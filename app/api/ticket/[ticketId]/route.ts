import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getClientIp } from "@/lib/get-client-ip";
import { checkRateLimit } from "@/lib/rate-limit";

/** Matches tickets from verify-payment: EVT- + nanoid(10).toUpperCase() (URL-safe alphabet A–Z, 0–9, _, -) */
const TICKET_ID_PATTERN = /^EVT-[A-Z0-9_-]{10}$/;

/**
 * Public ticket lookup (no auth). The ticket ID in the URL is the capability token.
 * Uses service role so the page works even when anon has no SELECT on event_registrations.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ ticketId: string }> }
) {
  const ip = getClientIp(_req);
  // Brute-force protection: generous limit for normal refreshes / QR loads
  const rl = checkRateLimit(`ticket-view:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { ticketId: raw } = await context.params;
  const ticketId = decodeURIComponent(raw ?? "").trim();

  if (!TICKET_ID_PATTERN.test(ticketId)) {
    return NextResponse.json({ error: "Invalid ticket link" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: row, error } = await supabase
    .from("event_registrations")
    .select("ticket_id, name, email, phone, department, entry_status, payment_status")
    .eq("ticket_id", ticketId)
    .maybeSingle();

  if (error) {
    console.error("[api/ticket]", error.message);
    return NextResponse.json({ error: "Could not load ticket" }, { status: 500 });
  }

  if (!row || row.payment_status !== "verified") {
    return NextResponse.json({ error: "Invalid or unavailable ticket" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ticket: {
        ticket_id: row.ticket_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        department: row.department,
        entry_status: row.entry_status,
      },
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
