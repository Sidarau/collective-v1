# Open Collective — mobile operator UI

Phone-first operator surface for `mobile.opencollective.app`.

**Phase 1 is UI only.** Every screen reads typed fixtures through one provider
interface. There is no Supabase, no MCP, no server action and no production
data anywhere in this app. Phase 2 replaces the provider; nothing else should
need to move.

```bash
cd mobile
npm install
npm run dev          # http://localhost:3002
```

## Required checks

```bash
npm run lint
npm run typecheck
npm run test         # vitest — filters, timeline time rules, sheets
npm run build
npm run test:e2e     # playwright — navigation, a11y, screenshots
npm run verify:no-v2 # deterministic: no versioned route exists
```

## Where the design comes from

`admin/public/brand/mobile-ui/` is the only visual and behavioural authority.
Values in this app are transcribed from it, not invented:

| Source | Lands in |
|---|---|
| `mobile-ui-tokens.json` | `src/app/globals.css` (`@theme` + `:root`) |
| `mobile-routes.json` | `src/lib/routes.ts` |
| `backgrounds/background-manifest.json` | `src/lib/backgrounds.ts` |
| `backgrounds/BACKGROUND_SYSTEM.md` | `.ambient-scene` CSS + `AmbientScene.tsx` |
| `MOBILE_UI_SPEC.md` §5 | `src/lib/time.ts`, `orderTimeline()` in `provider.ts` |
| `COMPONENT_USAGE.md` | `src/components/**`, gallery at `/design-system` |

When a generated board disagrees with the written spec, the written spec wins.

## Boundaries that matter

### Data — the only seam

```
src/data/contracts.ts   types + MobileDataProvider  ← the interface
src/data/fixtures.ts    typed fixture data          ← Phase 1 only
src/data/provider.ts    fixture implementation      ← swap in Phase 2
```

**Pages and components never import `fixtures.ts`.** They call
`getProvider()` and receive `Result<T>`, which is one of `ok / empty / loading /
error / offline`. `ResultBoundary` renders those five states, so no screen
special-cases loading or failure.

Append `?scenario=empty|loading|error|offline|busy` to any route to see it in
that state. This is how the edge-state screenshots and tests are produced, and
it should survive Phase 2.

### Components

```
components/shell/       MobileShell, BrandHeader (top veil), BottomRail,
                        AmbientScene (wallpaper + depth), FloatingStack, PageTitle
components/intel/       DaySummary, NumbersDisclosure, MetricStrip,
                        ForecastCurve, PeriodControl, FilterTabs
components/timeline/    TimelineStream, OperationRow
components/rows/        Person / Space / Gate / Vendor / Money / Event / Area rows
components/ui/          buttons, status, banners, forms, OverflowMenu
components/sheets/      Sheet (focus trap) → Detail, Picker, Composer,
                        Confirm, Collecta
components/templates/   Stream, Queue, Directory, RecordDetail,
                        Intelligence, SettingsList, ResultBoundary
```

`ResultBoundary` is deliberately **not** a Client Component: it takes a render
function for the ok branch, and a Server Component cannot pass a function
across the client boundary.

### Rules encoded in code, not in review comments

- **Time** — `displayTime()` returns `null` unless `displayPrecision` is
  `"minute"`. Applications, approvals, upkeep, supplies, notes and dues can
  never render an invented clock.
- **Ordering** — `orderTimeline()` puts completed work above the present,
  lifts overdue incomplete work into a "Carried forward" block just above the
  present, and orders everything ahead by `sortAt`.
- **Money** — `moneyAnnouncement()` says "incoming"/"outgoing" in words, so an
  amount never depends on an arrow or a sign.
- **Confirmation** — money, access, approval, publishing and destructive
  actions route through `ConfirmSheet`. Fixture mutations are local-only.
- **Language** — this is an access network. Gate / Space / Person / access
  request / access period / arrival / departure / space reset / upkeep /
  supplies / utilization. A Playwright test fails the build if hospitality
  words appear in rendered UI copy.
- **One champagne primary action and one luminous selection per viewport.**

### Brand assets

`public/brand/` holds display-sized copies plus the untouched canonical
originals:

| File | Use |
|---|---|
| `keyhole.png` | the standalone mark, preloaded, never redrawn |
| `collecta-avatar.png` | Collecta's portrait, `object-position: 50% 28%` |
| `*-source.png` | the canonical full-resolution originals, kept lossless |
| `backgrounds/*.webp` + `.png` | four route-family masters |

The mark and the portrait are served as-is rather than through
`/_next/image`, so the `<link rel="preload">` URLs match what the markup
requests. The wordmark beside the mark is platform text and is never
rasterised.

## Screenshots

`npm run test:e2e` writes `screenshots/` at 320×700, 390×844, 430×932, a 768
tablet column, and reduced-motion 390×844, plus the open sheet states and all
five load states.

## What Phase 2 replaces

See [`docs/PHASE_2_HANDOFF.md`](./docs/PHASE_2_HANDOFF.md) for the exact
provider methods, their expected semantics, and what must not change.
