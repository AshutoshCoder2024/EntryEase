import nodemailer from "nodemailer";

import { ROBOTICS_EVENT_NAME } from "@/lib/event-config";

/** Shown in ticket email sign-off (e.g. "— Team XTS"). */
const EMAIL_TEAM_SIGN_OFF = "Team XTS";

// function getPublicBaseUrl(): string {
//   const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.trim();
//   if (fromEnv) return fromEnv.replace(/\/$/, "");
//   if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
//   return "http://localhost:3000";
// }
function getPublicBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  // Only fallback in dev
  if (process.env.NODE_ENV !== "production" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

/**
 * Builds a Nodemailer transporter from environment variables.
 * Defaults to Gmail SMTP when only EMAIL_USER and EMAIL_PASS are set.
 * For other providers (Outlook, Yahoo, etc.), set EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE as needed.
 */
function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error(
      "Email not configured: set EMAIL_USER and EMAIL_PASS in .env.local (use Gmail App Password for Gmail)."
    );
  }

  const host = process.env.EMAIL_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.EMAIL_PORT) || 587;
  const secure = process.env.EMAIL_SECURE === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export type SendTicketEmailParams = {
  to: string;
  studentName: string;
  ticketId: string;
};

/**
 * Sends the QR ticket confirmation email to the student after payment verification.
 * Uses the email address provided during registration.
 */
export async function sendTicketEmail({
  to,
  studentName,
  ticketId,
}: SendTicketEmailParams): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const transporter = getTransporter();
    const base = getPublicBaseUrl();
    const ticketUrl = `${base}/ticket/${encodeURIComponent(ticketId)}`;

    const subject = "Your Ticket is Ready – Payment Verified ✅";

    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a; line-height: 1.55;">
        <p style="margin: 0 0 16px; font-size: 16px;">Hi ${escapeHtml(studentName)},</p>
        <p style="margin: 0 0 8px; font-size: 16px;"><strong>Great news! 🎉</strong></p>
        <p style="margin: 0 0 16px; font-size: 16px;">Your payment has been successfully verified.</p>
        <p style="margin: 0 0 20px; font-size: 16px;">
          Your digital QR ticket for <strong>${escapeHtml(ROBOTICS_EVENT_NAME)}</strong> is now ready.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin: 0 0 20px;">
          <p style="margin: 0 0 10px; font-size: 15px; font-weight: 600;">🎟 Ticket Details</p>
          <p style="margin: 0; font-size: 15px;">
            <strong>Ticket ID:</strong>
            <code style="background: #e2e8f0; padding: 2px 8px; border-radius: 6px; font-size: 14px;">${escapeHtml(ticketId)}</code>
          </p>
        </div>

        <p style="margin: 0 0 12px; font-size: 15px;">You can view and download your ticket here:</p>
        <p style="margin: 0 0 16px;">
          <a href="${escapeHtmlAttr(ticketUrl)}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
            View &amp; Download Ticket
          </a>
        </p>
        <p style="margin: 0 0 20px; font-size: 14px; color: #64748b;">
          Or copy this link:<br/>
          <a href="${escapeHtmlAttr(ticketUrl)}" style="color: #2563eb; word-break: break-all;">${escapeHtml(ticketUrl)}</a>
        </p>

        <div style="border-left: 4px solid #2563eb; padding-left: 16px; margin: 0 0 24px;">
          <p style="margin: 0 0 8px; font-size: 15px; font-weight: 600;">📌 At the Event:</p>
          <ul style="margin: 0; padding-left: 18px; font-size: 15px; color: #334155;">
            <li style="margin-bottom: 6px;">Show your QR code at the entry gate</li>
            <li>Each ticket is valid for one-time use only</li>
          </ul>
        </div>

        <p style="margin: 0 0 8px; font-size: 15px;">We’re excited to have you join us!</p>
        <p style="margin: 0 0 24px; font-size: 15px;">See you at the event 🚀</p>
        <p style="margin: 0; font-size: 13px; color: #94a3b8;">— ${escapeHtml(EMAIL_TEAM_SIGN_OFF)}</p>
      </div>
    `;

    const text = `Hi ${studentName},

Great news! Your payment has been successfully verified.

Your digital QR ticket for ${ROBOTICS_EVENT_NAME} is now ready.

Ticket Details
Ticket ID: ${ticketId}

View and download your ticket:
${ticketUrl}

At the Event:
- Show your QR code at the entry gate
- Each ticket is valid for one-time use only

We're excited to have you join us!
See you at the event

— ${EMAIL_TEAM_SIGN_OFF}`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
      to,
      subject,
      html,
      text,
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sendTicketEmail] Failed to send email:", message);
    if (err && typeof err === "object" && "response" in err) {
      console.error("[sendTicketEmail] SMTP response:", (err as { response?: string }).response);
    }
    return { success: false, error: message };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
