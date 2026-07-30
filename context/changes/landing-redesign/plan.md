# Landing Redesign (Customer Home) Implementation Plan

## Overview

Port the restyled customer **home page** — desktop (`ScreenDesktopHome`, 1440px) and mobile
(`ScreenMobileHome`, 390px) from the Claude Design project `Rental car company` — onto the
shipped `src/pages/index.astro`. This is a landing-scoped UI slice: a dark immersive hero
(full-bleed photo → translucent FLOTA wordmark → van-cutout z-order → glass search pill +
trust card) rising into a light "sheet" that carries a branching "Proces wynajmu" stepper, a
click-to-route category selector, and a "Popularne" strip. Built over **existing data and
existing tokens** (no `global.css` edit) and **existing fonts** (no new webfonts), with the
mock's five net-new elements handled per their frame dispositions.

**Exact values live in `design-contract.md`** (this folder). This plan references it per
surface rather than repeating every pixel; the contract is the source the build follows.

## Current State Analysis

- `src/pages/index.astro` is a **light-mode** page: a serif hero with the `<HeroSearch>`
  island, static category quick-links (`VehicleSilhouette` cards → `/fleet?category`), and a
  "Popularne" strip of the first 3 `listVehicles(...)`. It already wires the live vehicle
  count (`vehicles.length`) and uses `SiteHeader`/`SiteFooter`.
- `HeroSearch.tsx` already renders **TYP / DATY / ODDZIAŁ + Szukaj → `/fleet`** with date
  validation and a static "Warszawa · Mokotów" branch — the mock's search pill is a **restyle**
  of it, not new logic.
- `VehicleCard.astro` is the **shared** catalog card (also backs `/fleet`). The mock's Popular
  card differs (no monthly/deposit line, top-left type/status, "od … /dzień"), so it is **forked**.
- `SiteHeader`/`SiteFooter` back **5 public pages** — the floating pill nav is **forked** as a
  landing-local `LandingNav`, never an edit to the shared header. `SiteFooter` already matches
  the mock footer and is **reused as-is**.
- Fonts: `Layout.astro` + `astro.config.mjs` wire **Inter / Instrument Serif / JetBrains Mono**.
  The redesign **reuses these** — no `astro.config`/`Layout` change.
- Tokens: every mock hex is within a few RGB of an existing `global.css` token (frame
  hypothesis 2) — colors snap to tokens; the dark hero palette (`#080B12` / `#0A0D14`) is
  landing-local arbitrary hex.
- Hero assets are **delivered** on disk (`~/Downloads/flota-handover/images/`): hero
  `generated-1784921984332.png` (a 644KB JPEG, 1376×768 — must optimize) + `van-cutout.png`
  (RGBA, 1376×768). The van-cutout crop matches the photo so it lands over the wordmark.

### Key Discoveries

- Mobile landing source confirmed in Claude Design: `customer-desktop.jsx` → `ScreenMobileHome`
  ("11m · Customer · Landing page · MOBILE"). Pull via `DesignSync get_file`; do **not** copy
  JSX into the repo (`design-system.md:24`).
- Desktop & mobile use **intentionally different per-breakpoint copy** (subcopy, bullet 1,
  stepper titles, footer tagline) — both recorded `exact` in the contract.
- The **search island moves across breakpoints**: inside the dark hero on desktop, inside the
  light sheet on mobile; a mobile-only "Zarezerwuj online" CTA replaces it in the dark hero.
- Async-button rule (`CLAUDE.md`): the "Szukaj" action already navigates; no new pending state
  needed beyond what `HeroSearch` has. New anchors (nav CTA, "Zarezerwuj online", category pills)
  are plain links, not async buttons.
- Polish pluralization: the **trust-card** count ("N pojazd / pojazdy / pojazdów") needs a small
  noun `pluralPl` helper in `src/lib/format.ts` (N=1/2–4/5+). The **mobile-only hero eyebrow**
  ("N POJAZDÓW DOSTĘPNYCH DZIŚ") also inflects its adjectives (DOSTĘPNY/DOSTĘPNE/DOSTĘPNYCH), which
  the noun helper does NOT cover — per the contract it ships the **fixed genitive** (accepted while
  the live count is ≥5; currently 7) as a recorded deviation, not via `pluralPl`.

## Desired End State

