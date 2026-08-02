# Mobile app audit log

Recurring audit of mobile.opencollective.app. Cron job `collective-mobile-audit`
(daily 08:00) runs `~/.hermes/scripts/collective-mobile-audit.sh` and appends
here. When a run says CLEAN there is nothing to list.

## 2026-08-02 — initial hardening run (manual, Hermes)

**Scanned:** dead buttons, fixture no-ops, money rescale (100×), fake copy,
design-system leak, Collecta capability/page-awareness, prod data drift.

**Found & fixed (commit `3c15572`):**
- 20+ dead buttons across dues/requests/people/vendors/experiences/spaces —
  all wired to the new `record-actions.ts` write layer or removed as console
  jobs (Edit experience, Manage RSVPs).
- Collecta: route-aware focus, comp/record/approve/decline drafts, truthful
  opener, per-stay outstanding snapshot, system prompt with capabilities.
- Collecta money 100× (snapshot + summary fallback).
- Spaces facts table truncating 9 areas → 4 (now 3 + "+N more" row).
- `/design-system` link gated to preview deploys.

**Found & fixed (commit `86f7f43`, caught by the audit script itself):**
- `live-provider.ts` getDaySummary dues/incoming chips rescaled 100×.

**Prod data ops (with approval):**
- Comped Alex Sidarau 8–16 Jul (€2,240) + Don D 15–19 Jul (€1,400) test
  stays — payment_records kind `other` method `comp` + audit rows.
- Deleted 5 test accounts (users + leads + dependents); kept
  `test-admin@collective.test` for auth smoke tests.
- Cancelled Don D 15–19 Jul test request.

**Verification:** 130/130 unit, 199/199 e2e (7 pre-existing skips), tsc +
eslint clean, deployed to mobile.opencollective.app.

**Documented, not built (needs a human decision):**
- Arrival-handoff checklist data source (schema decision).
- Edit experience / Manage RSVPs / member messaging surfaces.
- Fixture-provider answer drift vs live answers.
