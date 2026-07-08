import * as crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { config } from "@core/config";
import { sendMagicLinkEmail } from "@core/email";
import { getSupabaseAdmin } from "@core/supabase";

export const runtime = "nodejs";

const RESPONSE = {
  success: true,
  message:
    "If that address belongs to an operator account, a password setup link is on its way.",
};

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();
    const supabase = getSupabaseAdmin();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("email", normalized)
      .maybeSingle();
    if (userError) throw new Error(userError.message);

    if (user && ["admin", "operator"].includes(String(user.role))) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ password_hash: null })
        .eq("id", user.id);
      if (updateError) throw new Error(updateError.message);

      const token = crypto.randomBytes(32).toString("hex");
      const { error: tokenError } = await supabase.from("magic_tokens").insert({
        user_id: user.id,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (tokenError) throw new Error(tokenError.message);

      const baseUrl = (config.adminUrl || config.baseUrl).replace(/\/$/, "");
      const link = `${baseUrl}/login?email=${encodeURIComponent(user.email)}&token=${token}`;
      await sendMagicLinkEmail({
        to: user.email,
        firstName: user.email.split("@")[0],
        magicLink: link,
        intro:
          "Use this one-time operator entrance link to choose a new password for the Collective console.",
        cta: "Choose a new password",
        template: "operator_password_reset",
        entityType: "user",
        entityId: user.id,
      });
    }

    return NextResponse.json(RESPONSE);
  } catch (error) {
    console.error("operator password reset error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
