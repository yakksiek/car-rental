---
date: 2026-08-07T10:58:17+0200
researcher: MarcinK
git_commit: c58da6c0302d6e1cc8c12eaa63eb9e4f11d500fb
branch: main
repository: car-rental
topic: "Tablet hero on `/` is cramped on height vs the ScreenTabletHome design mockup"
tags: [research, codebase, landing, tablet, hero, design-fidelity, index.astro, type-selector, popularne, vision-diff]
status: complete
last_updated: 2026-08-07
last_updated_by: MarcinK
last_updated_note: "Added full landing fidelity audit across all breakpoints vs the live Claude Design (TypeSelector + Popularne focus)"
---

# Research: Tablet hero on `/` is cramped on height vs the ScreenTabletHome mockup

**Date**: 2026-08-07T10:58:17+0200
**Researcher**: MarcinK
**Git Commit**: c58da6c
**Branch**: main
**Repository**: car-rental

## Research Question

The hero section on the tablet version is too cramped on height compared to the
Claude design mockup. Compare them side by side and see if that is true.

## Summary

**Confirmed — true.** The tablet (`md`–`<xl`) hero on `/` is ~**400px shorter than the
design intends**, and the cramping is structural, not a matter of a few pixels of padding.

The canonical `ScreenTabletHome` mockup renders the dark hero as **two stacked regions**:

1. a **452px photo stage** (van + `FLOTA` wordmark), then
2. a **separate, in-flow, solid-dark content band (~399px)** below it — a 2-col grid
   (`1.25fr / 0.95fr`, gap 36, `align-end`) with the eyebrow + 62px heading + subhead +
   bullets on the **left** and the white search card on the **right**, all sitting on
   `#0A0D14` with real breathing room.

Total design dark-hero height ≈ **851px**.

The shipped implementation collapses those two regions into **one 452px region**: the
heading + bullets are an **`absolute` overlay pinned to the bottom of the 452px photo**
(`src/pages/index.astro:171`), and the search card is **lifted out of the light sheet
with `md:top-[-280px]`** (`index.astro:252`) to fake the right column. The measured
`<section>` height at 834px is **452px** (DOM-measured), vs the design's ~851px.

The result — visible in the rendered 834px capture — is that the heading collides with
the `FLOTA` wordmark, the subhead ("Wynajem długoterminowy…") runs straight across the
van's body, and the search card floats half-on-photo / half-on-sheet. In the design none
of that content touches the photo at all. **The design gives the hero copy + search its
own ~400px of solid-dark real estate; the app crams it onto the photo.**

This is **implementation drift**, not a recorded deviation: the plan/audit captured the
2-col grid but never stated it was a distinct in-flow band **below** the photo, and Phase
6D (the tablet layout) shipped after the only impl-review, so it was never vision-diffed
against the mock at a true 834px width.

## Side-by-side comparison (834px)

| Aspect                                      | Design `ScreenTabletHome` (canonical)              | App `/` today (`c58da6c`)                                                              |
| ------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Photo stage height                          | `452px`                                            | `452px` ✅ match                                                                       |
| Hero copy (eyebrow/heading/subhead/bullets) | **in-flow band BELOW photo**, on solid `#0A0D14`   | **`absolute bottom-[46px]` overlay ON the photo**                                      |
| Search card                                 | right column of the same in-flow band, `align-end` | **lifted from the sheet** (`md:top-[-280px] md:right-10`), overlaps photo bottom-right |
| Hero content background                     | solid dark, no photo underneath                    | the photo itself (heading over wordmark, subhead over van)                             |
| Dark-hero total height                      | **≈ 851px** (452 + ~399 band)                      | **452px** (`<section>` measured)                                                       |
| Delta                                       | —                                                  | **~399px shorter → "cramped"**                                                         |

Reference images used:

- Design: `context/changes/landing-fleet-restyle/design-review/landing-tablet-reference.jpg`
  (canonical `ScreenTabletHome`, 834px).
- App (captured fresh at 834px for this research): dark hero ends at the search card
  with copy overlapping the photo art; heading overlaps the `FLOTA` wordmark, subhead
  crosses the van.
