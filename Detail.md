# Event Registration (Living with AI) — Creator Master Notes

## 1) Purpose (plain but precise)
This project is a full-stack event registration system:

- Users submit registration details + UTR (payment transaction id).
- The backend stores a **pending** registration in Supabase.
- Admin verifies the payment, then generates a **public QR ticket** (capability token) and emails it to the user.
- Visitors open the ticket link, view the QR ticket, and (optionally) download it.
- At the event entrance, admins scan QR codes to mark tickets as **used**.

The core design is: **registration (pending) → admin verification (verified + ticket id) → public ticket capability (QR) → admin scan (used)**.

## 2) End-to-end architecture & flow (working step-by-step)

### Frontend routes
1. `app/page.tsx` — Registration form (client component).
   - Collects: name, email, phone, department/year, optional roll number, UTR.
   - Validates in-browser (then still validates server-side).
   - Submits via `POST /api/register`.

2. `app/pending/page.tsx` — Waiting screen.
   - Tells the user their UTR is being verified.

3. `app/ticket/[ticketId]/page.tsx` — Public digital pass.
   - Fetches ticket data from `GET /api/ticket/[ticketId]`.
   - Generates a QR code in the browser that encodes the ticket URL.

4. Admin UI
   - `app/admin/login/page.tsx` — password gate.
   - `app/admin/page.tsx` — dashboard listing registrations + “Verify” action.
   - `app/admin/scan/page.tsx` — camera-based QR scanner for entry.

### Backend API routes (Next.js route handlers)
1. `POST /api/register` (`app/api/register/route.ts`)
   - Service-role Supabase insert: creates a `pending` registration row.
   - Implements anti-spam: honeypot + IP/rate-limit + cooldown.
   - Enforces strict schema validation (Zod) and strips unknown fields.
   - Performs abuse prevention checks (duplicate UTR / recent submissions).

2. `GET /api/event/capacity` (`app/api/event/capacity/route.ts`)
   - Public capacity snapshot for UX (still service-role to avoid anon SELECT).

3. `POST /api/verify-payment` (`app/api/verify-payment/route.ts`)
   - Admin-only: requires an httpOnly cookie session.
   - Validates request body with Zod, rate limits admin attempts, and limits payload size.
   - Checks capacity and verifies a registration row from Supabase.
   - Updates registration to `verified`, generates `EVT-...` ticket id, sets `verified_at`.
   - Sends the confirmation email (`lib/email.ts`).

4. `GET /api/ticket/[ticketId]` (`app/api/ticket/[ticketId]/route.ts`)
   - Public capability lookup.
   - Validates ticket id format strictly (`EVT-[A-Z0-9_-]{10}`).
   - Rate limits ticket reads (IP + fingerprint).
   - Ensures payment status is `verified`.
   - Returns ticket metadata with masked email (no raw PII).

### Admin session flow
1. Admin login page calls `POST /api/admin/session` with admin password.
2. Server validates password against `ADMIN_PASSWORD` (or legacy env).
3. Server sets an httpOnly cookie `admin_session` signed with HMAC (`lib/admin-session.ts`).
4. Admin pages call `GET /api/admin/session` to verify the cookie.
5. Admin verification uses the same cookie to gate `POST /api/verify-payment`.

## 3) Major components/modules & how they interact

### `lib/`
- `lib/event-config.ts`
  - Central constants for event name/capacity/fee.
  - Drives UI headings and email/ticket header.

- `lib/supabaseClient.ts`
  - Creates a **browser-safe** Supabase client using anon key.
  - Used by admin dashboard/scan pages for reads/updates (depending on RLS).

- `lib/supabase-admin.ts`
  - Creates a **service-role** Supabase client used only by server routes.
  - Writes happen here (e.g. `POST /api/register`, `POST /api/verify-payment`).

- `lib/admin-session.ts`
  - HMAC-signed, expiring session token for admin in an httpOnly cookie.
  - Avoids exposing the admin password in the client bundle.

- `lib/rate-limit.ts` and `lib/get-client-ip.ts`
  - Fixed-window in-memory rate limiting.
  - Uses IP (and in some endpoints a hashed UA fingerprint).

- `lib/registration-validation.ts`
  - Zod strict schema for registration form.
  - Normalizes/sanitizes free text.
  - Strips unknown fields.
  - Defends against malformed payloads and common injection patterns.

- `lib/email.ts`
  - Builds and sends the ticket email after admin verification.
  - Escapes HTML inputs.
  - Builds a link using `NEXT_PUBLIC_BASE_URL` (must be real production URL).

### `app/`
- `app/page.tsx` registration UX -> `POST /api/register`.
- `app/pending/page.tsx` status page.
- `app/api/*` route handlers enforce trust boundaries.
- `app/ticket/[ticketId]/page.tsx` consumes `GET /api/ticket/[ticketId]`.
- `app/admin/*` consumes admin session and triggers `POST /api/verify-payment`.

## 4) Technology choices (and why they fit)

- **Next.js App Router**: single repository for frontend + backend endpoints.
- **Supabase**: fast database + admin workflows + RLS model that fits “server vs client capabilities”.
- **Service role on server**: keeps secrets off the browser bundle and centralizes writes.
- **httpOnly cookie session** for admin: reduces token theft and avoids exposing bearer tokens to XSS.
- **Nodemailer**: pragmatic email delivery without building a separate email service.
- **Zod**: prevents “validation drift” and makes strict schema enforcement explicit.
- **NanoID**: generates unpredictable ticket identifiers.
- **QR + scanner libraries**:
  - `qrcode` for browser-side generation/download.
  - `html5-qrcode` for camera decoding during entry.

