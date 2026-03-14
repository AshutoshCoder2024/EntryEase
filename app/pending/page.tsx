"use client";

import Link from "next/link";

export default function PendingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-2xl">
          ⏳
        </div>
        <h1 className="text-xl font-semibold text-slate-50">
          Waiting for Payment Verification
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Your registration has been submitted. Our team will verify your UTR
          and payment. Once verified, your QR ticket will be sent to your email.
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Check your inbox (and spam) for the ticket. If you don&apos;t receive
          it within 24 hours, contact the organizers with your UTR number.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
