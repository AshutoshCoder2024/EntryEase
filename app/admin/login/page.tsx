"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/admin/session", { credentials: "include" });
        const json = (await res.json()) as { authenticated?: boolean };
        if (cancelled) return;
        if (json.authenticated) {
          router.replace("/admin");
          return;
        }
        setChecking(false);
      } catch {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Login failed");
        return;
      }
      router.replace("/admin");
    } catch {
      setError("Could not reach the server. Try again.");
    }
  }

  if (checking) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/20 px-4 py-8">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/40 p-8 shadow-soft-lg backdrop-blur-xl">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Admin Login
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter the event admin password to access the dashboard.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-600/80 bg-slate-800/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-rose-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Continue to Admin
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Session is stored in a secure httpOnly cookie. Use a strong password set in server env (ADMIN_PASSWORD).
        </p>
      </div>
    </div>
  );
}
