/**
 * Central authorization engine (ADR 0001 §3.3). Pure and deterministic:
 * adapters resolve a Principal, the caller resolves any resource facts
 * (e.g. does this principal's audience have a tree grant), and `authorize`
 * returns allow/deny. Default deny. No DB, no I/O — trivially testable.
 */

export type Capability =
  | "kb.view"
  | "kb.draft"
  | "kb.render"
  | "kb.publish"
  | "kb.share"
  | "kb.grant"
  | "kb.archive"
  | "ops.read"
  | "ops.write"
  | "comms.campaign.send"
  | "admin.tokens.manage"
  | "admin.grants.manage";

/** Capabilities no automated principal may ever hold (ADR §3.2). Human-gated. */
export const HUMAN_ONLY: ReadonlySet<Capability> = new Set<Capability>([
  "kb.publish",
  "kb.share",
  "kb.grant",
  "comms.campaign.send",
  "admin.tokens.manage",
  "admin.grants.manage",
]);

export type PrincipalKind =
  | "owner"
  | "operator"
  | "member"
  | "vendor"
  | "agent"
  | "external_share"
  | "public";

export type AgentScope = "owner" | "staff";

/** Audience tags used for KB tree grants (kb_grants.audience). */
export type Audience = "operator" | "staff" | "member" | "vendor";

export interface Principal {
  kind: PrincipalKind;
  userId: string | null;
  entityId: string | null; // staff/vendor entity, share id, token id
  agentScope?: AgentScope; // when kind === "agent"
  via: "session" | "agent_token" | "system_token" | "share_session" | "anonymous";
  tokenId: string | null;
}

const OWNER: Capability[] = [
  "kb.view", "kb.draft", "kb.render", "kb.publish", "kb.share", "kb.grant", "kb.archive",
  "ops.read", "ops.write", "comms.campaign.send", "admin.tokens.manage", "admin.grants.manage",
];
const OPERATOR: Capability[] = [
  "kb.view", "kb.draft", "kb.render", "kb.publish", "kb.share", "kb.archive", "ops.read", "ops.write",
];
const AGENT_OWNER: Capability[] = ["kb.view", "kb.draft", "kb.render", "ops.read"]; // drafts only; never publish/share
const AGENT_STAFF: Capability[] = ["kb.view", "kb.draft", "kb.render"];
const MEMBER: Capability[] = ["kb.view"];
const VENDOR: Capability[] = ["kb.view"];
const EXTERNAL: Capability[] = ["kb.view"]; // one pinned revision, gated separately
const NONE: Capability[] = [];

/** The capability set a principal carries, before resource scoping. */
export function capabilitiesFor(p: Principal): Set<Capability> {
  let caps: Capability[];
  switch (p.kind) {
    case "owner": caps = OWNER; break;
    case "operator": caps = OPERATOR; break;
    case "agent": caps = p.agentScope === "staff" ? AGENT_STAFF : AGENT_OWNER; break;
    case "member": caps = MEMBER; break;
    case "vendor": caps = VENDOR; break;
    case "external_share": caps = EXTERNAL; break;
    default: caps = NONE;
  }
  const set = new Set(caps);
  // Belt and suspenders: automated principals never hold human-only caps.
  if (p.kind === "agent" || p.kind === "external_share" || p.kind === "public") {
    for (const c of HUMAN_ONLY) set.delete(c);
  }
  return set;
}

/** Audience tag this principal presents to KB tree grants; null = no tree access path. */
export function audienceFor(p: Principal): Audience | null {
  switch (p.kind) {
    case "owner":
    case "operator": return "operator";
    case "agent": return p.agentScope === "staff" ? "staff" : "operator";
    case "member": return "member";
    case "vendor": return "vendor";
    default: return null; // external_share and public do not traverse the tree
  }
}

export interface ResourceFacts {
  /** For kb.* on a node: whether this principal's audience has an inherited allow. */
  treeGranted?: boolean;
  /** For external_share principals viewing their pinned share. */
  shareMatches?: boolean;
}

export interface AuthzResult {
  allow: boolean;
  reason:
    | "ok"
    | "no_capability"
    | "human_only"
    | "tree_denied"
    | "share_mismatch"
    | "undecided";
}

const deny = (reason: AuthzResult["reason"]): AuthzResult => ({ allow: false, reason });
const ALLOW: AuthzResult = { allow: true, reason: "ok" };

/**
 * Decide one (principal, capability, resource) case. Fail closed.
 * Resource-bound capabilities require the caller to supply the resolved facts;
 * a missing fact for a resource-scoped capability is `undecided` → deny.
 */
export function authorize(
  p: Principal,
  capability: Capability,
  resource?: ResourceFacts,
): AuthzResult {
  // Automated principals can never exercise human-only capabilities.
  if (HUMAN_ONLY.has(capability) && (p.kind === "agent" || p.kind === "external_share" || p.kind === "public")) {
    return deny("human_only");
  }
  if (!capabilitiesFor(p).has(capability)) return deny("no_capability");

  // External share principals: only their matched pinned share, view-only.
  if (p.kind === "external_share") {
    if (capability !== "kb.view") return deny("no_capability");
    if (resource?.shareMatches === true) return ALLOW;
    if (resource?.shareMatches === false) return deny("share_mismatch");
    return deny("undecided");
  }

  // KB read/draft/render/publish/share/grant/archive on a specific node require a tree grant.
  const treeScoped: Capability[] = [
    "kb.view", "kb.draft", "kb.render", "kb.publish", "kb.share", "kb.grant", "kb.archive",
  ];
  if (treeScoped.includes(capability) && resource !== undefined) {
    if (resource.treeGranted === true) return ALLOW;
    if (resource.treeGranted === false) return deny("tree_denied");
    return deny("undecided");
  }

  // Capability held and no resource scoping required (e.g. ops.read at list level,
  // or a tree capability checked without a specific node — the handler must still
  // re-check per node before returning a body).
  return ALLOW;
}