## 5) Strengths (what’s legitimately good)

- Clear trust boundaries: most critical writes are done from server routes using service role.
- Admin access is gated with a signed httpOnly cookie session.
- Public ticket links are capability tokens validated strictly by format.
- Sensitive info reduction:
  - Ticket endpoint returns masked email only.
  - Avoids leaking field-by-field validation errors.
- Email template escapes dynamic values (reduces HTML injection risk).
- Anti-spam exists beyond a single knob:
  - honeypot fields + rate limiting + cooldown + duplicate checks.

## 6) Weaknesses & real-world risks (be honest)

1. **RLS and anon update risk**
   - The admin scanner currently updates `entry_status` from the browser using the anon client.
   - This is safe only if Supabase RLS policies are correctly configured to prevent marking arbitrary tickets as used.
   - If you misconfigure policies, you create a direct abuse path.

2. **`dangerouslySetInnerHTML` remains in admin scanner**
   - Even with escaping, rendering HTML strings is still a footgun.
   - Safer pattern: use React elements (no HTML injection) or a strict sanitizer.

3. **Capacity checks are not fully transactional**
   - Under concurrency, “check then insert/update” can overshoot without a DB-level invariant.
   - Postgres-level constraints or a single RPC transaction is the production-grade fix.

4. **In-memory rate limiter**
   - Works for small scale but breaks down across multiple server instances (or serverless cold starts).
   - For production at scale, use Redis/Upstash.

5. **CSRF considerations**
   - Admin endpoints use cookies.
   - SameSite=lax helps but isn’t a complete CSRF defense.
   - Production hardening should add CSRF tokens or custom header requirements.

6. **PII storage model**
   - UTR and phone/email are stored in plaintext.
   - That may be acceptable for an event system, but real privacy/security requirements might demand hashing/encryption and data retention rules.

## 7) Predict what you’ll face in production

### Deploying
- Environment variables mismatch is the #1 failure:
  - `NEXT_PUBLIC_BASE_URL` must match the real domain, or email links break.
  - `SUPABASE_SERVICE_ROLE_KEY` / URL must exist server-side.
  - SMTP credentials must be correct; Gmail App Password mistakes are common.

- Vercel “Deployment Protection” can block public ticket links.

### Scaling to many users
- Your in-memory limiter becomes uneven across instances.
- Email volume can spike; SMTP throttling/deliverability may slow verification flow.
- Capacity oversubscription becomes more likely without a DB transaction.

### Maintaining long-term
- Schema changes require coordinated updates:
  - `event_registrations` columns and the Zod schema mapping.
- Admin workflows are operationally critical; regressions show up during entry day.

### Security & edge cases
- QR payload injection attempts.
- Admin “verify” spam (multiple clicks / parallel requests).
- Duplicate/partial submissions (same email/phone/UTR).
- Scanner marking tickets as used if RLS is weak.

## 8) Improvements to reach “production-level”

Priority improvements (highest ROI):
1. **Move scanner write to a server endpoint**
   - Avoid anon UPDATE from the browser.
   - Scanner calls a protected endpoint with session or a scoped token.

2. **Replace in-memory rate limiter with Redis-backed**
   - Upstash or your own Redis in production.

3. **Make capacity checks transactional**
   - Use a Postgres function/RPC:
     - “if remaining seats exist, atomically create pending row or transition state”.

4. **Add CSRF protection for admin cookie endpoints**
   - CSRF token per session + validation on POST.
   - Or require `X-Requested-With` / custom header and verify origin.

5. **Remove `dangerouslySetInnerHTML`**
   - Render status/detail with typed React nodes.

6. **Harden Supabase policies**
   - Write a “policy contract” checklist and verify it in Supabase SQL.

7. **Add audit logs**
   - Record admin verify/scan events (only metadata).

## 9) Interview questions you can expect

- Explain the trust boundaries in your system. Where do you validate data?
- How does Supabase RLS interact with service-role usage?
- What is a capability token and why do ticket links use it?
- How do you prevent brute-force enumeration of tickets?
- How does your rate limiting work and where does it fail at scale?
- What would you change to make capacity checks fully correct under concurrency?
- How do you protect admin endpoints from CSRF?
- How do you prevent XSS in places where you render QR-derived strings?
- How would you test this end-to-end (unit + integration + e2e)?

## 10) How to present this to a recruiter/client (confidence script)

Recommended narrative:

1. “I built an event registration + QR ticketing system on Next.js and Supabase.”
2. “Users submit registration to a server route; the server validates strictly and writes with service-role.”
3. “Admin verification is gated by a signed httpOnly cookie session. Verification generates a ticket token and emails it.”
4. “Ticket pages are public capability-token lookups; I validate the token format and rate-limit reads.”
5. “Security-wise, I use strict schema validation, anti-spam controls, generic error responses, PII minimization, and (when configured) Supabase RLS.”
6. “Operationally, I optimized UX for pending states, added admin QR scanning, and included deployment docs.”

Talk about trade-offs you made:
- Quick build vs full transactional correctness (and how you’d upgrade).
- Browser anon updates vs moving to server endpoints for tighter control.
- In-memory rate limiting vs Redis-backed.

## Appendix: Key files to remember
- `app/page.tsx` (register)
- `app/api/register/route.ts`
- `app/api/verify-payment/route.ts`
- `app/api/ticket/[ticketId]/route.ts`
- `app/admin/login/page.tsx`, `app/admin/page.tsx`, `app/admin/scan/page.tsx`
- `lib/registration-validation.ts`, `lib/admin-session.ts`, `lib/email.ts`, `lib/rate-limit.ts`

