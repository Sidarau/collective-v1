# Open Collective Mobile Operator UI

This directory is the visual and behavioral source of truth for the operator
application at `mobile.opencollective.app`.

The mobile product is not `/v2` and must not ship at a versioned path. It is a
dedicated mobile application surface that reuses the existing Collective
database, domain logic, authentication rules, and audit trail.

## Authority order

When references disagree, use this order:

1. `MOBILE_UI_SPEC.md` for product and interaction behavior.
2. `COMPONENT_USAGE.md` for component selection and placement.
3. `mobile-ui-tokens.json` for exact implementation values.
4. `mobile-routes.json` for canonical routes and navigation.
5. `00-approved-home-reference.png` for the approved home composition.
6. `01-component-system-board.png` for component appearance.
7. `02-operations-screen-family.png` for daily-operations screens.
8. `03-management-screen-family.png` for management screens.

Generated boards are composition references. The written specification is
authoritative for spelling, data, accessibility, dimensions, and behavior.

## Files

| File | Purpose |
|---|---|
| `00-approved-home-reference.png` | Approved Today/home direction |
| `01-component-system-board.png` | Reusable controls, rows, states, forms, feedback and Collecta |
| `02-operations-screen-family.png` | Today, Requests, Access detail and Space operations |
| `03-management-screen-family.png` | Dues, Experiences, People/Vendors and More + Collecta |
| `keyhole-gold-alpha.png` | Canonical dial-free transparent champagne keyhole |
| `collecta-avatar.png` | Canonical Collecta portrait |
| `MOBILE_UI_SPEC.md` | Product, behavior, motion, data and accessibility specification |
| `COMPONENT_USAGE.md` | Where each component should and should not be used |
| `mobile-ui-tokens.json` | Machine-readable design tokens |
| `mobile-routes.json` | Machine-readable route and navigation contract |
| `ACCEPTANCE_CHECKLIST.md` | Build and release gate |
| `asset-manifest.json` | Asset roles and usage constraints |
| `backgrounds/background-manifest.json` | Background route mapping and runtime values |
| `backgrounds/BACKGROUND_SYSTEM.md` | Parallax, focus, glass and accessibility behavior |
| `backgrounds/GENERATION_PROMPTS.md` | Reproducible generation prompt set |

## Ambient background family

The `backgrounds/` directory contains four coordinated portrait masters for
Today, Access, Dues and Spaces. Use the WebP files at runtime and keep the PNG
files as lossless sources. The route family selects the image; scroll and focus
states create the iPhone-style depth behavior. Do not invent page-specific
backgrounds without extending the manifest and validating contrast.

## Brand rules

- Use `keyhole-gold-alpha.png` for the standalone mark. Do not redraw it.
- Use `collecta-avatar.png` for Collecta. Never substitute the logo for her
  portrait when the portrait can load.
- Crop Collecta with `object-fit: cover` and `object-position: 50% 28%`.
- The wordmark is platform text beside the exact mark. Do not rasterize UI
  labels into the logo.
- Champagne is a focus/action material, not a general text color.
- Coral is reserved for blockers, destructive actions and urgent decisions.

## Canonical product language

- `Gate`: a curated access pathway, program or offering.
- `Space`: any physical setting or asset, including residences, rooms,
  studios, land, venues, boats, berths and future types.
- `Person`: member, visitor, applicant, host, partner or vendor.
- `Access request` / `access period`: never “booking” or “stay” in UI copy.
- `Arrival` / `departure`: never “check-in” or “checkout” in default UI copy.
- `Space reset`, `upkeep`, `supplies`: never hospitality or housekeeping copy.
- `Utilization`: the default cross-space metric, not occupancy.

Database names may retain legacy technical terms. Presentation copy must not.

## Privacy

Everything in this public directory must be safe to serve as a static asset.
Do not store customer messages, private contact details, Linear context,
credentials, internal negotiations or production data here.
