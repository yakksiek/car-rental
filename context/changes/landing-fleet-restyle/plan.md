# Fleet-Browse Restyle (`/fleet`) Implementation Plan

## Overview

Port the restyled customer **fleet-browse** mock onto the shipped `/fleet` page,
finishing the surface that `landing-redesign` explicitly deferred ("home only").
The canonical design is `ScreenDesktopFleet` / `ScreenTabletFleet` /
`ScreenMobileFleet` + `FleetCardBig` / `FilterBtn` / `FleetTypeScroll` in the live
Claude Design project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`, file `customer-desktop.jsx`) — the same
file and design language as the shipped landing. It restyles three things —
the category tabs (→ type-pills), the `FilterBar.tsx` island (→ a filter card),
and `VehicleCard.astro` (→ `FleetCardBig`) — plus a bespoke animated dark mobile
type-pill scroller, across three breakpoints (1440 / 834 / 390). No behavior,
data, API, or schema changes.

## Current State Analysis

`/fleet` is `src/pages/fleet/index.astro` (SSR). It reads URL filters via
`parseFilters` (`src/lib/catalog-filters.ts`), routes the query to
`searchAvailableVehicles` (dated) or `listVehicles` (undated) in
`src/lib/services/vehicles.ts`, builds per-category counts with
`getCategoryCounts`, and renders:

- Page heading "{count} pojazdów gotowych do wynajmu." (`fleet/index.astro:112-118`)
- Category tabs — mobile horizontal-scroll squares, `sm+` inline pills; "Wszystkie"
  grid tab + one `<CategoryIcon>` per category, each an **anchor** carrying the
  filter (instant filter) (`fleet/index.astro:122-166`)
- `<FilterBar initial={filters} client:load />` — a React island (`fleet/index.astro:170`)
- Active-filter chip row + "Wyczyść wszystko" clear-all link (`fleet/index.astro:174-215`)
- Results: date-error / empty / grid states; grid is
  `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` of `<VehicleCard>`
  (`fleet/index.astro:218-236`)

`FilterBar.tsx` is deliberately **not** `transition:persist`ed (remounts and
re-reads `initial` from the URL each nav). It holds a date-range Popover+Calendar
(93-120), a payload `Select` (122-134), a price-sort `Select` (138-154), a
"Zastosuj" button (156-158) that validates + `navigate()`s to `/fleet?…`, and an
inline error (162). Category is **not** set here — it is driven by the page's tab
anchors; FilterBar preserves `initial.category`.

`VehicleCard.astro` is a single `<a>` → `/fleet/{id}/{slug}` (dates appended when
set). It renders eyebrow `{year} · {categoryLabelPl}`, title `make ?? name`,
subtitle `model · production_year`, a `<VehicleSilhouette>` image (photo or
per-category SVG), a 4-up `<SpecIcon>` spec grid, a price block
(`formatPln(daily_rate)` + "/dzień", plus `{monthly}/mies. · kaucja {deposit}`),
and a styled `<span>` "Rezerwuj" CTA. Container is
`rounded-xl p-5 shadow-card hover:shadow-pop` (`VehicleCard.astro:43`).

### Key Discoveries

- **`VehicleCard.astro` is used only on `/fleet`** (`grep`: sole importer is
  `fleet/index.astro`). Restyling it in place is fully isolated — no
  reservation-funnel / Cennik ripple. The fork dilemma `landing-redesign` faced
  does not arise here.
- **`CategoryIcon` is shared with `/about` + `/pricing`; `VehicleSilhouette` with
  `/reserve`.** Keep their glyphs/SVGs untouched — only restyle the _containers_
  (pill, card image frame) around them.
- **The header is already aligned.** `/fleet` renders `<SiteHeader active="fleet" />`,
  which the `public-info-pages` slice restyled into the current design language —
  the mock's `DesktopHeader active="fleet"` is the same shell. Verify-in-contract,
  do not rebuild.
- **The mock is a happy-path prototype** — it omits the empty-results state, the
  active-filter chip row + "Wyczyść wszystko", the result-count line, loading, and
  the filter dropdown _panels_ (only the triggers are drawn). The shipped page has
  all of these and they work. Decision (this plan): **keep every working affordance,
  restyle to the new language**, and design the mock-silent surfaces on-brand,
  recorded as `deviation(reason)`.
- **Filter fields map 1:1.** Mock Termin / Ładowność / Sortuj ↔ app date / payload /
  sort. The mock's "Polecane"/"domyślne" sort copy is placeholder; keep the app's
  real sort options (`Cena: rosnąco` / `Cena: malejąco`).
- **Category labels already match.** The restyled mock uses the singular set
  (Furgon, Bus osobowy, Autolaweta, Chłodnia, Skrzyniowy) = `categoryLabelPl`
  (`src/lib/format.ts`). No copy change.
- **Instant-vs-deferred split already matches the mock.** Category pills = instant
  (anchor nav); Termin/Ładowność/Sortuj = deferred (applied on "Zastosuj"). Preserve
  exactly this behavior through the restyle.

## Desired End State

`/fleet` renders in the restyled design language at all three breakpoints:

- **Desktop (1440):** page on the light sheet (`#F4F5F7`≈`--background`); a wrapping
  **type-pill bar** (`{label} · {count}`, active `#141922`); a single
  `#EEF0F4 rounded-[18px]` **filter card** ("Filtry" chip + 3 `FilterBtn`s + crimson
  "Zastosuj"); a 3-col `gap-[22px]` grid of `FleetCardBig` cards
  (`rounded-[22px]`, gradient image, hairline spec grid, `#141B2D` "Rezerwuj").
