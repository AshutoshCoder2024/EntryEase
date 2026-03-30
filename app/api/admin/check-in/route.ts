import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";
import { isTrustedAdminPost } from "@/lib/csrf";

const TicketIdSchema = z.string().trim().regex(/^EVT-[A-Z0-9_-]{10}$/);

const CheckInSchema = z
  .object({
    ticketId: TicketIdSchema,
  })
  .strip();

export async function POST(req: NextRequest) {
  try {
    if (!isTrustedAdminPost(req)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    if (!verifyAdminSessionToken(sessionToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const body = (await req.json()) as unknown;
    const parsed = CheckInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ticket" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server unavailable" }, { status: 503 });
    }

    const ticketId = parsed.data.ticketId;
    const { data, error } = await supabase
      .from("event_registrations")
      .select("ticket_id, name, payment_status, entry_status")
      .eq("ticket_id", ticketId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ status: "invalid" }, { status: 404 });
    }

    if (data.payment_status !== "verified") {
      return NextResponse.json({ status: "not_verified", ticketId }, { status: 409 });
    }

    if (data.entry_status === "used") {
      return NextResponse.json({ status: "already_used", ticketId, name: data.name ?? null }, { status: 200 });
    }

    const { error: updateError } = await supabase
      .from("event_registrations")
      .update({ entry_status: "used" })
      .eq("ticket_id", ticketId)
      .eq("payment_status", "verified")
      .eq("entry_status", "not_used");

    if (updateError) {
      return NextResponse.json({ error: "Could not check in ticket" }, { status: 500 });
    }

    return NextResponse.json({ status: "approved", ticketId, name: data.name ?? null }, { status: 200 });
  } catch (err) {
    console.error("[admin/check-in] unhandled_error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
