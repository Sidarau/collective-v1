# Production hardening — 2026-08-02 (Alex's audit run)

What the first real day of operator use surfaced, what shipped in response, and
what is still a console job. Scope: `mobile/` (mobile.opencollective.app) +
two data operations on prod Supabase.

## Found (all verified in code, not guessed)

### Dead buttons — the app was a read-only shell with write-looking UI

| Surface | Button | Was | Now |
|---|---|---|---|
| Dues detail | Record as received | Fixture no-op | Real `payment_records` insert (kind `balance`), audited |
| Dues detail | Comp | Didn't exist | New — kind `other` + `Comped` note, zeroes the ledger, audited |
| Dues detail | Add note / View audit trail | No handler | Real `admin_notes` write / `audit_logs` read sheet |
| Requests list | Approve / Decline | Fixture no-op | Real booking/application decisions, conflict-checked |
| Requests list (follow-ups) | Approve / Decline (nonsense) | — | Replaced by Mark done |
| Request detail | Approve | **Unreachable** (no button set the state) | Kind-aware Approve / Deny / Decline |
| Request detail | Begin access handoff | Fixture no-op, checklist always empty | Real `approved → confirmed` transition, audited |
| Person detail | Follow up / Message / Add note | No handlers | Follow-up sheet / `mailto:` / note sheet |
| Person detail | Approve / Deny application | **Didn't exist** | Shown when the person has a submitted/screening application |
| Vendor detail | Assign work / Message / View invoices | No handlers | Follow-up sheet / `mailto:` / `/dues` link |
| Experience detail | Publish | Fixture no-op | Real publish (draft → published), audited |
| Experience detail | Edit / Manage RSVPs | No handlers | **Removed** — console jobs (see below) |
| Space detail | Add upkeep / Close Space | No handler / fixture no-op | Real upkeep (closure + note) / real day closure |

### Collecta ("program her brain")

1. **Money 100×** — `buildSnapshot` + summary fallback multiplied
   `total_price` by 100, but the column is already cents. €14,311.20 showed
   as "€1,431,120 across 9 stays". Fixed; regression tests pin the euros.
2. **No page awareness** — `CollectaContext.route` was sent by the client and
   ignored server-side. Now every detail route (`/dues`, `/requests`,
   `/people`, `/spaces`, `/experiences`) resolves to a focused record —
   "it / this / that / him / her" work, and "can we comp it?" on a dues page
   drafts the comp for exactly that stay.
3. **No capabilities** — drafts existed only for publish + complete
   follow-up, and the system prompt told her she "cannot change anything".
   New confirmed drafts: **comp**, record-received, approve/decline access,
   approve/deny application — all executing through the same
   `record-actions.ts` layer the buttons use, all audited.
4. **Fake opener** — the empty thread claimed "Three decisions need you
   today: one access request, one supplies list and one overdue invoice."
   Replaced with a truthful capability line.
5. Snapshot now lists outstanding per stay (person · Space · dates · €) so
   she can answer "which stays" and quote amounts exactly.

### UI bugs

- **Space detail showed only 4 of 9 areas** (`areas.slice(0, 4)` in the facts
  table — the "9 rooms in Roca Llisa, 4 spaces" report). Facts now show the
  first 3 + a "+N more (9 areas — full list below)" row; the Areas section
  lists all and its title carries the count.
- **Design system leaked to prod** — the More page linked `/design-system`
  ("not a production surface") in the guarded app. Now preview-deploys only.

## Data operations on prod (2026-08-02)

- **Comped Alex Sidarau 8–16 Jul** (€2,240, booking `5efcef01…`) — test stay.
- **Comped Don D 15–19 Jul** (€1,400, booking `2f8a0600…`) — test stay.
- Both via `payment_records` (kind `other`, method `comp`) + `audit_logs`
  rows (`booking.comp`). Outstanding dropped €14,311.20/9 stays →
  **€7,900 / 6 stays**.
- Test-account inventory taken (users + leads); deletion list with Alex.

## Architecture added

- `mobile/src/data/record-actions.ts` — the single write layer behind both
  the detail-screen buttons and Collecta's confirmed drafts. Mirrors the
  admin console: approve is conflict-checked (bookings overlap +
  availability blocks + closures via `@core/availability`), application
  approve creates the member + seeds the profile + referral credit + mints
  the entrance link (outbox-gated email), money writes are minor units
  end-to-end. Every write re-checks the operator session, verifies the row
  exists, and leaves an `audit_logs` entry.
- `mobile/src/components/sheets/RecordActionButtons.tsx` — note / follow-up /
  audit-trail sheets used by every detail screen.
- Tests: `record-actions.test.ts` (16) + `collecta.test.ts` (9) — money
  truthfulness, page-focus pronouns, comp/approve drafts, confirm execution.

## Still console jobs (removed from mobile rather than left dead)

- **Edit experience** — no update path exists anywhere; build in console first.
- **Manage RSVPs** — member-facing list; console surface.
- **Arrival-handoff checklist** — the `ChecklistTimeline` exists but no data
  source: `checklist: []` in every live mapper. Needs a schema decision
  (per-stay checklist table or derived steps from bookings + closures) before
  the section means anything. Currently hidden when empty.
- **Member messaging** — Message buttons are `mailto:` for now. In-app
  messaging/WhatsApp deep links need phone numbers on profiles (not in schema).

## Streamline / replace candidates

- The three "approve" surfaces (requests list sheet, request detail,
  Collecta draft) now share one layer — keep it that way; the console's
  `requestTransitionAction` is the reference implementation to port further
  transitions from (deposit/paid with amount capture is still console-only).
- `fixture-provider.ts` answers are drifting from live answers (different
  copy for the same intents). Acceptable while the investor demo exists, but
  any new intent must be added twice — consider generating fixture answers
  from the same rule tables.
