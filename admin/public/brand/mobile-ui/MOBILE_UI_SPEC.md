# Mobile Open Collective — Product and UI Specification

## 1. Product definition

`mobile.opencollective.app` is the phone-first operator surface for running the
Collective. It is an operational index over the existing system, not a reduced
or separate product.

An operator must be able to:

- understand the day in under five seconds;
- review and decide applications and access requests;
- coordinate arrivals, departures, space resets, upkeep and supplies;
- review contributions, expenses, dues and revenue forecast;
- operate events and general programming;
- find people, members, visitors, partners and vendors and their histories;
- create or edit upcoming work while scrolling into the future;
- use Collecta with current page context;
- reach every existing admin module without switching to desktop.

The home metaphor is one continuous chronology. Scroll upward into history and
downward into plans. The present is an anchor, not a separate tab.

## 1.1 Canonical domain language

The product is an access network, not a hospitality product.

| Product term | Meaning |
|---|---|
| Gate | A curated access pathway, program or offering |
| Space | Any physical setting or asset: residence, room, studio, land, venue, boat, berth or future type |
| Person | Member, visitor, applicant, host, partner or vendor |
| Access request | A request to use a Gate or Space during a period |
| Access period | Approved use of a Gate or Space |
| Arrival / departure | The start and end of an access period |
| Space reset | Preparing a Space for its next use |
| Upkeep | Maintenance, inspection, repair and recurring care |
| Supplies | Provisions, consumables and replenishment |
| Utilization | Cross-Space usage metric |

Avoid “hotel”, “hospitality”, “booking”, “stay”, “guest”, “check-in”,
“checkout”, “housekeeping”, “villa” and “occupancy” as generic UI language.
Type-specific detail may identify a residence, room, boat, berth or studio when
that is the actual Space type. Legacy database names do not dictate UI copy.

## 2. Deployment and application boundary

- Canonical production host: `https://mobile.opencollective.app`
- Canonical home path: `/`
- Do not expose `/v2` in navigation, canonical URLs or analytics.
- Build as a dedicated `mobile/` Next.js application in the existing
  repository, deployed as a separate Vercel project.
- Reuse `packages/core` domain logic rather than copying it into the mobile
  application.
- Reuse the same Supabase project and server-enforced admin/operator roles.
- Authentication may share the existing identity and secret configuration,
  but mobile must enforce its own route guard before reading any private data.
- If cross-subdomain sessions are enabled, cookies must be `Secure`,
  `HttpOnly`, `SameSite=Lax`, and scoped deliberately to
  `.opencollective.app`. Do not broaden cookie scope by accident.

## 3. Information architecture

### Persistent bottom navigation

| Destination | Route | Purpose |
|---|---|---|
| Today | `/` | Daily summary, numbers, filtered chronology and creation |
| People | `/people` | Members, visitors, applicants, hosts, partners and access history |
| Spaces | `/spaces` | Gates, Spaces, areas, utilization, closures and upkeep |
| More | `/more` | Every remaining operator module |

Only four persistent destinations are allowed.

### More groups

- Operate: Requests, Applications, Partners & crew, Communications
- Spaces: Gates, Areas & closures, Content
- Intelligence: Daily briefing, Dues, Knowledge base, Reports
- System: Agents & MCP, Settings

### Today filters

| Filter | Includes |
|---|---|
| All | Every operation in chronological order |
| Requests | Applications, access requests, screenings, approvals and follow-ups |
| Access | Arrivals, departures, space resets, upkeep, inspections and supplies |
| Dues | Contributions, balances, expenses, refunds and vendor invoices |
| Experiences | Events, dinners, activities, programming and RSVPs |

Filters describe kind. Time remains the timeline axis.

## 4. Today and numbers of the day

The header uses its most valuable space for useful counts, not a large clock.

Required summary:

1. Flow: arrivals, departures and requests
2. Hands: upkeep and supplies
3. Money: due and incoming

Example:

```text
Today                         Sunday, 26 July
2 arrivals · 1 departure · 3 requests
2 upkeep · 1 supplies
€2.4k due · €850 incoming
```

