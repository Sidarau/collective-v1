# Component Usage Matrix

## Shell

| Component | Use on | Do not use for |
|---|---|---|
| `MobileShell` | Every authenticated mobile route | Public member pages |
| `TopVeil` | Stream and long-list screens | Short confirmation screens |
| `BrandHeader` | Every top-level route | Repeated inside sheets |
| `BottomRail` | Today, People, Spaces, More descendants | Login or setup |
| `PageTitle` | Every non-Today top-level screen | Every list subsection |

## Orientation and intelligence

| Component | Use on | Notes |
|---|---|---|
| `DaySummary` | Today | Three lines maximum |
| `NumbersDisclosure` | Today | Expands compactly or links to `/briefing` |
| `MetricStrip` | Briefing, Dues, Space detail | Two to four metrics; not a generic card grid |
| `ForecastCurve` | Dues/briefing | Must distinguish settled and projected |
| `FilterTabs` | Today, Dues, People, Requests | Text tabs with one travelling rule |
| `PeriodControl` | Briefing and Dues | Today / 7 days / 30 days |

## Timeline and lists

| Component | Use on | Notes |
|---|---|---|
| `TimelineStream` | Today, Dues, relationship history | Bidirectional only on Today |
| `TimelineRail` | Timeline screens | One rail per scroll container |
| `OperationRow` | Mixed operational events | Optional visible time |
| `FocusedOperationRow` | Current selection | One per viewport |
| `CarriedRow` | Overdue incomplete work | Amber state, remains actionable |
| `DirectoryRow` | People, Spaces, Gates, Partners | State and next relevant event |
| `MoneyRow` | Dues, invoices, person financial history | Announces direction |
| `EventRow` | Experiences and person history | Time only when scheduled |
| `AreaRow` | Space detail | Ready / in use / attention; label may be room, deck, berth or zone |
| `SkeletonRow` | Loading | Preserve final row geometry |
| `EmptyState` | Empty filter or directory | Explain how to change state |

## Status

| Component | Use on | Rule |
|---|---|---|
| `StatusText` | List-row trailing state | Default status form |
| `StatusPill` | Detail headers and confirmation sheets | Avoid filling every list row with pills |
| `StatusDot` | Rail condition or compact presence | Always paired with text elsewhere |
| `CountBadge` | More navigation and queue tabs | Actionable counts only |

## Actions

| Component | Use on | Rule |
|---|---|---|
| `AddFab` | Today, Experiences, Space detail | Opens type-aware composer |
| `PrimaryButton` | One decisive action | One champagne button per viewport |
| `SecondaryButton` | Cancel, view, contact, notes | Dark outline or quiet text |
| `DestructiveButton` | Delete/cancel/reject | Coral text, separated, confirmed |
| `OverflowMenu` | Rare secondary actions | Never hide the primary action |
| `UndoToast` | Reversible low-risk writes | Not for money/access/publishing |

## Forms

| Component | Use on | Rule |
|---|---|---|
| `TextField` | Names, titles, short values | Label remains visible |
| `SearchField` | Directories and queues | Debounce 150–250ms |
| `SelectRow` | Gate, Space, area, assignee, category | Prefer a bottom picker on phone |
| `DateRangeField` | Access periods and availability | Show timezone/date convention |
| `DateTimeField` | Calls, check-ins, events | Only when time is meaningful |
| `MoneyField` | Due, expense, contribution | Currency explicit |
| `PeopleStepper` | Access and experience capacity | Accessible increment/decrement |
| `TextArea` | Notes and rationale | Character count only when limited |
| `Toggle` | Immediate reversible preference | Never for destructive actions |
| `Checklist` | Access handoff and upkeep | Large targets, progress visible |

## Sheets

| Component | Use on | Rule |
|---|---|---|
| `DetailSheet` | Queue row preview | May promote to a route |
| `ComposerSheet` | Add flow | Date defaults from visible timeline |
| `ConfirmSheet` | Money, access, approval, publish, cancel | Exact effect shown before confirm |
| `PickerSheet` | Select/date/action choices | One task per sheet |
| `CollectaSheet` | Contextual assistant | 70–85% height, page visible behind |

## Route-to-component map

| Route | Required template/components |
|---|---|
| `/` | StreamScreen, DaySummary, NumbersDisclosure, FilterTabs, TimelineStream |
| `/briefing` | MetricStrip, ForecastCurve, PeriodControl, ranked attention list |
| `/requests` | QueueScreen, FilterTabs, DirectoryRow, DetailSheet |
| `/requests/[id]` | RecordDetail, StatusPill, activity timeline, ConfirmSheet |
| `/people` | Directory, relationship and access-state filters |
| `/people/[id]` | Person 360, access history, dues, experiences and action bar |
| `/spaces` | Directory, utilization summary, SpaceRow |
| `/spaces/[id]` | RecordDetail, AreaRow, upkeep timeline, AddFab |
| `/gates` | Directory, Gate state, associated Spaces and access windows |
| `/gates/[id]` | Gate detail, access rules, Spaces, requests and allocations |
| `/dues` | StreamScreen, ForecastCurve, MetricStrip, MoneyRow |
| `/dues/[id]` | Transaction detail, audit/history, ConfirmSheet |
| `/experiences` | QueueScreen, date strip, EventRow, AddFab |
| `/experiences/[id]` | Event detail, RSVP/capacity, vendor/budget, publish action |
| `/people` | Directory, relationship filters, DirectoryRow |
| `/people/[id]` | Person 360, related access/dues/experiences, relationship timeline |
| `/vendors` | Directory, job-state filters, VendorRow |
| `/vendors/[id]` | Vendor detail, active jobs, invoices, notes |
| `/communications` | QueueScreen, campaign/message rows, composer |
| `/knowledge` | Search, node list, reader/editor route |
| `/more` | SettingsListScreen, grouped navigation, CountBadge |
| `/settings` | SettingsListScreen, Toggle, select rows |

## Anti-patterns

- Do not compress desktop tables into mobile.
- Do not use hospitality language as generic product language.
- Do not use a glass card for every section.
- Do not put a timestamp on every event.
- Do not show more than one glowing selection.
- Do not use gold for ordinary metadata.
- Do not use coral for neutral pending states.
- Do not let floating controls cover a status or amount at rest.
- Do not make Collecta the only way to perform an operation.