Visiting `/` renders the restyled home at both breakpoints, matching the canonical screenshots
(minus recorded deviations): a dark hero with the wordmark/van composition, a working restyled
`HeroSearch` committing to `/fleet`, a live-count eyebrow + trust card, the branching stepper
(desktop) / vertical timeline (mobile), click-to-route category pills, and a forked Popular
strip over live vehicles. `/fleet`, dashboards, auth, and every other surface are **visually
unchanged** (no shared component or token was edited). `astro check`, lint, build, and the
existing unit/integration suites stay green.

**Verify:** rendered vision-diff of `/` at 1440px vs `desktop-landing-1440.png` and at 390px vs
the two mobile canonicals returns empty (minus recorded deviations); a diff of `/fleet` before/
after shows no change.

## What We're NOT Doing

- **No `global.css` / token edits**; no new webfonts (Space Grotesk / Playfair are deviations).
- **No edit to `SiteHeader` or `VehicleCard`** (both shared) — nav and Popular card are forked.
- **No real reviews/ratings feature** (trust card ratings are a hardcoded placeholder), **no
  multi-branch location model** (Oddział stays static), **no Cennik / Dla firm / Pomoc pages**,
  **no i18n / PL·EN toggle**.
- **No category hover-filter interaction** (click-to-route only this slice).
- **No fleet-browse (screen 08) restyle** — home only.
- No new API routes, DB migrations, or schema changes (this is presentational + existing reads).

## Implementation Approach

Build each surface **responsively at both breakpoints together** (they share components), in
four phases: (1) foundation — assets, dark palette, forked nav; (2) the dark hero incl. search

- trust + sheet; (3) the light-body sections; (4) a fidelity gate + a11y/perf polish. Re-author
  the design's fixed-canvas absolute layout as **flow/grid + Tailwind responsive utilities** —
  keep the _values_ (sizes → tokens, copy) exact, adapt the _layout mechanism_. Every color via
  `cn()` + tokens; the dark hero palette as documented arbitrary hex. Reference `design-contract.md`
  for exact values throughout.

## Critical Implementation Details

- **Van-behind-wordmark z-order** (S2): render order is photo (z-0) → FLOTA wordmark (z-3) →
  van-cutout (z-4). The cutout is the _same crop_ as the photo, so absolute full-bleed with the
  identical `object-position` makes it land exactly over the photo's van. Getting the
  `object-position` equal on both images is the load-bearing detail — a mismatch doubles the van.
- **Cross-breakpoint search placement** (S0/S3): the `HeroSearch` island is one component but
  sits in the dark hero on desktop and in the light sheet on mobile. Implement by placing it once
  in the flow where mobile needs it and repositioning on desktop (e.g. render the desktop hero
  content column with the island, and a separate `xl:hidden` "Zarezerwuj online" CTA + a
  sheet-level search slot for mobile) — decide the single-render approach at build; do not
  duplicate the island (double-mount = double state).
- **LCP**: the hero photo is the LCP element — `<Picture>` must be eager + `fetchpriority="high"`
  with width/height to avoid CLS; the van-cutout may be eager too (same viewport). Everything
  below the fold stays lazy.

---

## Phase 1: Foundation — assets, dark palette, forked nav

### Overview

Land the build-time image pipeline, the landing-local dark palette convention, and the forked
`LandingNav`, so Phases 2–3 compose against ready primitives. `SiteFooter` is reused unchanged.

### Changes Required

#### 1. Hero image assets → `astro:assets`

**File**: `src/assets/hero-airfield.{jpg}` , `src/assets/van-cutout.png` (new)

**Intent**: Copy the two delivered assets into `src/assets/` (so `astro:assets` fingerprints +
optimizes them) and render via `<Picture>` — the 644KB hero JPEG becomes AVIF/WebP, eager with
`fetchpriority="high"`; the van-cutout likewise. Sources in `src/assets/`, never `public/`.

**Contract**: `import heroImg from "../assets/hero-airfield.jpg"` (+ van) consumed by
`<Picture formats={["avif","webp"]} loading="eager" fetchpriority="high" …>` in the hero.
Confirm final dimensions/quality keep the hero < ~150KB AVIF.

#### 2. Landing-local dark palette

**File**: `src/pages/index.astro` (scoped) — no `global.css` edit

**Intent**: Establish the dark hero colors as documented arbitrary Tailwind values (per the
contract token map), not new global tokens. Keep them in one place (a short comment block or a
scoped wrapper) so the hero reads consistently.

