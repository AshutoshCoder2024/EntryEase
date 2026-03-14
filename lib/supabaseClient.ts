import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://YOUR-PROJECT-ID.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "YOUR_PUBLIC_ANON_KEY";

export const ROBOTICS_EVENT_NAME = "Robotics Challenge 2026";
export const ROBOTICS_EVENT_CAPACITY = 150;
export const REGISTRATION_FEE = 199;

/** Your UPI ID for payments (e.g. yourname@paytm / phonepe). Displayed on registration page. */
export const UPI_ID = "ashutosh@paytm"; // TODO: replace with your UPI ID

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Generate next ticket ID for verified registrations only. */
export async function generateTicketId() {
  const { count, error } = await supabase
    .from("event_registrations")
    .select("ticket_id", { count: "exact", head: true })
    .not("ticket_id", "is", null);

  if (error) {
    console.error("Failed to fetch ticket count", error);
    throw new Error("Unable to generate ticket ID. Please try again.");
  }

  const nextNumber = (count || 0) + 1;
  const padded = String(nextNumber).padStart(4, "0");
  return `EVT-2026-${padded}`;
}

