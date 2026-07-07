import "server-only";
import { getServerSession } from "next-auth/next";
import { buildAuthOptions, type SessionUser } from "@core/auth-options";
import { getSupabaseAdmin } from "@core/supabase";

export const authOptions = buildAuthOptions();

export async function getAdminUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user || !["admin", "operator"].includes(user.role)) return null;
  return user;
}

export async function getAdminUserWithPassword(): Promise<
  (SessionUser & { hasPassword: boolean }) | null
> {
  const user = await getAdminUser();
  if (!user) return null;

  const { data } = await getSupabaseAdmin()
    .from("users")
    .select("password_hash")
    .eq("id", user.id)
    .maybeSingle();

  return { ...user, hasPassword: Boolean(data?.password_hash) };
}
