import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  isAdminSessionConfigured,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

function getCookieValue(req: NextRequest): string | undefined {
  return req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
}

function adminPassword(): string | undefined {
  return (
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim()
  );
}

/** Check whether the browser has a valid admin session. */
export async function GET(req: NextRequest) {
  const token = getCookieValue(req);
  const ok = verifyAdminSessionToken(token);
  return NextResponse.json({ authenticated: ok });
}

/** Login: validate password and set httpOnly session cookie. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { password?: string };
    const password = typeof body.password === "string" ? body.password : "";

    const expected = adminPassword();
    if (!expected) {
      return NextResponse.json(
        {
          error:
            "Admin password is not configured. Set ADMIN_PASSWORD (recommended) or NEXT_PUBLIC_ADMIN_PASSWORD in the server environment.",
        },
        { status: 503 }
      );
    }

    if (!isAdminSessionConfigured()) {
      return NextResponse.json(
        {
          error:
            "Session signing is not configured. Set ADMIN_SESSION_SECRET, or ADMIN_PASSWORD / NEXT_PUBLIC_ADMIN_PASSWORD with at least 8 characters.",
        },
        { status: 503 }
      );
    }

    if (password !== expected) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const token = createAdminSessionToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    console.error("[admin/session] POST", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

/** Logout: clear session cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
