/**
 * Single source of truth for the NextAuth session cookie (see ZEUG-414).
 *
 * `next-auth`'s `getToken()` derives the cookie NAME from `secureCookie`. If
 * the handler that WRITES the cookie uses a different name than the middleware
 * that READS it, every protected request bounces to /login. Writer and reader
 * both import from here so they can never drift apart.
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

// `sameSite: "lax"` (NOT "none"): the whole flow is same-origin. Lax is sent
// on top-level navigations and survives Safari ITP / iOS in-app WebViews.
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: useSecureCookies,
};
