import "server-only";

/**
 * Server-side route guard for the mobile operator surface.
 *
 * Enforced deploys (MOBILE_AUTH_GUARD=enforced) require an admin/operator
 * NextAuth session on every private route. Preview deploys (fixture review)
 * run guardless and serve fixtures. See `page-params.ts` for the env logic.
 */

import { decode, type JWT } from "next-auth/jwt";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "@core/config";
import { sessionCookieName } from "@core/auth-cookies";
import type { UserRole } from "@core/database.types";
import { isGuarded } from "./page-params";

export interface OperatorPrincipal {
  id: string;
  email: string;
  role: UserRole;
  leadId: string | null;
}

const OPERATOR_ROLES: UserRole[] = ["admin", "operator"];

/**
 * Reads the raw session JWT out of the request cookies, reassembling
 * next-auth's chunked form (`name.0`, `name.1`, …) when the single cookie is
 * absent. Do NOT route this through `getToken({ req: { headers } })`: the
 * v4 SessionStore reads `req.headers.cookie` as a plain property, which a
 * Next 16 `Headers` instance does not have — the lookup silently returns
 * null and every signed-in operator bounces to /login. Verified in
 * production 2026-08-01: middleware (real NextRequest) passed while this
 * page guard rejected the same valid cookie.
 */
async function readSessionJwt(): Promise<string | null> {
  const store = await cookies();
  const single = store.get(sessionCookieName)?.value;
  if (single) return single;
  const parts: string[] = [];
  for (let i = 0; ; i++) {
    const part = store.get(`${sessionCookieName}.${i}`)?.value;
    if (!part) break;
    parts.push(part);
  }
  return parts.length > 0 ? parts.join("") : null;
}

/**
 * Resolves the caller's principal from the NextAuth session JWT.
 * Returns null when unauthenticated, or when the role is not allowed to
 * operate. Never trusts client hints — the JWT is the only source.
 */
export async function getOperatorPrincipal(): Promise<OperatorPrincipal | null> {
  const raw = await readSessionJwt();
  if (!raw) return null;

  // next-auth v4 getToken decodes with the default empty salt, matching how
  // @core/magic-consume mints the JWT — keep decode unsalted here too.
  let token: JWT | null = null;
  try {
    token = await decode({ token: raw, secret: config.nextAuthSecret });
  } catch {
    token = null;
  }

  if (!token?.sub || !token.email) return null;
  const role = token.role as UserRole | undefined;
  if (!role || !OPERATOR_ROLES.includes(role)) return null;

  return {
    id: token.sub,
    email: token.email as string,
    role,
    leadId: (token.leadId as string | null | undefined) ?? null,
  };
}

/**
 * Page guard. Preview deploys pass straight through so the fixture gallery
 * stays reachable; enforced deploys bounce unauthenticated callers to /login
 * and non-operator roles to the member portal.
 */
export async function requireOperator(): Promise<OperatorPrincipal | null> {
  if (!isGuarded()) return null;

  const principal = await getOperatorPrincipal();
  if (!principal) redirect("/login");
  return principal;
}
