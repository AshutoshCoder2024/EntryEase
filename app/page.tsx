"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ROBOTICS_EVENT_CAPACITY,
  ROBOTICS_EVENT_NAME,
  UPI_ID,
  REGISTRATION_FEE,
  supabase,
} from "@/lib/supabaseClient";

type StatusVariant = "info" | "success" | "error";

export default function Home() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [agreeInfo, setAgreeInfo] = useState(false);
  const [agreeRules, setAgreeRules] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ message: string; variant: StatusVariant } | null>(null);
  const [loading, setLoading] = useState(false);
  const [remainingSeats, setRemainingSeats] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCapacity() {
      const { count, error } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", "verified");

      if (error) {
        console.warn("Could not fetch capacity info", error);
        return;
      }
      const used = count || 0;
      setRemainingSeats(Math.max(ROBOTICS_EVENT_CAPACITY - used, 0));
    }

    fetchCapacity().catch(() => {});
  }, []);

  function validate() {
    const nextErrors: Record<string, string> = {};
    const phoneRegex = /^\d{10}$/;

    if (!fullName.trim()) nextErrors.fullName = "Full name is required";
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address";
    }
    if (!phoneRegex.test(phone.trim())) {
      nextErrors.phone = "Phone number must contain 10 digits";
    }
    if (!utrNumber.trim()) {
      nextErrors.utrNumber = "Please enter your UTR (transaction) number after payment";
    } else if (utrNumber.trim().length < 10) {
      nextErrors.utrNumber = "UTR number is usually 12 digits. Please enter the full UTR.";
    }
    if (!agreeInfo || !agreeRules) {
      nextErrors.terms = "You must accept all terms to continue";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function showStatus(message: string, variant: StatusVariant = "info") {
    setStatus({ message, variant });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setErrors({});
    setLoading(true);

    try {
      if (!validate()) {
        setLoading(false);
        showStatus("Please fix the highlighted fields and try again.", "error");
        return;
      }

      const { count, error } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", "verified");

      if (!error && typeof count === "number" && count >= ROBOTICS_EVENT_CAPACITY) {
        setRemainingSeats(0);
        throw new Error("Registration Closed — Event Full.");
      }

      const { error: insertError } = await supabase.from("event_registrations").insert({
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department: department || null,
        year: year || null,
        roll_number: rollNumber.trim() || null,
        utr_number: utrNumber.trim(),
        ticket_id: null,
        payment_status: "pending",
        entry_status: "not_used",
      });

      if (insertError) {
        console.error(insertError);
        throw new Error("Could not create registration. Please try again.");
      }

      showStatus("Registration submitted. Awaiting payment verification.", "success");
      router.push("/pending");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      showStatus(message, "error");
    } finally {
      setLoading(false);
    }
  }

  const statusClasses =
    status?.variant === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : status?.variant === "error"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
        : "border-sky-500/40 bg-sky-500/10 text-sky-200";

  const seatsLabel =
    remainingSeats === null
      ? "Checking seats..."
      : remainingSeats <= 0
        ? "Registration Closed — Event Full"
        : `${remainingSeats} of ${ROBOTICS_EVENT_CAPACITY} seats remaining`;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900/80 text-[10px] text-slate-400">
            College Logo
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-base font-semibold tracking-wide sm:text-lg md:text-xl">
              Robotics Challenge 2026 Registration
            </h1>
            <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">
              Pay via UPI &amp; enter UTR · Ticket sent to your email after verification
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900/80 text-[10px] text-slate-400">
            Club Logo
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row">
          <section className="hidden w-full max-w-sm flex-col justify-between rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-2xl shadow-slate-950/80 lg:flex">
            <div>
              <h2 className="text-xl font-semibold text-slate-50">
                Pay via UPI (PhonePe / GPay / Paytm)
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Scan the QR code or use UPI ID: <strong className="text-slate-200">{UPI_ID}</strong>
              </p>
              <div className="mt-4 flex justify-center rounded-2xl border border-slate-700 bg-white p-4">
                <img
                  src="/upiqr.png"
                  alt="UPI Payment QR Code"
                  className="h-48 w-48 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      const fallback = document.createElement("div");
                      fallback.className = "text-center text-xs text-slate-500 py-8";
                      fallback.innerHTML = `Place your UPI QR at<br/><code class="text-slate-400">public/upiqr.png</code><br/><br/>Or pay to: ${UPI_ID}`;
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Amount: ₹{REGISTRATION_FEE}. After payment, enter the UTR number in the form.
              </p>
            </div>
          </section>

          <section className="w-full rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/80 backdrop-blur-sm sm:p-7 lg:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">Event Registration</h2>
                <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                  Fill details, pay ₹{REGISTRATION_FEE} via UPI, then enter UTR below.
                </p>
              </div>
              <div className="space-y-1 text-right">
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                  Fee: ₹{REGISTRATION_FEE}
                </div>
                <p className="text-[11px] text-slate-400">{seatsLabel}</p>
              </div>
            </div>

            <form className="space-y-8" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Personal Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-300">
                      Full Name<span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                      placeholder="Enter your full name"
                    />
                    {errors.fullName && <p className="mt-1 text-xs text-rose-400">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-300">
                      Email Address<span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                      placeholder="you@gmail.com"
                    />
                    {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-300">
                      Phone Number<span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                      placeholder="10-digit mobile"
                    />
                    {errors.phone && <p className="mt-1 text-xs text-rose-400">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-800 pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Academic Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-300">
                      Department
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    >
                      <option value="">Select</option>
                      <option value="BCA">BCA</option>
                      <option value="BBA">BBA</option>
                      <option value="B.Tech">B.Tech</option>
                      <option value="MCA">MCA</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-300">
                      Year
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    >
                      <option value="">Select</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-300">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-800 pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Payment (UPI)
                </h3>
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="text-xs text-slate-300">
                    1. Pay ₹{REGISTRATION_FEE} via UPI to <strong>{UPI_ID}</strong> (scan QR on the left).
                  </p>
                  <p className="mt-2 text-xs text-slate-300">
                    2. After payment, you&apos;ll get a <strong>UTR / transaction ID</strong>. Enter it below.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-300">
                    UTR Number (Transaction ID)<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm font-mono text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    placeholder="e.g. 123456789012"
                  />
                  {errors.utrNumber && (
                    <p className="mt-1 text-xs text-rose-400">{errors.utrNumber}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-800 pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Terms &amp; Agreement
                </h3>
                <div className="space-y-3 text-xs text-slate-300">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={agreeInfo}
                      onChange={(e) => setAgreeInfo(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900 text-blue-500 focus:ring-blue-500"
                    />
                    <span>I confirm that all the information provided is correct.</span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={agreeRules}
                      onChange={(e) => setAgreeRules(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900 text-blue-500 focus:ring-blue-500"
                    />
                    <span>
                      I agree to follow the event rules. The registration fee is non‑refundable.
                    </span>
                  </label>
                </div>
                {errors.terms && <p className="mt-1 text-xs text-rose-400">{errors.terms}</p>}
              </div>

              <div className="space-y-3 border-t border-slate-800 pt-5">
                {status && (
                  <div className={`rounded-2xl border px-3 py-2 text-xs ${statusClasses}`}>
                    {status.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (remainingSeats !== null && remainingSeats <= 0)}
                  className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60"
                >
                  {loading ? "Submitting..." : "Submit Registration"}
                </button>

                <p className="text-[11px] text-slate-500">
                  After admin verifies your UTR, your QR ticket will be sent to your email.
                </p>
              </div>
            </form>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-900/80 bg-slate-950/80 px-4 py-3 text-center text-[11px] text-slate-500">
        Robotics Challenge 2026 · UPI Payment &amp; QR Ticket System
      </footer>
    </div>
  );
}
