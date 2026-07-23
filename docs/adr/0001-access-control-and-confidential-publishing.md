# ADR 0001 — Access control, scoped identities, and confidential HTML publishing

- Status: **Draft — awaiting Alex approval** (ZEUG-450; parent program ZEUG-449)
- Date: 2026-07-18
- Author: Claude (Fable 5, high reasoning) · Checker: Codex (current-code validation)
- Contract version: `adr-0001 v1.0.0-draft` — on approval, stamp the merge-commit sha here
  and reference `adr-0001@<sha>` from every dependent issue (ZEUG-446, 451–457).
- Delivery plan: `zeug-command/plans/collective/2026-07-18-scoped-auth-html-kb-delivery.md`

## 1. Problem

Collective needs one server-enforced authorization layer for humans, agents, and
external recipients, plus confidential HTML publishing (articles/briefs/decks) with
per-recipient credentials and NDA/terms acceptance. Today every accepted identity
reaches service-role-backed data access; "visibility" is a label, not a boundary.

Non-goals of this ADR: production schema changes, route/UI implementation, final
NDA/terms wording, issuing any credential. (Per ZEUG-450 scope.)

## 2. Current-state inventory (verified against code, 2026-07-18)

Two code states matter: `main` (deployed) and PR #10 (`codex/zeug-432-…`, in review)
which adds the Operator MCP expansion. Both are inventoried; the target design must
absorb PR #10 unchanged in spirit.

### 2.1 Principals and authentication paths that exist today