Each term is tappable and applies the relevant filter.

### Numbers layer

The compact summary expands in place or opens `/briefing`. It must include:

- revenue forecast;
- confirmed revenue;
- outstanding revenue;
- confirmed access periods;
- new approved members;
- Space utilization;
- average access value;
- operating expenses.

Periods: Today, 7 days, 30 days.

Rules:

- show a comparison only when the denominator is valid;
- label forecast separately from settled or confirmed value;
- never imply projected revenue is cash received;
- display the data-as-of time in the expanded view;
- keep the collapsed Today screen operational rather than chart-led;
- use compact sparklines only when at least five comparable data points exist.

## 5. Timeline behavior

### Data contract

```ts
type OperationCategory =
  | "requests"
  | "access"
  | "dues"
  | "experiences";

type OperationEvent = {
  id: string;
  sourceType: string;
  sourceId: string;
  category: OperationCategory;
  kind: string;
  title: string;
  detail?: string;
  sortAt: string;
  displayPrecision: "minute" | "day" | "none";
  status:
    | "complete"
    | "ready"
    | "in_progress"
    | "confirm"
    | "review"
    | "blocked";
  priority: "normal" | "attention" | "critical";
  amountMinor?: number;
  currency?: string;
  moneyDirection?: "incoming" | "outgoing";
  href: string;
  primaryAction?: { label: string; action: string };
};
```

`sortAt` controls placement. `displayPrecision` controls visible time.

Display a clock time only when punctuality is operationally meaningful:

- arrivals and departures;
- screening or host calls;
- experiences and events;
- committed vendor delivery windows;
- explicitly scheduled maintenance windows.

Do not show an invented time for applications, approvals, general upkeep,
supplies, notes, dues or unscheduled follow-ups.

### Ordering

Within the current day:

1. overdue incomplete work carried forward;
2. current or next scheduled item;
3. timed upcoming work in chronological order;
4. untimed work ordered by priority and due date;
5. completed work above the present in reverse chronology.

Incomplete work never disappears into history. Carry it directly above the
present until completed, dismissed or rescheduled.

### Pagination and landing

- Use bidirectional keyset pagination on `(sortAt, id)`.
- Load enough preceding and following rows to place the present at roughly
  35–42% of the viewport.
- Preserve scroll anchor while prepending history.
- A Today tap returns to the present without clearing filters.
- Scrolling into a future date changes the default date used by the add flow.

## 6. Screen templates

### Stream screen

Use for Today and Dues:

- measured transparent top veil;
- compact summary/hero;
- filter tabs;
- continuous rail and rows;
- floating actions;
- bottom navigation.

### Queue screen

Use for Requests, Applications, Vendors and Communications:

- title and actionable count;
- search/filter row;
- touch-native list;
- optional selected-row glow;
- detail bottom sheet on phones;
- no desktop table squeezed into the viewport.

### Record detail

Use for request, access period, person, partner, event, transaction and Space detail:

- compact identity/state header;
- critical facts strip;
- chronological activity/checklist;
- one persistent primary action;
- secondary actions grouped below or in an overflow menu;
- destructive actions separated and confirmed.

### Directory

Use for People, Spaces, Gates and Partners:

- search;
- short, domain-specific filters;
- rows with state and next relevant event;
- optional summary strip;
- no card masonry.

### Settings list

Use for More, Settings, Agents and Knowledge navigation:

- grouped rows;
- badges only for actionable counts;
- chevron indicates navigation;
- switches only for immediate reversible preferences.

## 7. Core interactions

### Row

- Minimum target: 44 × 44px; preferred row height: 58–68px.
- Title: one line.
- Detail: one line.
- Status: trailing, on the title baseline.
- Use text and color together.
- Press: 0.985 scale or 1–2px depression for 80–120ms.
- Tap opens a sheet or deep-linked record.
- Do not use swipe-to-approve for admissions or money.

### Selected/current item

- luminous champagne rail node;
- restrained horizontal flare;
- brighter ivory title;
- optional green edge when state is healthy;
- glow appears only on one selected item per viewport.