**Contract**: canvas `bg-[#080B12]` (desktop) / `bg-[#0A0D14]` (mobile), white-alpha text
`text-white/95…/60`, gradient scrims as arbitrary `[background:linear-gradient(...)]`. No token
layer added.

#### 3. `LandingNav.astro` (fork)

**File**: `src/components/LandingNav.astro` (new); wired only into `index.astro`

**Intent**: A landing-scoped floating nav — desktop white pill (logo + Start/Flota capsule +
phone + "Przeglądaj flotę" → `/fleet`), mobile logo + hamburger over the dark hero. Do not touch
`SiteHeader`. Build a **landing-local dropdown inside `LandingNav`** for the mobile menu (dark
trigger + Start/Flota/phone) — do **NOT** edit the shared `MobileNav.tsx` (only `SiteHeader`
consumes it, so restyling it regresses `/fleet` + the other public pages; reusing it unmodified
also fails the contract's dark trigger + phone).

**Contract**: props `active` (default "home"); destinations Start (`/`) + Flota (`/fleet`) + phone
`+48 22 100 20 30`; drops Cennik/Dla firm/Pomoc + PL·EN (deviations). See contract S1 for exact
sizes/radii/colors. Replaces `<SiteHeader>` in `index.astro`.

### Success Criteria

#### Automated Verification

- `npx astro check` passes (types resolve incl. `astro:assets` imports).
- `npm run lint` passes (no `@/` alias; grouped imports).
- `npm run build` succeeds; built `/` emits AVIF/WebP `<source>`s for the hero.
- `npm test` (unit) stays green.

#### Manual Verification

- `LandingNav` renders the desktop pill and mobile hamburger; links go to `/` and `/fleet`;
  phone number correct; no Cennik/Dla firm/Pomoc/PL·EN.
- Hero images load optimized (AVIF/WebP in Network), no layout shift.
- `/fleet` and other pages that use `SiteHeader` are unchanged.
- Nav fidelity (vs canonical) is verified inside the Phase 2 hero-canonical vision-diff — the
  floating pill/hamburger sits in-frame — so no separate nav diff is needed here.

**Implementation Note**: pause for manual confirmation before Phase 2.

---

## Phase 2: Dark hero (both breakpoints)

### Overview

Compose the dark hero: photo/wordmark/van z-order + scrims, hero copy (live-count eyebrow, serif
H1, per-breakpoint subcopy + bullets), the restyled `HeroSearch`, the trust card (hardcoded
ratings + live count), the mobile-only "Zarezerwuj online" CTA, and the dark→light sheet.

### Changes Required

#### 1. Hero composition

**File**: `src/pages/index.astro`

**Intent**: Replace the current light hero `<section>` with the dark full-bleed hero — photo
`<Picture>` (z-0), FLOTA wordmark (Inter bold, gradient-clip, z-3), van-cutout (z-4), gradient
scrims, and the content column (H1 / subcopy / bullets — plus the live-count eyebrow, which is
**mobile-only**; the desktop hero has no eyebrow). Per-breakpoint copy rendered
and toggled by breakpoint.

**Contract**: contract S2. H1 `font-serif` (Instrument Serif). Eyebrow uses live
`{vehicles.length}` via the new plural helper. Wordmark gradient text
`bg-clip-text text-transparent`. Van `object-cover` with `object-position` **identical** to the
photo.

#### 2. `HeroSearch.tsx` restyle

**File**: `src/components/vehicle/HeroSearch.tsx`

**Intent**: Restyle to the contract's search pill — desktop inline pill (`rounded-[22px]`, dark
`rounded-[15px]` Szukaj), mobile stacked card with full-width Szukaj — keeping all existing logic
(Typ + range → `/fleet`, `validateDateRange`, static Oddział).

**Contract**: contract S3. No logic change; class/structure restyle only. `bg-foreground
text-background` Szukaj (existing pattern). Field labels `text-[#9AA3B2]`, values `font-bold`.

#### 3. Trust card

**File**: `src/pages/index.astro` (inline block or a small `TrustCard.astro`)

**Intent**: Three-row trust card — hardcoded "4.9 / 5 · 1 280 opinii klientów" (placeholder),
live "**{vehicles.length} pojazd[y/ów]** · we flocie, gotowe od ręki", and "Rezerwacja · online
lub telefonicznie". Desktop floating right (bottom-aligned with search pill); mobile stacked in
the sheet.

**Contract**: contract S4. Ratings flagged placeholder (comment); count via plural helper.

