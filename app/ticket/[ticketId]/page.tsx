"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { ROBOTICS_EVENT_NAME, supabase } from "@/lib/supabaseClient";

type TicketRow = {
  ticket_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  entry_status: string;
};

export default function TicketPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = decodeURIComponent(params.ticketId);

  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const qrRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("ticket_id", ticketId)
        .single();

        if (error || !data) {
        console.error(error);
        setError("Invalid or Unauthorized Ticket");
        setLoading(false);
        return;
      }

      if ((data as any).payment_status !== "verified") {
        setError("Invalid or Unauthorized Ticket");
        setLoading(false);
        return;
      }

      setTicket(data as TicketRow);
      setLoading(false);
    }

    load().catch(() => {
      setError("Something went wrong while loading the ticket.");
      setLoading(false);
    });
  }, [ticketId]);

  useEffect(() => {
    if (!ticket || !qrRef.current) return;

    const generateQR = async () => {
      const ticketUrl = `${window.location.origin}/ticket/${encodeURIComponent(ticket.ticket_id)}`;

      try {
        const qrDataUrl = await QRCode.toDataURL(ticketUrl, {
          width: 512,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#e5e7eb'
          },
          errorCorrectionLevel: 'H'
        });

        qrRef.current!.innerHTML = `<img src="${qrDataUrl}" alt="QR Code" style="width: 100%; height: auto; max-width: 280px;" />`;
      } catch (err) {
        console.error('QR generation failed:', err);
        qrRef.current!.innerHTML = '<p class="text-red-400">Failed to generate QR code</p>';
      }
    };

    generateQR();
  }, [ticket]);

  async function downloadAsPng() {
    if (!ticket) return;

    const ticketUrl = `${window.location.origin}/ticket/${encodeURIComponent(ticket.ticket_id)}`;

    try {
      const qrDataUrl = await QRCode.toDataURL(ticketUrl, {
        width: 1024,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#e5e7eb'
        },
        errorCorrectionLevel: 'H'
      });

      const link = document.createElement("a");
      link.download = `robotics-ticket-${ticket.ticket_id}.png`;
      link.href = qrDataUrl;
      link.click();
    } catch (err) {
      console.error('PNG download failed:', err);
      alert('Failed to download PNG');
    }
  }

  async function downloadAsSvg() {
    if (!ticket) return;

    const ticketUrl = `${window.location.origin}/ticket/${encodeURIComponent(ticket.ticket_id)}`;

    try {
      const qrSvg = await QRCode.toString(ticketUrl, {
        type: 'svg',
        width: 512,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#e5e7eb'
        },
        errorCorrectionLevel: 'H'
      });

      const blob = new Blob([qrSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `robotics-ticket-${ticket.ticket_id}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('SVG download failed:', err);
      alert('Failed to download SVG');
    }
  }

  const statusLabel =
    ticket?.entry_status === "used"
      ? "Checked in"
      : "Payment confirmed · Not checked-in";

  const paymentStatusLabel = ticket ? (ticket.entry_status === "used" ? "Checked in" : "Valid · Not checked in") : "";

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/20 text-slate-50">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <img
              src="/college-logo.png"
              alt="College logo"
              className="h-8 w-8 object-contain"
            />
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">
              Robotics Challenge 2026 · Digital Pass
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Show this QR ticket at the entrance
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <img
              src="/xts.png"
              alt="Club logo"
              className="h-8 w-8 object-contain"
            />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-xl">
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-soft-lg backdrop-blur-xl sm:p-8">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
                <p className="mt-4 text-sm text-slate-400">Loading your ticket...</p>
              </div>
            )}
            {error && !loading && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 py-8 text-center">
                <p className="text-sm font-medium text-rose-300">{error}</p>
              </div>
            )}
            {ticket && !loading && !error && (
              <div className="space-y-6">
                {/* Ticket info card */}
                <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Event
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    {ROBOTICS_EVENT_NAME}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Venue: Main Auditorium · Reporting 30 mins before start
                  </p>

                  <div className="mt-4 grid gap-4 border-t border-slate-700/50 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Ticket Holder
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-100">
                        {ticket.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Ticket ID
                      </p>
                      <p className="mt-1 font-mono text-sm text-indigo-300">
                        {ticket.ticket_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Email
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-300">
                        {ticket.email || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Payment Status
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {paymentStatusLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                        ticket.entry_status === "used"
                          ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          ticket.entry_status === "used"
                            ? "bg-sky-400"
                            : "bg-emerald-400"
                        }`}
                      />
                      {statusLabel}
                    </span>
                  </div>
                </div>

                {/* QR section: show or blurred placeholder */}
                <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-4 sm:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      QR Code
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowQr(!showQr)}
                      className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      {showQr ? "Hide QR Code" : "Show QR Code"}
                    </button>
                  </div>

                  {showQr ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white p-6 shadow-soft">
                      <div
                        ref={qrRef}
                        className="flex min-h-[200px] w-full max-w-[280px] items-center justify-center"
                      />
                      <p className="mt-4 text-center text-xs text-slate-500">
                        Keep brightness high for faster scanning.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-800/80 py-16">
                      <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-slate-700/50 blur-md">
                        <div className="h-24 w-24 rounded-xl bg-slate-600/80" />
                      </div>
                      <p className="mt-4 text-sm text-slate-500">
                        QR code hidden
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Tap &quot;Show QR Code&quot; when at the entrance
                      </p>
                    </div>
                  )}
                </div>

                {/* Download actions */}
                <div className="flex flex-col gap-3 border-t border-slate-700/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={downloadAsPng}
                      className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-900/20 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      Download Ticket (PNG)
                    </button>
                    <button
                      onClick={downloadAsSvg}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-indigo-500/50 hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      Download QR (SVG)
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 sm:text-right">
                    Add this page to your home screen for quick access.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
