import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Edge guard for the mobile operator surface.
 *
 * MOBILE_AUTH_GUARD=enforced → every route except the public set requires an
 * admin/operator session JWT; anything else bounces to /login, and /login
 * itself bounces authenticated operators back to Today. Preview deploys
 * (guard unset) pass everything through so fixtures stay reviewable.
 *
 * Cookie name/options mirror `@core/auth-cookies` — duplicated here because
 * middleware runs in the edge bundle and vendor-core is synced at build time.
 */
const PUBLIC_PATHS = [/^\/login(?:\/|$)/, /^\/api\/auth(?:\/|$)/];

const useSecureCookies =
  process.env.NEXTAUTH_URL?.startsWith("https://") ?? Boolean(process.env.VERCEL);
const sessionCookieName = useSecureCookies
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";

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
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // `icons/` is public for the same reason `manifest.webmanifest` is: iOS
  // fetches the home-screen icon without the session, and a redirect to /login
  // would be saved to the home screen as an HTML page instead of the mark.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|icons/|manifest.webmanifest).*)"],
};