- Note: the pre-existing `design-review/app-shots/landing page hero.jpg` is a **desktop**
  (4112px) shot — not a valid tablet comparison; that's why the tablet gap went unnoticed.

## Detailed Findings

### Design source of truth — `ScreenTabletHome`

Pulled live via `DesignSync get_file` from the Claude Design project
`Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`), file `customer-desktop.jsx`.
The hero is a single `#0A0D14` wrapper containing two siblings:

```jsx
// (1) photo stage — self-contained, fixed height
<div style={{ position:'relative', width:834, height:452, overflow:'hidden' }}>
  <img HERO />  <FLOTA @top:118 />  <img VAN />  <scrims 150/150 />
</div>
// nav is position:absolute top:22 (overlays the photo)

// (2) hero CONTENT band — position:relative (IN FLOW), sits BELOW the 452px photo
<div style={{ position:'relative', zIndex:5, padding:'6px 40px 46px',
              display:'grid', gridTemplateColumns:'1.25fr 0.95fr', gap:36,
              alignItems:'end' }}>
  <div> eyebrow · Pojazdy/użytkowe (62px/lh62/-2.4 + 11px accent dot) · subhead · 3 bullets </div>
  <div> white search card (radius 22, p-14, 3 fields + 54px "Szukaj") </div>
</div>
```

Key point: **the content grid is `position: relative`** — it adds its own height to the
dark hero and renders on solid dark, _below_ the photo. It does not overlap the photo.
Band height ≈ `6 (pad-top) + ~347 (left column) + 46 (pad-bottom) ≈ 399px`; total dark
hero ≈ `452 + 399 ≈ 851px`. The body sheet then rises with `marginTop: -16` and opens
with the 3-across trust bar.

### Current implementation — `src/pages/index.astro`

- `index.astro:56` — hero `<section>` has **no tablet height**; height comes from flow.
  Only the photo stage is in normal flow, so the section is exactly the photo height.
