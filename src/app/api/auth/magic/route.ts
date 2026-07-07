import { NextRequest, NextResponse } from "next/server";
import { consumeMagicToken } from "@core/magic-consume";

// next-auth/jwt (jose) + supabase-js need Node, and the response must never be
// cached because it sets a per-user session cookie (ZEUG-414).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side magic-link consumption: the emailed link lands here as a
 * top-level GET navigation, so the Set-Cookie on the 302 survives Safari ITP
 * and iOS in-app WebViews. On success we hand off to /enter, which routes the
 * user by role/application state.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const result = await consumeMagicToken(
    url.searchParams.get("email"),
    url.searchParams.get("token")
  );

  if (!result.ok) {
    return NextResponse.redirect(new URL(`/login?error=${result.reason}`, req.url));
  }

  const res = NextResponse.redirect(new URL("/enter", req.url));
  res.cookies.set({
    name: result.cookie.name,
    value: result.sessionJwt,
    ...result.cookie.options,
  });
  return res;
}
