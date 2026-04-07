"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROBOTICS_EVENT_CAPACITY, ROBOTICS_EVENT_NAME, UPI_ID, REGISTRATION_FEE } from "@/lib/supabaseClient";
import { validateRegistrationInput } from "@/lib/registration-validation";

type StatusVariant = "info" | "success" | "error";

export default function Home() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [otherCourse, setOtherCourse] = useState("");
  const [year, setYear] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [agreeInfo, setAgreeInfo] = useState(false);
  const [agreeRules, setAgreeRules] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ message: string; variant: StatusVariant } | null>(null);
  const [loading, setLoading] = useState(false);
  const [remainingSeats, setRemainingSeats] = useState<number | null>(null);
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [upiCopySuccess, setUpiCopySuccess] = useState(false);
  const submitGuardRef = useRef(false);
  /** Honeypot — must stay empty (bots often fill hidden fields). */
  const [websiteHp, setWebsiteHp] = useState("");

  useEffect(() => {
    async function fetchCapacity() {
      try {
        const res = await fetch("/api/event/capacity", { cache: "no-store" });
        const json = (await res.json()) as { remaining?: number | null };
        if (typeof json.remaining === "number") {
          setRemainingSeats(json.remaining);
        }
      } catch {
        console.warn("Could not fetch capacity info");
      }
    }

    fetchCapacity().catch(() => { });
  }, []);

  function validate() {
    const result = validateRegistrationInput({
      fullName,
      email,
      phone,
      department: department === "Other" ? otherCourse : department,
      year,
      rollNumber,
      utrNumber,
      agreeInfo,
      agreeRules,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return false;
    }
    if (department === "Other" && !otherCourse.trim()) {
      setErrors({ departmentOther: "Please enter your course name" });
      return false;
    }
    setErrors({});
    return true;
  }

  function showStatus(message: string, variant: StatusVariant = "info") {
    setStatus({ message, variant });
  }

  async function handleCopyUpiId() {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setUpiCopySuccess(true);
      window.setTimeout(() => setUpiCopySuccess(false), 1800);
    } catch {
      showStatus("Could not copy UPI ID. Please copy it manually.", "error");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitGuardRef.current) return;
    setStatus(null);
    setErrors({});
    setLoading(true);

    try {
      if (!validate()) {
        setLoading(false);
        showStatus("Please fix the highlighted fields and try again.", "error");
        return;
      }

      submitGuardRef.current = true;

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          department: department === "Other" ? otherCourse : department,
          year,
          rollNumber,
          utrNumber,
          agreeInfo,
          agreeRules,
          website: websiteHp,
        }),
      });

      const json = (await res.json()) as { error?: string };

      if (res.status === 422) {
        // Server returns generic errors to avoid leaking validation rules.
        showStatus(json.error ?? "Invalid input. Please check the form and try again.", "error");
        return;
      }

      if (res.status === 429) {
        showStatus(json.error ?? "Too many attempts. Please try again later.", "error");
        return;
      }

      if (res.status === 409) {
        if (json.error?.includes("Full")) {
          setRemainingSeats(0);
        }
        throw new Error(json.error ?? "Registration could not be completed.");
      }

      if (!res.ok) {
        throw new Error(json.error ?? "Could not create registration. Please try again.");
      }

      showStatus("Registration submitted. Awaiting payment verification.", "success");
      router.push("/pending");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      showStatus(message, "error");
    } finally {
      submitGuardRef.current = false;
      setLoading(false);
    }
  }

  const statusClasses =
    status?.variant === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : status?.variant === "error"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
        : "border-indigo-500/30 bg-indigo-500/10 text-indigo-200";

  const seatsLabel =
    remainingSeats === null
      ? "Checking seats..."
      : remainingSeats <= 0
        ? "Registration Closed — Event Full"
        : `  Only ${remainingSeats} seats left out of ${ROBOTICS_EVENT_CAPACITY} `;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/20 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <img
              src="/college-logo.png"
              alt="College logo"
              className="h-9 w-9 object-contain"
            />
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl md:text-2xl">
              {ROBOTICS_EVENT_NAME}
            </h1>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Explore the Future of AI & Robotics — Register Now to Secure Your Spot!          </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <img
              src="/xts.png"
              alt="Club logo"
              className="h-9 w-9 object-contain"
            />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row">
          {/* UPI QR & ID — visible on all devices (mobile: top, desktop: left) */}
          <section className="hidden w-full shrink-0 rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-soft-lg backdrop-blur-xl lg:block lg:max-w-sm">            <div>
            <h2 className="text-xl font-semibold text-white">
              Pay via UPI
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Scan the QR code or use UPI ID: <strong className="text-slate-200">{UPI_ID}</strong>
            </p>
            <button
              type="button"
              onClick={() => setShowUpiQr((prev) => !prev)}
              className="mt-5 w-full rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {showUpiQr ? "Hide UPI QR" : "Show UPI QR"}
            </button>
            {showUpiQr && (
              <div className="mt-4 flex justify-center rounded-2xl border border-white/10 bg-white p-4 shadow-soft sm:p-5">
                <img
                  src="/NausheenOR.png"
                  alt="UPI Payment QR Code"
                  className="h-44 w-44 object-contain sm:h-48 sm:w-48"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      const fallback = document.createElement("div");
                      fallback.className = "text-center text-xs text-slate-500 py-8";
                      fallback.innerHTML = `Place your UPI QR at<br/><code class="text-slate-400">public/NausheenOR.png</code><br/><br/>Or pay to: ${UPI_ID}`;
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
            )}
            <div className="mt-3 flex items-center justify-center gap-2 sm:mt-4">
              <p className="font-mono text-sm text-slate-300">{UPI_ID}</p>
              <button
                type="button"
                onClick={handleCopyUpiId}
                aria-label="Copy UPI ID"
                title="Copy UPI ID"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-800/60 text-slate-300 transition hover:bg-slate-700/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="9" y="9" width="11" height="11" rx="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            {upiCopySuccess && <p className="mt-1 text-center text-xs text-emerald-300">UPI ID copied</p>}
            <p className="mt-2 text-center text-xs text-slate-500">
              Amount: ₹{REGISTRATION_FEE}. After payment, copy your UTR Number and enter it below
            </p>
          </div>
          </section>

          <section className="w-full rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-soft-lg backdrop-blur-xl sm:p-7 lg:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white sm:text-2xl">Event Registration</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Fill your details → Complete payment → Enter UTR to confirm registration
                </p>
                <div className="mt-3 space-y-1 rounded-xl border border-white/10 bg-slate-800/40 p-3 text-xs text-slate-300 sm:text-sm">
                  <p>📅 Date: 13 April 2026</p>
                  <p>⏰ Time: 11:00 AM - 2:00 PM</p>
                  <p>📍 Venue: Fr. De Brouwer Auditorium Hall</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300">
                  Fee: ₹{REGISTRATION_FEE}
                </span>
                {/* <p className="text-xs text-slate-500">{seatsLabel}</p> */}
              </div>
            </div>

            <form className="space-y-8" onSubmit={handleSubmit}>
              <input
                type="text"
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                value={websiteHp}
                onChange={(e) => setWebsiteHp(e.target.value)}
              />
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Personal Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-800/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                      placeholder="Enter your full name"
                    />
                    {errors.fullName && <p className="mt-1.5 text-xs text-rose-400">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Email <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-800/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                      placeholder="you@example.com"
                    />
                    {errors.email && <p className="mt-1.5 text-xs text-rose-400">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Phone <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-800/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                      placeholder="10-digit mobile"
                    />
                    {errors.phone && <p className="mt-1.5 text-xs text-rose-400">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-700/50 pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Academic Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Department</label>
                    <select
                      value={department}
                      onChange={(e) => {
                        setDepartment(e.target.value);
                        if (e.target.value !== "Other") setOtherCourse("");
                      }}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-800/50 px-4 py-3 text-sm text-slate-100 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                    >
                      <option value="">Select</option>
                      <option value="Bsc-IT">Bsc-IT</option>
                      <option value="Bsc-CA">Bsc-CA</option>
                      <option value="BCA">BCA</option>
                      <option value="Physics">Physics</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.department && <p className="mt-1.5 text-xs text-rose-400">{errors.department}</p>}
                  </div>
                  {department === "Other" && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-300">
                        Course Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={otherCourse}
                        onChange={(e) => setOtherCourse(e.target.value)}
                        className="w-full rounded-xl border border-slate-600/80 bg-slate-800/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                        placeholder="Enter your course"
                      />
                      {errors.departmentOther && (
                        <p className="mt-1.5 text-xs text-rose-400">{errors.departmentOther}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Year</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-800/50 px-4 py-3 text-sm text-slate-100 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                    >
                      <option value="">Select</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                    {errors.year && <p className="mt-1.5 text-xs text-rose-400">{errors.year}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Roll Number</label>
                    <input
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-800/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                      placeholder="Optional"
                    />
                    {errors.rollNumber && <p className="mt-1.5 text-xs text-rose-400">{errors.rollNumber}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-700/50 pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Payment (UPI)
                </h3>
                {/* Mobile: toggle QR visibility in payment section */}
                <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-4 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setShowUpiQr((prev) => !prev)}
                    className="w-full rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    {showUpiQr ? "Hide UPI QR" : "Show UPI QR"}
                  </button>
                  {showUpiQr && (
                    <div className="mt-3 flex flex-col items-center">
                      <p className="mb-3 text-center text-xs text-slate-400">Scan to pay</p>
                      <div className="flex justify-center rounded-xl border border-white/10 bg-white p-3">
                        <img
                          src="/NausheenOR.png"
                          alt="UPI Payment QR Code"
                          className="h-40 w-40 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              const fallback = document.createElement("div");
                              fallback.className = "text-center text-xs text-slate-500 py-6";
                              fallback.innerHTML = `Or pay to: ${UPI_ID}`;
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <p className="font-mono text-sm text-slate-300">{UPI_ID}</p>
                        <button
                          type="button"
                          onClick={handleCopyUpiId}
                          aria-label="Copy UPI ID"
                          title="Copy UPI ID"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-800/60 text-slate-300 transition hover:bg-slate-700/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="9" y="9" width="11" height="11" rx="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </div>
                      {upiCopySuccess && <p className="mt-1 text-xs text-emerald-300">UPI ID copied</p>}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-sm text-slate-300">
                    1. Pay ₹{REGISTRATION_FEE} via UPI to <strong className="text-slate-200">{UPI_ID}</strong>
                    <span className="hidden lg:inline"> (click Show UPI QR on the left).</span>
                    <span className="lg:hidden"> (click Show UPI QR above).</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    2. After payment, you&apos;ll get a <strong className="text-slate-200">UTR or (UPI Reference Number)</strong>. Enter it below.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    UTR Number  <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-600/80 bg-slate-800/50 px-4 py-3 text-sm font-mono text-slate-100 placeholder:text-slate-500 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                    placeholder="e.g. 123456789012"
                  />
                  {errors.utrNumber && (
                    <p className="mt-1.5 text-xs text-rose-400">{errors.utrNumber}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-700/50 pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Terms &amp; Agreement
                </h3>
                <div className="space-y-3 text-sm text-slate-300">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={agreeInfo}
                      onChange={(e) => setAgreeInfo(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-800 text-indigo-500 transition focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <span>I confirm that all the information provided is correct.</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={agreeRules}
                      onChange={(e) => setAgreeRules(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-800 text-indigo-500 transition focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <span>
                      I agree to follow the event rules. The registration fee is non‑refundable.
                    </span>
                  </label>
                </div>
                {errors.terms && <p className="mt-1.5 text-xs text-rose-400">{errors.terms}</p>}
              </div>

              <div className="space-y-4 border-t border-slate-700/50 pt-6">
                {status && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${statusClasses}`}>
                    {status.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (remainingSeats !== null && remainingSeats <= 0)}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loading ? "Submitting..." : "Submit Registration"}
                </button>

                <p className="text-center text-xs text-slate-500">
                  After admin verifies your UTR, your QR ticket will be sent to your email.
                </p>
              </div>
            </form>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 bg-slate-950/60 px-4 py-4 text-center text-xs text-slate-500 backdrop-blur-sm">
        {ROBOTICS_EVENT_NAME} · Register, Pay & Get Your QR Ticket
      </footer>
    </div>
  );
}
