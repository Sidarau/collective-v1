import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { sessionCookieName } from "@core/auth-cookies";

/**
 * Edge guard for the mobile operator surface.
 *
 * MOBILE_AUTH_GUARD=enforced → every route except the public set requires an
 * admin/operator session JWT; anything else bounces to /login, and /login
 * itself bounces authenticated operators back to Today. Preview deploys
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
  if (token?.sub && role && OPERATOR_ROLES.has(role)) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  // Carry the query, not just the path. A shared install link is
  // `/?a2hs=invite&from=…`, and a member who is not signed in yet is exactly
  // who those links are sent to — dropping the search here landed them on a
  // bare Today after login, with nothing to show for having followed the link.
  // Set before the redirect is built: NextResponse.redirect() snapshots the
  // URL, so mutating `login` afterwards is silently lost.
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // `icons/` is public for the same reason `manifest.webmanifest` is: iOS
  // fetches the home-screen icon without the session, and a redirect to /login
  // would be saved to the home screen as an HTML page instead of the mark.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|icons/|manifest.webmanifest).*)"],
};
