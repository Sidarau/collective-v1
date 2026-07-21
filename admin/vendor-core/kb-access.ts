import "server-only";
import { getSupabaseAdmin } from "./supabase";
import type { KbAudience, KbNodeRow, KbGrantRow } from "./database.types";
import type { Audience, Capability, Principal } from "./policy";

/**
 * Resource-layer for the KB: resolves tree grants with inheritance and writes
 * the redacted audit trail. The pure policy engine (policy.ts) consumes the
 * boolean this produces; it never touches the DB.
 *
 * Inheritance (ADR 0001 §3.4), implemented deny-dominant and fail-closed:
 *   - a grant inherits to all descendants;
 *   - a `deny` anywhere on the ancestor path wins (child deny narrows a parent
 *     allow, and an ancestor deny cannot be widened by a child allow in v1 —
 *     owner-override widening is a documented follow-up);
 *   - no grant anywhere on the path ⇒ deny (default).
 */

async function ancestorPathIds(nodeId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("kb_nodes").select("id, parent_id");
  const rows = (data as Pick<KbNodeRow, "id" | "parent_id">[]) || [];
  const parentOf = new Map(rows.map((r) => [r.id, r.parent_id]));
  const path: string[] = [];
  let cur: string | null | undefined = nodeId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    path.push(cur);
    cur = parentOf.get(cur) ?? null;
  }
  return path; // node → … → root
}

/** True iff `audience` has an inherited allow (and no closer deny) on `nodeId`. */
export async function resolveTreeGrant(nodeId: string, audience: Audience): Promise<boolean> {
  const pathIds = await ancestorPathIds(nodeId);
  if (pathIds.length === 0) return false;
  const { data } = await getSupabaseAdmin()
    .from("kb_grants")
    .select("node_id, audience, effect")
    .in("node_id", pathIds)
    .eq("audience", audience as KbAudience);
  const grants = (data as Pick<KbGrantRow, "node_id" | "audience" | "effect">[]) || [];
  if (grants.some((g) => g.effect === "deny")) return false;
  return grants.some((g) => g.effect === "allow");
}

/**
 * Redacted audit event (ADR §5.8). Stores ids/kinds/decisions only — never
 * bodies, tokens, passwords, raw IPs, or external emails. Fire-and-forget:
 * auditing must never block or fail an authorization decision.
 */
export async function recordAccessEvent(input: {
  principal: Pick<Principal, "kind" | "userId" | "entityId" | "tokenId">;
  capability: Capability | string;
  resourceType?: string | null;
  resourceId?: string | null;
  decision: "allow" | "deny";
  reason?: string | null;
  requestId?: string | null;
}): Promise<void> {
  try {
    await getSupabaseAdmin().from("access_events").insert({
      principal_kind: input.principal.kind,
      principal_id: input.principal.userId || input.principal.entityId || input.principal.tokenId || null,
      capability: String(input.capability),
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      decision: input.decision,
      reason: input.reason ?? null,
      request_id: input.requestId ?? null,
    });
  } catch {
    // never throw from the audit path
  }
}
