/**
 * Single source of truth for the NextAuth session cookie.
 *
 * Why this file exists:
 * `next-auth`'s `getToken()` (used by `withAuth` middleware and `getServerSession`)
 * derives the cookie NAME from `secureCookie`, defaulting to
 *   secureCookie ? "__Secure-next-auth.session-token" : "next-auth.session-token"
 * (see node_modules/next-auth/jwt/index.js). If the handler that WRITES the cookie
 * uses a different name than the middleware that READS it, the session is invisible
 * to middleware and every /portal request bounces to /login. That was the original
 * bug. By computing the name/options here once and importing it everywhere
 * (authOptions, middleware, and the server-side magic-link route), writer and reader
 * can never drift apart.
 *
 * We mirror next-auth's own `secureCookie` detection exactly so the derived name
 * matches getToken's default even where we don't pass it explicitly.
 */

// Mirrors next-auth/jwt getToken's secureCookie default:
//   process.env.NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL
export const useSecureCookies: boolean =
  process.env.NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL;

export const sessionCookieName = useSecureCookies
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";

// 30 days, matching next-auth's DEFAULT_MAX_AGE.
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

// `sameSite: "lax"` (NOT "none"): the whole flow — login, callback, /portal — is
// same-origin. Lax is sent on top-level navigations and avoids Safari ITP / iOS
// in-app WebView partitioning that drops SameSite=None cookies set over fetch/XHR.
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: useSecureCookies,
};
