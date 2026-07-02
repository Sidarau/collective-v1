import "server-only";
import { getServerSession } from "next-auth/next";
import { buildAuthOptions, type SessionUser } from "@core/auth-options";

export const authOptions = buildAuthOptions();

export async function getAdminUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user || !["admin", "operator"].includes(user.role)) return null;
  return user;
}
