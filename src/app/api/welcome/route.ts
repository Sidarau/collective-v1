import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import { mintSession } from "@core/session";
import { writeAudit } from "@core/audit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Redeem a phone/WhatsApp invite: capture the email (the account key),
 * link the invite's phone, and open the right door — returning guests become
 * members instantly (skip application + Dominik's screening) and go set a
 * password; new prospects continue into the application.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { token?: string; email?: string; firstName?: string; lastName?: string };
    const token = body.token?.trim();
    const email = body.email?.toLowerCase().trim();
    if (!token || !email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: invite } = await supabase
      .from("invite_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!invite || invite.used_at || invite.expires_at < new Date().toISOString()) {
      return NextResponse.json({ error: "This invitation has expired or was already used" }, { status: 410 });
    }

    const firstName = body.firstName?.trim() || invite.first_name || email.split("@")[0];
    const lastName = body.lastName?.trim() || invite.last_name || "";
    const asMember = invite.kind === "member_returning";

    // Lead row (CRM identity).
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .upsert(
        {
          email,
          first_name: firstName,
          last_name: lastName,
          phone: invite.phone,
          whatsapp: invite.phone,
          source: asMember ? "whatsapp_fast_track" : "whatsapp_invite",
          status: "active",
        },
        { onConflict: "email" }
      )
      .select()
      .single();
    if (leadError || !lead) throw new Error(leadError?.message || "Lead upsert failed");

    // Account. If the email already exists, link the phone; never downgrade a role.
    const { data: existing } = await supabase
      .from("users")
      .select("id, email, role, lead_id, phone")
      .eq("email", email)
      .maybeSingle();

    let user = existing;
    if (existing) {
      if (existing.phone && existing.phone !== invite.phone) {
        return NextResponse.json(
          { error: "That email is already linked to a different number — enter with your email instead" },
          { status: 409 }
        );
      }
      const role = asMember && existing.role === "lead" ? "member" : existing.role;
      const { data: updated } = await supabase
        .from("users")
        .update({ phone: invite.phone, phone_verified: !!invite.phone, role, lead_id: existing.lead_id || lead.id })
        .eq("id", existing.id)
        .select("id, email, role, lead_id, phone")
        .single();
      user = updated || existing;
    } else {
      const { data: phoneTaken } = invite.phone
        ? await supabase.from("users").select("id").eq("phone", invite.phone).maybeSingle()
        : { data: null };
      if (phoneTaken) {
        return NextResponse.json(
          { error: "This number is already linked to another account" },
          { status: 409 }
        );
      }
      const { data: created, error: userError } = await supabase
        .from("users")
        .insert({
          email,
          role: asMember ? "member" : "lead",
          lead_id: lead.id,
          phone: invite.phone,
          phone_verified: !!invite.phone,
        })
        .select("id, email, role, lead_id, phone")
        .single();
      if (userError || !created) throw new Error(userError?.message || "Account creation failed");
      user = created;
    }

    // Seed the profile shell for members so onboarding pre-fills.
    if (asMember && user) {
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (!profile) {
        await supabase.from("profiles").insert({
          user_id: user.id,
          first_name: firstName,
          last_name: lastName,
          phone: invite.phone,
          whatsapp: invite.phone,
          onboarding_completed: false,
        });
      }
    }

    await supabase
      .from("invite_tokens")
      .update({ used_at: new Date().toISOString(), used_by: user!.id })
      .eq("id", invite.id);

    await writeAudit({
      actorId: invite.created_by,
      action: asMember ? "invite.redeemed_member" : "invite.redeemed_lead",
      entityType: "user",
      entityId: user!.id,
      summary: `${firstName} ${lastName} redeemed a ${asMember ? "returning-member" : "prospect"} WhatsApp invite (${email})`,
      meta: { invite_id: invite.id, phone: invite.phone },
    });

    const minted = await mintSession(user!);
    const destination = asMember ? "/setup-password" : "/join";
    const res = NextResponse.json({ success: true, destination });
    res.cookies.set({ name: minted.cookie.name, value: minted.sessionJwt, ...minted.cookie.options });
    return res;
  } catch (error) {
    console.error("Welcome redemption error:", error);
    return NextResponse.json({ error: "Something went wrong — try again" }, { status: 500 });
  }
}