- **Tablet (834):** wrapping pills; the filter card with wrapped `FilterBtn`s and a
  full-width "Zastosuj"; a 2-col grid; `stack`ed card footers.
- **Mobile (390):** the animated dark `#0A0A0F` **type-pill scroller** (active pill
  expands with count, inactive collapse to an icon); the mobile filter card
  (full-width rows + "Zastosuj"); a 1-col grid of `stack`ed cards.
- Empty-results, loading, active-filter chips + "Wyczyść wszystko", and the result
  count are all present and restyled on-brand.

**Verify:** rendered vision-diff against the canonical screenshots at 1440 / 834 /
390 converges to empty (minus recorded deviations); `npm run lint`, `npx astro
check`, `npm run build` pass; FilterBar behavior (instant category nav + deferred
apply + clear-all + date validation) is unchanged; the reservation funnel / Cennik
/ about surfaces render identically (no shared-primitive regression).

## What We're NOT Doing

- **No landing (`/`) changes** — it is done and archived. This plan is `/fleet` only.
- **No vehicle-detail (`/fleet/[id]`) restyle** — deferred to a later change
  (VehicleDetail / BookingWidget / VehicleGallery untouched).
- **No edit to `CategoryIcon`, `VehicleSilhouette`, or `SpecIcon` glyphs/SVGs** —
  they back `/about`, `/pricing`, `/reserve`; only their containers change.
- **No `SiteHeader` / `SiteFooter` rebuild** — reuse the public-info-pages shell;
  record any diff vs the mock's `DesktopHeader` as a deviation.
- **No behavior/logic change** — filter parsing/serialization, the
  `available_vehicles` RPC, sort/payload options, and routing stay as-is.
- **No token/font/`global.css` churn beyond additive** — reuse existing `--flota-*`
  tokens; add a token/utility only if a mock value has no existing home, and record it.
- **No new API/DB, no data-model change.**

## Implementation Approach

