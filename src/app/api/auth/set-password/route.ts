import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import { hashPassword } from "@core/password";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password } = (await req.json()) as { password?: string };
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const hash = await hashPassword(password);
    const { error } = await getSupabaseAdmin()
      .from("users")
      .update({ password_hash: hash })
      .eq("email", session.user.email);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, message: "Password set" });
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set password" },
      { status: 500 }
    );
  }
}
