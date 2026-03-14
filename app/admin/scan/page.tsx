"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { ROBOTICS_EVENT_NAME, supabase } from "@/lib/supabaseClient";

type ScanVariant = "info" | "success" | "warning" | "error";

type ScanPhase = "scanning" | "processing" | "result";

export default function AdminScanPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [scannerSession, setScannerSession] = useState(0);
  const [phase, setPhase] = useState<ScanPhase>("scanning");
  const [scanStatus, setScanStatus] = useState<{
    message: string;
    variant: ScanVariant;
    detailHtml: string;
  }>({
    message: "Scanning…",
    variant: "info",
    detailHtml: "",
  });

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scanLockRef = useRef(false);

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
    if (!authChecked || typeof window === "undefined") return;

    scanLockRef.current = false;
    setPhase("scanning");
    setScanStatus({ message: "Scanning…", variant: "info", detailHtml: "" });

    let html5QrCode: Html5Qrcode | null = null;
    html5QrCodeRef.current = null;

    const startScanner = async () => {
      const element = document.getElementById("qr-reader-full");
      if (!element) return;

      html5QrCode = new Html5Qrcode("qr-reader-full");
      html5QrCodeRef.current = html5QrCode;
      const config = { fps: 10, qrbox: { width: 260, height: 260 } };

      const onScan = (decodedText: string) => {
        if (scanLockRef.current) return;
        scanLockRef.current = true;

        setPhase("processing");
        setScanStatus({
          message: "Processing Ticket…",
          variant: "info",
          detailHtml: "",
        });

        const processTicket = async () => {
          try {
            await html5QrCode?.stop();
            html5QrCodeRef.current = null;
          } catch (e) {
            console.warn("Scanner stop:", e);
          }

          let ticketId: string | null = null;
          try {
            const url = new URL(decodedText);
            const pathParts = url.pathname.split("/");
            const ticketIndex = pathParts.indexOf("ticket");
            if (ticketIndex !== -1 && pathParts[ticketIndex + 1]) {
              ticketId = decodeURIComponent(pathParts[ticketIndex + 1]);
            }
          } catch {
            ticketId = decodedText.trim();
          }

          if (!ticketId) {
            setScanStatus({
              message: "Invalid Ticket",
              variant: "error",
              detailHtml: "QR does not contain a valid ticket URL or ID.",
            });
            setPhase("result");
            return;
          }

          const { data, error } = await supabase
            .from("event_registrations")
            .select("*")
            .eq("ticket_id", ticketId)
            .single();

          if (error || !data) {
            setScanStatus({
              message: "Invalid Ticket",
              variant: "error",
              detailHtml: "No ticket found in the database.",
            });
            setPhase("result");
            return;
          }

          if (data.payment_status !== "verified") {
            setScanStatus({
              message: "Invalid Ticket",
              variant: "error",
              detailHtml: `Payment not verified for ticket <span class="font-mono">${ticketId}</span>.`,
            });
            setPhase("result");
            return;
          }

          if (data.entry_status === "used") {
            setScanStatus({
              message: "Ticket Already Used",
              variant: "warning",
              detailHtml: `Ticket ID: <span class="font-mono">${ticketId}</span>`,
            });
            setPhase("result");
            return;
          }

          const { error: updateError } = await supabase
            .from("event_registrations")
            .update({ entry_status: "used" })
            .eq("ticket_id", ticketId);

          if (updateError) {
            setScanStatus({
              message: "Invalid Ticket",
              variant: "error",
              detailHtml: "Failed to mark checked-in. Please try again.",
            });
            setPhase("result");
            return;
          }

          setScanStatus({
            message: "Entry Approved",
            variant: "success",
            detailHtml: `Ticket ID: <span class="font-mono">${ticketId}</span><br/>Status: Valid Ticket`,
          });
          setPhase("result");
        };

        processTicket();
      };

      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText: string) => onScan(decodedText),
          () => {}
        );
      } catch (err) {
        console.warn("Failed to start with rear camera, trying default camera", err);
        try {
          await html5QrCode.start(
            {},
            config,
            (decodedText: string) => onScan(decodedText),
            () => {}
          );
        } catch (fallbackErr) {
          console.error("QR scanner failed to start", fallbackErr);
          setScanStatus({
            message: "Camera access denied or unavailable",
            variant: "error",
            detailHtml:
              "Please allow camera permission in your browser settings or try another device.",
          });
          setPhase("result");
        }
      }
    };

    startScanner();

    return () => {
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
      html5QrCodeRef.current = null;
    };
  }, [authChecked, scannerSession]);

  const handleScanAgain = () => {
    setScannerSession((s) => s + 1);
  };

  const scanClasses =
    scanStatus.variant === "success"
      ? "border-emerald-500/30 bg-emerald-500/10"
      : scanStatus.variant === "error"
        ? "border-rose-500/30 bg-rose-500/10"
        : scanStatus.variant === "warning"
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-white/10 bg-slate-800/40";

  if (!authChecked) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/20 text-slate-50">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">
            {ROBOTICS_EVENT_NAME} · Scanner
          </h1>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            ← Dashboard
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md space-y-5">
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-5 shadow-soft-lg backdrop-blur-xl sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                QR Ticket Scanner
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Hold the ticket QR inside the frame. Works on mobile and desktop.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
              <div
                id="qr-reader-full"
                className={`aspect-square w-full min-h-[280px] ${phase === "result" ? "hidden" : ""}`}
              />
              {phase === "processing" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/95">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
                    <p className="text-sm font-medium text-slate-300">
                      Processing Ticket…
                    </p>
                  </div>
                </div>
              )}
              {phase === "result" && (
                <div className="flex min-h-[280px] flex-col items-center justify-center py-10">
                  <p className="text-sm text-slate-500">
                    Camera off
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Tap &quot;Scan Again&quot; to verify another ticket
                  </p>
                </div>
              )}
            </div>
          </div>

          <div
            className={`rounded-2xl border p-4 transition ${scanClasses}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {phase === "result" ? "Result" : "Status"}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-200">
              {scanStatus.message}
            </p>
            {scanStatus.detailHtml && (
              <div
                className="mt-2 text-xs text-slate-400"
                dangerouslySetInnerHTML={{ __html: scanStatus.detailHtml }}
              />
            )}
          </div>

          {phase === "result" && (
            <button
              type="button"
              onClick={handleScanAgain}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3.5 text-sm font-semibold text-slate-100 shadow-soft transition hover:border-indigo-500/50 hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              Scan Again
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
