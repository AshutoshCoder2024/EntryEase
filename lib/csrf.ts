import { NextRequest } from "next/server";

/**
 * Basic CSRF guard for cookie-authenticated JSON endpoints.
 * Requires same-origin Origin header and X-Requested-With: XMLHttpRequest.
 */
export function isTrustedAdminPost(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const expectedOrigin = req.nextUrl.origin;
  if (!origin || origin !== expectedOrigin) return false;

  const requestedWith = req.headers.get("x-requested-with");
  if (requestedWith !== "XMLHttpRequest") return false;

  return true;
}
