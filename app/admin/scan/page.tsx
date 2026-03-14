"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { ROBOTICS_EVENT_NAME, supabase } from "@/lib/supabaseClient";

type ScanVariant = "info" | "success" | "warning" | "error";

export default function AdminScanPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [scanStatus, setScanStatus] = useState<{
    message: string;
    variant: ScanVariant;
    detailHtml: string;
  }>({
    message: "Point the camera at a ticket QR code.",
    variant: "info",
    detailHtml: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = window.localStorage.getItem("admin-authed") === "true";
    if (!ok) {
      router.replace("/admin/login");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    if (typeof window === "undefined") return;

    const setScan = (params: {
      message: string;
      variant: ScanVariant;
      detailHtml: string;
    }) => setScanStatus(params);

    const startScanner = () => {
      const Html5Qrcode = (window as any).Html5Qrcode;
      if (!Html5Qrcode) return;
      const html5QrCode = new Html5Qrcode("qr-reader-full");
      const config = { fps: 10, qrbox: { width: 260, height: 260 } };

      html5QrCode
        .start(
          { facingMode: "environment" },
          config,
          (decodedText: string) => handleScan(decodedText),
          () => {}
        )
        .catch((err: unknown) => {
          console.error("QR scanner failed to start", err);
          setScan({
            message: "Camera access denied or unavailable",
            variant: "error",
            detailHtml:
              "Please allow camera permission in your browser settings or try another device.",
          });
        });
    };

    const handleScan = async (payload: string) => {
      try {
        let parsed: { ticket_id?: string };
        try {
          parsed = JSON.parse(payload);
        } catch {
          parsed = { ticket_id: payload.trim() };
        }

        const ticketId = parsed.ticket_id;
        if (!ticketId) {
          setScan({
            message: "Invalid QR format",
            variant: "error",
            detailHtml: "QR does not contain a ticket_id.",
          });
          return;
        }

        const { data, error } = await supabase
          .from("event_registrations")
          .select("*")
          .eq("ticket_id", ticketId)
          .single();

        if (error || !data) {
          setScan({
            message: "Invalid Ticket",
            variant: "error",
            detailHtml: `No ticket found with ID <span class="font-mono">${ticketId}</span>.`,
          });
          return;
        }

        if (data.payment_status !== "verified") {
          setScan({
            message: "Payment not verified",
            variant: "warning",
            detailHtml: `Ticket for <span class="font-semibold">${data.name}</span> — payment status: <span class="font-mono">${data.payment_status}</span>.`,
          });
          return;
        }

        if (data.entry_status === "used") {
          setScan({
            message: "Ticket Already Used",
            variant: "warning",
            detailHtml: `Ticket <span class="font-mono">${data.ticket_id}</span> for <span class="font-semibold">${data.name}</span> has already been checked in.`,
          });
          return;
        }

        const { error: updateError } = await supabase
          .from("event_registrations")
          .update({ entry_status: "used" })
          .eq("ticket_id", ticketId);

        if (updateError) {
          setScan({
            message: "Failed to mark checked-in",
            variant: "error",
            detailHtml: "Please try again.",
          });
          return;
        }

        setScan({
          message: "Entry Successful",
          variant: "success",
          detailHtml: `Welcome, <span class="font-semibold">${data.name}</span>!<br/>Ticket: <span class="font-mono">${data.ticket_id}</span>`,
        });
      } catch (err) {
        console.error(err);
        setScan({
          message: "Scan error",
          variant: "error",
          detailHtml: "An unexpected error occurred.",
        });
      }
    };

    const interval = setInterval(() => {
      if ((window as any).Html5Qrcode) {
        clearInterval(interval);
        startScanner();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [authChecked]);

  const scanClasses =
    scanStatus.variant === "success"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : scanStatus.variant === "error"
        ? "border-rose-500/40 bg-rose-500/5"
        : scanStatus.variant === "warning"
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-slate-800 bg-slate-950/80";

  if (!authChecked) {
    return null;
  }

  return (
    <>
      <Script
        src="https://unpkg.com/html5-qrcode@2.3.10/html5-qrcode.min.js"
        strategy="afterInteractive"
      />

      <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
            <h1 className="text-sm font-semibold sm:text-base">
              {ROBOTICS_EVENT_NAME} · QR Ticket Scanner
            </h1>
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              ← Back to Dashboard
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-4 py-6">
          <div className="w-full max-w-md space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-slate-950/80">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Scan QR Ticket
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Hold the QR code inside the box. Works on mobile and desktop.
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
                <div id="qr-reader-full" className="aspect-square w-full" />
              </div>
            </div>

            <div
              className={`rounded-2xl border bg-slate-950/80 p-3 text-xs ${scanClasses}`}
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Scan Status
              </p>
              <p className="mt-1 text-sm text-slate-300">{scanStatus.message}</p>
              <div
                className="mt-2 text-[11px] text-slate-400"
                dangerouslySetInnerHTML={{ __html: scanStatus.detailHtml }}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

