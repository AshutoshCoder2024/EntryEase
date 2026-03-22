import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ROBOTICS_EVENT_CAPACITY } from "@/lib/event-config";

/**
 * Public capacity snapshot (verified registrations vs cap).
 * Uses service role so the anon key does not need SELECT on the table.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Unavailable", remaining: null, capacity: ROBOTICS_EVENT_CAPACITY },
      { status: 503 }
    );
  }

  const { count, error } = await supabase
    .from("event_registrations")
    .select("*", { count: "exact", head: true })
    .eq("payment_status", "verified");

  if (error) {
    console.error("[event/capacity]", error.message);
    return NextResponse.json(
      { error: "Could not load capacity", remaining: null, capacity: ROBOTICS_EVENT_CAPACITY },
      { status: 500 }
    );
  }

  const used = count ?? 0;
  const remaining = Math.max(ROBOTICS_EVENT_CAPACITY - used, 0);

  return NextResponse.json(
    { remaining, capacity: ROBOTICS_EVENT_CAPACITY, used },
    {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
      },
    }
  );
}
