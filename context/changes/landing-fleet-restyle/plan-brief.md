# Fleet-Browse Restyle (`/fleet`) — Plan Brief

> Full plan: `context/changes/landing-fleet-restyle/plan.md`

## What & Why

Restyle the customer **fleet-browse** page (`/fleet`) to the design language the
landing already ships — finishing the surface `landing-redesign` explicitly
deferred ("home only"). The target is a real, code-backed Claude Design mock
(`ScreenDesktopFleet` / `ScreenTabletFleet` / `ScreenMobileFleet` + `FleetCardBig`),
so this is a fidelity port, not invention.

## Starting Point

`/fleet` (`src/pages/fleet/index.astro`) works but wears the pre-redesign look:
category tabs, a `FilterBar.tsx` island (date / payload / sort), and a grid of the
`VehicleCard.astro` (`rounded-xl`, `<span>` CTA). It reuses the already-restyled
shared `SiteHeader`. Behavior — instant category filtering via anchors, deferred
"Zastosuj", clear-all, date validation, the `available_vehicles` RPC — is sound and
stays untouched.

## Desired End State

`/fleet` renders in the restyled language at 1440 / 834 / 390: a type-pill category
bar (`{label} · {count}`, active `#141922`), a single `#EEF0F4` filter card
("Filtry" chip + 3 triggers + crimson "Zastosuj"), a grid of `FleetCardBig` cards
(`rounded-[22px]`, gradient image, hairline spec grid, `#141B2D` "Rezerwuj"), and a
signature animated dark `#0A0A0F` type-pill scroller on mobile. Empty-results,
active-filter chips, clear-all, and the result count survive — restyled on-brand.

## Key Decisions Made

| Decision          | Choice                                                             | Why (1 sentence)                                                                             | Source |
| ----------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------ |
| Scope             | `/fleet` browse only                                               | Finishes exactly the surface `landing-redesign` deferred; detail page is a later change      | Plan   |
| Design source     | Updated Claude Design mock                                         | `customer-desktop.jsx` already holds a redesign-matching fleet family — a true fidelity port | Plan   |
| Card strategy     | Restyle `VehicleCard.astro` in place                               | `grep` proves it's used only on `/fleet` — zero funnel/Cennik ripple, so no fork needed      | Plan   |
| Feature parity    | Keep all working affordances, restyle                              | The mock is happy-path; a restyle must not delete shipped UX (empty state, chips, count)     | Plan   |
| Mobile pills      | Build the animated scroller faithfully                             | It's the signature mobile treatment; worth a small interactive island                        | Plan   |
| Header            | Reuse restyled `SiteHeader`, verify-in-contract                    | `public-info-pages` already aligned it with the mock's `DesktopHeader`                       | Plan   |
| Shared primitives | `CategoryIcon` / `VehicleSilhouette` / `SpecIcon` glyphs untouched | They back `/about`, `/pricing`, `/reserve` — only restyle their containers                   | Plan   |

## Scope

**In scope:** `/fleet` page shell + result count; category type-pills (desktop/tablet);
`FilterBar.tsx` → filter card (functional panels kept); active-filter chips + clear-all;
`VehicleCard.astro` → `FleetCardBig` + grid; animated dark mobile type-pill scroller;
on-brand empty-results / loading; 3-breakpoint vision-diff.

**Out of scope:** landing (`/`); vehicle detail (`/fleet/[id]`); `SiteHeader`/`SiteFooter`
rebuild; `CategoryIcon`/`VehicleSilhouette`/`SpecIcon` glyphs; any behavior/logic, sort/payload
options, RPC, API, DB, or non-additive token/font change.

## Architecture / Approach

Restyle in place, component by component, top-of-page down: page shell + category
pills → filter card → vehicle card → mobile scroller → mock-silent states + fidelity
gate. One new client island (the mobile scroller); everything else is class/markup
restyle against exact values transcribed into `design-contract.md`. Phases are
component-grouped (matching `landing-redesign`), each leaving `/fleet` coherent and
manually reviewable.

## Phases at a Glance

| Phase                     | What it delivers                                  | Key risk                                              |
| ------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| 1. Category pills + shell | Type-pill bar (desktop/tablet), light-sheet shell | Preserving instant-filter anchor nav                  |
| 2. Filter card            | `FilterBar` → `#EEF0F4` card, chips, count        | Keeping shadcn panels + apply/validation intact       |
| 3. Vehicle card           | `VehicleCard` → `FleetCardBig` + grid             | `stack` footer / photo-vs-silhouette at narrow widths |
| 4. Mobile scroller        | Animated dark `#0A0A0F` type-pill island          | New island; no-JS fallback + param preservation       |
| 5. States + fidelity gate | Empty/loading + 3-breakpoint vision-diff          | Mock-silent surfaces (design + record as deviation)   |

**Prerequisites:** Canonical screenshots captured into `design-review/` and
`design-contract.md` written (planning Step 6, below). Local dev server for rendering.
**Estimated effort:** ~2-3 sessions across 5 phases.

## Open Risks & Assumptions

- The mock omits empty/loading/chips/count/filter-panels — those get on-brand designs
  recorded as `deviation(reason)`, verified only by the rendered vision-diff.
- The mobile scroller's collapse/expand animation and keyboard reachability need
  hands-on tuning; a static-row fallback is the recorded escape hatch if it misbehaves.
- Assumes `SiteHeader` already matches the mock's `DesktopHeader`; the contract
  verifies this rather than assuming.

## Success Criteria (Summary)

- `/fleet` matches the canonical mock at 1440 / 834 / 390 (vision-diff empty minus deviations).
- All filtering behavior (instant pills, deferred apply, clear-all, date validation) unchanged.
- No visual regression on `/reserve`, `/about`, `/pricing` from shared primitives.
