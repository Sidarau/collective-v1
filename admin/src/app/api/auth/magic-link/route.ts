import { NextRequest, NextResponse } from "next/server";
import { config } from "@core/config";
import { sendMagicLinkEmail } from "@core/email";
import { mintMagicLink } from "@core/invites";
import { getSupabaseAdmin } from "@core/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();
    const { data: user } = await getSupabaseAdmin()
      .from("users")
      .select("id, email, role")
      .eq("email", normalized)
      .maybeSingle();

    if (user && ["admin", "operator"].includes(user.role)) {
      const link = await mintMagicLink(
        user.id,
        user.email,
        config.adminUrl || req.nextUrl.origin
      );
      try {
        await sendMagicLinkEmail({
          to: user.email,
          firstName: user.email.split("@")[0],
          magicLink: link,
          intro:
            "Your operator entrance to Collective is ready. This one-time link opens the admin console and expires in 7 days.",
          cta: "Open operator console",
          template: "operator_magic_link",
        });
      } catch (err) {
        console.error("operator magic-link email failed:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: "If that address is an operator account, a fresh entrance link is on its way.",
    });
  } catch (error) {
    console.error("operator magic-link error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
