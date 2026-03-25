import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ROBOTICS_EVENT_CAPACITY } from "@/lib/event-config";
import { validateRegistrationInput, type RegistrationInput } from "@/lib/registration-validation";
import { checkRateLimit, getRegistrationRateLimitConfig } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";
import { createHash } from "crypto";

/** Honeypot / bot fields — must be empty */
function isBotPayload(body: Record<string, unknown>): boolean {
  const honeypots = ["website", "url", "company", "_gotcha"];
  for (const k of honeypots) {
    const v = body[k];
    if (typeof v === "string" && v.trim().length > 0) return true;
  }
  return false;
}

function hashFingerprint(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function safeClientIp(req: NextRequest): string {
  return getClientIp(req);
}

const MAX_BODY_BYTES = Math.max(
  4096,
  Math.min(65536, Number(process.env.REGISTRATION_MAX_BODY_BYTES ?? "16384"))
);

export const maxDuration = 10; // seconds

export async function POST(req: NextRequest) {
  try {
    const ip = safeClientIp(req);
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Basic payload-size protection before JSON parsing.
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Invalid request" }, { status: 413 });
    }

    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Invalid request" }, { status: 413 });
    }

    let json: unknown;
    try {
      const text = new TextDecoder().decode(buf);
      json = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (json === null || typeof json !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const body = json as Record<string, unknown>;

    if (isBotPayload(body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Rate limiting:
    // - fixed window to cap spam volume
    // - per-fingerprint cooldown to slow burst attempts
    const { limit, windowMs } = getRegistrationRateLimitConfig();
    const ua = (req.headers.get("user-agent") ?? "").slice(0, 200);
    const acceptLang = (req.headers.get("accept-language") ?? "").slice(0, 100);
    const fp = hashFingerprint(`${ua}|${acceptLang}`);

    const rl = checkRateLimit(`register:${ip}:${fp}`, limit, windowMs);
    const cooldownMs = Math.max(
      10_000,
      Math.min(180_000, Number(process.env.REGISTRATION_COOLDOWN_MS ?? "30000"))
    );
    const cooldown = checkRateLimit(`register-cooldown:${ip}:${fp}`, 1, cooldownMs);

    const headers = new Headers();
    headers.set("X-RateLimit-Limit", String(rl.limit));
    headers.set("X-RateLimit-Remaining", String(Math.max(0, rl.remaining)));
    headers.set("X-RateLimit-Reset", String(Math.ceil(rl.resetAt / 1000)));

    if (!rl.ok) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      headers.set("Retry-After", String(retryAfter));

      // Don’t log personal data; only log coarse metadata.
      console.warn("[register] rate_limited", { ip, fp, remaining: rl.remaining });
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers }
      );
    }

    if (!cooldown.ok) {
      const retryAfter = Math.max(1, Math.ceil((cooldown.resetAt - Date.now()) / 1000));
      headers.set("Retry-After", String(retryAfter));
      console.warn("[register] cooldown_hit", { ip, fp });
      return NextResponse.json(
        { error: "Please wait a moment before submitting again." },
        { status: 429, headers }
      );
    }

    const input: RegistrationInput = {
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      department: body.department,
      year: body.year,
      rollNumber: body.rollNumber,
      utrNumber: body.utrNumber,
      agreeInfo: body.agreeInfo,
      agreeRules: body.agreeRules,
    };

    const validated = validateRegistrationInput(input);
    if (!validated.ok) {
      // Don’t expose field-level validation errors to attackers.
      console.warn("[register] validation_failed", { ip, fp, keys: Object.keys(validated.errors) });
      return NextResponse.json({ error: "Invalid input." }, { status: 422, headers });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error("[register] missing supabase admin client");
      return NextResponse.json(
        { error: "Registration is temporarily unavailable." },
        { status: 503, headers }
      );
    }

    // Abuse prevention (duplicate submissions from same identity/IP):
    // Block if the same UTR already exists, or if user recently submitted (pending/verified).
    const now = Date.now();
    const identityWindowMs = Math.max(
      60_000,
      Math.min(900_000, Number(process.env.REGISTRATION_DUPLICATE_WINDOW_MS ?? "600000")) // default 10 min
    );
    const cutoffIso = new Date(now - identityWindowMs).toISOString();

    // 1) UTR reuse
    const { data: utrExisting, error: utrErr } = await supabase
      .from("event_registrations")
      .select("id,payment_status")
      .eq("utr_number", validated.data.utr_number)
      .limit(1);
    if (utrErr) {
      console.error("[register] utr reuse check failed");
    } else if (utrExisting && utrExisting.length > 0) {
      return NextResponse.json(
        { error: "We already received your registration. Please wait for verification." },
        { status: 409, headers }
      );
    }

    // 2) Recent email/phone submissions
    const recentByEmail = await supabase
      .from("event_registrations")
      .select("id,payment_status")
      .eq("email", validated.data.email)
      .in("payment_status", ["pending", "verified"])
      .gte("created_at", cutoffIso)
      .limit(1);
    if (recentByEmail.error) {
      console.error("[register] recent email check failed");
    } else if (recentByEmail.data && recentByEmail.data.length > 0) {
      return NextResponse.json(
        { error: "We already received your registration. Please wait for verification." },
        { status: 409, headers }
      );
    }

    const recentByPhone = await supabase
      .from("event_registrations")
      .select("id,payment_status")
      .eq("phone", validated.data.phone)
      .in("payment_status", ["pending", "verified"])
      .gte("created_at", cutoffIso)
      .limit(1);
    if (recentByPhone.error) {
      console.error("[register] recent phone check failed");
    } else if (recentByPhone.data && recentByPhone.data.length > 0) {
      return NextResponse.json(
        { error: "We already received your registration. Please wait for verification." },
        { status: 409, headers }
      );
    }

    const { count: verifiedCount, error: countError } = await supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("payment_status", "verified");

    if (countError) {
      console.error("[register] Capacity check failed:", countError.message);
      return NextResponse.json({ error: "Could not verify event capacity." }, { status: 500, headers });
    }

    if (typeof verifiedCount === "number" && verifiedCount >= ROBOTICS_EVENT_CAPACITY) {
      return NextResponse.json(
        { error: "Registration Closed — Event Full." },
        { status: 409, headers }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("event_registrations")
      .insert({
        name: validated.data.name,
        email: validated.data.email,
        phone: validated.data.phone,
        department: validated.data.department,
        year: validated.data.year,
        roll_number: validated.data.roll_number,
        utr_number: validated.data.utr_number,
        ticket_id: null,
        payment_status: "pending",
        entry_status: "not_used",
      })
      .select("id")
      .single();

    if (insertError) {
      // Avoid logging insertError.message because it can contain constraint details.
      console.error("[register] insert_failed", { ip, fp, code: insertError.code });
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error: "We already received your registration. Please wait for verification.",
          },
          { status: 409, headers }
        );
      }
      return NextResponse.json(
        { error: "Could not create registration." },
        { status: 500, headers }
      );
    }

    if (!inserted) {
      return NextResponse.json({ error: "Could not create registration." }, { status: 500, headers });
    }

    return NextResponse.json({ ok: true, id: inserted.id }, { status: 201, headers });
  } catch (e) {
    // Don’t leak internals to clients.
    console.error("[register] unhandled_error", e);
    return NextResponse.json({ error: "Could not process registration." }, { status: 500 });
  }
}