- `index.astro:61` — photo stage `md:h-[452px]` ✅ (matches the design's 452).
- `index.astro:171` — **tablet hero copy** is
  `absolute bottom-[46px] left-10 z-[5] hidden w-[408px] flex-col gap-5 md:flex xl:hidden`
  → heading + bullets **overlaid on the bottom-left of the 452px photo** (left column only;
  no search card here).
- `index.astro:175` — heading `text-[62px] leading-[62px] tracking-[-2.4px]` ✅ (values match
  design), but positioned over the photo instead of on solid dark.
- `index.astro:252` — the single `<HeroSearch>` mount's wrapper is
  `md:absolute md:top-[-280px] md:right-10 md:z-20 md:w-[320px]` → the search card is **pulled
  up out of the light sheet** to overlap the photo's bottom-right, standing in for the design's
  right column.
- DOM measurement at 834px (Playwright): `sectionHeight: 452`, heading top≈94 / bottom≈218
  (i.e. the h1 sits over the photo, overlapping the wordmark) — confirming the collapse.

### Why it drifted (not a deviation)

- Plan **Phase 6D contract** (`plan.md:617`): _"452px photo stage; 2-col hero grid
  `1.25fr/0.95fr` gap 36 align-end — heading (left) + search card (right)"_ — captures the grid
  but **never says the grid is a separate in-flow band below the photo**. "align-end" was
  implemented as "pin to the bottom of the photo" (overlay) rather than "a band under the photo
  whose two columns bottom-align to each other."
- `reviews/design-audit.md:18` describes the same grid at the **design** level, also without
  the "band below the photo / on solid dark" note.
- `reviews/impl-review.md` covers **only Phases 1–5 (fleet)**, dated 2026-08-02, and explicitly
  predates Phase 6D. Its verdict already flags the tablet vision-diff gate as **not formally
  closed** ("re-capture at browser viewport 834") — so the tablet landing hero was **never
  vision-diffed at a true 834px width**. Phase 6D (`858bfcf`) checked box `6D.4` without that gate
  actually catching this.

## Code References

- `src/pages/index.astro:56` — hero `<section>`; no `md:` height (root cause: height = flow = photo only)
- `src/pages/index.astro:61` — `md:h-[452px]` photo stage (matches design)
- `src/pages/index.astro:168-209` — tablet hero copy block, `absolute bottom-[46px]` overlay on the photo
- `src/pages/index.astro:175` — tablet heading `62px/lh62/-2.4` (correct type, wrong placement)
- `src/pages/index.astro:251-255` — `<HeroSearch>` wrapper lifted with `md:top-[-280px] md:right-10`
- `context/changes/landing-fleet-restyle/plan.md:602-649` — Phase 6D contract + success criteria
- `context/changes/landing-fleet-restyle/reviews/design-audit.md:18` — audited design hero grid
- `context/changes/landing-fleet-restyle/reviews/impl-review.md:16` — tablet vision-diff gate left open

## Architecture Insights

- The design's hero is deliberately **two regions** (photo stage + dark content band). The band
  is what supplies the vertical room the user perceives as missing. Reproducing it faithfully
  means letting the copy+search grid **flow below** the 452px photo on `#0A0D14`, exactly like the
  desktop hero uses a taller `xl:h-[880px]` canvas — the tablet just needs the band, not a fixed
  canvas height.
- The **single-island** constraint (one `<HeroSearch>` mount, never duplicated) is real and must
  be preserved. Today it's honored via `md:absolute` lift. A faithful fix keeps one mount but
  places its wrapper **inside the in-flow dark band's right column** (bottom-aligned) rather than
  lifting it out of the sheet — the mount can still be physically authored in the sheet and moved
  with positioning, or the band can host it directly, as long as there's exactly one instance.
- `mobile` (`< md`) and `desktop` (`≥ xl`) heroes are separate branches and are **not affected** —
  this is strictly the `md`–`<xl` tier.

## Suggested direction (for a follow-up plan — not implemented here)

Reproduce the design's structure at the tablet tier:

1. Give the tablet hero a **real in-flow content band below the 452px photo** on `bg-[#0A0D14]`,
   with `padding: 6px 40px 46px`, `grid-cols-[1.25fr_0.95fr] gap-9 items-end`.
2. Move the heading + bullets **out of the `absolute bottom-[46px]` overlay** into that band's left
   column (keep the `62px/lh62/-2.4` + 11px accent dot + 24px circled-check bullets — already correct).
3. Place the **single** `<HeroSearch>` wrapper into the band's right column, bottom-aligned — remove
   the `md:top-[-280px]` lift. Preserve the one-mount rule.
4. Let the body sheet rise over the taller hero with `-mt-4` as today; verify the 3-across trust bar
   still leads the sheet.
5. Close the gate with a **rendered vision-diff at a true 834px** against `landing-tablet-reference.jpg`.

## Resolution (implemented 2026-08-07)

Fixed in `src/pages/index.astro` — 2 functional changes, tablet-only (`md`–`<xl`),
mobile + desktop untouched:

1. **Tablet copy band: `absolute` overlay → in-flow solid-dark band.**
   `index.astro:171` changed from
   `absolute bottom-[46px] left-10 z-[5] … w-[408px]` to
   `relative z-[5] ml-10 … w-[408px] pt-1.5 pb-[46px] md:flex xl:hidden`.
   The copy now flows **below** the 452px photo on the section's `#0A0D14` background
   (reproducing the design's `padding:6px 40px 46px`, `1.25fr` left column). This is what
   restores the hero height — the band adds ~402px in flow.
2. **Search island re-anchored to bottom-align in the band.**
   `index.astro:252` `md:top-[-280px]` → `md:top-[-315px]` (still `md:right-10 md:w-[320px]`,
   still the single mount lifted from the sheet). Its offset is relative to the sheet top,
   which tracks the section bottom, so the value is stable regardless of band height; `-315`
   bottom-aligns the 285px-tall card with the copy's `pb-[46px]` edge.

**Verified at true widths (Playwright, deviceScaleFactor 2):**

- Tablet 834: dark hero **854px** (was 452; design ≈851). Heading at y=496–620 on solid
  dark below the photo (no wordmark/van overlap). Search card y=523–808, bottom-aligned
  with the copy (808), fully on dark. Matches `landing-tablet-reference.jpg`.
- Mobile 390: section 748px, search static in the light sheet — **unchanged**.
- Desktop 1440: section 880px, search lifted via `xl:top-[-145px]` — **unchanged**.
- `npx astro check` 0/0 · `npm run lint` 0 errors (2 pre-existing unrelated warnings) ·
  `npm run build` Complete.

## Historical Context (from prior changes)

- The landing desktop + mobile shipped earlier under the archived `landing-redesign` change;
  this change (`landing-fleet-restyle`) added the fleet restyle (Phases 1–5) **and** the tablet
  landing tier (Phase 6D). See `reviews/impl-review.md:82` (out-of-scope note) and `plan.md:602`.
- `reviews/impl-review.md:16,84-86` — the desktop/tablet vision-diff was captured under-width
  (retina 2× → ~1061 CSS for the "tablet" shot, which is actually the desktop band), so the gate
  "could not converge" and re-capture at true 834/1440 was only _recommended_, never done.

## Related Research

- `context/changes/landing-fleet-restyle/design-contract.md` — design contract (scoped to `/fleet`;
  the landing tablet hero is covered by the Phase 6D contract in `plan.md`, not here).

## Open Questions

- None on the diagnosis. The one design decision for the fix is **whether the tablet dark-hero band
  should be a fixed height or content-driven** — the design is content-driven (`min-height` on the
  screen wrapper, band grows with copy), which is the faithful choice and also the simplest in
  Tailwind (just let it flow).

---

# Follow-up Research 2026-08-07 — Full landing fidelity audit, all breakpoints (vs live Claude Design)

**Question (verbatim):** _"Check the implementation of the landing page for all the screens
vs Claude design. What has been implemented differently and needs fixing. Make a list for me
to make a final decision on what to fix. Especially the 'Wybierz typ pojazdu' and 'Popularne'
sections."_

**Git commit:** `2ecf4fe` · **Breakpoints:** desktop 1440 · tablet 834 · mobile 390.

## Method

- **Live app render** at true viewports 390 / 834 / 1440 (Playwright, ×2 DPR): full page +
  focused crops of the two priority sections. (This closes the vision-diff gate the prior
  impl-review left open — it had only under-width shots.)
- **Live design source pulled via DesignSync** — `customer-desktop.jsx` →
  `ScreenDesktopHome` / `ScreenTabletHome` / `ScreenMobileHome`, plus the shared blocks
  `DesktopTypeExplorer`, `CalaFlotaCTA`, `PopularCard`, `MobilePopularCard`, `MobileTypePill`.
  **This is the source of truth**, not the 2026-08-02 reference screenshots.
- Three per-breakpoint vision-diff sub-agents + a line-level code audit of the shipped
  components.

## Headline finding — the design moved after the app was built

The landing is a **high-fidelity match to the design as it stood on ~2026-08-02** (the pass
Phases 6B–6D built against). But the **live design has since evolved**, and the app now
diverges from it in a coherent cluster — concentrated in the two sections you flagged. Plus
one systematic, pre-existing brand deviation (serif headings), and a couple of real tablet
layout breaks.

**Root-cause tags** (each item below carries one):

- **DRIFT** — the app never matched the design; implementation gap.
- **DEVIATION** — the app deliberately differs; a recorded decision.
- **DESIGN-MOVED** — the app matched the older design; the **live** design changed after it
  shipped (so "fixing" means chasing a moving target — see Open Questions).
- **DATA** — a seed/live-data artifact, not a design defect (listed but not a "fix the CSS"
  item).

Concretely, since 2026-08-02 the live design **removed** the type-selector hover hint
("Najedź, aby podejrzeć modele…"), **removed** the "Popularne" category chip, **removed** the
"Wszystkie" see-all on Popularne, and **moved** the single see-all into the type-pill row as a
**crimson "Cała flota"** shown on all three breakpoints. The app still reflects the pre-move
layout.

## Master decision list

Severity = how visible/broken. **Rec** = my recommendation; the call is yours.

| #   | Section         | What the app does now                                                                              | What the live design does                                                                         | Bp affected    | Sev  | Cause                                      | Rec                                                                         |
| --- | --------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------- | ---- | ------------------------------------------ | --------------------------------------------------------------------------- |
| 1   | Cross-cutting   | Display headings (hero H1 + every section h2) in **Instrument Serif** (`font-serif`)               | **Bold sans** (`tokens.font`) everywhere — zero serif in the design                               | all            | HIGH | DEVIATION                                  | Decide: keep the serif brand face or revert to sans                         |
| 2   | **Popularne**   | Tablet cards side-by-side price/CTA → **price wraps to 2 lines**, cramped                          | Tablet cards **stack** (price line above a full-width "Rezerwuj") — `MobilePopularCard stack`     | tablet         | HIGH | DRIFT (bug)                                | Fix — stack the footer at narrow card widths                                |
| 3   | **Popularne**   | Tablet spec values **overflow/collide** ("AutomatycznaDiesel") — `truncate` fails in the grid cell | Fits (abbreviated + stacked)                                                                      | tablet         | HIGH | DRIFT (bug)                                | Fix — add `min-w-0` so cells truncate                                       |
| 4   | **Wybierz typ** | "Cała flota" CTA is **dark** (`bg-foreground`), plain arrow                                        | **Crimson** (`tokens.accent`) with a dark `#141922` inner arrow-disc                              | desktop (+2,3) | MED  | DEVIATION\*                                | Decide: honor live-design crimson or keep the recorded dark deviation       |
| 5   | **Wybierz typ** | "Cała flota" shown **desktop only** (`xl:inline-flex`)                                             | Shown on **all three** — inside the pill row on desktop, after the wrapped pills on tablet/mobile | tablet, mobile | MED  | DESIGN-MOVED                               | Add it to tablet + mobile if matching design                                |
| 6   | **Wybierz typ** | Mobile pills **horizontal-scroll** (`flex-nowrap overflow-x-auto`)                                 | Mobile pills **wrap** to multiple rows (`flex-wrap`)                                              | mobile         | MED  | DRIFT                                      | Decide: wrap (design) vs keep scroller                                      |
| 7   | **Popularne**   | Heading carries a **chip** ("Polecane", or the shared category)                                    | **No chip** — the live design removed it                                                          | all            | MED  | DESIGN-MOVED                               | Remove to match, or keep as product choice                                  |
| 8   | **Popularne**   | Heading carries a **"Wszystkie →"** see-all (text link / crimson pill)                             | **No "Wszystkie"** — see-all is now only "Cała flota" in the type row                             | all            | MED  | DESIGN-MOVED                               | Remove (pair with #5) or keep for UX                                        |
| 9   | **Popularne**   | Card subtitle = **year only** ("2021")                                                             | Subtitle = **descriptor · year** ("L3H2 · 2021", "8-osobowy · 2023", "Chłodnia · 2023")           | all            | MED  | DRIFT/DEV                                  | Add `{categoryLabelPl} · {year}` (category is in the data)                  |
| 10  | **Popularne**   | Card images are **real stock photos that aren't vehicles** (clouds/beach/coast)                    | Flat gradient placeholder blocks (silhouette in app)                                              | all            | MED  | DATA                                       | Fix seed photos (or force silhouette) — reads as broken                     |
| 11  | **Wybierz typ** | "Cała flota" sits in the **heading row** (top-right of "Wybierz typ pojazdu.")                     | Sits **inside/after the pill row** (last item of the bordered pill container)                     | all            | LOW  | DRIFT                                      | Relocate if chasing exact structure (pairs with #5)                         |
| 12  | Footer          | Full **multi-column mega-footer** (WYNAJEM / INFORMACJE / KONTAKT) — shared `SiteFooter`           | **Minimal** footer: logo + one-line tagline + "Start · Flota · Strefa pracownika" + ©             | all            | MED  | DRIFT (pre-existing, out of restyle scope) | Decide: swap landing to the minimal footer or keep the mega-footer sitewide |
| 13  | Footer          | © "Wsze**lkie** prawa zastrzeżone"                                                                 | © "Wsze**stkie** prawa zastrzeżone"                                                               | all            | LOW  | DRIFT (copy)                               | One-word copy fix                                                           |
| 14  | Hero / nav      | Desktop nav **phone glyph is crimson** (`text-primary`)                                            | Muted/grey                                                                                        | desktop        | LOW  | DRIFT                                      | Token swap if desired                                                       |

\* #4 is tagged DEVIATION because Phase 6C explicitly chose "keep dark `Cała flota`, record
deviation" — but note the 2026-08-02 audit recorded the design as _"Wszystkie, crimson"_,
whereas the **live** design is _"Cała flota, crimson"_. So today the label already matches; only
the **colour** (and the inner arrow-disc) differ.

## Sections that MATCH (no action)

- **Dark hero** (nav, FLOTA wordmark, van composition, headline, benefit list, "Zarezerwuj
  online" mobile CTA, glass tablet nav, trust card) — matches at all three breakpoints. The
  tablet-hero cramping from the earlier research was fixed (`d054f0f`); the desktop/mobile
  heroes track the design. Search-pill "empty" state (`Wszystkie typy` / `Dowolne daty`) vs the
  mock's filled example is app default-state, **not** a defect.
- **"Proces wynajmu" stepper** — matches at all breakpoints (eyebrow, heading + dot, subhead,
  desktop branching lanes + 4-circle track, tablet 2×2 grid with short titles, mobile vertical
  timeline). Verbatim copy aligns.
- Nav "Flota" / "Przeglądaj flotę" vs the design's English "Fleet" / "Browse the fleet" is the
  design's EN placeholder — the app's **Polish is canonical**, not a bug.
- Count deltas (6 vs 47 "pojazdów", trust "6" vs "83", card models/prices) are **live/seed
  data**, not fidelity issues.

## Deep dive — "Wybierz typ pojazdu" (type selector)

Design source: `DesktopTypeExplorer` (`customer-desktop.jsx:220-238`), `CalaFlotaCTA`
(`:201-218`), `ScreenTabletHome` (`:751-761`), `ScreenMobileHome` (`:902-916`).
App: `src/components/landing/TypeSelector.astro`.

- **Heading + dot** — match (both a text "." in `tokens.accent`/`text-primary`; the app's
  serif face is the cross-cutting item #1, not specific to this section).
- **Pills** (5, order Furgon · Bus osobowy · Autolaweta · Chłodnia · Skrzyniowy, Furgon active
  crimson) — match in content and states across all breakpoints. Desktop wraps them in a white
  bordered `rounded-full` container in both.
- **The see-all CTA is the real divergence** (items #4, #5, #11). In the live design a single
  **crimson "Cała flota"** (`background: tokens.accent`, dark `#141922` arrow-disc) is the last
  element of the pill row and appears on **every** breakpoint (`overhang` variant inside the
  desktop container; plain variant after the wrapped pills on tablet/mobile). The app ships a
  **dark** one, in the **heading row**, **desktop-only**. `TypeSelector.astro:38-55` (the
  `xl:inline-flex` dark `Cała flota`) is where all three sub-issues live.
- **Mobile layout** (#6): the design **wraps** the pills (`flexWrap: 'wrap'`,
  `customer-desktop.jsx:908`); the app **horizontal-scrolls** them
  (`TypeSelector.astro:59`, `flex-nowrap overflow-x-auto`). Phase 6C changed this to a scroller
  believing it matched the design — but the horizontal scroller is the **/fleet** pattern
  (`FleetTypeScroll`), not the landing selector, which wraps.

## Deep dive — "Popularne" (featured strip)

Design source: `PopularCard` (desktop, `customer-desktop.jsx:240-269`), `MobilePopularCard`
(`:641-668`), the desktop composition in `DesktopTypeExplorer` (`:230-235` — **plain
"Popularne" heading, no chip, no see-all**), `ScreenTabletHome` (`:763-770` — cards passed
`stack`), `ScreenMobileHome` (`:918-934`).
App: `src/pages/index.astro:271-326` (section) + `src/components/vehicle/LandingVehicleCard.astro`.

- **Card interior largely matches** (Phase 6C did this well): white card `rounded-[18px]`
  desktop / `rounded-xl` mobile, 150px image block, 4-spec row with vertical dividers + bottom
  hairline on desktop, dark `ink-deep` "Rezerwuj" CTA, `od {price} zł /dzień` on desktop with
  the "od" dropped on tablet/mobile, **no monthly/deposit line**. The live design's `PopularCard`
  has **no "Dostępny" status pill** (that green pill only existed in an older generation) — so the
  app correctly omits it.
- **Heading furniture removed by the live design** (#7, #8): the app's chip
  (`index.astro:280-298`) and "Wszystkie" link (`:300-317`) are **gone** in the live design.
  The chip is also the app's own flagged deviation (`popularChipLabel` = "Polecane" when the
  top-3 span categories — `index.astro:43-50`).
- **Subtitle** (#9): app shows year only (`LandingVehicleCard.astro:81` uses
  `production_year`); the design shows a descriptor + year. `categoryLabelPl(vehicle.category)`
  is available and would approximate it.
- **Tablet is genuinely broken** (#2, #3): at 834 the 3-col grid makes each card ≈246px. The
  design handles that width with `MobilePopularCard stack` (price stacks above a full-width
  button) and abbreviated specs; the app has **no stacked footer state** — its `@min-[400px]`
  container query only toggles mobile↔desktop, so at ~246px it uses the mobile side-by-side and
  the price wraps (`LandingVehicleCard.astro:99-122`). The 4-col spec cells also lack `min-w-0`,
  so `truncate` (`:92`) can't engage and values collide.

## Code references

- `src/components/landing/TypeSelector.astro:38-55` — dark, desktop-only "Cała flota" CTA (#4,#5,#11)
- `src/components/landing/TypeSelector.astro:59` — mobile `flex-nowrap overflow-x-auto` scroller (#6)
- `src/pages/index.astro:280-298` — Popularne category chip (#7)
- `src/pages/index.astro:300-317` — Popularne "Wszystkie" see-all (#8)
- `src/pages/index.astro:43-50` — `popularChipLabel` derivation (the "Polecane" fallback)
- `src/components/vehicle/LandingVehicleCard.astro:81` — subtitle = year only (#9)
- `src/components/vehicle/LandingVehicleCard.astro:85-96` — 4-spec grid, missing `min-w-0` (#3)
- `src/components/vehicle/LandingVehicleCard.astro:99-122` — footer with no stacked state (#2)
- `src/components/SiteFooter.astro` — the mega-footer used on the landing (#12,#13)
- Design (live, via DesignSync): `customer-desktop.jsx` — `CalaFlotaCTA:201-218`,
  `DesktopTypeExplorer:220-238`, `PopularCard:240-269`, `MobilePopularCard:641-668`,
  `ScreenTabletHome:670-776`, `ScreenMobileHome:778-941`.

## Open Questions

- **The live design is a moving target.** It changed materially between 2026-08-02 (what the
  app was built to) and 2026-08-07 (this pull). Items #5, #7, #8 (and the crimson in #4) are
  "chase the new design" changes. Decide whether to **re-sync to the current design**, **freeze
  against the 08-02 snapshot** the app already matches, or **cherry-pick**. If re-syncing, note
  the design also removed the hover-preview hint (the app already dropped it — good).
- **Serif vs sans headings (#1)** is the biggest single visual call. It was a deliberate
  `landing-redesign` brand elevation, but it is _not_ what the live design shows. This is an
  identity decision, not a bug.
- **Footer (#12)** is pre-existing and shared sitewide; changing it touches more than the
  landing.
- The Popularne **seed photos (#10)** are not vehicle images — likely a data/seed problem worth
  confirming against production data before treating it as a UI fix.
