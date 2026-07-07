import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { buildAuthOptions, type SessionUser, type UserRole } from "@core/auth-options";
import { getSupabaseAdmin } from "@core/supabase";

export type { SessionUser, UserRole };

// Single AuthOptions instance shared by the route handler and helpers.
export const authOptions = buildAuthOptions();

export async function getAuthUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function getAuthUserWithPassword(): Promise<
  (SessionUser & { hasPassword: boolean }) | null
> {
  const user = await getAuthUser();
  if (!user) return null;

  const { data } = await getSupabaseAdmin()
    .from("users")
    .select("password_hash")
    .eq("id", user.id)
    .maybeSingle();

  return { ...user, hasPassword: Boolean(data?.password_hash) };
}

export function requireMemberTier(session: Session | null): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as SessionUser).role;
  if (!["member", "admin", "operator"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export function requireAnyUser(session: Session | null): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
