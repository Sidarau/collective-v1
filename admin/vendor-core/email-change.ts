import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "./config";
import { getSupabaseAdmin } from "./supabase";
import { sendTrackedEmail } from "./email";
import type { EmailChangeRequestRow } from "./database.types";

/**
 * Email change with verification — PHASE_2_HANDOFF.md §2 of the account sheet.
 *
 * The six-step contract:
 *   1. Operator requests the change while authenticated.
 *   2. A signed, single-use, short-expiry token goes to the NEW address.
 *      Nothing about the account changes at this point.
 *   3. The OLD address gets a notification with a cancel link — this is what
 *      makes account takeover recoverable.
 *   4. Only the new address confirming changes `users.email`, and the change
 *      is written to the audit trail with actor, timestamp and both values.
 *   5. `users.token_version` bumps, so every existing session is re-validated
 *      and dies on its next request (see the jwt callback in auth-options).
 *   6. Requests are rate-limited per account and pending requests expire.
 *
 * Table: `email_change_requests` (migration 011).
 */

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_PENDING_PER_ACCOUNT = 3;

export type EmailChangeRow = EmailChangeRequestRow;

function sign(value: string): string {
  return createHmac("sha256", config.nextAuthSecret).update(value).digest("base64url");
}

function mintToken(): string {
  return `${randomBytes(24).toString("base64url")}.${sign(randomBytes(8).toString("base64url"))}`;
}

const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

export type RequestResult =
  | { ok: true; requestId: string }
  | { ok: false; reason: "invalid_email" | "same_email" | "email_in_use" | "rate_limited" | "server_error" };

/** Step 1–3: validate, rate-limit, mint tokens, notify both addresses. */
export async function requestEmailChange(
  userId: string,
  currentEmail: string,
  rawNewEmail: string,
  requestedIp?: string | null,
): Promise<RequestResult> {
  const newEmail = rawNewEmail.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return { ok: false, reason: "invalid_email" };
  if (newEmail === currentEmail.toLowerCase()) return { ok: false, reason: "same_email" };

  const db = getSupabaseAdmin();
  try {
    // The new address must not belong to another account.
    const { data: existing } = await db
      .from("users")
      .select("id")
      .eq("email", newEmail)
      .neq("id", userId)
      .maybeSingle();
    if (existing) return { ok: false, reason: "email_in_use" };

    // Rate limit per account, and expire stale pendings in the same pass.
    await db
      .from("email_change_requests")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());
    const { count } = await db
      .from("email_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");
    if ((count ?? 0) >= MAX_PENDING_PER_ACCOUNT) return { ok: false, reason: "rate_limited" };

    const row = {
      user_id: userId,
      old_email: currentEmail.toLowerCase(),
      new_email: newEmail,
      token: mintToken(),
      cancel_token: mintToken(),
      requested_ip: requestedIp ?? null,
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    };
    const { data: inserted, error } = await db
      .from("email_change_requests")
      .insert(row)
      .select("id")
      .single();
    if (error || !inserted) return { ok: false, reason: "server_error" };

    const confirmLink = `${config.baseUrl.replace(/\/$/, "")}/api/auth/email-change/confirm?token=${encodeURIComponent(row.token)}`;
    const cancelLink = `${config.baseUrl.replace(/\/$/, "")}/api/auth/email-change/cancel?token=${encodeURIComponent(row.cancel_token)}`;

    // 2. Token to the NEW address — the account is unchanged until they confirm.
    await sendTrackedEmail({
      to: newEmail,
      subject: "Confirm your new sign-in address",
      heading: "Confirm this address",
      body: `You asked to make this the sign-in address for your ${config.brandName} operator account. The change only happens when you confirm — if this was not you, ignore this email and nothing changes.`,
      ctaHref: confirmLink,
      ctaLabel: "Confirm new address",
      footnote: "This link expires in 30 minutes and works once.",
      template: "email_change_confirm",
      entityType: "user",
      entityId: userId,
      meta: { confirm_link: confirmLink },
    });

    // 3. Notification to the OLD address, with the way to stop it.
    await sendTrackedEmail({
      to: currentEmail,
      subject: "A sign-in address change was requested",
      heading: "Was this you?",
      body: `Someone asked to change the sign-in address on your ${config.brandName} operator account to ${newEmail}. Nothing has changed yet. If this was not you, stop it now — your current address keeps working either way.`,
      ctaHref: cancelLink,
      ctaLabel: "Stop this change",
      template: "email_change_alert",
      entityType: "user",
      entityId: userId,
      meta: { cancel_link: cancelLink },
    });

    return { ok: true, requestId: inserted.id };
  } catch (e) {
    console.error("[email-change] request failed:", e instanceof Error ? e.message : e);
    return { ok: false, reason: "server_error" };
  }
}

export type ConfirmResult =
  | { ok: true; newEmail: string }
  | { ok: false; reason: "link_invalid" | "email_in_use" | "server_error" };

/** Step 4–5: the new address confirms; the address changes and sessions die. */
export async function confirmEmailChange(rawToken: string | null): Promise<ConfirmResult> {
  const token = rawToken?.trim();
  if (!token) return { ok: false, reason: "link_invalid" };

  const db = getSupabaseAdmin();
  try {
    const { data: request } = await db
      .from("email_change_requests")
      .select("*")
      .eq("status", "pending")
      .gte("expires_at", new Date().toISOString())
      .then(async (r) => {
        // Compare in app code so the token match is constant-time.
        const rows = (r.data as EmailChangeRow[] | null) ?? [];
        return { data: rows.find((row) => safeEqual(row.token, token)) ?? null };
      });
    if (!request) return { ok: false, reason: "link_invalid" };

    // Re-check the address is still free — it may have been taken since the request.
    const { data: taken } = await db
      .from("users")
      .select("id")
      .eq("email", request.new_email)
      .neq("id", request.user_id)
      .maybeSingle();
    if (taken) return { ok: false, reason: "email_in_use" };

    const { data: user } = await db
      .from("users")
      .select("id, email, token_version")
      .eq("id", request.user_id)
      .single();
    if (!user) return { ok: false, reason: "server_error" };

    const nextVersion = ((user as { token_version?: number }).token_version ?? 1) + 1;
    const { error: updateError } = await db
      .from("users")
      .update({ email: request.new_email, token_version: nextVersion })
      .eq("id", request.user_id);
    if (updateError) return { ok: false, reason: "server_error" };

    await db
      .from("email_change_requests")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", request.id);

    // 4. The audit entry — actor, timestamp, both values.
    await db.from("audit_logs").insert({
      actor_id: request.user_id,
      actor_email: request.new_email,
      action: "user.email_change",
      entity_type: "user",
      entity_id: request.user_id,
      summary: `Sign-in address changed from ${request.old_email} to ${request.new_email}`,
      meta: { old_email: request.old_email, new_email: request.new_email, request_id: request.id },
    });

    return { ok: true, newEmail: request.new_email };
  } catch (e) {
    console.error("[email-change] confirm failed:", e instanceof Error ? e.message : e);
    return { ok: false, reason: "server_error" };
  }
}

/** The old address stops the change — takeover recovery. */
export async function cancelEmailChange(rawToken: string | null): Promise<boolean> {
  const token = rawToken?.trim();
  if (!token) return false;

  const db = getSupabaseAdmin();
  const { data: rows } = await db
    .from("email_change_requests")
    .select("*")
    .eq("status", "pending");
  const match = ((rows as EmailChangeRow[] | null) ?? []).find((row) => safeEqual(row.cancel_token, token));
  if (!match) return false;

  await db
    .from("email_change_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", match.id);
  return true;
}