| # | Identity path | Mechanism | Where | Effective privilege today |
|---|---|---|---|---|
| P1 | Operator (admin/operator) session | NextAuth CredentialsProvider: password (bcrypt) or one-time magic token → JWT session cookie | `packages/core/src/auth-options.ts`, both apps | Everything the admin console exposes; all server actions gate only on `users.role ∈ {admin, operator}` via `getAdminUser()` |
| P2 | Member/lead session | Same NextAuth infra on the member app | member app `src/` | Member portal pages; server routes query with service role |
| P3 | Per-admin agent token `osk_…` | SHA-256 hash lookup in `agent_tokens` (revocable, `last_used_at`, max 3/admin) | PR #10 `admin/src/lib/agent-auth.ts` | Full agent surface (17 MCP tools + KB REST) — identical to P4 |
| P4 | Shared system token | `AGENT_API_TOKEN` env, `timingSafeEqual` | `agent-auth.ts` (main has this; PR #10 keeps it) | Full agent surface, attributed "system" |
| P5 | Admin console session on agent endpoints | Session fallback in `requireAgentOrAdmin` | `agent-auth.ts` | Same as P3/P4 |
| P6 | Instant-entrance / invite token | `invite_tokens` row → `/welcome/[token]` (migration 006) | member app | Redeems into a member session |
| P7 | Screening / interview token | `applications.screening_token`, `staff_applications.interview_token` (24-byte hex, plaintext columns) | public booking pages/APIs | Book/reschedule one call; leaks name/status of one application |
| P8 | Public visitor | none | `/r/[code]`, `/v/[code]`, landing | Submit applications; read published content |
| — | Vendor/staff durable login | **does not exist** | — | Vendor surface is a funnel + operator-side management only |
| — | External document recipient | **does not exist** | — | To be created by this program |

### 2.2 Enforcement facts the design must fix

- All server code paths use `getSupabaseAdmin()` (service role). RLS exists but is
  bypassed by design; there are **no anon policies** (hardened in migration 005) and
  the anon key is unused. Authorization is therefore 100% application-layer — and
  currently consists of exactly two checks: "is admin" (P1/P5) and "has any accepted
  bearer" (P3/P4).
- `kb_nodes.visibility (internal|staff|members)` is returned to every accepted agent
  identity: `kb_get`/`kb_tree`/KB REST never filter on it. Metadata, not policy.
- MCP tool exposure: on `main`, 4 KB tools; PR #10 grows this to 17 tools spanning
  leads, operations, gates/rooms, applications, referral links, closures. Tool
  *listing* and tool *handlers* share one gate (`resolveAgent`) with no per-tool or
  per-row scoping. A "staff" token cannot be issued today without granting the
  entire operator surface — this is ZEUG-446's job and the reason no staff token
  may be issued before it lands.
- `users.role` is a single mutable string: `lead | member | admin | operator`
  (CHECK constraint, migration 001). No multi-role, no scoped grants.
- Storage: the `media` bucket is **public** (migration 005). Fine for gate photos;
  unusable for confidential assets. Confidential assets need a private bucket +
  authorized streaming (§5.6).
- P7 tokens are stored **plaintext** in their tables. Acceptable for their narrow
  function today; the pattern must not be copied for shares (§5.3) and should be
  migrated to hashed storage opportunistically (follow-up, not this program).
- `deck.opencollective.app` (reference deck): its access gate is client-side — the
  full HTML and password hash ship to every visitor. Named anti-pattern: **no
  protected byte may leave the server before authorization** (Release-gate item 1).

## 3. Decision — target architecture

### 3.1 Canonical principal model

Every request resolves, server-side, to one `Principal` before any data access:

```ts
interface Principal {
  kind: "owner" | "operator" | "member" | "vendor" | "agent" | "external_share" | "public";
  userId: string | null;          // users.id when session-backed
  entityId: string | null;        // staff/vendor entity, share id, token id…
  profileIds: string[];           // resolved access_profiles
  via: "session" | "agent_token" | "system_token" | "share_session" | "anonymous";
  tokenId: string | null;         // agent_tokens.id / external_shares.id for audit
}
```

Identity adapters (one per authentication path P1–P8 plus the two new paths) map
credentials → `Principal`. **Adapters authenticate; only the policy engine
authorizes.** No adapter may embed permission logic beyond "who is this".

New tables (names bind the schema contract for ZEUG-446/451/453; DDL written in
those issues, not here):

| Table | Purpose | Key columns (contract) |
|---|---|---|
| `access_profiles` | Named capability bundles | `id, slug (owner\|operator\|staff_ops\|member\|vendor\|external_reader\|agent_owner\|agent_staff), description` |
| `access_capabilities` | Profile → capability rows | `profile_id, capability (text, §3.2), UNIQUE(profile_id, capability)` |
| `principal_profiles` | Principal → profile grants | `principal_type (user\|agent_token\|share), principal_id, profile_id, granted_by, created_at`; UNIQUE triple |
| `resource_grants` | Profile/principal → bounded resource | `id, principal_type, principal_id, profile_id NULLABLE, resource_type (kb_tree\|gate\|entity_class), resource_id, effect (allow\|deny), inherited (bool, always true — computed), created_by` |
| `external_shares` | One recipient × one document | §5.3 |
| `legal_documents`, `legal_acceptances` | §5.5 |
| `access_events` | Redacted audit | `principal snapshot (kind, ids only), capability, resource_type/id, decision (allow\|deny), reason_code, request_id, created_at` — **never** content, tokens, passwords, emails of externals |

Migration compatibility (acceptance criterion): `users.role` remains the primary
role during migration. A seed maps role → default profile (`admin/operator →
operator`, `member → member`, `lead → (none)`). The policy engine reads profiles;
`role` feeds it, nothing else grows around `role`. `agent_tokens` gains `scope
(owner|staff)` + optional `profile_id`; existing rows backfill to `scope=owner` so
PR #10 behavior is preserved on day one. `AGENT_API_TOKEN` maps to a constant
owner-scope principal and is scheduled for retirement after ZEUG-455 (owner MCP
tools make it redundant); until then it stays, unchanged.

### 3.2 Capability vocabulary

Dot-namespaced strings; deny-unknown (a capability not in this list fails closed):

```
kb.view  kb.draft  kb.publish  kb.share  kb.grant  kb.archive
ops.leads.read    ops.leads.write
ops.applications.read  ops.applications.write
ops.gates.read    ops.gates.write
ops.events.read   ops.events.write
ops.referrals.read ops.referrals.write
ops.schedule.read  ops.schedule.write
ops.report.read
comms.outbox.read  comms.campaign.draft  comms.campaign.send
admin.tokens.manage  admin.settings.manage  admin.grants.manage
```

Profile defaults (initial seed; owner-editable later via `admin.grants.manage`):

| Profile | Capabilities |
|---|---|
| `owner` | everything |
| `operator` (Don) | all `kb.*` except `kb.grant`; all `ops.*`; `comms.outbox.read`, `comms.campaign.draft` |
| `staff_ops` | `kb.view` (staff trees), `ops.schedule.read`, `ops.applications.read` |
| `member` | `kb.view` (member trees) — portal features keep their existing non-KB paths |
| `vendor` | `kb.view` (vendor trees), `ops.schedule.read` (own calls only) |
| `external_reader` | `kb.view` (pinned revision of one share only) |
| `agent_owner` | = owner minus `admin.*`, minus `kb.publish/share/grant` (drafts only; §5.7) |
| `agent_staff` | = `staff_ops` |

`comms.campaign.send`, `kb.publish`, `kb.share`, `kb.grant`, `admin.*` are
**human-only in v1**: no agent profile may contain them (enforced by a seed test).

### 3.3 One policy engine

A single pure module `packages/core/src/policy.ts`:

```ts
authorize(p: Principal, capability: Capability, resource?: ResourceRef):
  { allow: true, scope: QueryScope } | { allow: false, reason: ReasonCode }
```

Rules (normative):

1. **Default deny.** No principal, no capability row, no grant path ⇒ deny.
   Undecided/ambiguous cases ⇒ deny with `reason=undecided` (fail closed).
2. The service-role client may execute a query **only after** `authorize` returned
   `allow`, and the query must be bounded by the returned `QueryScope` (e.g. a set
   of kb root ids, a gate id, `own-rows-only`).
3. **Direct-id rule:** every handler that takes a UUID (kb_get, gate_update,
   application detail, asset fetch, share open, …) re-runs `authorize` against that
   specific resource. List filtering is never sufficient (acceptance criterion:
   guessed-UUID tests must deny).
4. **Double gate for agents:** MCP tool *listing* filters to tools whose required
   capability the principal holds, **and** every tool *handler* re-checks. The two
   must agree; the access-matrix test asserts both.
5. Every deny and every sensitive allow (publish, share, grant, external view)
   writes an `access_events` row (§5.8 redaction).

### 3.4 KB tree grants and inheritance

- Grants attach to `kb_nodes` (usually folder roots) as `resource_grants
  (resource_type=kb_tree, resource_id=node_id, effect=allow|deny)`.
- **Effective access** for principal × node = walk node → ancestors:
  - `allow` inherits downward to all descendants;
  - a child-level `deny` **narrows** (wins over any ancestor allow for that
    subtree);
  - a child-level `allow` under an ancestor `deny` is **inert** unless the grant
    row was created with `override=true` by a principal holding `kb.grant`
    (owner-level). Without override: deny wins. This is the only widening path and
    it is explicit, audited, and owner-only.
  - No grant row anywhere on the path ⇒ deny (default).
- The legacy `visibility` column becomes a **seed hint only**: migration maps
  `internal → grant to operator profile on that subtree`, `staff → +staff_ops`,
  `members → +member`, then the column is frozen (kept for back-compat reads,
  ignored by policy; removed in a later cleanup migration).
- Ordering: `resource_grants` for kb trees are evaluated on the materialized
  ancestor path (`kb_nodes.parent_id` walk, already loaded for breadcrumbs); depth
  is small (<10), no recursive SQL needed in v1.

### 3.5 Revisions (content contract with ZEUG-454)

`kb_revisions`: append-only — `id, node_id, markdown, ast_json, html, template
(article|brief|deck), theme_json, content_hash (sha256 of markdown+template+
renderer_version), renderer_version, author_principal snapshot, created_at`.
`kb_nodes.published_revision_id` points at the live revision. Re-publishing means
pointing at a new revision; nothing is edited in place. No stored `<script>`;
sanitizer allowlist; interactivity only from trusted app components.

## 4. Threat model

Assets: confidential documents/assets, member/prospect/vendor PII, credentials
(passwords, agent tokens, share secrets), legal acceptance evidence, Don/Alex trust.

Adversaries: curious/compromised external recipient; leaked-URL holder; malicious
or compromised staff/vendor token; compromised agent credential; drive-by scraper;
honest-but-buggy agent (most likely of all).

| # | Threat | Vector | Mitigation (normative) |
|---|---|---|---|
| T1 | Protected bytes reach unauthenticated client | Client-side gate (deck anti-pattern); RSC payload embedding protected data before gate; static prerender of protected pages | Server authorizes **before** render; protected routes are `dynamic` + per-request authz; no protected data in any layout/flight payload above the gate; integration test fetches raw HTML of a gated URL and asserts zero protected bytes |
| T2 | Share URL leak (forward, referrer, logs) | URL alone opens document | URL token is factor 1 of 2; opening without password shows only the credential+legal gate; `Referrer-Policy: no-referrer`; `X-Robots-Tag: noindex, nofollow`; share id treated as semi-secret, stored hashed where practical |
| T3 | Password brute force on a share | Cheap online guessing | Argon2id (fallback bcrypt cost ≥12 — bcrypt already in deps) per-share password; throttle: ≤5 failures / 15 min / (share × IP) then lockout with generic error; global per-IP cap; attempts audited |
| T4 | IDOR via guessed UUIDs | kb_get, asset URL, application/gate ids over agent surface or share session | §3.3 direct-id rule; access-matrix includes guessed-id fixtures for every resource type × every principal class; deny is the asserted result |
| T5 | Tool-list vs handler drift | Tool hidden from list but handler still executes | Double gate (§3.3 r4); matrix asserts both list content and handler result per principal |
| T6 | Privilege creep via role migration | Vendor/staff principal accidentally inherits member/operator paths | Distinct `Principal.kind=vendor`; vendor profile seeded with zero member/operator capabilities; **negative tests are part of ZEUG-453's acceptance**: vendor session × operator routes/tools/member portal ⇒ all deny; `users.role` gains `vendor`/`staff` values only via additive CHECK migration, and role→profile seed maps them to `vendor`/`staff_ops` only |
| T7 | Stolen agent token | osk_ token in a leaked env/log | Tokens stored SHA-256; revocation column already exists (PR #10); scoped tokens (ZEUG-446) cap blast radius; `last_used_at` anomaly surfaces in later digest loop (plan §B); never logged |
| T8 | Share session replay/fixation | Cookie reuse after revocation/expiry | Share session = short-lived (≤60 min) HttpOnly, `Secure`, `SameSite=Strict` cookie scoped `Path=/s/<share_id>`; server re-checks share status (revoked/expired/view-cap) on **every** request, not just at login; logout on revocation is immediate because state lives server-side |
| T9 | Cache/CDN leak | Vercel/edge caches protected HTML or assets | `Cache-Control: private, no-store` on every protected response; protected assets streamed through the authorizing route from a **private** bucket (never the public `media` bucket) or via signed URLs with TTL ≤ 60s; test asserts response headers |
| T10 | Log/audit leakage | Bodies, secrets, PII in logs, Linear, access_events | §5.8 redaction contract + a grep-style CI check on access-event writers; external recipient identified in audit by share id, not email |
| T11 | Legal-acceptance forgery/dispute | "I never accepted" / tampered terms | `legal_documents` immutable with content sha256; acceptance stores doc hash + typed name + timestamp + IP/UA **hash**; acceptances append-only (no UPDATE/DELETE grant); enforcement decisions stay human (plan loop D is report-only) |
| T12 | XSS via stored content | Markdown/raw HTML injection into rendered pages | ZEUG-454 sanitizer allowlist, no stored scripts, golden XSS fixtures; CSP `default-src 'self'` (+ hashed inline styles as needed) on protected pages |
| T13 | Buggy agent mass-writes | kb_upsert loop trashes tree | Agents capability-capped to drafts (§3.2); revisions append-only make content recoverable; rate cap on agent surface (existing maxDuration + per-token request throttle in ZEUG-446) |

## 5. Subsystem contracts

### 5.1 Identity adapters
P1/P2 session → Principal (kind from role); P3 osk_ → `agent` + token scope;
P4 env → `agent` owner-scope constant; P6/P7 unchanged this program; new: vendor
session adapter (ZEUG-453), share-session adapter (ZEUG-451).

### 5.2 Vendor OS identity (ZEUG-453)
Vendor/staff accounts reuse the existing NextAuth password/magic-link mechanism —
new `users.role` values (`vendor`, `staff`) via additive CHECK migration + link
column to their staff/vendor entity (`users.staff_application_id` or a
`staff_members` table — implementer's choice, contract: one durable FK). Creation
is operator-initiated (hire flow) only. See T6 for the mandatory negative tests.

### 5.3 External shares (ZEUG-451)
`external_shares`: `id, node_id, revision_id (pinned), recipient_label, share_slug
(unguessable, ≥24 bytes; stored hashed, shown once in full URL), password_hash
(argon2id/bcrypt, set at creation, plaintext shown exactly once), legal_document_ids[],
expires_at, max_views, view_count, revoked_at, created_by, created_at`.

Open flow (normative order): URL → gate page (no content) → password verify
(throttled, T3) → legal acceptance (all required docs, §5.5) → mint share-session
cookie (T8) → server renders pinned revision + assets (T9 headers). Any failure ⇒
generic error, audited. Revocation/expiry/view-cap checked per request.

### 5.4 Publishing lifecycle
`draft revision → deterministic render → checks (sanitize/XSS/links/a11y) → owner
preview → publish (human) → grant/share (human) → read-back verify`. Agents stop at
draft+preview. Enforced by capability seeds (§3.2), not convention.

### 5.5 Legal documents
Versioned rows, immutable text + sha256, effective date; a share/tree names which
doc versions are required; acceptance evidence per §4 T11. Wording requires
Alex/legal sign-off (out of scope here); schema must make re-acceptance after a
version bump expressible but **enforcement is a human decision** (loop D reports).

### 5.6 Protected assets
Private bucket (`kb-private`); upload via authorized route; serve via the same
policy check as the owning page: stream with `no-store` or 60s-signed URL. The
public `media` bucket remains for non-confidential gate/room/event imagery only.

### 5.7 Owner MCP tools (ZEUG-455)
`kb_draft, kb_render_preview, kb_publish_request, kb_share_create_request,
kb_share_revoke, kb_access_report`. The two `*_request` tools create pending
actions requiring console confirmation by a human holding the capability —
tools themselves never cross the human boundary (§3.2). Bypass tests included.

### 5.8 Audit redaction contract
`access_events` and all logs: principal ids/kinds, capability, resource ids,
decision, reason code, request id — and nothing else. Forbidden fields enforced by
the writer's type + a unit test: no markdown/html bodies, no tokens/passwords/
hashes, no external emails, no IP (store hash only), no legal text.

## 6. Access matrix (fixtures contract)

Principal classes (rows): owner session, operator session, member session, vendor
session, staff agent token, owner agent token, system env token, external share
session (valid), external (expired), external (revoked), invalid bearer, no auth.

Resource probes (columns): kb node in operator-only tree; kb node in staff tree;
kb node in member tree; child-narrowed node (ancestor allow + child deny);
guessed-UUID kb node; guessed-UUID gate; own vs other application row; protected
asset URL; each MCP tool list + one handler per capability group; publish/share/
grant endpoints; share open with wrong password ×6 (throttle assertion).

Every cell's expected result (`allow`/`deny`/`401`/`429`) is enumerated in
`tests/access-matrix.fixtures.ts` (created by ZEUG-446, extended by 451/453/454).

**Verifier commands** (the program's objective gates):

```bash
npm run test:access          # vitest run tests/access-matrix.test.ts — full matrix
npm run test:render          # ZEUG-454: golden render + XSS + link + a11y fixtures
npx tsc --noEmit && npm run build          # both apps
node scripts/smoke-protected.mjs <url>     # fetches gated URL unauthenticated;
                                           # fails if protected bytes or cacheable
                                           # headers appear (ZEUG-451)
```

CI runs all four; a PR touching auth/KB code with a red matrix cannot merge.

## 7. Rollout order and compatibility

1. ZEUG-446 introduces policy engine + capabilities + scoped tokens behind the
   existing surface (owner-scope default ⇒ zero behavior change for current
   tokens); denial matrix green before any staff token is issued.
2. ZEUG-454 revisions/renderer (content, no authz dependency beyond `kb.draft`).
3. ZEUG-452/453 portal trees + vendor principal (negative tests T6).
4. ZEUG-451 external shares (T1/T2/T3/T8/T9 tests).
5. ZEUG-456/455 publishing console + owner MCP tools.
6. ZEUG-457 pilot: publish the monetization-ideas doc through every principal
   class, then revoke the pilot share.
Kill switches: `KB_V2_ENABLED`, `EXTERNAL_SHARES_ENABLED` env flags — default off
in production until the release gate passes.

## 8. Decisions Alex must confirm (approval checklist)

- [ ] Role/profile names in §3.1–3.2 (esp. `vendor` vs `staff` as separate roles).
- [ ] Vendor OS expectation: operator-created accounts only (no self-signup) — §5.2.
- [ ] External-share risk posture: password + NDA both mandatory for confidential
      trees; watermark optional per share — §5.3, §4.
- [ ] Human-only capability list (`kb.publish`, `kb.share`, `kb.grant`,
      `comms.campaign.send`, `admin.*`) — §3.2.
- [ ] `AGENT_API_TOKEN` retirement after ZEUG-455 — §3.1.
- [ ] Legal reviewer for NDA/terms wording + retention/GDPR of acceptance
      evidence (name a person; schema ships regardless) — §5.5.
- [ ] Approval recorded here (name/date + merge sha) unblocks ZEUG-446 + 454.

## 9. Consequences

Positive: one auditable engine; agents become safely scopeable; staff/vendor/
external access become grantable without new code paths; content becomes
publishable with provenance. Negative/cost: every data handler gains an authorize
call (small, in-process); grants add operational surface (mitigated by profiles +
console in ZEUG-456); migration discipline required around `users.role`.