#### 4. `pl` plural helper

**File**: `src/lib/format.ts`

**Intent**: Add a small `pluralPl(n, ["pojazd","pojazdy","pojazdów"])`-style helper for the
count strings, so N=1/2–4/5+ read correctly.

**Contract**: pure function; unit-tested. Reused by the eyebrow + trust card.

#### 5. Mobile "Zarezerwuj online" CTA + sheet transition

**File**: `src/pages/index.astro`

**Intent**: Mobile-only accent CTA (→ `/fleet`) under the hero bullets; the light sheet
(`rounded-t-[40px]`/`[28px]`, `-mt-40`/`-16`, upward shadow) begins the body.

**Contract**: contract S2 (CTA) + S5 (sheet). CTA `xl:hidden`.

### Success Criteria

#### Automated Verification

- `npx astro check`, `npm run lint`, `npm run build` pass.
- `npm test` green incl. a new `pluralPl` unit test (1 / 2 / 5 → correct form).

#### Manual Verification

- Vision-diff of the **hero** at 1440px vs `desktop-landing-1440.png` and 390px vs
  `mobile-landing-part1-…jpg` → empty minus deviations (van lands over the wordmark, not doubled).
- `HeroSearch` still commits to `/fleet` with the right filters; date validation error still shows.
- Eyebrow + trust-card counts show the real vehicle count with correct Polish plural.
- Dark→light sheet transition reads as designed; no horizontal scroll at 320–1440px.

**Implementation Note**: pause for manual confirmation before Phase 3.

---

## Phase 3: Light body — stepper, category selector, Popularne

### Overview

Build the three light-sheet sections at both breakpoints: the branching "Proces wynajmu" stepper,
the click-to-route category selector, and the "Popularne" strip on a forked `LandingVehicleCard`.
Reuse `SiteFooter`.

### Changes Required

#### 1. "Proces wynajmu" stepper

**File**: `src/components/landing/ProcessSteps.astro` (new) + used in `index.astro`

**Intent**: Desktop branching layout (two lane pills converging into circle 1 via connector SVGs,
then a 4-circle horizontal track) and mobile vertical timeline (4 circles + vertical connectors,
shorter titles). Static content, verbatim Polish copy.

**Contract**: contract S6 (both breakpoints, exact copy incl. the different mobile titles).
Heading `font-serif`. Connectors as inline SVG/CSS; circles `bg-primary`.

#### 2. Category selector (click-to-route)

**File**: `src/components/landing/TypeSelector.astro` (new) + used in `index.astro`

**Intent**: 5 pills linking to `/fleet?category=<cat>` (Furgon active), with the custom category
SVG icons. Desktop bordered pill container + "Cała flota" link; mobile wrapped pills. No hover
filter; the hover-hint copy is dropped.

**Contract**: contract S7. Transcribe the 4 custom SVG paths (bus / autolaweta-flatbed / snow /
box) into a **landing-local icon set** (e.g. `src/components/landing/`) — do **NOT** edit the
shared `SpecIcon`/`VehicleSilhouette` (they back `/fleet` + 6 surfaces). Categories
from the existing `VehicleCategory` list + `categoryLabelPl`.

#### 3. `LandingVehicleCard.astro` (fork) + Popularne section

**File**: `src/components/vehicle/LandingVehicleCard.astro` (new); `index.astro` section

**Intent**: A landing-only card matching the mock (type/status top-left, gradient/silhouette
image, 4-spec row, "od {daily} zł /dzień", "Rezerwuj", no monthly/deposit). Section header
"Popularne" + "Furgony" chip + "Wszystkie" → `/fleet`. Whole card links to the vehicle detail
route. Leave shared `VehicleCard.astro` untouched.

**Contract**: contract S8. SSR `listVehicles(...).slice(0,3)`. Reuse `formatPln`,
`formatPayloadKg`, `transmissionLabelPl`, `fuelLabelPl`, `vehicleSlug`, `StatusPill`,
`VehicleSilhouette`. Mark the card `@container` and drive any internal split with `@min-[Npx]:`
(not viewport `md:`/`lg:`) — it narrows inside a multi-up grid ("embeddable panels" lesson). The
"Furgony" chip label is derived from the shown set (or the query is filtered to `cargo_van`), not
hardcoded — see contract S8.

#### 4. Footer wiring

**File**: `src/pages/index.astro`

