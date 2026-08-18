import "server-only";
import * as crypto from "crypto";
import { getSupabaseAdmin } from "@core/supabase";
import type { ReferralLinkRow } from "@core/database.types";

/**
 * Personal referral doors (T5 — oc-referral-link).
 *
 * Every member gets exactly one persistent /r/<code> door, minted lazily the
 * first time their Refer block renders. The code is 18 lowercase hex chars
 * (72 bits) — unguessable, and lowercase-safe because loadActiveReferralLink
 * lowercases incoming codes before matching.
 *
 * Ownership is `referral_links.created_by = <member user id>`: that is what
 * the approval path reads to open referral credit, so a personal door always
 * attributes back to its member. Admin-console doors are created_by an admin
 * id and never collide with this lookup.
 */
export async function getOrCreatePersonalDoor(userId: string): Promise<ReferralLinkRow | null> {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("referral_links")
    .select("*")
    .eq("created_by", userId)
    .eq("kind", "member")
    .order("active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as ReferralLinkRow;

  // The label doubles as the application's referred_by fallback and reads in
  // admin copy ("came through the <label> link"), so it is the member's name.
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle();
  const name = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = crypto.randomBytes(9).toString("hex");
    const { data, error } = await supabase
      .from("referral_links")
      .insert({
        code,
        kind: "member",
        label: name || "Personal door",
        note: "Personal referral door — auto-minted for the member's Refer block.",
        labels: ["personal"],
        active: true,
        created_by: userId,
      })
      .select("*")
      .single();
    if (data) return data as ReferralLinkRow;

    // Lost a race with a concurrent mint, or hit the unique code constraint:
    // re-read first (someone else's insert may have landed), then retry.
    const { data: raced } = await supabase
      .from("referral_links")
      .select("*")
      .eq("created_by", userId)
      .eq("kind", "member")
      .limit(1)
      .maybeSingle();
    if (raced) return raced as ReferralLinkRow;
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      console.error("Personal door mint failed:", error.message);
      return null;
    }
  }
  return null;
}
