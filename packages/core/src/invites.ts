import * as crypto from "crypto";
import { getSupabaseAdmin } from "./supabase";
import { sendMagicLinkEmail } from "./email";
import { getHubSpotContactByEmail, updateContactMagicLink } from "./hubspot";
import type { UserRole } from "./database.types";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Mint a one-time magic token for an existing user. Returns the login URL. */
export async function mintMagicLink(userId: string, email: string, baseUrl: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const { error } = await getSupabaseAdmin().from("magic_tokens").insert({
    user_id: userId,
    token,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  });
  if (error) throw new Error(`Failed to mint magic token: ${error.message}`);
  return `${baseUrl}/api/auth/magic?email=${encodeURIComponent(email)}&token=${token}`;
}

export interface CreateInviteParams {
  email: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  source: string; // e.g. "admin_invite", "member_referral:<name>"
  baseUrl: string; // app origin the magic link should open
  sendEmail?: boolean;
  emailIntro?: string;
}

export interface CreateInviteResult {
  userId: string;
  leadId: string | null;
  inviteLink: string;
  existing: boolean;
}

/**
 * Invite flow shared by admin console and member referrals:
 * upsert lead + user (role lead by default), mint a one-time magic link,
 * optionally email it, and mirror it onto the HubSpot contact if one exists.
 */
export async function createInvite(params: CreateInviteParams): Promise<CreateInviteResult> {
  const supabase = getSupabaseAdmin();
  const email = params.email.toLowerCase().trim();
  const role = params.role || "lead";

  const { data: existingUser } = await supabase
    .from("users")
    .select("id, lead_id")
    .eq("email", email)
    .maybeSingle();

  let userId: string;
  let leadId: string | null = existingUser?.lead_id ?? null;
  const existing = !!existingUser;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .upsert(
        {
          email,
          first_name: params.firstName,
          last_name: params.lastName,
          source: params.source,
          status: "new",
        },
        { onConflict: "email" }
      )
      .select()
      .single();
    if (leadError || !lead) {
      throw new Error(leadError?.message || "Failed to create lead");
    }
    leadId = lead.id;

    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({ email, role, lead_id: lead.id })
      .select()
      .single();
    if (userError || !newUser) {
      throw new Error(userError?.message || "Failed to create user");
    }
    userId = newUser.id;
  }

  const inviteLink = await mintMagicLink(userId, email, params.baseUrl);

  if (params.sendEmail !== false) {
    try {
      await sendMagicLinkEmail({
        to: email,
        firstName: params.firstName,
        magicLink: inviteLink,
        intro: params.emailIntro,
      });
    } catch (err) {
      console.error("Invite email failed (link still valid):", err);
    }
  }

  try {
    const contactId = await getHubSpotContactByEmail(email);
    if (contactId) await updateContactMagicLink(contactId, inviteLink);
  } catch (err) {
    console.error("HubSpot magic_link mirror failed:", err);
  }

  return { userId, leadId, inviteLink, existing };
}