Restyle in place, component by component, top-of-page to bottom, then add the
mock-silent states and close with the fidelity gate. Because the surface is one
page with three islands/components and the ripple is contained, phases are grouped
by component (matching `landing-redesign`'s precedent) rather than vertical slices;
each phase leaves `/fleet` in a coherent, manually-reviewable state. Transcribe
**exact values** from the mock into `design-contract.md` (Step 6 of planning) and
build against that contract, not by eye.

## Critical Implementation Details

- **Mobile type-pill scroller is a new interactive island.** The active pill must
  expand (show `{label} · {count}`) while others collapse to a 40px icon, animated
  (`flex .32s`), and selecting a pill must navigate (instant category filter, same
  contract as the desktop anchors). Since active-state + navigation need client JS,
  build it as a small React island (`client:load`/`client:visible`) or an
  Astro-island wrapper; keep the desktop/tablet pill bar as static SSR anchors.
  Do not regress the no-JS instant-filter path — the desktop anchors stay real `<a>`.
- **Preserve the deferred-remount contract.** `FilterBar.tsx` must stay
  non-persisted so it re-reads `initial` from the URL each navigation
  (`FilterBar.tsx:21-27`); the restyle changes only its markup/classes, not its
  mount contract or `handleApply` flow.
- **Container-width, not viewport, for the card's internal split.** `FleetCardBig`'s
  `stack` (vertical footer) toggles by the card's own column width across
  1-/2-/3-col grids; prefer Tailwind v4 container queries (`@container` +
  `@min-[Npx]:`) over `md:`/`lg:` so a card in a 2-col tablet grid lays out by its
  real width (per the "size internal layout by container width" lesson).

## Phase 1: Category type-pills + page shell

### Overview

Restyle the page container and the category filter row (desktop/tablet) into the
mock's type-pill bar. Mobile keeps today's tabs for now (replaced in Phase 4).

### Changes Required:

#### 1. Page shell

**File**: `src/pages/fleet/index.astro`

**Intent**: Move the page to the light-sheet background and the mock's spacing;
keep the result-count heading (restyled, per the keep-all decision).

**Contract**: `<main>` stays `max-w-app mx-auto` but adopts the mock's desktop
gutter (`px` ≈ 48px desktop / 20px mobile) and vertical rhythm; page bg resolves to
`--background` (`#F1F3F6`, nearest token to the mock's `#F4F5F7` — record as
deviation). Heading "{count} pojazdów gotowych do wynajmu." retained; restyle to the
new type scale.

#### 2. Category type-pill bar (desktop/tablet)

**File**: `src/pages/fleet/index.astro` (tabs block `122-166`)

**Intent**: Replace the tab squares/pills with the mock's pill bar; each pill stays
an anchor carrying its category filter (instant nav preserved).

**Contract**: Wrapping flex row (`gap-3`, `flex-wrap`), pills `h-[52px]
rounded-full` `pl-4 pr-[22px]`, label `{categoryLabelPl} · {count}` at 14.5px/600.
Active = `bg-[#141922] text-white`; inactive = `bg-card` + `1px` hairline
`rgba(15,23,42,0.08)`. "Wszystkie · {total}" leads. `<CategoryIcon>` glyph reused
inside each pill (glyph itself unchanged). Hrefs from the existing `tabHref` logic.

### Success Criteria:

#### Automated Verification:

- Types pass: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Pill bar matches the mock at desktop + tablet; active pill reflects the current category
- Clicking a pill filters the fleet (instant nav) and preserves any active date/payload/sort params
- `/about` and `/pricing` (which reuse `CategoryIcon`) render unchanged

**Implementation Note**: After automated verification passes, pause for manual
confirmation before Phase 2.

---

## Phase 2: Filter card

### Overview

Reshape the `FilterBar.tsx` island into the mock's `#EEF0F4` filter card and
restyle the active-filter chip row + result count to match. Functional panels
(date/payload/sort) are kept — the mock draws only the triggers.

### Changes Required:

#### 1. FilterBar island → filter card

**File**: `src/components/vehicle/FilterBar.tsx`

**Intent**: Restyle the three controls into `FilterBtn`-style triggers inside one
rounded card with a leading "Filtry" chip and a crimson "Zastosuj"; keep the
shadcn Popover/Calendar/Select panels and the `handleApply`/validation flow intact.

**Contract**: Card `bg-[#EEF0F4] rounded-[18px]` `p-3 pl-5 gap-3.5`, border
`--flota-hair-2`. Leading "Filtry" chip: 36px round `bg-[#141922]` + white filter
icon + 12px/700 label. Each trigger (`FilterBtn`): `h-[52px] rounded-full bg-card`,
36px round icon chip `bg-[#FBE4E1]` with crimson icon, field label 10px/700
uppercase `#9AA3B2` (Termin / Ładowność / Sortowanie), value 14px/650 + chevron.
"Zastosuj": `ml-auto h-[46px] rounded-full bg-[#B43638] text-white 14px/650`
(desktop) / full-width `h-[50px] rounded-[14px]` (tablet/mobile). Sort keeps the
real `Cena: rosnąco` / `Cena: malejąco` options. Island stays non-persisted.

#### 2. Active-filter chips + result count

**File**: `src/pages/fleet/index.astro` (chips `174-215`, heading `112-118`)

**Intent**: Restyle the active-filter chip row, the "Wyczyść wszystko" clear-all,
and the result-count heading to the new language (kept per the feature-parity
decision; recorded as deviations since the mock omits them).

**Contract**: Chips as pill tags with a remove affordance; "Wyczyść wszystko" as a
subdued text link; heading in the restyled type scale. No behavior change to the
clear-all hrefs.

### Success Criteria:

#### Automated Verification:

- Types pass: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Filter card matches the mock (Filtry chip, 3 triggers, crimson Zastosuj) at all breakpoints
- Date-range picker, payload select, sort select still open and function; "Zastosuj" validates + navigates
- Invalid date range still shows the inline error; active-filter chips + "Wyczyść wszystko" work

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Vehicle card (`VehicleCard.astro` → `FleetCardBig`)

### Overview

Restyle the shared-only `VehicleCard.astro` to the `FleetCardBig` design and update
the grid columns/gap. Isolated to `/fleet`.

### Changes Required:

#### 1. Card restyle

**File**: `src/components/vehicle/VehicleCard.astro`

**Intent**: Adopt the `FleetCardBig` look while keeping the card a single `<a>` to
the detail route and all current fields.

**Contract**: Container `bg-card rounded-[22px] p-[22px] shadow-card`
(`--flota-shadow-1`). Eyebrow `{year} · {categoryLabelPl}` 11px/700 uppercase
`#99A2B2`; title (make) 21px/700 `#141922` `tracking-[-0.5px]`; subtitle
`{model} · {year}` 14px `#5B6474`. Image frame `aspect-[16/9] rounded-[12px]`
with the mock's diagonal gradient placeholder when no photo (silhouette/photo swap
kept via `<VehicleSilhouette>`); `my-4`. Spec grid `grid-cols-4 gap-2 py-[15px]`
with top/bottom hairline `rgba(15,23,42,0.05)`, `<SpecIcon>` icons `#99A2B2`,
values 12.5px/600 `#141922`. Footer: price `{formatPln(daily_rate)} zł` 24px/700 +
"/dzień" 14px/500 `#99A2B2`; sub `{monthly} zł/mies. · kaucja {deposit} zł`
12px/500. CTA "Rezerwuj" + arrow: `h-[44px] rounded-full bg-[#141B2D] text-white
14px/650`. Container-query `stack` variant for narrow columns (vertical footer).

