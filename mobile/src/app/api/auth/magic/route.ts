import { NextResponse } from "next/server";
import { consumeMagicToken } from "@core/magic-consume";

/**
 * Magic-link consumption, ZEUG-414 pattern: validate server-side, mint the
 * exact NextAuth session JWT, and set it on a top-level 302 so Safari and
 * in-app WebViews keep the cookie. This is the route the sign-in emails
 * target on mobile.opencollective.app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await consumeMagicToken(
    url.searchParams.get("email"),
    url.searchParams.get("token"),
  );

  if (!result.ok) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", result.reason);
    return NextResponse.redirect(login, 302);
  }

  const next = url.searchParams.get("next");
  const target = next && next.startsWith("/") ? next : "/";
  const response = NextResponse.redirect(new URL(target, url.origin), 302);
  response.cookies.set(result.cookie.name, result.sessionJwt, result.cookie.options);
  return response;
}
