import { NextRequest, NextResponse } from "next/server";
import { config } from "@core/config";
import { sendPasswordResetLink } from "@core/invites";

export const runtime = "nodejs";

const RESPONSE = {
  success: true,
  message:
    "If that address belongs to the Circle, a password setup link is on its way.",
};

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    await sendPasswordResetLink({
      email,
      baseUrl: config.baseUrl,
      roles: ["member", "admin", "operator", "lead"],
      template: "member_password_reset",
    });

    return NextResponse.json(RESPONSE);
  } catch (error) {
    console.error("password reset error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
