-- Optional Supabase / Postgres hardening for XTS event registration
-- Run in SQL Editor after reviewing your schema.

-- Faster lookups for common filters (adjust table name if different)
CREATE INDEX IF NOT EXISTS idx_event_registrations_payment_status
  ON public.event_registrations (payment_status);

CREATE INDEX IF NOT EXISTS idx_event_registrations_ticket_id
  ON public.event_registrations (ticket_id)
  WHERE ticket_id IS NOT NULL;

-- Prevent duplicate UTR per event (uncomment if utr_number should be unique)
-- ALTER TABLE public.event_registrations
--   ADD CONSTRAINT event_registrations_utr_unique UNIQUE (utr_number);

-- RLS: public registration + capacity APIs use the service role key server-side only.
-- After enabling RLS, you can deny anon INSERT/SELECT on this table and rely on API routes.
-- Example (adjust to your policy model):
-- ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Service role only" ON public.event_registrations
--   FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
-- (Supabase often uses service_role for API; verify with your admin dashboard and anon client needs.)

-- For strict capacity under high concurrency, enforce verified count in a SECURITY DEFINER
-- RPC instead of relying on app-level checks only (recommended for production scale).

-- Admin dashboard / scanner: if they use the anon key in the browser, grant SELECT/UPDATE
-- only for policies your app needs, or migrate those flows to authenticated API routes.
