import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ROBOTICS_EVENT_CAPACITY } from "@/lib/event-config";
import { validateRegistrationInput, type RegistrationInput } from "@/lib/registration-validation";
import { checkRateLimit, getRegistrationRateLimitConfig } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";

/** Honeypot / bot fields — must be empty */
function isBotPayload(body: Record<string, unknown>): boolean {
  const honeypots = ["website", "url", "company", "_gotcha"];
  for (const k of honeypots) {
    const v = body[k];
    if (typeof v === "string" && v.trim().length > 0) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { limit, windowMs } = getRegistrationRateLimitConfig();
    const rl = checkRateLimit(`register:${ip}`, limit, windowMs);

    const headers = new Headers();
    headers.set("X-RateLimit-Limit", String(rl.limit));
    headers.set("X-RateLimit-Remaining", String(Math.max(0, rl.remaining)));
    headers.set("X-RateLimit-Reset", String(Math.ceil(rl.resetAt / 1000)));

    if (!rl.ok) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      headers.set("Retry-After", String(retryAfter));
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429, headers }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers });
    }

    if (isBotPayload(body)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400, headers });
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
      return NextResponse.json(
        { error: "Validation failed", errors: validated.errors },
        { status: 422, headers }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error("[register] SUPABASE_SERVICE_ROLE_KEY missing");
      return NextResponse.json(
        { error: "Registration is temporarily unavailable." },
        { status: 503, headers }
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
      console.error("[register] Insert failed:", insertError.code, insertError.message);
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "This UTR (or another unique field) is already registered. If you paid twice, contact support with both UTRs.",
          },
          { status: 409, headers }
        );
      }
      return NextResponse.json(
        { error: "Could not create registration. Please try again." },
        { status: 500, headers }
      );
    }

    if (!inserted) {
      return NextResponse.json({ error: "Could not create registration." }, { status: 500, headers });
    }

    return NextResponse.json({ ok: true, id: inserted.id }, { status: 201, headers });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