### Add

The satin `+` opens a type chooser:

- Request/follow-up
- Access period or movement
- Space reset or upkeep
- Due/expense
- Experience/event
- Note

The form defaults to the date currently visible in the timeline.

### Confirmation

Money, membership, access, publishing, cancellations and destructive changes
require a review sheet showing:

- action in plain language;
- affected person/record;
- date and amount when relevant;
- quiet Cancel;
- one champagne Confirm.

### Collecta

The portrait orb opens a 70–85% height liquid-glass sheet. Send:

```json
{
  "route": "/spaces/space-id",
  "filter": "access",
  "visibleDate": "2026-07-26",
  "visibleEventIds": ["bookings:123", "upkeep_tasks:456"],
  "selectedEventId": "upkeep_tasks:456"
}
```

Collecta re-fetches records server-side and never trusts client-supplied record
content. Material changes use draft → review → confirm → audit.

## 8. Visual system

### Palette

- Field: `#0A1310`
- Void: `#060D0B`
- Raised: `#101C17`
- Line: `#17251F`
- Ivory: `#F2F5F1`
- Dim sage: `#8A9A93`
- Faint sage: `#5A6B64`
- Champagne: `#E8C87A`
- Champagne highlight: `#F6E4B2`
- Champagne shadow: `#C9A054`
- Healthy green: `#86C9A4`
- Critical coral: `#F0645A`

### Type

- UI: system stack, beginning with `-apple-system` and
  `BlinkMacSystemFont`; this yields SF Pro on iOS.
- Display: Playfair Display, with Didot/Bodoni/Georgia fallback.
- Display face is reserved for Today, major numbers, sheet titles and
  Collecta’s name.
- Use tabular numerals for amounts, counts and aligned dates.
- Do not ship Apple font files or rely on SF Symbols outside Apple platforms.

### Materials

- Light leaks are static radial gradients.
- Champagne controls use a satin gradient plus a one-pixel highlight.
- Blur is limited to the fixed header veil, bottom rail and open sheets.
- The scrolling feed uses opacity and transform for depth; per-row blur is
  capped at 2px near viewport edges.
- One gold primary action per viewport.

## 9. Motion

- Native scroll; no Lenis or GSAP scroll engine.
- `scroll-snap-type: y proximity`, disabled under reduced motion.
- Header collapse: 180–240ms equivalent visual response driven by scroll.
- Filter indicator travel: 180ms.
- Row press: 90ms in, 140ms out.
- Return-to-present pulse: one 600ms ring, never looping.
- Sheet open: 320–380ms with `cubic-bezier(.32,.72,.24,1)`.
- Floating controls retire while scrolling and return 350–420ms after rest.
- Reduced motion removes snap, blur choreography, shared movement and pulses.

## 10. Accessibility

- WCAG 2.2 AA contrast.
- Visible keyboard focus.
- 44px minimum targets.
- Status is never color-only.
- Filters use tab semantics.
- Timeline uses an ordered list with descriptive row labels.
- Filtered result count is announced in a polite live region.
- Sheets trap focus and restore it to the opener.
- Amount labels announce incoming/outgoing rather than only signs or arrows.
- Support 200% zoom and text size without hiding the primary action.
- Respect `prefers-reduced-motion`, `prefers-contrast` and safe areas.

## 11. Performance

- Initial usable shell under 2.5 seconds on a mid-tier mobile connection.
- Avoid layout shift after the header is measured.
- Virtualize only after measuring real row counts; do not prematurely break
  native accessibility.
- Preload the exact keyhole and Collecta portrait.
- Use responsive AVIF/WebP for Space and experience thumbnails.
- Keep backdrop-filter layers fixed and limited to three.
- Target 60fps on a two-generation-old iPhone.

## 12. Desktop behavior

The mobile app may expand to a centered 520px operational column on tablets.
It is not a replacement for the existing dense desktop console in the first
release. Deep links may open the mobile detail layout at any width, but the
legacy admin remains available until every module reaches functional parity.
