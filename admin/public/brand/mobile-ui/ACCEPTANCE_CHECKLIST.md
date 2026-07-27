# Mobile UI Template Acceptance Checklist

## Architecture

- [ ] Application is served at `mobile.opencollective.app`.
- [ ] No user-facing or canonical `/v2` route exists.
- [ ] Private routes enforce admin/operator authentication server-side.
- [ ] Mobile imports shared domain logic from `packages/core`.
- [ ] No Supabase service-role secret reaches the client.
- [ ] Human UI and MCP adapters share permission-checked domain services.

## Brand and design

- [ ] Exact `keyhole-gold-alpha.png` is used.
- [ ] Collecta uses `collecta-avatar.png`.
- [ ] UI follows `mobile-ui-tokens.json`.
- [ ] Only one champagne primary action appears per viewport.
- [ ] Coral is reserved for blockers/destructive/urgent decisions.
- [ ] Header, rail and sheets are the only major blur layers.
- [ ] 320px, 390px and 430px widths have no horizontal page overflow.

## Today

- [ ] Today summary uses real data from the same source as the timeline.
- [ ] Revenue forecast is distinguished from confirmed and received money.
- [ ] Periods Today / 7 days / 30 days work.
- [ ] All / Requests / Access / Dues / Experiences work and persist in URL state.
- [ ] Initial scroll lands near the present.
- [ ] History can prepend without a visible scroll jump.
- [ ] Future scrolling changes the default add date.
- [ ] Untimed items do not display invented times.
- [ ] Overdue incomplete work is carried forward.

## Product coverage

- [ ] Requests and applications can be reviewed.
- [ ] Arrival/departure and access-period details are usable by touch.
- [ ] Gates, Spaces, areas, closures, upkeep and supplies are reachable.
- [ ] Dues supports incoming, outgoing, outstanding and forecast views.
- [ ] Experiences support draft, publish, capacity and RSVP views.
- [ ] People and vendors have mobile detail views and history.
- [ ] Communications, content, knowledge, agents and settings remain reachable.
- [ ] Add flow supports every category specified in `MOBILE_UI_SPEC.md`.
- [ ] Generic UI copy contains no hospitality, booking, stay, guest, villa,
      check-in, checkout, housekeeping or occupancy terminology.
- [ ] Every route family uses the background assigned in
      `backgrounds/background-manifest.json`.
- [ ] Background parallax is interaction-driven, remains within the documented
      overscan bounds and exposes no bitmap edge.
- [ ] Opening a detail, sheet or Collecta creates the documented blur-and-focus
      depth change without resetting page scroll.
- [ ] Reduced motion disables parallax, scale and cinematic focus transitions.

## Collecta

- [ ] Orb opens a context-aware sheet.
- [ ] Page context contains IDs, not trusted record bodies.
- [ ] Material writes are presented as drafts.
- [ ] Approval, money, access and publishing require explicit confirmation.
- [ ] Confirmed actions create an audit record.
- [ ] Focus returns to the orb when the sheet closes.

## Accessibility

- [ ] Automated axe scan reports no serious/critical issues.
- [ ] Interactive targets are at least 44px.
- [ ] All statuses include text.
- [ ] Filters expose correct tab semantics.
- [ ] Sheets trap and restore focus.
- [ ] Reduced motion disables snap and cinematic transitions.
- [ ] VoiceOver can traverse the summary, filters, timeline and bottom rail.
- [ ] UI remains usable at 200% text zoom.

## Performance

- [ ] No more than three simultaneous backdrop-filter layers.
- [ ] Scroll remains responsive on a two-generation-old iPhone.
- [ ] Images use responsive modern formats where appropriate.
- [ ] Header measurement causes no visible layout shift.
- [ ] Floating controls do not cover a status or amount at rest.

## Required verification

```bash
cd mobile
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Additional deterministic checks:

```bash
grep -R "/v2" src public package.json
grep -R "OpenCollective transparent gold keyhole emblem" src
```

The first command must return no user-facing V2 route. The second should return
no runtime dependency on the source filename with spaces; use the stable mobile
alias instead.

Required Playwright viewports:

- 320 × 700
- 390 × 844
- 430 × 932
- reduced-motion 390 × 844
