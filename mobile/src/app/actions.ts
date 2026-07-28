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
