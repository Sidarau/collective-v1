import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import * as crypto from "crypto";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { sendMagicLinkEmail } from "../../../../lib/email";
import { updateContactMagicLink, getHubSpotContactByEmail } from "../../../../lib/hubspot";
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

    // Create lead record for the invitee
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        source: "admin_invite",
        status: "new",
      })
      .select()
      .single();

    if (leadError || !lead) {
      throw new Error(leadError?.message || "Failed to create lead");
    }

    // Upsert user (idempotent)
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      await supabaseAdmin.from("users").update({ role, lead_id: lead.id }).eq("id", userId);
    } else {
      const { data: newUser, error: userError } = await supabaseAdmin
        .from("users")
        .insert({ email, role, lead_id: lead.id })
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

    // Update HubSpot contact if exists
    try {
      const contactId = await getHubSpotContactByEmail(email);
      if (contactId) {
        await updateContactMagicLink(contactId, inviteLink);
      }
    } catch (hubspotError: unknown) {
      console.error("Failed to update HubSpot contact:", hubspotError);
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
