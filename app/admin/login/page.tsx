"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // If already authed (flag in localStorage), go straight to /admin
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = window.localStorage.getItem("admin-authed") === "true";
    if (ok) {
      router.replace("/admin");
      return;
    }
    setChecking(false);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (!expected) {
      setError("Admin password is not configured. Ask the developer to set NEXT_PUBLIC_ADMIN_PASSWORD.");
      return;
    }

    if (password === expected) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("admin-authed", "true");
      }
      router.replace("/admin");
    } else {
      setError("Incorrect password. Please try again.");
    }
  }

  if (checking) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/70">
          <h1 className="text-lg font-semibold text-slate-50">
            Admin Login
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Enter the event admin password to access the dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter password"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-rose-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="mt-1 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-blue-900/40 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Continue to Admin
            </button>
          </form>

          <p className="mt-4 text-[11px] text-slate-500">
            This password is shared only with event organizers. If you&apos;re not an organizer, please use the normal registration page.
          </p>
        </div>
      </main>
    </div>
  );
}

