import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type SessionUser } from "@/lib/auth";
import { createInvite } from "@core/invites";
import { config } from "@core/config";
import { getSupabaseAdmin } from "@core/supabase";

export const runtime = "nodejs";

/**
 * Member referral: an approved member (or host) opens the door for someone.
 * Creates the lead+user and emails a one-time entrance link that lands on the
 * introduction form. The invite link itself is never returned to the browser.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    if (!["member", "admin", "operator"].includes(user.role)) {
      return NextResponse.json({ error: "Membership required" }, { status: 403 });
    }

    const { email, firstName, lastName } = (await req.json()) as Record<string, string>;
    if (!email || !firstName || !lastName) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    // Referrer's display name for attribution.
    const { data: referrer } = await getSupabaseAdmin()
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const referrerName = referrer
      ? `${referrer.first_name} ${referrer.last_name}`.trim()
      : user.email;

    const result = await createInvite({
      email,
      firstName,
      lastName,
      role: "lead",
      source: `member_referral:${referrerName}`,
      baseUrl: config.baseUrl,
      emailIntro: `${referrerName} has opened the door to ${config.brandName} for you. Your private entrance link is below — it expires in 7 days and works once.`,
    });

    return NextResponse.json({
      success: true,
      existing: result.existing,
      message: result.existing
        ? "They're already known to the Circle — a fresh entrance link is on its way to them."
        : `Invitation sent to ${email}.`,
    });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ error: "Failed to send the invitation" }, { status: 500 });
  }
}
