# Landing Redesign (Customer Home) — Plan Brief

> Full plan: `context/changes/landing-redesign/plan.md`
> Frame brief: `context/changes/landing-redesign/frame.md`
> Design contract (exact values): `context/changes/landing-redesign/design-contract.md`

## What & Why

Port the restyled customer **home page** (desktop + mobile) from the Claude Design project onto
`src/pages/index.astro`: a dark immersive hero (photo → translucent FLOTA wordmark → van-cutout →
glass search pill + trust card) rising into a light "sheet" with a "Proces wynajmu" stepper, a
category selector, and a "Popularne" strip. Per the frame, this is a **shippable-now visual port
over existing data + tokens (~70%)**, with five net-new elements handled per their recorded
dispositions — not one monolithic "implement the restyle."

## Starting Point

Today `/` is a light-mode page (serif hero + `HeroSearch` island + static category quick-links +
top-3 Popular strip) that already wires the live vehicle count and uses the shared `SiteHeader`/
`SiteFooter`. `HeroSearch` already does TYP/DATY/ODDZIAŁ → `/fleet`; `VehicleCard` is the shared
catalog card. The redesign restyles this page only — no shared component, token, or font changes.

## Desired End State

`/` renders the restyled hero + body at 1440px and 390px matching the canonical screenshots
(minus recorded deviations), with a working restyled search, a live-count eyebrow + trust card,
a branching stepper (desktop) / vertical timeline (mobile), click-to-route category pills, and a
forked Popular strip. `/fleet`, dashboards, and auth are visually unchanged; all gates stay green.

## Key Decisions Made

| Decision                   | Choice                                                                      | Why                                                       | Source       |
| -------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------- | ------------ |
| Category pills             | Click-to-route only (no hover-filter island)                                | Ships fast; matches re-skinned quick-links                | Plan         |
| Popular card               | Fork `LandingVehicleCard` (leave shared `VehicleCard`)                      | Zero risk to `/fleet`; mock card differs                  | Plan         |
| Fonts                      | Reuse Inter + Instrument Serif (no Space Grotesk/Playfair)                  | No new webfonts; keep app identity                        | Plan         |
| Font mapping               | Wordmark/numbers → Inter 700; H1 + headings → Instrument Serif              | Keeps shipped serif H1; editorial headings                | Plan         |
| Mobile                     | Fully specified from the provided mobile mock (`ScreenMobileHome`)          | User supplied canonical + it's in Claude Design           | Plan         |
| Trust-card / eyebrow count | Wire live `{vehicles.length}`; only 4.9/5 · 1 280 ratings hardcoded         | Truthful count; ratings are the only invented placeholder | Frame + Plan |
| Nav                        | Fork `LandingNav` (Start/Flota + phone); drop Cennik/Dla firm/Pomoc + PL·EN | No routes / no i18n; don't edit shared `SiteHeader`       | Frame        |
| Tokens / palette           | Snap colors to existing tokens; dark hero = landing-local hex               | No `global.css` edit (mock hexes ≈ tokens)                | Frame        |
| Hero assets                | Optimize delivered JPEG + PNG via `astro:assets <Picture>`                  | Delivered; 644KB → AVIF/WebP, eager LCP                   | Frame        |
| Stepper                    | Branching lanes on desktop; vertical timeline on mobile                     | Per the two canonicals                                    | Plan         |

## Scope

**In scope:** dark hero (photo/wordmark/van/scrims), restyled `HeroSearch`, live-count eyebrow +
trust card, dark→light sheet, branching/timeline stepper, click-to-route category selector,
forked Popular strip, forked `LandingNav`, both breakpoints, `pl` plural helper.

**Out of scope:** real reviews/ratings feature, multi-branch model, Cennik/Dla firm/Pomoc pages,
i18n/PL·EN, category hover-filter, `/fleet` restyle, any token/`global.css`/font/shared-component
edit, new API/DB.

## Architecture / Approach

One Astro page (`index.astro`) SSR'ing `listVehicles` as today, composed from new landing-scoped
components: `LandingNav.astro`, `ProcessSteps.astro`, `TypeSelector.astro`,
`LandingVehicleCard.astro`, plus a restyled `HeroSearch.tsx` island and a reused `SiteFooter`.
The design's fixed-canvas absolute layout is re-authored as flow/grid + Tailwind responsive
utilities; colors resolve to existing tokens, the dark hero palette to documented arbitrary hex.
Build each surface at both breakpoints together (they share components).

## Phases at a Glance

| Phase            | What it delivers                                                    | Key risk                                                                |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Foundation    | Optimized hero assets, dark palette, forked `LandingNav`            | `astro:assets` import wiring; keeping `SiteHeader` untouched            |
| 2. Dark hero     | Photo/wordmark/van composition, restyled search, trust card, sheet  | Van-over-wordmark z-order; cross-breakpoint search placement; LCP       |
| 3. Light body    | Branching/timeline stepper, category selector, forked Popular strip | Branching-connector SVG; custom category icons; no `/fleet` regression  |
| 4. Fidelity gate | Vision-diffs empty (minus deviations); a11y + perf                  | Tablet range has no mock; wordmark gradient/backdrop-blur cross-browser |

**Prerequisites:** delivered hero assets on disk (✓), both canonicals captured (✓), Claude
Design access for `DesignSync` at implement time (✓).
**Estimated effort:** ~3–4 focused sessions across 4 phases (hero is the heaviest).

## Open Risks & Assumptions

- The **tablet/in-between range (641–1279px)** has no mock — reflow is derived and verified by
  responsive judgment, not a pixel diff.
- **Van-over-wordmark** relies on the cutout crop matching the photo crop; a wrong shared
  `object-position` doubles the van — the load-bearing detail of the hero.
- Trust-card ratings ("4.9/5 · 1 280 opinii") ship as a **flagged placeholder** until real data
  exists; the vehicle count is live (currently 7, not the mock's 83).
- Mock nav/CTA copy is partly English ("Browse the fleet", "Fleet") — shipped copy is Polish.

## Success Criteria (Summary)

- `/` matches both canonicals at 1440px and 390px (minus recorded deviations) via rendered
  vision-diff; the search works and the counts are live + correctly pluralized.
- `/fleet`, dashboards, and auth are visually unchanged (no shared component/token/font edit).
- `astro check` + lint + build + unit/integration suites stay green.
