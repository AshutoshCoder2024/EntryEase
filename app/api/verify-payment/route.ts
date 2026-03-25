import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { z } from "zod";
import { sendTicketEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ROBOTICS_EVENT_CAPACITY } from "@/lib/event-config";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";
import { checkRateLimit, getRegistrationRateLimitConfig } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";

const TICKET_PREFIX = "EVT-";

const RegistrationIdSchema = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  return v;
}, z.number().int().positive());

const VerifyPaymentSchema = z
  .object({
    registrationId: RegistrationIdSchema,
  })
  .strip();

function fingerprintFromReq(req: NextRequest): string {
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 200);
  const acceptLang = (req.headers.get("accept-language") ?? "").slice(0, 100);
  return createHash("sha256").update(`${ua}|${acceptLang}`).digest("hex").slice(0, 16);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    const MAX_BODY_BYTES = Math.max(
      2048,
      Math.min(8192, Number(process.env.VERIFY_PAYMENT_MAX_BODY_BYTES ?? "4096"))
    );
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Invalid request" }, { status: 413 });
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    if (!verifyAdminSessionToken(sessionToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Anti-spam (admin-only endpoint still needs protection).
    const ip = getClientIp(req);
    const fp = fingerprintFromReq(req);
    const { limit, windowMs } = getRegistrationRateLimitConfig();
    const rl = checkRateLimit(`verify-payment:${ip}:${fp}`, Math.max(1, Math.floor(limit / 2)), windowMs);
    const cooldownMs = Math.max(
      10_000,
      Math.min(180_000, Number(process.env.VERIFY_PAYMENT_COOLDOWN_MS ?? "30000"))
    );
    const cooldown = checkRateLimit(`verify-payment-cooldown:${ip}:${fp}`, 1, cooldownMs);

    if (!rl.ok || !cooldown.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error("[verify-payment] missing supabase admin client");
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    let body: unknown;
    try {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Invalid request" }, { status: 413 });
      }
      const text = new TextDecoder().decode(buf);
      body = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const parsed = VerifyPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const registrationId = parsed.data.registrationId;

    const { data: row, error: fetchError } = await supabase
      .from("event_registrations")
      .select(
        "id, email, name, payment_status, ticket_id"
      )
      .eq("id", registrationId)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: "Invalid registration" }, { status: 404 });
    }

    if (row.payment_status === "verified" && row.ticket_id) {
      return NextResponse.json({
        success: true,
        ticketId: row.ticket_id,
        emailSent: false,
        alreadyVerified: true,
      });
    }

    if (row.payment_status === "verified") {
      // Should not happen in normal flow, but keep the response shape stable.
      return NextResponse.json(
        {
          success: true,
          ticketId: row.ticket_id ?? null,
          emailSent: false,
          alreadyVerified: true,
        },
        { status: 200 }
      );
    }

    if (row.payment_status === "rejected") {
      return NextResponse.json({ error: "Invalid registration" }, { status: 400 });
    }

    const { count: verifiedCount, error: countError } = await supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("payment_status", "verified");

    if (countError) {
      console.error("[verify-payment] capacity count failed");
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const used = verifiedCount ?? 0;
    if (used >= ROBOTICS_EVENT_CAPACITY) {
      return NextResponse.json(
        { error: "Event is full" },
        { status: 409 }
      );
    }

    let ticketId = `${TICKET_PREFIX}${nanoid(10).toUpperCase()}`;

    const { data: updated, error: updateError } = await supabase
      .from("event_registrations")
      .update({
        payment_status: "verified",
        ticket_id: ticketId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", registrationId)
      .eq("payment_status", "pending")
      .select("ticket_id")
      .maybeSingle();

    if (updateError) {
      console.error("[verify-payment] update failed");
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    if (!updated?.ticket_id) {
      const { data: again } = await supabase
        .from("event_registrations")
        .select("ticket_id, payment_status")
        .eq("id", registrationId)
        .single();

      if (again?.payment_status === "verified" && again.ticket_id) {
        return NextResponse.json({
          success: true,
          ticketId: again.ticket_id,
          emailSent: false,
          alreadyVerified: true,
        });
      }

      return NextResponse.json({ error: "Could not verify request" }, { status: 409 });
    }

    ticketId = updated.ticket_id;

    const emailResult = await sendTicketEmail({
      to: row.email,
      studentName: row.name,
      ticketId,
    });

    if (!emailResult.success) {
      return NextResponse.json({
        success: true,
        ticketId,
        emailSent: false,
      });
    }

    return NextResponse.json({
      success: true,
      ticketId,
      emailSent: true,
    });
  } catch (err) {
    console.error("[verify-payment] unhandled_error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
