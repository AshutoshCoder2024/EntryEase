import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getClientIp } from "@/lib/get-client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { createHash } from "crypto";
import { z } from "zod";

/** Matches tickets from verify-payment: EVT- + nanoid(10).toUpperCase() (URL-safe alphabet A–Z, 0–9, _, -) */
const TICKET_ID_PATTERN = /^EVT-[A-Z0-9_-]{10}$/;
const TicketIdSchema = z.string().regex(TICKET_ID_PATTERN);

function fingerprintFromReq(req: NextRequest): string {
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 200);
  const acceptLang = (req.headers.get("accept-language") ?? "").slice(0, 100);
  return createHash("sha256").update(`${ua}|${acceptLang}`).digest("hex").slice(0, 16);
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = String(email).trim();
  const at = e.indexOf("@");
  if (at <= 1 || at === e.length - 1) return null;
  const user = e.slice(0, at);
  const domain = e.slice(at + 1);
  const head = user.slice(0, 2);
  return `${head}***@${domain}`;
}

/**
 * Public ticket lookup (no auth). The ticket ID in the URL is the capability token.
 * Uses service role so the page works even when anon has no SELECT on event_registrations.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ ticketId: string }> }
) {
  const ip = getClientIp(_req);
  const fp = fingerprintFromReq(_req);
  // Brute-force protection: generous limit for normal refreshes / QR loads.
  // Include a small fingerprint to reduce UA-bot amplification.
  const rl = checkRateLimit(`ticket-view:${ip}:${fp}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { ticketId: raw } = await context.params;
  const ticketId = decodeURIComponent(raw ?? "").trim();

  const parsedTicketId = TicketIdSchema.safeParse(ticketId);
  if (!parsedTicketId.success) {
    return NextResponse.json({ error: "Invalid ticket link" }, { status: 400 });
  }
  const safeTicketId = parsedTicketId.data;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: row, error } = await supabase
    .from("event_registrations")
    .select("ticket_id, name, email, department, entry_status, payment_status")
    .eq("ticket_id", safeTicketId)
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
        ticket_id: String(row.ticket_id),
        name: String(row.name),
        email_masked: maskEmail(row.email),
        department: row.department ? String(row.department) : null,
        entry_status: String(row.entry_status),
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
