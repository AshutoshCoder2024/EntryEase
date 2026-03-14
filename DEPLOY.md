# Deploy Guide – Event Registration System (Frontend + Backend + Admin)

This guide walks you through deploying the **full event registration website** to production. The app is a single Next.js project that includes:

- **Frontend**: Registration form, pending page, ticket page (QR download)
- **Backend**: API route for payment verification and email sending (Nodemailer + Supabase)
- **Admin**: Dashboard, login, and QR scanner for event entry

Everything deploys together to one host (e.g. **Vercel**). No separate backend server is required.

---

## Table of contents

1. [What gets deployed](#1-what-gets-deployed)
2. [Prerequisites](#2-prerequisites)
3. [Deploy to Vercel (recommended)](#3-deploy-to-vercel-recommended)
4. [Environment variables](#4-environment-variables)
5. [After first deploy](#5-after-first-deploy)
6. [Admin panel access](#6-admin-panel-access)
7. [Custom domain (optional)](#7-custom-domain-optional)
8. [Troubleshooting](#8-troubleshooting)
9. [Deployment checklist](#9-deployment-checklist)

---

## 1. What gets deployed

| Part | Description | URL (example) |
|------|-------------|---------------|
| **Registration** | Student sign-up form (UPI + UTR) | `https://your-app.vercel.app/` |
| **Pending** | “Waiting for verification” page | `https://your-app.vercel.app/pending` |
| **Ticket** | QR ticket view & download | `https://your-app.vercel.app/ticket/EVT-2026-0001` |
| **Admin login** | Password gate for admins | `https://your-app.vercel.app/admin/login` |
| **Admin dashboard** | Registrations table, Verify button | `https://your-app.vercel.app/admin` |
| **QR scanner** | Camera-based ticket scanner | `https://your-app.vercel.app/admin/scan` |
| **API** | Verify payment + send email | `https://your-app.vercel.app/api/verify-payment` (POST) |

All of the above are served by the same Next.js app. No separate frontend/backend deploy.

---

## 2. Prerequisites

Before deploying, ensure:

- [ ] **Supabase** project is set up:
  - Table `event_registrations` created (see [SETUP.md](../SETUP.md) or project SETUP.md).
  - Realtime enabled for `event_registrations`.
  - You have: **Project URL**, **anon key**, **service_role key**.
- [ ] **Email (Gmail SMTP)**:
  - Gmail address and [App Password](https://support.google.com/accounts/answer/185833) (or other SMTP credentials).
- [ ] **Code** is in a Git repository (GitHub, GitLab, or Bitbucket) so Vercel can connect it.
- [ ] **Admin password** decided (e.g. strong password for `NEXT_PUBLIC_ADMIN_PASSWORD`).
- [ ] **UPI**: `lib/supabaseClient.ts` has your `UPI_ID` and `public/upiqr.png` is your UPI QR image.

---

## 3. Deploy to Vercel (recommended)

Vercel runs Next.js natively and is free for small projects.

### Step 1: Create a Vercel account and import the project

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New… → Project**.
3. **Import** the Git repository that contains your event registration code.
4. If the repo has multiple folders, you will set the root in the next step.

### Step 2: Set the root directory

Your Next.js app lives inside the repo under **`Event-Registration`** (or the folder that contains `package.json`, `app/`, etc.).

1. In the import screen, find **Root Directory**.
2. Click **Edit**, set it to **`Event-Registration`** (or the correct folder name).
3. Leave **Framework Preset** as **Next.js** (auto-detected).

### Step 3: Add environment variables

Before deploying, add all required environment variables in Vercel:

1. In the same import screen, open **Environment Variables**.
2. Add each variable (name + value). Use **Production** (and optionally Preview) for each.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service_role key (for API) |
| `EMAIL_USER` | Yes | Gmail (or SMTP) email address |
| `EMAIL_PASS` | Yes | Gmail App Password or SMTP password |
| `NEXT_PUBLIC_BASE_URL` | Yes | **Production URL** (e.g. `https://your-app.vercel.app`) |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | Yes | Admin login password |

Optional (for non-Gmail or custom sender):

| Variable | Description |
|----------|-------------|
| `EMAIL_FROM` | Sender address (defaults to `EMAIL_USER`) |
| `EMAIL_HOST` | SMTP host (default: `smtp.gmail.com`) |
| `EMAIL_PORT` | SMTP port (default: `587`) |
| `EMAIL_SECURE` | Set to `true` for port 465 |

**Important:** Set `NEXT_PUBLIC_BASE_URL` to your **final production URL** (e.g. `https://your-app.vercel.app` or your custom domain). This is used in ticket links in emails and must match how users access the site.

### Step 4: Deploy

1. Click **Deploy**.
2. Wait for the build to finish. The first deploy may take 1–2 minutes.
3. When done, Vercel shows a URL like `https://your-project.vercel.app`.

### Step 5: Set production base URL (if you didn’t already)

If you used a placeholder for `NEXT_PUBLIC_BASE_URL`:

1. In Vercel: **Project → Settings → Environment Variables**.
2. Edit `NEXT_PUBLIC_BASE_URL` and set it to your live URL (e.g. `https://your-project.vercel.app`).
3. **Redeploy**: Deployments → … on latest deployment → **Redeploy** (so the new value is applied).

---

## 4. Environment variables

Summary for production (e.g. Vercel):

```env
# Supabase (from Supabase dashboard → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Email (Gmail SMTP – use App Password, not normal password)
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx

# Must be your production URL (no trailing slash)
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app

# Admin dashboard login (shared password)
NEXT_PUBLIC_ADMIN_PASSWORD=YourStrongAdminPassword123!
```

- Never commit `.env.local` or paste real keys into docs.
- For Gmail: [Create an App Password](https://support.google.com/accounts/answer/185833) and use it as `EMAIL_PASS`.

---

## 5. After first deploy

1. **Open the live URL** (e.g. `https://your-app.vercel.app`).
2. **Test registration**: Submit a test registration with a real email you can check.
3. **Test admin**: Go to `https://your-app.vercel.app/admin/login`, enter `NEXT_PUBLIC_ADMIN_PASSWORD`, then open the dashboard.
4. **Test verify**: In the admin dashboard, click **Verify** on the test registration. Check that:
   - The row becomes “verified” and gets a ticket ID.
   - The student receives the ticket email (inbox and spam).
   - The email link opens the ticket page with the QR code.
5. **Test scanner**: On a phone or laptop with camera, open **Scan QR Ticket** from the admin dashboard and scan the test ticket QR; first scan should show “Entry Successful”, second “Ticket Already Used”.

If anything fails, see [Troubleshooting](#8-troubleshooting).

---

## 6. Admin panel access

| Page | URL | Purpose |
|------|-----|--------|
| Admin login | `/admin/login` | Enter admin password (same for all organizers) |
| Admin dashboard | `/admin` | View registrations, verify payments (redirects to login if not authenticated) |
| QR ticket scanner | `/admin/scan` | Open camera to scan student QR codes at entrance |

**How to open admin:**

1. Go to `https://your-app.vercel.app/admin/login`.
2. Enter the password you set in `NEXT_PUBLIC_ADMIN_PASSWORD`.
3. You’ll be redirected to `/admin`. Use **Scan QR Ticket** to open the scanner.

Access is controlled only by the shared password (stored in env). Keep it strong and share only with organizers.

---

## 7. Custom domain (optional)

1. In Vercel: **Project → Settings → Domains**.
2. Add your domain (e.g. `events.yourcollege.edu`).
3. Follow Vercel’s instructions to add the DNS records (A/CNAME) at your domain provider.
4. After the domain is active, set `NEXT_PUBLIC_BASE_URL` to `https://events.yourcollege.edu` and redeploy so ticket links in emails use the custom domain.

---

## 8. Troubleshooting

### Build fails on Vercel

- Confirm **Root Directory** is set to the folder that contains `package.json` and the `app/` directory (e.g. `Event-Registration`).
- Check the build log for missing dependencies or TypeScript errors; fix in code and push again.

### Emails not received after verification

- Confirm **EMAIL_USER** and **EMAIL_PASS** are set in Vercel (and that you’re using a Gmail **App Password** if using Gmail).
- Check **Vercel → Project → Logs** (or **Functions**) for errors when calling the verify API.
- Ensure **NEXT_PUBLIC_BASE_URL** is the exact production URL (e.g. `https://your-app.vercel.app`); wrong base URL can break links but not sending itself.
- Look for “[verify-payment] Email send failed” or “[sendTicketEmail]” in logs to see SMTP errors.

### “Registration not found” or Supabase errors

- Verify **NEXT_PUBLIC_SUPABASE_URL**, **NEXT_PUBLIC_SUPABASE_ANON_KEY**, and **SUPABASE_SERVICE_ROLE_KEY** in Vercel.
- Ensure the `event_registrations` table exists and Realtime is enabled for it.

### Admin login says “Admin password is not configured”

- Add **NEXT_PUBLIC_ADMIN_PASSWORD** in Vercel (Environment Variables), then redeploy so the client bundle gets the new value.

### Ticket link in email is wrong or broken

- Set **NEXT_PUBLIC_BASE_URL** to the URL students actually use (e.g. `https://your-app.vercel.app` or your custom domain), then redeploy.

---

## 9. Deployment checklist

Use this before and after going live:

**Before deploy**

- [ ] Supabase project created; `event_registrations` table and Realtime configured
- [ ] All env vars ready (Supabase, EMAIL_USER, EMAIL_PASS, NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_ADMIN_PASSWORD)
- [ ] `UPI_ID` and `public/upiqr.png` set in the repo
- [ ] Code pushed to Git; Vercel connected to the correct repo and root directory

**Deploy**

- [ ] Root directory set to `Event-Registration` (or your app folder)
- [ ] All environment variables added in Vercel for Production
- [ ] First deploy successful; live URL works

**After deploy**

- [ ] `NEXT_PUBLIC_BASE_URL` set to the real production URL and redeployed if needed
- [ ] Test: registration → admin verify → email received → ticket link opens
- [ ] Test: admin login → dashboard → Scan QR Ticket → scan works and shows correct statuses
- [ ] Share registration URL with students and admin login URL (and password securely) with organizers

---

You now have the full site (frontend, backend API, and admin) deployed and ready for production use.
