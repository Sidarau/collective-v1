import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import { hashPassword } from "@core/password";
import { getAdminUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password } = (await req.json()) as { password?: string };
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const { error } = await getSupabaseAdmin()
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin set password error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set password" },
      { status: 500 }
    );
  }
}
