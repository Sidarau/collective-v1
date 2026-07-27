import * as crypto from "node:crypto";
import { config } from "./config";
import type { CalendarOAuthInviteRow } from "./database.types";
import { getSupabaseAdmin } from "./supabase";
import {
  signCalendarOAuthTargetValue,
  verifyCalendarOAuthTargetValue,
} from "./calendar-oauth-state";

const INVITE_TTL_MS = 48 * 60 * 60_000;

const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export async function mintCalendarOAuthInvite(input: {
  adminId: string;
  createdBy: string;
}): Promise<string> {
  const token = `gci_${crypto.randomBytes(32).toString("base64url")}`;
  const { error } = await getSupabaseAdmin().from("calendar_oauth_invites").insert({
    admin_id: input.adminId,
    created_by: input.createdBy,
    token_hash: hash(token),
    expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(error.message);
  return token;
}

export async function resolveCalendarOAuthInvite(
  token: string
): Promise<CalendarOAuthInviteRow | null> {
  if (!token.startsWith("gci_")) return null;
  const { data } = await getSupabaseAdmin()
    .from("calendar_oauth_invites")
    .select("*")
    .eq("token_hash", hash(token))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return (data as CalendarOAuthInviteRow | null) || null;
}

export async function validateCalendarOAuthInviteTarget(
  inviteId: string,
  adminId: string
): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("calendar_oauth_invites")
    .select("id")
    .eq("id", inviteId)
    .eq("admin_id", adminId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

export async function consumeCalendarOAuthInvite(inviteId: string): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from("calendar_oauth_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Calendar setup link expired");
}

/** Signed browser handoff between OAuth start and callback; contains no secret. */
export function signCalendarOAuthTarget(invite: {
  id: string;
  admin_id: string;
}): string {
  return signCalendarOAuthTargetValue(
    { inviteId: invite.id, adminId: invite.admin_id },
    config.nextAuthSecret
  );
}

export function verifyCalendarOAuthTarget(
  signed: string
): { inviteId: string; adminId: string } | null {
  return verifyCalendarOAuthTargetValue(signed, config.nextAuthSecret);
}
