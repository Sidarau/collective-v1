import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import { mintMagicLink } from "@core/invites";
import { sendMagicLinkEmail } from "@core/email";
import { config } from "@core/config";

export const runtime = "nodejs";

/**
 * Request a fresh entrance link. Only works for existing accounts —
 * membership is referral-only. Responds identically whether or not the
 * account exists (no membership enumeration).
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const normalized = email.toLowerCase().trim();

    const { data: user } = await getSupabaseAdmin()
      .from("users")
      .select("id, email")
      .eq("email", normalized)
      .maybeSingle();

    if (user) {
      const link = await mintMagicLink(user.id, user.email, config.baseUrl);
      try {
        await sendMagicLinkEmail({
          to: user.email,
          firstName: user.email.split("@")[0],
          magicLink: link,
        });
      } catch (err) {
        console.error("magic-link email failed:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: "If that address belongs to the Circle, a fresh entrance link is on its way.",
    });
  } catch (error) {
    console.error("magic-link error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
