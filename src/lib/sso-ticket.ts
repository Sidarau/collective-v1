import "server-only";
import { createHmac, randomUUID } from "node:crypto";

/**
 * SSO bridge ticket — collective-v1 (identity owner) side.
 *
 * After a founder confirms their member session here (magic link / password),
 * the bridge route mints a short-lived HMAC ticket and redirects to
 * opencollective.clawpanel.app/auth/oc/callback, which verifies it with the
 * same shared secret (OC_SSO_SECRET).
 *
 * Stateless: 60s expiry; provisioning on the other side is idempotent, so a
 * replayed ticket inside the window is harmless. Ticket format:
 *   base64url(JSON payload) + "." + base64url(HMAC-SHA256(body))
 */

const OC_SSO_SECRET = () => {
  const v = process.env.OC_SSO_SECRET;
  if (!v) throw new Error("Missing required env var: OC_SSO_SECRET");
  return v;
};

export const CLAWPANEL_OC_BASE = () =>
  process.env.CLAWPANEL_OC_BASE || "https://opencollective.clawpanel.app";

const TICKET_TTL_SECONDS = 60;

export interface OcTicketPayload {
  sub: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  exp: number;
  nonce: string;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function mintTicket(p: Omit<OcTicketPayload, "exp" | "nonce">): string {
  const payload: OcTicketPayload = {
    ...p,
    exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
    nonce: randomUUID(),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", OC_SSO_SECRET()).update(body).digest());
  return `${body}.${sig}`;
}

export function callbackUrl(ticket: string, next: string): string {
  const safeNext = next.startsWith("/") ? next : "/pm";
  const u = new URL(`${CLAWPANEL_OC_BASE()}/auth/oc/callback`);
  u.searchParams.set("ticket", ticket);
  u.searchParams.set("next", safeNext);
  return u.toString();
}
