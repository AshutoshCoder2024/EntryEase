import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://YOUR-PROJECT-ID.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "YOUR_PUBLIC_ANON_KEY";

export {
  ROBOTICS_EVENT_NAME,
  ROBOTICS_EVENT_CAPACITY,
  REGISTRATION_FEE,
} from "./event-config";

/** Your UPI ID for payments (e.g. yourname@paytm / phonepe). Displayed on registration page. */
export const UPI_ID = "ashutoshsahu9601@okicici"; // TODO: replace with your UPI ID

/** Support contact shown on the registration page (Need Help section). */
export const SUPPORT_CONTACT_NAME = "Event Support";
export const SUPPORT_PHONE = "9876543210";
export const SUPPORT_EMAIL = "robotics.support@college.edu";
export const SUPPORT_HOURS = "Mon–Sat · 10:00 AM – 6:00 PM IST";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