#### 2. Results grid

**File**: `src/pages/fleet/index.astro` (grid `230`)

**Intent**: Match the mock's column counts and gap.

**Contract**: `grid gap-[22px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (2-col
tablet gap 20, 1-col mobile gap 16 per mock — reconcile to the nearest Tailwind step
and record).

### Success Criteria:

#### Automated Verification:

- Types pass: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Card matches `FleetCardBig` (radii, gradient image, spec hairlines, `#141B2D` CTA) at all breakpoints
- Card links to the correct `/fleet/{id}/{slug}` with dates appended when set
- Cards with real photos and cards falling back to `<VehicleSilhouette>` both render correctly
- `stack` footer engages in the 2-col / 1-col grids without clipping

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Mobile type-pill scroller

### Overview

Build the animated dark `#0A0A0F` type-pill scroller for the mobile breakpoint,
replacing the Phase-1 pill bar below the tablet cutoff.

### Changes Required:

#### 1. Mobile scroller island

**File**: `src/components/vehicle/` (new component, e.g. `FleetTypeScroll.tsx` or an
Astro-island wrapper) + wired into `src/pages/fleet/index.astro`

**Intent**: Render the mock's compact dark scroller on mobile — active pill expands
to `{label} · {count}`, inactive collapse to a 40px icon — and navigate on select
(instant category filter, same contract as the desktop anchors).

