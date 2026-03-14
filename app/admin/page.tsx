"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { ROBOTICS_EVENT_NAME, supabase } from "@/lib/supabaseClient";

type ScanVariant = "info" | "success" | "warning" | "error";

type Registration = {
  id: number;
  name: string;
  email: string;
  phone: string;
  department: string | null;
  year: string | null;
  roll_number: string | null;
  utr_number: string | null;
  ticket_id: string | null;
  payment_status: string;
  payment_id: string | null;
  entry_status: string;
  created_at: string;
  verified_at?: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "verified">("all");
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    checked: 0,
    remaining: 0,
  });

  const [scanStatus, setScanStatus] = useState<{
    message: string;
    variant: ScanVariant;
    detailHtml: string;
  }>({
    message: "Awaiting scan...",
    variant: "info",
    detailHtml: "",
  });

  // Simple client-side password gate using localStorage flag set by /admin/login
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = window.localStorage.getItem("admin-authed") === "true";
    if (!ok) {
      router.replace("/admin/login");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  async function refreshData() {
    const { data, error } = await supabase
      .from("event_registrations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("Failed to load registrations", error);
      return;
    }

    const rows = data as Registration[];
    setRegistrations(rows);

    const total = rows.length;
    const pending = rows.filter((r) => r.payment_status === "pending").length;
    const verified = rows.filter((r) => r.payment_status === "verified").length;
    const checked = rows.filter((r) => r.entry_status === "used").length;
    const remaining = Math.max(verified - checked, 0);
    setStats({ total, pending, verified, checked, remaining });
  }

  useEffect(() => {
    refreshData();

    const channel = supabase
      .channel("event_registrations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_registrations" },
        () => refreshData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleVerify(registrationId: number) {
    setVerifyingId(registrationId);
    try {
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      const json = await res.json();

      if (!res.ok) {
        alert(json.error ?? "Verification failed");
        return;
      }
      if (json.success && json.emailSent === false) {
        const ticketUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/ticket/${encodeURIComponent(json.ticketId ?? "")}`;
        alert(`Payment verified and ticket ${json.ticketId} created, but the confirmation email could not be sent. Check EMAIL_USER/EMAIL_PASS in .env.local and server logs. You can share this link with the student: ${ticketUrl}`);
      }
      await refreshData();
    } catch (err) {
      alert("Verification failed. Check console.");
      console.error(err);
    } finally {
      setVerifyingId(null);
    }
  }

  function setScan(params: {
    message: string;
    variant: ScanVariant;
    detailHtml: string;
  }) {
    setScanStatus(params);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const startScanner = () => {
      const Html5Qrcode = (window as any).Html5Qrcode;
      if (!Html5Qrcode) return;
      const html5QrCode = new Html5Qrcode("qr-reader");
      const config = { fps: 10, qrbox: { width: 240, height: 240 } };

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
  }, []);

  const filtered = registrations.filter((r) => {
    if (filter === "pending") return r.payment_status === "pending";
    if (filter === "verified") return r.payment_status === "verified";
    return true;
  });

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

      <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/60 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <h1 className="text-base font-semibold sm:text-lg">
              {ROBOTICS_EVENT_NAME} · Admin Dashboard
            </h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/admin/scan")}
                className="hidden rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-md shadow-blue-900/40 transition hover:bg-blue-500 sm:inline-flex"
              >
                Scan QR Ticket
              </button>
              <a
                href="/"
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                ← Registration
              </a>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p>
                <p className="mt-1 text-2xl font-semibold text-slate-100">{stats.total}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-amber-500/10 p-3">
                <p className="text-[11px] uppercase tracking-wide text-amber-400/80">Pending</p>
                <p className="mt-1 text-2xl font-semibold text-amber-300">{stats.pending}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-emerald-500/10 p-3">
                <p className="text-[11px] uppercase tracking-wide text-emerald-400/80">Verified</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-300">{stats.verified}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-sky-500/10 p-3">
                <p className="text-[11px] uppercase tracking-wide text-sky-400/80">Checked-in</p>
                <p className="mt-1 text-2xl font-semibold text-sky-300">{stats.checked}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Remaining</p>
                <p className="mt-1 text-2xl font-semibold text-slate-200">{stats.remaining}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {(["all", "pending", "verified"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                    filter === f
                      ? "bg-blue-600 text-white"
                      : "border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Data table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90">
                    <th className="px-4 py-3 font-medium text-slate-300">Name</th>
                    <th className="px-4 py-3 font-medium text-slate-300">Email</th>
                    <th className="px-4 py-3 font-medium text-slate-300">Phone</th>
                    <th className="px-4 py-3 font-medium text-slate-300">Dept</th>
                    <th className="px-4 py-3 font-medium text-slate-300">UTR</th>
                    <th className="px-4 py-3 font-medium text-slate-300">Status</th>
                    <th className="px-4 py-3 font-medium text-slate-300">Ticket</th>
                    <th className="px-4 py-3 font-medium text-slate-300">Entry</th>
                    <th className="px-4 py-3 font-medium text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-slate-800/80 hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-slate-100">{r.name}</td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-slate-300" title={r.email}>
                        {r.email}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{r.phone}</td>
                      <td className="px-4 py-3 text-slate-400">{r.department ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {r.utr_number ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            r.payment_status === "verified"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : r.payment_status === "rejected"
                                ? "bg-rose-500/20 text-rose-300"
                                : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {r.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {r.ticket_id ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.entry_status === "used" ? (
                          <span className="text-xs text-sky-400">Used</span>
                        ) : (
                          <span className="text-xs text-slate-500">Not used</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.payment_status === "pending" && (
                          <button
                            onClick={() => handleVerify(r.id)}
                            disabled={verifyingId === r.id}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {verifyingId === r.id ? "Verifying..." : "Verify"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  No registrations yet.
                </p>
              )}
            </div>

            {/* QR Scanner */}
            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
              <h2 className="mb-4 text-sm font-semibold text-slate-100">
                QR Ticket Scanner (Event Entry)
              </h2>
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
                <div id="qr-reader" className="w-full" />
              </div>
              <div
                className={`mt-4 rounded-2xl border bg-slate-950/80 p-3 text-xs ${scanClasses}`}
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Scan Status</p>
                <p className="mt-1 text-sm text-slate-300">{scanStatus.message}</p>
                <div
                  className="mt-2 text-[11px] text-slate-400"
                  dangerouslySetInnerHTML={{ __html: scanStatus.detailHtml }}
                />
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
