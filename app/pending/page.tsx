"use client";

import Link from "next/link";

export default function PendingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/20 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/40 p-8 text-center shadow-soft-lg backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-3xl">
          ⏳
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-white">
          Waiting for Payment Verification
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Your registration has been submitted. Our team will verify your UTR
          and payment. Once verified, your QR ticket will be sent to your email.
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Check your inbox (and spam) for the ticket. If you don&apos;t receive
          it within 24 hours, contact the organizers with your UTR number.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
