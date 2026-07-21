import "server-only";
import * as crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { getSupabaseAdmin } from "./supabase";
import { config } from "./config";
import { hashPassword, verifyPassword } from "./password";
import type { ExternalShareRow, LegalDocumentRow } from "./database.types";

/**
 * External confidential shares (ADR §5.3, threats T2/T3/T8/T9). Two factors
 * safe to distribute separately: an unguessable URL token (stored hashed) and
 * a per-recipient password (bcrypt, shown once). Opening the URL returns NO
 * document — the server verifies password + legal acceptance, mints a short
 * share-session cookie, and only then serves the pinned revision.
 */

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_TTL_S = 60 * 60; // 60 min
const sessionKey = () => new TextEncoder().encode(config.nextAuthSecret || "dev-secret-change-me");

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const hashForAudit = (v: string) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 32);

export interface CreateShareInput {
  nodeId: string;
  revisionId: string;
  recipientLabel: string;
  password?: string; // omit to auto-generate
  requireNda?: boolean;
  legalDocumentId?: string | null;
  watermark?: boolean;
  expiresAt?: string | null;
  maxViews?: number | null;
  createdBy?: string | null;
}

export interface CreatedShare {
  share: ExternalShareRow;
  token: string; // shown once
  password: string; // shown once
  url: string;
}

/** Create a share. Human-gated at the call site (kb.share is human-only). */
export async function createShare(input: CreateShareInput): Promise<CreatedShare> {
  const token = crypto.randomBytes(24).toString("base64url");
  const password = input.password && input.password.length >= 8
    ? input.password
    : crypto.randomBytes(9).toString("base64url"); // ~12 chars
  const { data, error } = await getSupabaseAdmin()
    .from("external_shares")
    .insert({
      node_id: input.nodeId,
      revision_id: input.revisionId,
      recipient_label: input.recipientLabel,
      token_hash: hashToken(token),
      token_prefix: token.slice(0, 6),
      password_hash: await hashPassword(password),
      require_nda: input.requireNda ?? false,
      legal_document_id: input.legalDocumentId ?? null,
      watermark: input.watermark ?? false,
      expires_at: input.expiresAt ?? null,
      max_views: input.maxViews ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Share create failed");
  const base = (config.baseUrl || "").replace(/\/$/, "");
  return { share: data as ExternalShareRow, token, password, url: `${base}/s/${token}` };
}

export async function getShareByToken(token: string): Promise<ExternalShareRow | null> {
  const { data } = await getSupabaseAdmin()
    .from("external_shares")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  return (data as ExternalShareRow) || null;
}

export type ShareState = "ok" | "revoked" | "expired" | "exhausted" | "locked";

/** Per-request validity — checked even when a session cookie is present (T8). */
export function shareState(share: ExternalShareRow): ShareState {
  if (share.revoked_at) return "revoked";
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) return "expired";
  if (share.max_views != null && share.view_count >= share.max_views) return "exhausted";
  if (share.locked_until && new Date(share.locked_until).getTime() > Date.now()) return "locked";
  return "ok";
}

export interface PasswordCheck {
  ok: boolean;
  locked: boolean;
}

/** Verify a share password with per-share throttling (T3). Generic on failure. */
export async function verifySharePassword(share: ExternalShareRow, password: string): Promise<PasswordCheck> {
  if (share.locked_until && new Date(share.locked_until).getTime() > Date.now()) {
    return { ok: false, locked: true };
  }
  const ok = await verifyPassword(password, share.password_hash);
  const supabase = getSupabaseAdmin();
  if (ok) {
    await supabase.from("external_shares").update({ failed_attempts: 0, locked_until: null }).eq("id", share.id);
    return { ok: true, locked: false };
  }
  const fails = share.failed_attempts + 1;
  if (fails >= MAX_FAILS) {
    await supabase
      .from("external_shares")
      .update({ failed_attempts: 0, locked_until: new Date(Date.now() + LOCK_MS).toISOString() })
      .eq("id", share.id);
    return { ok: false, locked: true };
  }
  await supabase.from("external_shares").update({ failed_attempts: fails }).eq("id", share.id);
  return { ok: false, locked: false };
}

export async function getLegalDocument(id: string): Promise<LegalDocumentRow | null> {
  const { data } = await getSupabaseAdmin().from("legal_documents").select("*").eq("id", id).maybeSingle();
  return (data as LegalDocumentRow) || null;
}

/** Append-only acceptance evidence (T11). IP/UA are hashed, never raw. */
export async function recordLegalAcceptance(input: {
  shareId: string;
  legal: LegalDocumentRow;
  typedName: string;
  ip?: string | null;
  ua?: string | null;
}): Promise<void> {
  await getSupabaseAdmin().from("legal_acceptances").insert({
    share_id: input.shareId,
    legal_document_id: input.legal.id,
    legal_version: input.legal.version,
    legal_hash: input.legal.content_hash,
    typed_name: input.typedName,
    ip_hash: input.ip ? hashForAudit(input.ip) : null,
    ua_hash: input.ua ? hashForAudit(input.ua) : null,
  });
}

export async function hasAcceptedLegal(shareId: string, legal: LegalDocumentRow): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("legal_acceptances")
    .select("id")
    .eq("share_id", shareId)
    .eq("legal_document_id", legal.id)
    .eq("legal_version", legal.version)
    .limit(1);
  return ((data as unknown[]) || []).length > 0;
}

/** Mint a short-lived share-session token scoped to one share + revision. */
export async function mintShareSession(shareId: string, revisionId: string): Promise<string> {
  return new SignJWT({ sid: shareId, rid: revisionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_S}s`)
    .sign(sessionKey());
}

export async function verifyShareSession(
  jwt: string,
): Promise<{ sid: string; rid: string } | null> {
  try {
    const { payload } = await jwtVerify(jwt, sessionKey());
    if (typeof payload.sid === "string" && typeof payload.rid === "string") {
      return { sid: payload.sid, rid: payload.rid };
    }
    return null;
  } catch {
    return null;
  }
}

export async function incrementShareView(shareId: string): Promise<void> {
  // read-modify-write is fine at this volume; view caps are advisory throttles
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("external_shares").select("view_count").eq("id", shareId).maybeSingle();
  const current = (data as { view_count: number } | null)?.view_count ?? 0;
  await supabase.from("external_shares").update({ view_count: current + 1 }).eq("id", shareId);
}

export async function revokeShare(shareId: string): Promise<void> {
  await getSupabaseAdmin()
    .from("external_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId);
}

export async function listSharesForNode(nodeId: string): Promise<ExternalShareRow[]> {
  const { data } = await getSupabaseAdmin()
    .from("external_shares")
    .select("*")
    .eq("node_id", nodeId)
    .order("created_at", { ascending: false });
  return (data as ExternalShareRow[]) || [];
}
