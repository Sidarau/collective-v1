import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendMagicLinkEmail } from "@/lib/email";
import { updateContactMagicLink, getHubSpotContactByEmail } from "@/lib/hubspot";
import { config } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabaseAdmin = getSupabaseAdmin();

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email, lead_id")
      .eq("email", normalizedEmail)
      .single();

    if (!user) {
      // Don't reveal whether email exists
      return NextResponse.json(
        { success: true, message: "If an account exists, a magic link has been sent." },
        { status: 200 }
      );
    }

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from("magic_tokens").insert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
    });

    // Point at the server-side consumption route (top-level GET navigation that
    // sets the session cookie + 302s to the portal). This is the Safari/iOS-safe
    // path; the old /login?... client auto-login flow set the cookie over XHR,
    // which Safari ITP / iOS Gmail WebView dropped.
    const magicLink = `${config.baseUrl}/api/auth/magic?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

    // Try to update HubSpot contact
    try {
      const contactId = await getHubSpotContactByEmail(normalizedEmail);
      if (contactId) {
        await updateContactMagicLink(contactId, magicLink);
      }
    } catch (hubspotError) {
      console.error("Failed to update HubSpot with magic link:", hubspotError);
    }

    // Try to send email
    try {
      await sendMagicLinkEmail({ to: normalizedEmail, firstName: normalizedEmail.split("@")[0], magicLink });
    } catch (emailError) {
      console.error("Failed to send magic link email:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists, a magic link has been sent.",
      // Only expose link in non-production for testing
      ...(config.nodeEnv !== "production" ? { magicLink } : {}),
    });
  } catch (error) {
    console.error("Magic link error:", error);
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 });
  }
}
