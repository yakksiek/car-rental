# Frame Brief: Landing-page redesign (customer desktop home)

> Framing step before /10x-plan. This document captures what is _actually_ at issue,
> separated from what was initially assumed.

## Reported Observation

The landing-page mocks in the Claude Design project (`Rental car company`,
`352d78a6-…`, file `customer-desktop.jsx` → `ScreenDesktopHome`, catalog screen 07)
have been restyled. The shipped `src/pages/index.astro` no longer matches them.

## Initial Framing (preserved)

- **User's stated cause or approach**: The delta is a _visual restyle_ — port the new
  look onto the existing landing page.
- **User's proposed direction**: "Implement the changes" — bring `index.astro` up to the
  new mock.
- **Pre-dispatch narrowing**: canonical source = `customer-desktop.jsx` (not
  `flota-landing.html`); breadth = **landing / home only** (not fleet browse); scope =
  **full mock as the spec** (ratings card, branch selector, new nav destinations all
  intended in).

## Dimension Map

The single observation ("implement the restyled home mock") decomposes into dimensions
with very different backing stories:

1. **Static composition & copy** — hero text, new "Proces wynajmu" (how-it-works)
   section, Kategorie / Popularne layout. ← _initial framing assumes the whole change
   lives here (pure re-skin)._
2. **Design tokens** — does the mock change `global.css` (system-wide) or is it
   landing-local? ← _also where the "just a restyle" framing lands._
3. **Shared chrome** — floating `LandingNav` / footer vs. the app-wide `SiteHeader` /
   `SiteFooter`.
4. **New nav destinations** — Cennik / Dla firm / Pomoc + phone + PL·EN toggle.
5. **Branch (ODDZIAŁ) selector** — 3rd search field against a single-location app.
6. **Ratings & fleet-count data** — "4.9/5 · 1 280 opinii", "83 pojazdy".
7. **Hero imagery** — airfield photo + van-cutout PNG + FLOTA wordmark.

## Hypothesis Investigation

| Hypothesis (dimension)                                               | Evidence                                                                                                                                                                                                                                                   | Verdict                                                                             |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **1. Static composition/copy is the whole change** (initial framing) | Hero/Proces/Kategorie/Popularne are layout + Polish copy only, no backend                                                                                                                                                                                  | **PARTIAL** — true for ~70%, but not the whole change                               |
| **2. Restyle touches design tokens (cascade)**                       | Every mock hex within a few RGB of an existing token in `src/styles/global.css` (bg `#F4F5F7`≈`#F1F3F6`, ink `#141B2D`≈`#0F172A`, border `#E7EAF0`≈`#E3E7EC`, success `#16A34A`≈`#1B9E5A`); zero real changes                                              | **NONE** — landing-local, no `global.css` edit                                      |
| **3. Chrome is shared → editing cascades**                           | `SiteHeader`/`SiteFooter` imported by 5 public pages (`index.astro:42,169`, `fleet/index.astro:108,239`, `fleet/[id]/[...slug].astro:52,72`, `reserve.astro:52,103`, `r/[token].astro:34,79`); today's nav = Start + Flota only (`SiteHeader.astro:23-26`) | **STRONG** — must fork a landing-local `LandingNav`, not replace shared             |
| **4. New nav destinations are net-new**                              | No Cennik / Dla firm / Pomoc routes in `src/pages/**`; no company phone anywhere; no i18n layer (`Layout.astro:17` hardcodes `lang="pl"`)                                                                                                                  | **STRONG** — net-new pages/feature/content                                          |
| **5. Branch selector is net-new**                                    | `HeroSearch.tsx:137-140` **already** renders "Warszawa · Mokotów" as a _static_ field; no location model in schema (comment `:24-26`)                                                                                                                      | **NONE (already exists as static)** — a _real_ selector would need a new data model |
| **6a. Ratings card is net-new data**                                 | No reviews/ratings/opinions table, column, service, or seed anywhere; "4.9 / 5 · 1 280" appears nowhere in `src/`                                                                                                                                          | **STRONG** — pure invention                                                         |
| **6b. Fleet count "83" is backed**                                   | Live count already computed (`index.astro:29`, `listVehicles` `vehicles.ts:38-57`); "83" is fake — real seeded fleet is **7** (`seed.sql`)                                                                                                                 | **PARTIAL** — wire to live count                                                    |
| **7. Hero imagery must be produced**                                 | _Resolved at frame time_ — user delivered `~/Downloads/flota-handover/images/`: hero `generated-1784921984332.png` (actually a **JPEG**, 1376×768, **644KB → optimize**) + `van-cutout.png` (1376×768 **RGBA**, 160KB); wordmark is text                   | **DELIVERED** — no longer a blocker; needs build-time optimization                  |
| **(card data) restyled cards need new fields**                       | `VehicleCard.astro` already renders every field incl. monthly rate + deposit + specs (`:27,28,34-39,80,82-84`); model has `daily_rate`/`monthly_rate`/`deposit`/`payload`/`seats`/`transmission`/`fuel` (migration `20260603155136:48-73`)                 | **NONE** — pure re-skin of existing data                                            |
| **8. Typography change** (surfaced by handover)                      | `flota-handover/design-tokens.css` + README specify **Space Grotesk** (display/wordmark/numbers) + **Playfair Display** (serif headings), vs the app's Inter + Instrument Serif (`design-system.md:38`)                                                    | **NEW** — two net-new webfonts + serif swap; decide landing-local vs app-wide       |
| **9. Mobile unspecified** (surfaced by handover)                     | Mock/HTML is **desktop-fixed 1440px**; mobile behavior is prose-only in README (stepper→vertical timeline, cards 3-up→1-up, trust/search stack)                                                                                                            | **GAP** — plan must design + vision-diff mobile, not just port desktop              |

