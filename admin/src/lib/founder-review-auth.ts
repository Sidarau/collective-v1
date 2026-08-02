import "server-only";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import type { SessionUser } from "@core/auth-options";

const FOUNDER_EMAILS = new Set([
  "alex@mission-mastery.com",
  "alex@zeuglab.com",
  "dominik@mission-mastery.com",
  "manuel@mission-mastery.com",
]);

export type FounderReviewAccess =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "authorized"; user: { id: string; email: string } };

export function isFounderReviewEmail(email: string): boolean {
  return FOUNDER_EMAILS.has(email.toLowerCase().trim());
}

/**
 * Secure founder-review authorization.
 *
 * The session is only the identity hint. The live users row is re-read for
 * every review page/file request so a role or email change takes effect
 * immediately. Only the four founder admin accounts pass.
 */
export async function getFounderReviewAccess(): Promise<FounderReviewAccess> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;
  if (!sessionUser?.id) return { status: "unauthenticated" };

  const { data: user, error } = await getSupabaseAdmin()
    .from("users")
    .select("id, email, role")
    .eq("id", sessionUser.id)
    .maybeSingle();

  if (error || !user) return { status: "forbidden" };
  if (user.role !== "admin" || !isFounderReviewEmail(user.email)) {
    return { status: "forbidden" };
  }

  return {
    status: "authorized",
    user: { id: user.id, email: user.email },
  };
}
