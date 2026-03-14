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

        qrRef.current!.innerHTML = `<img src="${qrDataUrl}" alt="QR Code" style="width: 100%; height: auto; max-width: 256px;" />`;
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

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/60 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900/80 text-[9px] text-slate-400">
              College
              <br />
              Logo
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-sm font-semibold tracking-wide sm:text-base">
                Robotics Challenge 2026 · Digital Pass
              </h1>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Show this QR ticket at the entrance
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900/80 text-[9px] text-slate-400">
              Club
              <br />
              Logo
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
          <div
            id="ticket-card"
            className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/80"
          >
            {loading && (
              <p className="text-center text-sm text-slate-400">
                Loading your ticket...
              </p>
            )}
            {error && !loading && (
              <p className="text-center text-sm text-rose-400">{error}</p>
            )}
            {ticket && !loading && !error && (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Robotics Challenge 2026
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-50">
                      {ROBOTICS_EVENT_NAME}
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Venue: Main Auditorium · Reporting 30 mins before start
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Ticket ID
                    </p>
                    <p className="mt-1 rounded-full bg-slate-800 px-3 py-1 text-xs font-mono text-slate-100">
                      {ticket.ticket_id}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Ticket Holder
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-50">
                        {ticket.name}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          Email
                        </p>
                        <p className="mt-0.5 break-all text-slate-200">
                          {ticket.email || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          Phone
                        </p>
                        <p className="mt-0.5 text-slate-200">
                          {ticket.phone || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          Department
                        </p>
                        <p className="mt-0.5 text-slate-200">
                          {ticket.department || "-"}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium ${
                        ticket.entry_status === "used"
                          ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
                          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          ticket.entry_status === "used"
                            ? "bg-sky-400"
                            : "bg-emerald-400"
                        }`}
                      />
                      {statusLabel}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-3">
                    <div
                      ref={qrRef}
                      className="flex h-40 w-40 items-center justify-center rounded-2xl bg-slate-900 shadow-inner shadow-slate-950/80"
                    />
                    <p className="text-center text-[11px] text-slate-400">
                      Keep brightness high and avoid screen cracks for faster
                      scanning.
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-col gap-2 border-t border-dashed border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={downloadAsPng}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-slate-50 shadow-md shadow-blue-900/40 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    >
                      Download Ticket (PNG)
                    </button>
                    <button
                      onClick={downloadAsSvg}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 shadow-md shadow-slate-950/40 transition hover:border-blue-500 hover:text-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    >
                      Download QR (SVG)
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 sm:mt-0">
                    Tip: Add this page to your home screen for quick access.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

