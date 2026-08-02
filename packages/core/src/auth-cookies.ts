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

/**
 * One session across the apps on `opencollective.app`.
 *
 * Without a Domain the cookie is *host-only*: a session minted on
 * `opencollective.app` is simply never sent to `mobile.opencollective.app`,
 * so the mobile guard sees no cookie at all and bounces to /login — on a
 * sign-in that had just succeeded. Setting `SESSION_COOKIE_DOMAIN` to
 * `.opencollective.app` scopes it to the parent so every app under it shares
 * one login.
 *
 * Requirements, all of them:
 *   • Every participating app sets the SAME value here, and the SAME
 *     `NEXTAUTH_SECRET` — a cookie the next app cannot decrypt is worse than
 *     no cookie, because it looks like a valid session that always fails.
 *   • The host must actually sit under this domain. A `.vercel.app` value can
 *     never work: it is on the Public Suffix List and browsers refuse it.
 *   • `__Secure-` permits a Domain attribute (`__Host-` would not), so the
 *     cookie NAME is unchanged and readers need no update.
 *
 * Trade-off worth stating: a domain-scoped cookie is readable by every
 * subdomain, so one compromised subdomain exposes the session everywhere.
 * Left unset, the cookie stays host-only and each app logs in separately.
 */
export const sessionCookieDomain: string | undefined =
  process.env.SESSION_COOKIE_DOMAIN?.trim() || undefined;

// `sameSite: "lax"` (NOT "none"): the whole flow is same-origin. Lax is sent
// on top-level navigations and survives Safari ITP / iOS in-app WebViews.
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: useSecureCookies,
  ...(sessionCookieDomain ? { domain: sessionCookieDomain } : {}),
};
