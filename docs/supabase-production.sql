-- Optional Supabase / Postgres hardening for XTS event registration
-- Run in SQL Editor after reviewing your schema.

-- Faster lookups for common filters (adjust table name if different)
CREATE INDEX IF NOT EXISTS idx_event_registrations_payment_status
  ON public.event_registrations (payment_status);

CREATE INDEX IF NOT EXISTS idx_event_registrations_ticket_id
  ON public.event_registrations (ticket_id)
  WHERE ticket_id IS NOT NULL;

-- =========================
-- Row Level Security (RLS)
-- =========================
-- Goal:
-- - Registrations must be written only via server route `POST /api/register`
--   using Supabase service role (never from browser/anon).
-- - Scanner/admin pages may need anon SELECT and a restricted UPDATE to mark a
--   ticket as "used".
--
-- IMPORTANT:
-- Adjust policies based on whether you later refactor admin scanner to use
-- server-side endpoints. If you do, you can tighten anon UPDATE further or remove it.

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Block anon inserts (prevents direct client-side registration writes).
-- Service role bypasses RLS, so `POST /api/register` still works.
CREATE POLICY IF NOT EXISTS "anon_no_insert_registrations"
  ON public.event_registrations
  FOR INSERT
  TO anon
  WITH CHECK (false);

-- Allow anon reads (admin dashboard + scanner currently read from the browser).
CREATE POLICY IF NOT EXISTS "anon_select_registrations"
  ON public.event_registrations
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon to mark verified tickets as "used" only.
-- This restricts updates to the intended workflow.
CREATE POLICY IF NOT EXISTS "anon_mark_ticket_used"
  ON public.event_registrations
  FOR UPDATE
  TO anon
  USING (payment_status = 'verified' AND entry_status <> 'used')
  WITH CHECK (entry_status = 'used');

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
