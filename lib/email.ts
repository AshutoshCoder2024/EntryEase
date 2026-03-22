import nodemailer from "nodemailer";

import { ROBOTICS_EVENT_NAME } from "@/lib/event-config";

function getPublicBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
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

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #0f172a;">Payment verified – your ticket is ready</h2>
        <p>Hi ${escapeHtml(studentName)},</p>
        <p>Your payment has been verified. Your digital QR ticket for <strong>${escapeHtml(ROBOTICS_EVENT_NAME)}</strong> is ready.</p>
        <p><strong>Ticket ID:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(ticketId)}</code></p>
        <p>Open your ticket (with QR code) here:</p>
        <p>
          <a href="${ticketUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
            View &amp; download ticket
          </a>
        </p>
        <p style="font-size: 14px; color: #64748b;">Or copy this link: ${ticketUrl}</p>
        <p><strong>At the event:</strong> Show the QR code at the entrance. Each ticket works only once.</p>
        <p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">— ${ROBOTICS_EVENT_NAME} Team</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
      to,
      subject: `Your ${ROBOTICS_EVENT_NAME} Ticket – ${ticketId}`,
      html,
      text: `Hi ${studentName},\n\nYour payment has been verified. Your digital QR ticket for ${ROBOTICS_EVENT_NAME} is ready.\n\nTicket ID: ${ticketId}\n\nView and download your ticket: ${ticketUrl}\n\nShow the QR code at the event entrance. Each ticket works only once.\n\n— ${ROBOTICS_EVENT_NAME} Team`,
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
