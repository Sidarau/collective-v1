import "server-only";

/**
 * Server-side route guard for the mobile operator surface.
 *
 * Enforced deploys (MOBILE_AUTH_GUARD=enforced) require an admin/operator
 * NextAuth session on every private route. Preview deploys (fixture review)
 * run guardless and serve fixtures. See `page-params.ts` for the env logic.
 */

import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
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
 * Resolves the caller's principal from the NextAuth session JWT.
 * Returns null when unauthenticated, or when the role is not allowed to
 * operate. Never trusts client hints — the JWT is the only source.
 */
export async function getOperatorPrincipal(): Promise<OperatorPrincipal | null> {
  const headerList = await headers();
  const token = await getToken({
    req: { headers: headerList } as unknown as Parameters<typeof getToken>[0]["req"],
    secret: config.nextAuthSecret,
    cookieName: sessionCookieName,
  });

  if (!token?.sub || !token.email) return null;
  const role = token.role as UserRole | undefined;
  if (!role || !OPERATOR_ROLES.includes(role)) return null;

  return {
    id: token.sub,
    email: token.email,
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