## Narrowing Signals

Decisive dispositions the user gave once the net-new split was surfaced:

- **Hero imagery** → **delivered** in `~/Downloads/flota-handover/images/` (hero JPEG +
  van-cutout RGBA, both 1376×768). Dependency cleared; remaining work is build-time
  optimization — the 644KB hero → AVIF/WebP via `astro:assets` `<Picture>` (eager +
  `fetchpriority="high"`, sources in `src/assets/`, not `public/`).
- **Trust card** → **hardcode the mock figures** ("4.9/5 · 1 280 opinii", "83 pojazdy")
  as placeholder-to-replace (user's explicit call for their own site; recorded as a
  temporary placeholder, not derived data).
- **Nav chrome** → **only live destinations** (Start + Flota + real phone); Cennik /
  Dla firm / Pomoc and PL·EN dropped from this slice until they exist.

## Cross-System Convention

- **Chrome pattern**: shared `SiteHeader`/`SiteFooter` back all 5 public pages; a
  page-specific nav is a _fork wired into that page only_ (there is no per-page-header
  precedent yet, so `LandingNav` is a new, deliberately landing-scoped component).
- **Design-fidelity convention** (lessons.md): any UI slice ports the design spec at
  _exact_ values (never ranges), verbatim Polish copy, each line `exact` / `deviation`,
  and closes with a rendered vision-diff gate against the mock. This plan inherits the
  plan-time **Design Alignment Audit** + implement-time vision-diff. The leading
  reframe (decompose, don't lump) matches this: deviations (dropped nav items, adapted
  trust card, hardcoded figures, hero-asset dependency) must be recorded as `deviation`
  lines so the fidelity gate converges instead of re-flagging them.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: implement the restyled home page as a
> **shippable-now visual port over existing data + tokens (~70%)**, with the mock's
> **five net-new elements handled per their recorded dispositions** — not as one
> monolithic "implement the restyle."

The initial framing ("it's a visual restyle") is _partially_ correct and is the bulk of
the work — but treated as the whole change it would stall or misfire on five elements
that the mock shows but the app can't back: the hero photo (doesn't exist), the ratings
card (no data), the new nav pages (no routes), the PL·EN toggle (no i18n), and the
"83" fleet count (illustrative). Addressing the frame means the plan sequences the
re-skin first and carries each net-new element as an explicit, dispositioned item
(build / placeholder / drop / await-asset) rather than an implied one.

## Confidence

**HIGH** — four independent read-only investigations returned consistent, file-cited
evidence; the reframe matches the repo's chrome and design-fidelity conventions; and the
user's dispositions resolved the only elements that couldn't be defaulted. Two
corrections to early assumptions (HeroSearch is already 3-field; the vehicle card already
shows monthly/deposit) _reduced_ net-new scope rather than expanding it — no open
unknowns remain that block planning.

## What Changes for /10x-plan

Plan the home restyle as **one UI slice with a clearly partitioned scope**, not a flat
"port the mock":

- **Core (shippable now)** — re-skin hero (layout/text/bullets/search pill), new static
  **Proces wynajmu** section (verbatim Polish copy), Kategorie TypePill row, Popularne
  cards (existing data), landing-local `LandingNav` + restyled footer. All against
  **existing tokens** — no `global.css` edit.
- **Dispositioned net-new** — hero assets **delivered** → optimize at build
  (`astro:assets` `<Picture>` → AVIF/WebP, eager + `fetchpriority="high"`, sources in
  `src/assets/`); trust card **hardcodes** the mock figures as flagged placeholders;
  **fleet count wired to live** `listVehicles().length`; nav ships **only Start/Flota +
  real phone** (record dropped Cennik/Dla firm/Pomoc + PL·EN as `deviation` lines).
- **Typography** — add **Space Grotesk** (display) + **Playfair Display** (serif) via the
  existing Astro Fonts API (mirroring the Inter/Instrument Serif setup in `Layout.astro`);
  recommended default is landing-scoped first, not an app-wide Instrument Serif rip-out —
  confirm at plan time.
- **Mobile** — the mock is desktop-fixed 1440px; **design + vision-diff the responsive
  layout** (README prose is the starting spec: stepper→vertical timeline, cards 3-up→1-up,
  trust/search stack), don't ship desktop-only.
- **Explicitly out of this slice** — a real reviews/ratings feature, a multi-branch
  location model, the Cennik/Dla firm/Pomoc pages, and any i18n. Fleet-browse restyle is
  also out (home only).

## References

- **Handover bundle** (packaged source of truth): `~/Downloads/flota-handover/` —
  `flota-landing.html` (structure/spacing SoT per its README), `flota-landing-reference.png`
  (visual-match target), `design-tokens.css` (colors + **new fonts**), `images/`
  (hero + van-cutout). Consistent with the Claude Design `customer-desktop.jsx` mock.
- Restyled mock: Claude Design `customer-desktop.jsx` → `ScreenDesktopHome` (screen 07)
- Shipped page: `src/pages/index.astro`; shared chrome `src/components/SiteHeader.astro`,
  `SiteFooter.astro`; `src/components/vehicle/{VehicleCard.astro,HeroSearch.tsx,VehicleSilhouette.astro}`
- Data: `supabase/migrations/20260603155136_booking_integrity_data.sql:48-73`,
  `src/lib/services/vehicles.ts`, `src/types.ts`; tokens `src/styles/global.css`
- Conventions: `context/foundation/design-system.md` (`:140` real-photography TODO),
  `context/foundation/lessons.md` (design-fidelity + Design Alignment Audit gate)
- Investigation: 4 parallel read-only agents (nav/chrome · branch/ratings/count ·
  vehicle-card data · tokens/assets)
