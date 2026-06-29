import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export type UserRole = "lead" | "member" | "admin" | "operator";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  leadId?: string | null;
}

function sessionToUser(session: Session): SessionUser {
  return session.user as SessionUser;
}

export function requireLead(session: Session | null): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = sessionToUser(session);
  if (!["lead", "member", "admin", "operator"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export function requireAdminOrOperator(session: Session | null): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = sessionToUser(session);
  if (!["admin", "operator"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function getAuthUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return sessionToUser(session);
}
