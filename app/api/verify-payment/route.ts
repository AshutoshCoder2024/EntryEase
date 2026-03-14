import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTicketEmail } from "@/lib/email";
import { nanoid } from "nanoid";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { registrationId } = await req.json();
    if (!registrationId) {
      return NextResponse.json(
        { error: "registrationId is required" },
        { status: 400 }
      );
    }

    const { data: row, error: fetchError } = await supabase
      .from("event_registrations")
      .select("*")
      .eq("id", registrationId)
      .single();

    if (fetchError || !row) {
      console.error("[verify-payment] Registration not found:", fetchError?.message ?? registrationId);
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    if (row.payment_status === "verified") {
      return NextResponse.json(
        { error: "Payment already verified", ticketId: row.ticket_id },
        { status: 400 }
      );
    }

    if (row.payment_status === "rejected") {
      return NextResponse.json(
        { error: "Payment was rejected" },
        { status: 400 }
      );
    }

    const { count } = await supabase
      .from("event_registrations")
      .select("ticket_id", { count: "exact", head: true })
      .not("ticket_id", "is", null);

    const ticketId = `EVT-${nanoid(10).toUpperCase()}`;

    const { error: updateError } = await supabase
      .from("event_registrations")
      .update({
        payment_status: "verified",
        ticket_id: ticketId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", registrationId);

    if (updateError) {
      console.error("[verify-payment] Failed to update registration:", updateError.message);
      return NextResponse.json(
        { error: "Failed to update registration" },
        { status: 500 }
      );
    }

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

    console.log("[verify-payment] Ticket email sent to:", row.email, "ticketId:", ticketId);
    return NextResponse.json({
      success: true,
      ticketId,
      email: row.email,
      emailSent: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[verify-payment] Error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
