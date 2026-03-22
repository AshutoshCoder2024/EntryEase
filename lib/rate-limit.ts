/**
 * In-memory fixed-window rate limiter (per server instance).
 * On Vercel serverless, each warm instance has its own counter — still limits abuse per edge.
 * For strict global limits, use Upstash Redis + @upstash/ratelimit.
 */

type Entry = { count: number; windowStart: number };

const store = new Map<string, Entry>();
const MAX_KEYS = 20_000;

function prune(now: number, windowMs: number) {
  if (store.size <= MAX_KEYS) return;
  for (const [key, e] of store) {
    if (now - e.windowStart > windowMs * 2) store.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  prune(now, windowMs);

  let entry = store.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 1, windowStart: now };
    store.set(key, entry);
    const resetAt = now + windowMs;
    return { ok: true, limit, remaining: limit - 1, resetAt };
  }

  entry.count++;
  const resetAt = entry.windowStart + windowMs;

  if (entry.count > limit) {
    return { ok: false, limit, remaining: 0, resetAt };
  }

  return { ok: true, limit, remaining: limit - entry.count, resetAt };
}

export function getRegistrationRateLimitConfig(): { limit: number; windowMs: number } {
  const limit = Math.max(1, Math.min(100, Number(process.env.REGISTRATION_RATE_LIMIT_MAX) || 8));
  const windowMs = Math.max(
    60_000,
    Math.min(86_400_000, Number(process.env.REGISTRATION_RATE_LIMIT_WINDOW_MS) || 900_000)
  );
  return { limit, windowMs };
}
