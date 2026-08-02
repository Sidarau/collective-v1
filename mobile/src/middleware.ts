import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { sessionCookieName } from "@core/auth-cookies";

/**
 * Edge guard for the mobile operator surface.
 *
 * MOBILE_AUTH_GUARD=enforced → every route except the public set requires an
 * admin/operator session JWT; anything else is sent to the single operator
 * login on the parent domain (`opencollective.app/login?next=<absolute url>`,
 * which passes an existing shared session straight through). Preview deploys
 * (guard unset) pass everything through so fixtures stay reviewable.
 *
 * The cookie name comes from `@core/auth-cookies`, the same module the handler
 * that writes the cookie uses — see ZEUG-414, and the member app's middleware,
 * which does the same. This file previously re-derived the name from
 * `process.env` instead of importing it, which is precisely the drift that
 * module exists to prevent.
 */
const PUBLIC_PATHS = [/^\/login(?:\/|$)/, /^\/api\/auth(?:\/|$)/];

const OPERATOR_ROLES = new Set(["admin", "operator"]);

export async function middleware(request: NextRequest) {
  if (process.env.MOBILE_AUTH_GUARD !== "enforced") return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((re) => re.test(pathname))) return NextResponse.next();

  const token = await getToken({
    // next-auth's type predates Next 16's NextRequest; runtime accepts it.
    req: request as unknown as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: sessionCookieName,
  });

  const role = typeof token?.role === "string" ? token.role : null;
  if (token?.sub && role && OPERATOR_ROLES.has(role)) {
    // Strip the pass-through sentinel from the URL on the way in, so Today
    // doesn't keep a stray `loop=1` in the address bar.
    if (request.nextUrl.searchParams.has("loop")) {
      const clean = new URL(request.nextUrl.toString());
      clean.searchParams.delete("loop");
      return NextResponse.redirect(clean);
    }
    return NextResponse.next();
  }

  // Single login lives on the parent domain. Send the visitor there with the
  // absolute URL they wanted (path + query — a shared install link is
  // `/?a2hs=invite&from=…`, and dropping the search landed members on a bare
  // Today with nothing to show for having followed the link). The admin
  // console signs them in — or passes them straight through when they
  // already hold the shared *.opencollective.app session cookie — and hands
  // them back here.
  //
  // Loop breaker: if this request already came back once (admin tagged the
  // pass-through with `loop=1`) and the cookie is STILL not valid here, the
  // cookie is one mobile cannot ever accept (host-only, pre-role-claims) —
  // bouncing again would ping-pong forever. Send them to the admin login
  // with `force=1`, which renders the form instead of passing through, so
  // one fresh sign-in replaces the bad cookie.
  const target = new URL(request.nextUrl.toString());
  const bounced = target.searchParams.has("loop");
  target.searchParams.delete("loop");
  const login = new URL("/login", process.env.ADMIN_ORIGIN ?? "https://opencollective.app");
  login.searchParams.set("next", target.toString());
  if (bounced) login.searchParams.set("force", "1");
  return NextResponse.redirect(login);
}

export const config = {
  // `icons/` is public for the same reason `manifest.webmanifest` is: iOS
  // fetches the home-screen icon without the session, and a redirect to /login
  // would be saved to the home screen as an HTML page instead of the mark.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|icons/|manifest.webmanifest).*)"],
};
