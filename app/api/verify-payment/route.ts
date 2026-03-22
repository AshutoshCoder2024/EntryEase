import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { sendTicketEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ROBOTICS_EVENT_CAPACITY } from "@/lib/event-config";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";

const TICKET_PREFIX = "EVT-";

function parseRegistrationId(body: unknown): number | null {
  if (body === null || typeof body !== "object") return null;
  const id = (body as { registrationId?: unknown }).registrationId;
  if (typeof id === "number" && Number.isInteger(id) && id > 0) return id;
  if (typeof id === "string" && /^\d+$/.test(id)) {
    const n = Number(id);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    if (!verifyAdminSessionToken(sessionToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error("[verify-payment] SUPABASE_SERVICE_ROLE_KEY or URL missing");
      return NextResponse.json(
        { error: "Server misconfigured: missing Supabase service credentials" },
        { status: 500 }
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const registrationId = parseRegistrationId(json);
    if (registrationId === null) {
      return NextResponse.json(
        { error: "registrationId must be a positive integer" },
        { status: 400 }
      );
    }

    const { data: row, error: fetchError } = await supabase
      .from("event_registrations")
      .select(
        "id, email, name, payment_status, ticket_id"
      )
      .eq("id", registrationId)
      .single();

    if (fetchError || !row) {
      console.error("[verify-payment] Registration not found:", fetchError?.message ?? registrationId);
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    if (row.payment_status === "verified" && row.ticket_id) {
      return NextResponse.json({
        success: true,
        ticketId: row.ticket_id,
        email: row.email,
        emailSent: false,
        alreadyVerified: true,
      });
    }

    if (row.payment_status === "verified") {
      return NextResponse.json(
        { error: "Payment already verified", ticketId: row.ticket_id },
        { status: 400 }
      );
    }

    if (row.payment_status === "rejected") {
      return NextResponse.json({ error: "Payment was rejected" }, { status: 400 });
    }

    const { count: verifiedCount, error: countError } = await supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("payment_status", "verified");

    if (countError) {
      console.error("[verify-payment] Capacity count failed:", countError.message);
      return NextResponse.json({ error: "Could not verify event capacity" }, { status: 500 });
    }

    const used = verifiedCount ?? 0;
    if (used >= ROBOTICS_EVENT_CAPACITY) {
      return NextResponse.json(
        { error: "Event is full — cannot verify more payments" },
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
      console.error("[verify-payment] Update failed:", updateError.message);
      return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
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
          email: row.email,
          emailSent: false,
          alreadyVerified: true,
        });
      }

      return NextResponse.json(
        { error: "Could not verify — registration may have changed. Refresh and try again." },
        { status: 409 }
      );
    }

    ticketId = updated.ticket_id;

    const emailResult = await sendTicketEmail({
      to: row.email,
      studentName: row.name,
      ticketId,
    });

    if (!emailResult.success) {
      console.error("[verify-payment] Email send failed:", emailResult.error);
      return NextResponse.json({
        success: true,
        ticketId,
        email: row.email,
        emailSent: false,
        emailError: emailResult.error,
      });
    }

    return NextResponse.json({
      success: true,
      ticketId,
      email: row.email,
      emailSent: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[verify-payment] Error:", message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
