"use server";

/**
 * Server actions for the mobile operator surface.
 *
 * Client components (sheets) call these instead of importing the provider —
 * the provider is server-only because it owns the service-role client. Every
 * action re-checks the session and re-validates its input server-side.
 */

import { getOperatorPrincipal, requireOperator } from "@/lib/guard";
import { isGuarded } from "@/lib/page-params";
import { createLiveProvider } from "@/data/live-provider";
import { confirmDraft } from "@/data/collecta";
import { createFromComposer, type ComposerInput, type ComposerOutcome } from "@/data/composer-actions";
import {
  addEntityNote,
  closeSpaceForDay,
  completeFollowUp,
  createEntityFollowUp,
  decideAccessRequest,
  decideApplication,
  getAuditTrail,
  publishExperience,
  settleContribution,
  type AccessDecision,
  type ActionOutcome,
  type AuditTrailEntry,
} from "@/data/record-actions";
import type {
  CollectaContext,
  CollectaTurn,
  LinkTarget,
  LinkTargetKind,
  OperatorAccount,
  Result,
} from "@/data/contracts";

/** Preview deploys have no sessions; client reads fall back to fixtures. */
async function principalOrPreview() {
  const principal = await getOperatorPrincipal();
  if (!principal && isGuarded()) return null;
  return principal; // null here means preview mode — callers use fixtures
}

export async function getOperatorAction(): Promise<Result<OperatorAccount>> {
  const principal = await principalOrPreview();
  if (!principal && isGuarded()) return { status: "error", message: "No operator session." };
  if (!principal) {
    const { OPERATOR } = await import("@/data/fixtures");
    return { status: "ok", data: OPERATOR };
  }
  return createLiveProvider().getOperator();
}

export async function askCollectaAction(
  context: CollectaContext,
  prompt: string,
): Promise<CollectaTurn> {
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 2000) {
    return { state: "answer", messages: [] };
  }
  const principal = await principalOrPreview();
  if (!principal) {
    const { createFixtureProvider } = await import("@/data/fixture-provider");
    return createFixtureProvider().askCollecta(context, prompt);
  }
  return createLiveProvider().askCollecta(context, prompt);
}

export async function confirmDraftAction(
  encoded: string,
): Promise<{ ok: boolean; message: string }> {
  const principal = await getOperatorPrincipal();
  if (!principal) return { ok: false, message: "No operator session." };
  if (typeof encoded !== "string" || encoded.length > 500) {
    return { ok: false, message: "That draft is no longer valid." };
  }
  return confirmDraft(encoded, principal);
}

export async function searchLinkTargetsAction(
  query: string,
  kinds?: LinkTargetKind[],
): Promise<Result<LinkTarget[]>> {
  if (typeof query !== "string" || query.length > 200) return { status: "empty" };
  const principal = await principalOrPreview();
  if (!principal) {
    const { createFixtureProvider } = await import("@/data/fixture-provider");
    return createFixtureProvider().searchLinkTargets(query, kinds);
  }
  return createLiveProvider().searchLinkTargets(query, kinds);
}

export async function createFromComposerAction(
  input: ComposerInput,
): Promise<ComposerOutcome> {
  if (typeof input?.kind !== "string" || typeof input?.title !== "string") {
    return { ok: false, message: "Nothing to create." };
  }
  if (input.title.length > 200 || (input.note?.length ?? 0) > 400) {
    return { ok: false, message: "Keep it shorter." };
  }
  // Preview mode has no backend to write to — the demo creates nothing.
  const principal = await getOperatorPrincipal();
  if (!principal) return { ok: false, message: "Preview mode — nothing is created here." };
  return createFromComposer(input);
}

export async function signOutAction(): Promise<void> {
  // Server-side sign-out: expire the NextAuth session cookie, then the
  // client lands on /login. In preview mode this is a no-op the client
  // handles locally.
  if (!isGuarded()) return;
  await requireOperator();
  const { cookies } = await import("next/headers");
  const { sessionCookieName } = await import("@core/auth-cookies");
  const store = await cookies();
  store.set(sessionCookieName, "", { path: "/", maxAge: 0 });
}