**Contract**: Container `bg-[#0A0A0F] rounded-full p-[5px] gap-[2px]`,
`overflow-x-auto`. Active pill: white bg, `{categoryLabelPl} · {count}`
13.5px/650 ink `#0A0A0F`. Inactive: 40px icon-only, `text-white/72`, reuse
`<CategoryIcon>` glyph. Animate width via `flex .32s`. Selecting navigates to the
category href (preserving other params). Shown only `< sm`; the desktop/tablet pill
bar (Phase 1) is `hidden` on mobile. No-JS fallback: the underlying anchors remain
navigable.

### Success Criteria:

#### Automated Verification:

- Types pass: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Mobile scroller matches the mock: dark container, active pill expanded with count, inactive icons
- Expand/collapse animates on selection; scrolls horizontally when pills overflow
- Selecting a type navigates + filters and preserves date/payload/sort params
- Desktop/tablet pill bar is hidden on mobile and vice-versa (no double control)

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Mock-omitted states + fidelity gate

### Overview

Add on-brand designs for the surfaces the mock is silent on (empty-results,
loading), then run the terminal 3-breakpoint vision-diff and regression checks.

### Changes Required:

#### 1. Empty-results + loading states

**File**: `src/pages/fleet/index.astro` (empty/date-error `218-228`)

**Intent**: Restyle the existing empty-results and date-error states to the new
language; add a lightweight loading treatment if warranted. These have no canonical
mock — design on-brand and record as `deviation(reason)`.

**Contract**: Empty/date-error as a centered on-brand card in the results region;
Polish copy retained. No behavior change.

#### 2. Fidelity gate

**File**: (verification only — no source change)

**Intent**: Render `/fleet` at 1440 / 834 / 390 and vision-diff against the
canonical screenshots; iterate to empty minus recorded deviations.

**Contract**: Diff each breakpoint against
`context/changes/landing-fleet-restyle/design-review/*` per the "vision-diff gate"
lesson; confirm no regression on shared-primitive consumers.

### Success Criteria:

#### Automated Verification:

- Types pass: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- Existing unit tests pass: `npm test`

#### Manual Verification:

- Vision-diff at 1440 / 834 / 390 converges to empty (minus recorded deviations in `design-contract.md`)
- Empty-results, date-error, and loading states render on-brand
- `/reserve`, `/about`, `/pricing` render identically (no `VehicleSilhouette` / `CategoryIcon` regression)
- Keyboard focus + visible focus rings on pills, filter triggers, and card links; scroller reachable by keyboard
- Lighthouse/perf on `/fleet` not regressed vs pre-restyle

**Implementation Note**: This phase closes the plan; the rendered vision-diff is the
fidelity gate.

---

## Testing Strategy

### Unit Tests:

- No new logic → no new unit suites. Keep the existing `catalog-filters` / services
  unit tests green (they cover parse/serialize/validate + query routing, which are
  unchanged).

### Integration Tests:

- No behavior change; keep the existing `/fleet` integration coverage green. Restyle
  must not alter query routing, sort/payload options, or clear-all hrefs.

### Manual Testing Steps:

1. Load `/fleet` at 1440, 834, 390 — compare each to the canonical mock.
2. Click each category pill (desktop anchors + mobile scroller) — confirm instant filter + param preservation.
3. Open the date picker, pick a valid range, "Zastosuj" — confirm nav + dated cards; pick an invalid range — confirm inline error.
4. Set payload + sort, apply, then "Wyczyść wszystko" — confirm chips clear.
5. Force an empty result (filter to a no-match combo) — confirm the on-brand empty state.
6. Visit `/reserve`, `/about`, `/pricing` — confirm no visual regression from shared primitives.

## Performance Considerations

Only one new client island (the mobile scroller) is added; keep it minimal
(`client:visible` if it need not hydrate above the fold). No new fonts/assets — the
card image placeholder is a CSS gradient. Preserve the FilterBar non-persist
remount contract (no added re-render cost).

## Migration Notes

None — no data or schema change. Purely presentational; revert is a straight git
revert of the touched components/page.

## References

- Design source: Claude Design `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`),
  `customer-desktop.jsx` → `ScreenDesktopFleet` / `ScreenTabletFleet` / `ScreenMobileFleet`,
  `FleetCardBig`, `FilterBtn`, `FleetTypeScroll`
