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
src/data/contracts.ts        types + MobileDataProvider     ← the interface
src/data/fixtures.ts         typed fixture data             ← Phase 1 content
src/data/fixture-provider.ts fixture implementation        ← preview/demo
src/data/live-data.ts        Supabase reads + aggregations  ← Phase 2
src/data/live-provider.ts    live implementation            ← Phase 2
src/data/mappers.ts          Supabase → contract mappers    ← pure, tested
src/data/provider.ts         the seam: getProvider()        ← server-only
src/data/collecta.ts         Collecta drafts + audit        ← Phase 2
```

**Pages and components never import `fixtures.ts`.** They call
`getProvider()` and receive `Result<T>`, which is one of `ok / empty / loading /
error / offline`. `ResultBoundary` renders those five states, so no screen
special-cases loading or failure.

Client components (sheets) never import `provider.ts` either — their reads and
writes go through the server actions in `src/app/actions.ts`, which re-check
the session on every call.

Append `?scenario=empty|loading|error|offline|busy` to any route to see it in
that state — preview deploys only. On a guarded deploy (`MOBILE_AUTH_GUARD`)
the flag is ignored so an edge-state can never mask real data.

### Deployment shapes

| Shape | Env | Behaviour |
|---|---|---|
| **Preview** (investor demo, `collective-mobile.vercel.app`) | no guard env | Public, fixtures only, `?scenario=` works. Hermetic — no Supabase, no sessions. |
| **Guarded** (`mobile.opencollective.app`) | `MOBILE_AUTH_GUARD=enforced` + Supabase + `NEXTAUTH_SECRET` | Every private route requires an admin/operator session (middleware + per-page check); live data; scenarios disabled. |
| **Dogfood** (local) | preview + `MOBILE_DOGFOOD=1` + Supabase creds | Fixtures chrome with live data for spot checks. |

Guarded env vars: `MOBILE_AUTH_GUARD`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM` (names match
`admin/.env.local`).

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

### How Today is laid out

The day rests on the hero. `splitTimeline()` cuts the stream at the present:

```
history      ← above the hero, faded and masked, reached by scrolling up
hero         ← Today, the day summary, Numbers of the Day, the filters
present      ← Carried forward → Now → everything ahead
```

On load — and whenever the operator taps Today in the rail — the view settles
with the hero just under the veil, so the first thing on screen is the day and
the first thing under it is the work that needs a decision. Completed work is
never the operator's job, so it sits behind the header; a "N earlier" pill is
the only affordance it gets.

The settle re-asserts on a short interval, because the veil measurement and
the display-face swap both land after first paint and change the height of the
history above the hero. Any wheel, touch or key event hands control back
immediately.

### Two places this deviates from the written spec, deliberately

1. **No `scroll-snap-type`.** The spec asks for `y proximity` "where
   appropriate". It is not appropriate here: day dividers sit ~150px apart, so
   with snap points on them every resting position is near one and the browser
   will not settle at the top of the document — measured landing at 213px,
   which puts Today, the day summary and Numbers of the Day permanently out of
   reach. Reduced motion has nothing left to disable, and the test asserts the
   app declares no snap anywhere.
2. **The floating controls can overlap a row at rest.** The spec says they must
   not cover a status or amount at rest, and also that they retire on scroll and
   return after rest — on a 390px viewport those cannot both hold at an
   arbitrary scroll position, and the approved board has the same adjacency. The
   controls sit in a soft radial vignette so whatever is behind them recedes
   rather than collides. Worth a design decision before Phase 2.

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