/* ------------------------------------------------------------------ *
 * Record decisions — thin validators over data/record-actions.ts.
 * Every write re-checks the operator session inside the action itself.
 * ------------------------------------------------------------------ */

export async function decideAccessRequestAction(input: {
  bookingId: string;
  decision: AccessDecision;
  note?: string;
}): Promise<ActionOutcome> {
  if (typeof input?.bookingId !== "string" || input.bookingId.length > 64) {
    return { ok: false, message: "That record reference is not valid." };
  }
  if (!["approve", "decline", "confirm"].includes(input?.decision)) {
    return { ok: false, message: "Unknown decision." };
  }
  return decideAccessRequest(input);
}

export async function decideApplicationAction(input: {
  applicationId: string;
  decision: "approve" | "deny";
}): Promise<ActionOutcome> {
  if (typeof input?.applicationId !== "string" || input.applicationId.length > 64) {
    return { ok: false, message: "That record reference is not valid." };
  }
  if (!["approve", "deny"].includes(input?.decision)) {
    return { ok: false, message: "Unknown decision." };
  }
  return decideApplication(input);
}

export async function settleContributionAction(input: {
  bookingId: string;
  mode: "received" | "comp";
  amountMinor?: number;
  note?: string;
}): Promise<ActionOutcome> {
  if (typeof input?.bookingId !== "string" || input.bookingId.length > 64) {
    return { ok: false, message: "That record reference is not valid." };
  }
  if (!["received", "comp"].includes(input?.mode)) {
    return { ok: false, message: "Unknown settlement mode." };
  }
  if (input.amountMinor !== undefined && (!Number.isFinite(input.amountMinor) || input.amountMinor < 0)) {
    return { ok: false, message: "That amount is not valid." };
  }
  return settleContribution(input);
}

export async function addEntityNoteAction(input: {
  ref: string;
  body: string;
}): Promise<ActionOutcome> {
  if (typeof input?.ref !== "string" || input.ref.length > 80) {
    return { ok: false, message: "That record reference is not valid." };
  }
  if (typeof input?.body !== "string" || !input.body.trim() || input.body.length > 500) {
    return { ok: false, message: "Write the note first." };
  }
  return addEntityNote(input);
}

export async function createEntityFollowUpAction(input: {
  ref: string;
  title: string;
  dueAt?: string;
}): Promise<ActionOutcome> {
  if (typeof input?.ref !== "string" || input.ref.length > 80) {
    return { ok: false, message: "That record reference is not valid." };
  }
  if (typeof input?.title !== "string" || !input.title.trim() || input.title.length > 140) {
    return { ok: false, message: "Give it a title first." };
  }
  return createEntityFollowUp(input);
}

export async function closeSpaceAction(input: {
  villaId: string;
  date: string;
  reason: string;
}): Promise<ActionOutcome> {
  if (typeof input?.villaId !== "string" || input.villaId.length > 64) {
    return { ok: false, message: "That record reference is not valid." };
  }
  if (typeof input?.date !== "string" || typeof input?.reason !== "string") {
    return { ok: false, message: "Pick a date and a reason first." };
  }
  return closeSpaceForDay(input);
}

export async function completeFollowUpAction(input: {
  followUpId: string;
}): Promise<ActionOutcome> {
  if (typeof input?.followUpId !== "string" || input.followUpId.length > 64) {
    return { ok: false, message: "That record reference is not valid." };
  }
  return completeFollowUp(input);
}

export async function publishExperienceAction(input: {
  eventId: string;
}): Promise<ActionOutcome> {
  if (typeof input?.eventId !== "string" || input.eventId.length > 64) {
    return { ok: false, message: "That record reference is not valid." };
  }
  return publishExperience(input);
}

export async function getAuditTrailAction(input: {
  ref: string;
}): Promise<{ ok: boolean; entries: AuditTrailEntry[]; message?: string }> {
  if (typeof input?.ref !== "string" || input.ref.length > 80) {
    return { ok: false, entries: [], message: "That record reference is not valid." };
  }
  return getAuditTrail(input);
}