- Design contract: `context/changes/landing-fleet-restyle/design-contract.md` (Step 6)
- Prior slice (home only): `context/archive/2026-07-28-landing-redesign/`
- Current page: `src/pages/fleet/index.astro`; island `src/components/vehicle/FilterBar.tsx`;
  card `src/components/vehicle/VehicleCard.astro`
- Design system: `context/foundation/design-system.md`; tokens `src/styles/global.css`
- Lessons: "Port the design spec … with a vision-diff gate"; "size internal layout by
  container width"; "End every UI-touching plan with a Design Alignment Audit gate"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Category type-pills + page shell

#### Automated

- [x] 1.1 Types pass: `npx astro check` — d0775ab
- [x] 1.2 Lint passes: `npm run lint` — d0775ab
- [x] 1.3 Production build succeeds: `npm run build` — d0775ab

#### Manual

- [x] 1.4 Pill bar matches the mock at desktop + tablet; active pill reflects the current category
- [x] 1.5 Clicking a pill filters the fleet (instant nav) and preserves active date/payload/sort params
- [x] 1.6 `/about` and `/pricing` (reuse `CategoryIcon`) render unchanged

### Phase 2: Filter card

#### Automated

- [x] 2.1 Types pass: `npx astro check` — 241fff9
- [x] 2.2 Lint passes: `npm run lint` — 241fff9
- [x] 2.3 Production build succeeds: `npm run build` — 241fff9

#### Manual

- [x] 2.4 Filter card matches the mock (Filtry chip, 3 triggers, crimson Zastosuj) at all breakpoints
- [x] 2.5 Date/payload/sort panels still open and function; "Zastosuj" validates + navigates
- [x] 2.6 Invalid date range shows the inline error; active-filter chips + "Wyczyść wszystko" work

### Phase 3: Vehicle card (`VehicleCard.astro` → `FleetCardBig`)

#### Automated

- [x] 3.1 Types pass: `npx astro check` — df234fc
- [x] 3.2 Lint passes: `npm run lint` — df234fc
- [x] 3.3 Production build succeeds: `npm run build` — df234fc

#### Manual

- [x] 3.4 Card matches `FleetCardBig` (radii, gradient image, spec hairlines, `#141B2D` CTA) at all breakpoints
- [x] 3.5 Card links to the correct `/fleet/{id}/{slug}` with dates appended when set
- [x] 3.6 Photo cards and `<VehicleSilhouette>` fallback cards both render correctly
- [x] 3.7 `stack` footer engages in 2-col / 1-col grids without clipping

### Phase 4: Mobile type-pill scroller

#### Automated

- [x] 4.1 Types pass: `npx astro check` — a9d99af
- [x] 4.2 Lint passes: `npm run lint` — a9d99af
- [x] 4.3 Production build succeeds: `npm run build` — a9d99af

#### Manual

- [x] 4.4 Mobile scroller matches the mock: dark container, active pill expanded with count, inactive icons
- [x] 4.5 Expand/collapse animates on selection; scrolls horizontally on overflow
- [x] 4.6 Selecting a type navigates + filters and preserves date/payload/sort params
- [x] 4.7 Desktop/tablet pill bar hidden on mobile and vice-versa (no double control)

### Phase 5: Mock-omitted states + fidelity gate

#### Automated

- [x] 5.1 Types pass: `npx astro check` — 67442a9
- [x] 5.2 Lint passes: `npm run lint` — 67442a9
- [x] 5.3 Production build succeeds: `npm run build` — 67442a9
- [x] 5.4 Existing unit tests pass: `npm test` — 67442a9

#### Manual

- [x] 5.5 Vision-diff at 1440 / 834 / 390 converges to empty (minus recorded deviations)
- [x] 5.6 Empty-results, date-error, and loading states render on-brand
- [x] 5.7 `/reserve`, `/about`, `/pricing` render identically (no shared-primitive regression)
- [x] 5.8 Keyboard focus + visible focus rings on pills, filter triggers, card links; scroller keyboard-reachable
- [x] 5.9 Perf on `/fleet` not regressed vs pre-restyle
