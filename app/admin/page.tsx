"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
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

const IconGrid = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const IconQR = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
  </svg>
);

const IconUsers = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const IconCheck = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconHome = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

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
    <>
      <Script
        src="https://unpkg.com/html5-qrcode@2.3.10/html5-qrcode.min.js"
        strategy="afterInteractive"
      />

      <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/20 text-slate-50">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-white/5 bg-slate-950/90 backdrop-blur-xl lg:flex">
          <div className="flex h-14 items-center border-b border-white/5 px-4">
            <span className="text-sm font-semibold text-white">{ROBOTICS_EVENT_NAME}</span>
          </div>
          <nav className="flex-1 space-y-0.5 p-3">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white bg-white/10"
            >
              <IconGrid />
              Dashboard
            </Link>
            <Link
              href="/admin/scan"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            >
              <IconQR />
              Scan QR
            </Link>
            <a
              href="/"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            >
              <IconHome />
              Registration
            </a>
          </nav>
        </aside>

        <div className="flex flex-1 flex-col lg:pl-56">
          <header className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <h1 className="text-lg font-semibold tracking-tight text-white">
                Admin Dashboard
              </h1>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/scan"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-900/20 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  <IconQR />
                  Scan QR Ticket
                </Link>
                <a
                  href="/"
                  className="rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
                <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 shadow-soft backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-slate-500">
                    <IconUsers />
                    <span className="text-xs font-semibold uppercase tracking-wider">Total</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">{stats.total}</p>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 shadow-soft">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">Pending</span>
                  <p className="mt-2 text-2xl font-semibold text-amber-300">{stats.pending}</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 shadow-soft">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Verified</span>
                  <p className="mt-2 text-2xl font-semibold text-emerald-300">{stats.verified}</p>
                </div>
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 shadow-soft">
                  <span className="text-xs font-semibold uppercase tracking-wider text-sky-400/90">Checked-in</span>
                  <p className="mt-2 text-2xl font-semibold text-sky-300">{stats.checked}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 shadow-soft">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Remaining</span>
                  <p className="mt-2 text-2xl font-semibold text-slate-200">{stats.remaining}</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                {(["all", "pending", "verified"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                      filter === f
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                        : "border border-slate-600 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Data table */}
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 shadow-soft backdrop-blur-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-800/50">
                        <th className="px-4 py-3.5 font-semibold text-slate-400">Name</th>
                        <th className="px-4 py-3.5 font-semibold text-slate-400">Email</th>
                        <th className="px-4 py-3.5 font-semibold text-slate-400">Phone</th>
                        <th className="px-4 py-3.5 font-semibold text-slate-400">Dept</th>
                        <th className="px-4 py-3.5 font-semibold text-slate-400">UTR</th>
                        <th className="px-4 py-3.5 font-semibold text-slate-400">Status</th>
                        <th className="px-4 py-3.5 font-semibold text-slate-400">Ticket</th>
                        <th className="px-4 py-3.5 font-semibold text-slate-400">Entry</th>
                        <th className="px-4 py-3.5 font-semibold text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b border-white/5 transition hover:bg-white/5">
                          <td className="px-4 py-3.5 font-medium text-slate-100">{r.name}</td>
                          <td className="max-w-[140px] truncate px-4 py-3.5 text-slate-400" title={r.email}>
                            {r.email}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400">{r.phone}</td>
                          <td className="px-4 py-3.5 text-slate-400">{r.department ?? "—"}</td>
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                            {r.utr_number ?? "—"}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
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
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                            {r.ticket_id ?? "—"}
                          </td>
                          <td className="px-4 py-3.5">
                            {r.entry_status === "used" ? (
                              <span className="inline-flex items-center gap-1 text-xs text-sky-400">
                                <IconCheck />
                                Used
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">Not used</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {r.payment_status === "pending" && (
                              <button
                                onClick={() => handleVerify(r.id)}
                                disabled={verifyingId === r.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-md transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
                              >
                                {verifyingId === r.id ? (
                                  <>
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    Verifying...
                                  </>
                                ) : (
                                  "Verify"
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <IconUsers className="h-10 w-10 text-slate-600" />
                    <p className="mt-3 text-sm text-slate-500">No registrations yet.</p>
                  </div>
                )}
              </div>

              {/* QR Scanner */}
              <section className="rounded-3xl border border-white/10 bg-slate-900/40 p-5 shadow-soft-lg backdrop-blur-xl sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                  <IconQR />
                  QR Ticket Scanner (Event Entry)
                </h2>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
                  <div id="qr-reader" className="w-full" />
                </div>
                <div
                  className={`mt-4 rounded-2xl border p-4 ${scanClasses}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Scan Status</p>
                  <p className="mt-2 text-sm font-medium text-slate-200">{scanStatus.message}</p>
                  <div
                    className="mt-2 text-xs text-slate-400"
                    dangerouslySetInnerHTML={{ __html: scanStatus.detailHtml }}
                  />
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
