const PARENT_HOST = "opencollective.app";

/**
 * Sanitizes an attacker-supplied `next`. Two shapes are allowed:
 *
 *   - a path on this origin ("/spaces", "/?a2hs=invite") — returned relative
 *   - an absolute https URL on opencollective.app or any subdomain — returned
 *     absolute. Single-login: the admin console sends operators back to the
 *     mobile app, which shares the *.opencollective.app session cookie.
 *
 * Everything else (foreign hosts, http:, protocol-relative "//", backslash
 * tricks) falls back. The URL parser normalizes "\/" and "\\" into real
 * protocol-relative URLs, which the host check then rejects.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;

  try {
    if (value.startsWith("/")) {
      if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
      const parsed = new URL(value, `https://${PARENT_HOST}`);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return fallback;
    if (parsed.hostname !== PARENT_HOST && !parsed.hostname.endsWith(`.${PARENT_HOST}`)) {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}
