# Phase 2 handoff — provider interfaces reserved for backend integration

Phase 1 delivered the complete UI template for `mobile.opencollective.app`
behind one interface. This document is the contract for replacing fixtures with
real, permission-checked data.

**Most of the job is: implement `MobileDataProvider` and return it from
`getProvider()`.** If anything else has to change to make real data work, the
seam is in the wrong place — say so rather than reaching around it.

## Read this first: three things need backend that does not exist yet

Everything else on this page is wiring an existing capability to a typed
interface. These three are **new backend work** with no implementation and no
prior documentation anywhere in the repo. They are approved to build.

| # | What | Why it is not just wiring | Detail |
|---|---|---|---|
| 1 | **Server-side auth guard** | Phase 1 serves fixtures to anyone. There is no route guard at all. Nothing else on this list matters until this exists. | [Auth and security](#auth-and-security-not-started-in-phase-1) |
| 2 | **Profile image sync from the member portal** | The mobile app must not become a second place to upload a picture. Needs a decision on the source of truth and a stable URL on the session. | [§1](#1-profile-image-sync-from-the-member-portal--to-build) |
| 3 | **Email change with verification** | Security-sensitive. Needs a token round trip, a warning to the old address, an audit entry and session invalidation. No such flow exists in `packages/core`. | [§2](#2-changing-the-email-address--to-build-needs-a-verification-flow) |

Items 2 and 3 sit behind the avatar in the account sheet. Both are built in the
UI and deliberately inert — the email row says on screen that changing it is not
available yet, and the avatar falls back to initials. **Do not close those gaps
by adding an uploader or by letting the field save without verification.**

## The seam

```ts
// mobile/src/data/provider.ts
export function getProvider(scenario: Scenario = "healthy"): MobileDataProvider {
  return createFixtureProvider(scenario);   // ← replace this line
}
```

`MobileDataProvider` lives in `mobile/src/data/contracts.ts`. Every method
returns `Promise<Result<T>>`, where

```ts
type Result<T> =
  | { status: "ok"; data: T }
  | { status: "empty" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "offline" };
```

Return `empty` for "the query succeeded and there is nothing", `error` for a
failure the operator can act on, and never throw past the boundary. Every screen
already renders all five states through `ResultBoundary`.

## Methods to implement

| Method | Returns | Notes for the real implementation |
|---|---|---|
| `getDaySummary()` | `DaySummary` | Must come from the **same source as the timeline** — the acceptance checklist requires the counts and the stream to agree. |
| `getNumbers(period)` | `NumbersOfTheDay` | Periods `today \| 7d \| 30d`. Set `asOf` honestly; the UI displays it. Omit `deltaLabel` when the denominator is invalid. Omit `spark` unless ≥5 comparable points exist. |
| `getForecast(period)` | `ForecastSeries` | `settledMinor` and `projectedMinor` must stay separable. Never fold projection into confirmed or received money. |
| `getTimeline(query)` | `TimelinePage` | The big one — see below. |
| `listRequests(filter)` / `getRequest(id)` | `AccessRequest` | Applications, access requests and follow-ups. |
| `listSpaces()` / `getSpace(id)` | `Space` | Any physical asset: residence, room, studio, land, venue, boat, berth. `areas[]` label may read room, deck, berth or zone. |
| `listGates()` / `getGate(id)` | `Gate` | Curated access pathways, rules, allocations. |
| `listTransactions(filter)` / `getTransaction(id)` | `Transaction` | `filter` is `all \| incoming \| outgoing \| outstanding`. |
| `listExperiences()` / `getExperience(id)` | `Experience` | RSVP capacity, budget, publish state. |
| `listPeople(relationship)` / `getPerson(id)` | `Person` | Member, visitor, applicant, host, partner, vendor. |
| `listVendors()` / `getVendor(id)` | `Vendor` | Partners and crew. |
| `listCommunications()` / `listContent()` / `listKnowledge()` / `listReports()` / `listAgents()` | — | Straight list reads. |
| `getOperator()` | `OperatorAccount` | Read from the session, never from a client hint. Drives the account sheet behind the avatar — see the section below for the three pieces of backend it still needs. |
| `getSettings()` / `getMoreGroups()` | — | `badge` counts must be **actionable** counts only. |
| `getComposerOptions()` | `ComposerOption[]` | Synchronous; the six add types from the spec. |
| `searchLinkTargets(query, kinds?)` | `LinkTarget[]` | Everything a new item can attach to — Spaces, People, partners, experiences, Gates. **Must be scoped to what the session may see.** The composer's picker searches across all kinds regardless of the suggested ones, so this is a permission boundary, not just a filter. |
| `askCollecta(context, prompt)` | `CollectaTurn` | See the Collecta rules below. |

## `getTimeline` — the contract that carries the product

```ts
getTimeline(query: {
  category?: OperationCategory | "all";
  cursor?: string;          // keyset anchor on (sortAt, id)
  direction?: "older" | "newer" | "around";
  limit?: number;
}): Promise<Result<TimelinePage>>
```

Phase 1 serves one page and sets `hasOlder`/`hasNewer` to `true` so the call
sites already handle pagination. Phase 2 must:

1. **Paginate bidirectionally** on `(sortAt, id)`. `direction: "around"` returns
   enough rows either side of the present that the UI can place it at ~38% of
   the viewport.
2. **Preserve the scroll anchor** when prepending history. The client already
   avoids re-landing after the first paint; do not reset `sortAt` ordering
   between pages.
3. **Carry overdue incomplete work forward.** Set `carriedFrom` (an ISO date) on
   any incomplete item whose `sortAt` is in the past. `orderTimeline()` lifts
   those into the "Carried forward" block above the present. Incomplete work
   must never disappear into history.
4. **Set `displayPrecision` truthfully.** `"minute"` only where punctuality is
   operationally meaningful: arrivals, departures, screening/host calls,
   experiences, committed vendor delivery windows, explicitly scheduled
   maintenance. Everything else is `"none"` (or `"day"` for all-day items). The
   UI will render exactly what you declare and a test asserts it.
5. **Keep `sourceType`/`sourceId` as the legacy technical identifiers.** They are
   never rendered; presentation copy comes from `title`/`detail`.

`orderTimeline()` and `presentIndex()` are exported from `provider.ts` and are
already unit-tested — reuse them rather than reimplementing ordering.

## Collecta

```ts
askCollecta(context: CollectaContext, prompt: string): Promise<CollectaTurn>
```

The client sends **ids only**:

```jsonc
{
  "route": "/spaces/space-roca-llisa",
  "filter": "access",
  "visibleDate": "2026-07-26",
  "visibleEventIds": ["bookings:123", "upkeep_tasks:456"],
  "selectedEventId": "upkeep_tasks:456"
}
```

Non-negotiable:

- **Re-fetch every referenced record server-side.** Never trust client-supplied
  record content.
- **Material changes come back as a `draft`,** never as an applied change. The
  UI shows a draft card, then a `ConfirmSheet`, then reports the result.
- **Approval, money, access and publishing require explicit confirmation** and
  must write an audit record on confirm.
- `askCollecta` should become a server action or route handler. The UI calls it
  through the provider, so moving it off the client is a provider-side change.
- **Return unique message ids per turn.** The conversation is accumulated in
  the shell (`UiStateProvider.collectaThread`) and deduped on `id`; reusing ids
  across turns silently drops later replies. The fixture learned this the hard
  way — see `collectaTurnCounter` in `provider.ts`.
- The thread deliberately lives in the client shell so it survives closing the
  sheet and moving between routes. If Phase 2 persists conversations
  server-side, keep that shape: the sheet should never be the owner.

## The account sheet needs backend that does not exist yet

`getOperator()` returns an `OperatorAccount` and the avatar opens a sheet with
the operator's identity, the systems they are connected to, and sign-out. Three
of those need work that has no implementation or documentation today.

### 1. Profile image sync from the member portal — **to build**

The mobile app must not become a second place to upload a profile picture.
`OperatorAccount.avatarUrl` should resolve to the member portal's existing
profile image for the same person.

- Decide the source of truth (member profile record vs. auth provider) and
  expose it on the session.
- Serve a stable URL the mobile app can render at 56px without an upload path.
- Until it exists the sheet falls back to initials, which is a legitimate
  end state — do not add an uploader to close the gap.

### 2. Changing the email address — **to build, needs a verification flow**

The row is deliberately inert in Phase 1 and says so on screen. A real change
of address is a security-sensitive operation and needs, at minimum:

1. Operator enters the new address while authenticated.
2. A signed, single-use, short-expiry token is sent **to the new address**.
   Do not change anything on the account at this point.
3. A notification goes to the **old** address saying a change was requested,
   with a way to stop it — this is what makes account takeover recoverable.
4. Only on the new address confirming the token does `email` change, and the
   change is written to the audit trail with actor, timestamp and both values.
5. Existing sessions are re-validated; sign out other devices.
6. Rate-limit requests per account and per IP, and expire pending requests.

The token flow does not exist in `packages/core` today. `magic-consume.ts` and
`invites.ts` are the closest prior art and are the right place to look first.

### 3. Sign-out — **to wire**

The confirmation sheet is built and confirms before acting. It needs to clear
the session server-side (not just locally) and land on the login route.

## Auth and security (not started in Phase 1)

Phase 1 has **no route guard** — it serves fixtures to anyone. Before real data:

- Enforce admin/operator authentication **server-side** on every private route.
- No Supabase service-role secret may reach the client.
- Human UI and MCP adapters must share the same permission-checked domain
  services.
- If cross-subdomain sessions are enabled, cookies must be `Secure`, `HttpOnly`,
  `SameSite=Lax`, scoped deliberately to `.opencollective.app`. Do not broaden
  cookie scope by accident.

## Shared domain logic

`mobile/tsconfig.json` already maps `@core/*` → `./vendor-core/*`, and
`predev`/`prebuild` call `../scripts/sync-vendor-core.mjs mobile`, matching how
the admin app vendors `packages/core` for self-contained Vercel deploys. Phase 1
imports nothing from it. Reuse `packages/core` rather than copying domain logic
into this app.

## What must not change

These are acceptance-checklist items, not preferences:

- No user-facing or canonical `/v2` route. `npm run verify:no-v2` enforces it.
- The five load states, and the `?scenario=` switch that exercises them.
- Forecast stays visually and textually separate from confirmed and received.
- Untimed items never show a clock.
- One champagne primary action and one luminous selection per viewport.
- Status always carries text, never colour alone.
- Sheets trap focus and restore it to the opener.
- Access-network language. No booking, stay, guest, villa, check-in, checkout,
  housekeeping or occupancy in UI copy — a test fails the build on those words.
- Reduced motion disables snap, parallax and cinematic transitions.