**Intent**: Keep `<SiteFooter>` (already matches the mock). No fork.

**Contract**: contract S9 (mobile one-word tagline difference is a recorded deviation — reuse).

### Success Criteria

#### Automated Verification

- `npx astro check`, `npm run lint`, `npm run build` pass; `npm test` green.
- Category pill hrefs serialize to valid `/fleet?category=<cat>` (spot-checked or unit-tested via
  the existing filter-serialization helper).

#### Manual Verification

- Vision-diff of the **light body** at 1440px vs `desktop-landing-1440.png` and 390px vs
  `mobile-landing-part2-…jpg` → empty minus deviations (branching stepper on desktop, vertical
  timeline on mobile; pills wrap on mobile; cards 3-up → 1-up).
- Category pills route to the correctly-filtered `/fleet`; "Cała flota" / "Wszystkie" → `/fleet`.
- Popular strip shows the real top-3 vehicles with correct specs/price; card links to detail.
- `/fleet` listing (shared `VehicleCard`) unchanged.

**Implementation Note**: pause for manual confirmation before Phase 4.

---

## Phase 4: Fidelity gate + a11y/perf polish

### Overview

Run the rendered vision-diff gate against all canonicals, close the punch-list to empty (minus
deviations), and verify accessibility + performance.

### Changes Required

#### 1. Vision-diff gate

**File**: n/a (verification) — iterate on Phases 1–3 files

**Intent**: Render `/` at 1440px and 390px, hand each screenshot + its canonical to a vision
subagent, take back a structured punch-list, and iterate to empty (minus the recorded
deviations). Also diff `/fleet` before/after to prove no regression.

**Contract**: gate compares against the **canonicals** (`design-review/*`), not a self-baseline.
Deviations from `design-contract.md` are expected and excluded.

#### 2. Accessibility + performance

**File**: touched components

**Intent**: Hamburger has an accessible name + keyboard/focus behavior; all images have `alt`
(decorative photo/van `alt=""`); color-contrast on dark hero text acceptable; hero LCP is the
eager `<Picture>`; below-fold stays lazy; no CLS.

**Contract**: keyboard-navigable nav + pills; Lighthouse/observed LCP sane; no console errors;
no hydration mismatch (SSR count is server-rendered, not client-formatted).

### Success Criteria

#### Automated Verification

- Full suite green: `npx astro check`, `npm run lint`, `npm run build`, `npm test`,
  `npm run test:integration` (unaffected but confirm no regression).

#### Manual Verification

- Both-breakpoint vision-diffs empty minus deviations; `/fleet` diff shows no change.
- Keyboard: tab through nav, search, pills, cards; visible focus; hamburger opens/closes.
- Perf: hero LCP is the eager image; no CLS; no horizontal scroll 320–1440px.
- `LandingVehicleCard` verified at in-between + narrow grid-column widths (not only 1440/390) — its
  spec row + price/CTA must not clip when the grid is 2-up at the tablet range (container-query check).
- Cross-browser spot check (Chromium + WebKit) of the wordmark gradient-clip + `backdrop-blur`.

**Implementation Note**: this phase closes the slice; promote the canonical desktop shot to
`context/foundation/design/screenshots/` (re-export from the shipped surface) at archive.

---

## Testing Strategy

### Unit Tests

- `pluralPl` helper: N = 0, 1, 2, 4, 5, 22, 25 → correct Polish form.
- (Optional) category-pill href serialization via the existing filter helper.

### Integration Tests

- None required (no new API/DB). Confirm the existing suite is unaffected (the page still SSRs
  `listVehicles` the same way).

### Manual Testing Steps

1. Load `/` at 1440px — compare to `desktop-landing-1440.png` (hero, stepper, category, Popular).
2. Load `/` at 390px — compare to both mobile canonicals (hero+search+trust, then process+popular).
3. Resize 320 → 1440px slowly — no horizontal scroll, sane reflow through the tablet range.
4. Use the search pill (pick a type + dates) → lands on the filtered `/fleet`; try an invalid
   range → error shows.
5. Click each category pill → correct `/fleet?category`; click a Popular card → vehicle detail.
6. Open `/fleet` and a dashboard page → confirm unchanged (no shared-component regression).

## Performance Considerations

Hero photo is the LCP element — optimized `<Picture>` (AVIF/WebP), eager, `fetchpriority="high"`,
explicit dimensions (no CLS). Van-cutout eager (same viewport). All below-fold content lazy.
Target hero AVIF < ~150KB (from 644KB source). No new client JS beyond the existing `HeroSearch`
island (category pills and CTAs are plain anchors).

