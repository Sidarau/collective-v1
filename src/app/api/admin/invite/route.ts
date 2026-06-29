import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import * as crypto from "crypto";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { sendMagicLinkEmail } from "../../../../lib/email";
import { config } from "../../../../lib/config";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { role?: string };
    if (!["admin", "operator"].includes(user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, firstName, lastName, role = "lead" } = body;

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Email, first name, and last name are required" },
        { status: 400 }
      );
    }

    if (!["lead", "member", "admin", "operator"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Upsert user (idempotent)
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      await supabaseAdmin.from("users").update({ role }).eq("id", userId);
    } else {
      const { data: newUser, error: userError } = await supabaseAdmin
        .from("users")
        .insert({ email, role })
        .select()
        .single();

      if (userError || !newUser) {
        throw new Error(userError?.message || "Failed to create user");
      }
      userId = newUser.id;
    }

    // Create one-time magic token
    const magicToken = crypto.randomBytes(32).toString("hex");
    await supabaseAdmin.from("magic_tokens").insert({
      user_id: userId,
      token: magicToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const inviteLink = `${config.baseUrl}/login?email=${encodeURIComponent(
      email
    )}&token=${magicToken}`;

    try {
      await sendMagicLinkEmail({ to: email, firstName, magicLink: inviteLink });
    } catch (emailError: unknown) {
      console.error("Failed to send invite email:", emailError);
    }

    return NextResponse.json({
      success: true,
      userId,
      inviteLink,
      message: "Invite link generated. Share it securely with the recipient.",
    });
  } catch (error: unknown) {
    console.error("Admin invite error:", error);
    const message = error instanceof Error ? error.message : "Failed to create invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