## Migration Notes

None — no data or schema change. Purely presentational over existing reads. Rollback = revert the
`index.astro` + new-component commits; no shared file or token was touched, so nothing else
regresses.

## References

- Design contract (exact values): `context/changes/landing-redesign/design-contract.md`
- Frame brief: `context/changes/landing-redesign/frame.md`
- Canonical screenshots: `context/changes/landing-redesign/design-review/{desktop-landing-1440.png,
mobile-landing-part1-hero-search-trust.jpg, mobile-landing-part2-process-popular.jpg}`
- Design source (pull via `DesignSync`, do not copy): Claude Design `352d78a6-…`,
  `customer-desktop.jsx` → `ScreenDesktopHome` / `ScreenMobileHome`
- Handover bundle (on disk): `~/Downloads/flota-handover/` (`flota-landing.html` structure SoT,
  `design-tokens.css`, `images/`)
- Shipped page + components: `src/pages/index.astro`, `src/components/{SiteHeader,SiteFooter}.astro`,
  `src/components/vehicle/{HeroSearch.tsx,VehicleCard.astro,VehicleSilhouette.astro,StatusPill.astro,SpecIcon.astro}`,
  `src/lib/{services/vehicles.ts,format.ts,catalog-filters.ts}`
- Conventions: `context/foundation/design-system.md`, `context/foundation/lessons.md`
  (design-fidelity + Design Alignment Audit gate)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not
> rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation — assets, dark palette, forked nav

#### Automated

- [x] 1.1 `npx astro check` passes (incl. `astro:assets` imports) — 83bbcc6
- [x] 1.2 `npm run lint` passes — 83bbcc6
- [x] 1.3 `npm run build` succeeds; hero emits AVIF/WebP sources — 83bbcc6
- [x] 1.4 `npm test` (unit) green — 83bbcc6

#### Manual

- [x] 1.5 `LandingNav` desktop pill + mobile hamburger render; links + phone correct; dropped items absent — 83bbcc6
- [x] 1.6 Hero images load optimized; no layout shift — 83bbcc6
- [x] 1.7 `/fleet` + other `SiteHeader` pages unchanged — 83bbcc6

### Phase 2: Dark hero (both breakpoints)

#### Automated

- [x] 2.1 `npx astro check`, `npm run lint`, `npm run build` pass — 1de1bb5
- [x] 2.2 `npm test` green incl. new `pluralPl` unit test — 1de1bb5

#### Manual

- [x] 2.3 Hero vision-diff (1440 vs desktop canonical, 390 vs mobile part1) empty minus deviations; van lands over wordmark — 8397137
- [x] 2.4 `HeroSearch` commits to `/fleet` with filters; date error still shows — 1de1bb5
- [x] 2.5 Eyebrow + trust-card show real count with correct Polish plural — 1de1bb5
- [x] 2.6 Dark→light sheet reads as designed; no horizontal scroll 320–1440px — 1de1bb5

### Phase 3: Light body — stepper, category selector, Popularne

#### Automated

- [x] 3.1 `npx astro check`, `npm run lint`, `npm run build` pass; `npm test` green — aa45115
- [x] 3.2 Category pill hrefs serialize to valid `/fleet?category=<cat>` — aa45115

#### Manual

- [x] 3.3 Light-body vision-diff (1440 vs desktop, 390 vs mobile part2) empty minus deviations — 8397137
- [x] 3.4 Category pills + "Cała flota"/"Wszystkie" route correctly — aa45115
- [x] 3.5 Popular strip shows real top-3 with correct specs/price; card links to detail — aa45115
- [x] 3.6 `/fleet` listing (shared `VehicleCard`) unchanged — aa45115

### Phase 4: Fidelity gate + a11y/perf polish

#### Automated

- [x] 4.1 Full suite green: `astro check`, `lint`, `build`, `test`, `test:integration` — 8397137

#### Manual

- [x] 4.2 Both-breakpoint vision-diffs empty minus deviations; `/fleet` diff shows no change — 8397137
- [x] 4.3 Keyboard/focus through nav, search, pills, cards; hamburger a11y — 8397137
- [x] 4.4 Hero LCP is eager image; no CLS; wordmark gradient + backdrop-blur verified in Chromium + WebKit — 8397137
