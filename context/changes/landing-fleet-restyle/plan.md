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

## Phase 6: Design-fidelity completion (added post-impl-review)

> Added after the impl-review + a full component-by-component audit against the live
> Claude Design (`customer-desktop.jsx`). The itemized exact values live in
> `reviews/design-audit.md`; the sub-phases below carry the intent, key contract, and
> gates. Decisions taken with the user: **include** the card-footer fix; scope =
> **everything on the audit list** (fleet + landing, incl. low-priority batches). Order
> fixes the components first, then composes the tablet layout (6D) from them. No
> behavior/data/API change — purely presentational.

---

## Phase 6A: Fleet controls & cards — fidelity fixes

### Overview

Fix the fleet defects the audit surfaced (`design-audit.md` §1 2a/2b, §2 Fleet): the
`SelectTrigger` height collapse (the "two broken pills"), the deferred-filter mobile
rows, the card-footer stack threshold, the mobile scroller animation, plus batched
micro-fidelity nits.

### Changes Required:

#### 1. FilterBar — SelectTrigger height + mobile rows

**File**: `src/components/vehicle/FilterBar.tsx`

**Intent**: Ładowność/Sortowanie must match the 52px pill height and the design's mobile-row treatment.

**Contract**: Add `data-[size=default]:h-[50px] sm:data-[size=default]:h-[52px] py-0` to
`fieldShell` so shadcn's `data-[size=default]:h-9` is merged out (same modifier+base) —
the two `<SelectTrigger>` pills stop collapsing to 36px; verify `justify-between`/`gap`
don't misalign. Mobile (`<sm`) Termin: bare ~16px muted calendar glyph (no 36px round
wrapper). Mobile Ładowność/Sortowanie labels: `text-foreground` (dark), not muted.
Micro-nits (audit §2 F4/F5): mobile row `px-4` / label `14.5px` / `Filtry` `tracking-[1px]`;
desktop field `gap-[11px]` `pr-[14px]` + pill `shadow-[0_1px_2px_rgba(15,23,42,0.04)]`,
label `tracking-[0.5px]`, chip `gap-[9px]` `tracking-[0.4px]`, chevron `size-[15px]`;
Zastosuj `lg:px-[26px] lg:text-[14px]`; card `sm:pr-[14px]`, base `gap-2`. Decisions kept:
mobile Select chevron stays `⌄`; desktop default-values stay muted; lucide glyphs kept.
Non-persist mount + handleApply flow unchanged.

#### 2. FleetTypeScroll — smooth animation

**File**: `src/components/vehicle/FleetTypeScroll.tsx`

**Intent**: Buttery expand/collapse matching `HeaderContactToggle`.

**Contract**: Fixed 40px icon holder; transition only `flex`/`max-width` (+ background/color),
drop `transition-all` and the animated padding/margin; active `px-[14px]` `flex:1 1 auto`;
inactive `text-white/[0.72]`; dim the `·` at `opacity-40`. Preserve instant-nav anchors +
no-JS fallback.

#### 3. VehicleCard — footer threshold + micro-nits

**File**: `src/components/vehicle/VehicleCard.astro`

**Intent**: Side-by-side footer at laptop widths; close the sub-pixel gaps.

**Contract**: Footer/CTA container query `@min-[400px]:` → `@min-[360px]:` (3-col cards go
side-by-side at ~1280) + `@min:gap-0` in row mode. Micro (audit §2): eyebrow
`tracking-[0.4px]`, title `leading-[1.1]`, subtitle `mt-[3px]`, spec icon `size-[15px]`,
spec value `tracking-[-0.1px]`, price `tracking-[-0.7px]`, drop `/dzień` `ml-1`.

#### 4. Fleet page — delete result heading + reflow

**File**: `src/pages/fleet/index.astro`

**Intent**: Remove the mock-absent result-count heading; keep top rhythm.

**Contract**: Delete the `<h1>{count} pojazdów…</h1>` block (`:120-128`); give the desktop
pill bar `pt-8 sm:pt-10` (≈40px) and the mobile scroller matching top space. Pill-bar nits:
`gap-3`, `tracking-[-0.1px]`. Update `design-contract.md` S3 (heading removed — was a kept
deviation, now overridden by user directive).

### Success Criteria:

#### Automated Verification:

- Types: `npx astro check` · Lint: `npm run lint` · Build: `npm run build` · Unit: `npm test`

#### Manual Verification:

- Ładowność/Sortowanie render at 52px (desktop) / 50px (mobile), like Termin; icon chips have breathing room
- Mobile rows: bare calendar glyph; dark Ładowność/Sortowanie labels
- Scroller expand/collapse smooth (no padding snap); instant nav + no-JS still work
- 3-col cards show price-left / Rezerwuj-right at ~1280px
- No result heading; pill bar ~40px below header at all breakpoints
- Filter apply / date validation / clear-all unchanged

---

## Phase 6B: Landing hero, nav & trust-card polish

### Overview

Bring the shipped landing hero into line with the live design at the mobile + desktop
tiers (tablet is 6D). Trust-card icon restyle (1b) + hero/nav micro-fidelity
(`design-audit.md` §1 1b, §2 Landing hero/nav).

### Changes Required:

#### 1. TrustCard — drop tiles, faint glyph

**File**: `src/components/landing/TrustCard.astro`

**Intent**: Match `TrustRow` (`showTiles = false`).

**Contract**: Remove the 38px boxed icon tiles; render each row as title+sub with one large
faint glyph behind (`absolute right-8 top-1 opacity-[0.09]`, ~76px, accent) — star / truck /
phone. Desktop card: no row dividers (flex col `gap-2`); mobile keeps `#EEF1F5` dividers.
Desktop width `340`→`300` (`index.astro:193`). Content unchanged.

#### 2. Hero + nav micro-fidelity

**Files**: `src/pages/index.astro`, `src/components/LandingNav.astro`

**Contract** (audit §2 H1–H4): mobile heading dot → 9px accent circle (not text "."); mobile
wordmark `top-[86px]`; mobile sheet `-mt-4`, hero content `pb-[34px]`; nav active-pill shadow
`0 2px 6px rgba(14,21,36,0.15)`, marks 42/38, dark buttons → `bg-[var(--flota-ink-deep)]`
(nav CTA + HeroSearch Szukaj).

### Success Criteria:

#### Automated Verification:

- Types: `npx astro check` · Lint: `npm run lint` · Build: `npm run build`

#### Manual Verification:

- Trust card: no tiles, faint glyph behind each row; desktop no dividers / mobile dividers; width 300 desktop
- Mobile hero dot is a circle; wordmark + sheet spacing match design
- `/reserve`, `/about`, `/pricing` unaffected

---

## Phase 6C: Landing sections + Popularne card fidelity

### Overview

Static-fidelity fixes to ProcessSteps, TypeSelector, and the Popularne card
(`design-audit.md` §2 Landing sections + Popularne). Type-explorer hover-preview stays out
(deliberately withdrawn earlier).

### Changes Required:

#### 1. ProcessSteps

**File**: `src/components/landing/ProcessSteps.astro`

**Contract**: Desktop step title `text-[16.5px] leading-[21px]` drop `tracking-tight`; desc
`text-[13px] leading-[20px]`; title→desc gap `mt-4`. Lane pills `text-[12.5px] font-semibold`,
`shadow-[0_2px_6px_rgba(14,21,36,0.08)]`, `pr-4 pl-[14px]`. Mobile nudges (`top-[50px]`,
`pb-[26px]`, `mt-[5px]`).

#### 2. TypeSelector

**File**: `src/components/landing/TypeSelector.astro`

**Contract**: Mobile inactive pills `bg-card` (white, not transparent); mobile row →
`overflow-x-auto` nowrap `shrink-0` (not `flex-wrap`); mobile active glow
`0 4px 12px -3px rgba(180,54,56,0.35)`, weights 650/550, pad `pr-4 pl-[13px]`; desktop
`xl:gap-[9px]`, transporter glyph `xl:size-[20px]`. CTA stays dark `Cała flota` (decision —
record deviation).

#### 3. LandingVehicleCard (Popularne)

**File**: `src/components/vehicle/LandingVehicleCard.astro`

**Contract** (per `PopularCard`/`MobilePopularCard`): subtitle `text-muted-foreground`
(not ink-2); image radii `rounded-[14px] @min-[400px]:rounded-[12px]` (un-swap); desktop spec
row → vertical inter-column dividers + one bottom hairline (mobile keeps `border-y`); spec
value `font-semibold text-[12px]`, icon `size-[14px]`, cell `gap-1.5`; CTA
`bg-[var(--flota-ink-deep)] text-white`, `13.5/14px`, taller (~40/44), `font-[650]` mobile;
price mobile `text-[24px] @min:text-[22px]`; "od" `text-[12px]`; desktop row `@min:items-center`;
title tracking `-0.4/-0.3`.

### Success Criteria:

#### Automated Verification:

- Types: `npx astro check` · Lint: `npm run lint` · Build: `npm run build`

#### Manual Verification:

- Desktop process steps read tighter (title 16.5/21, desc 13/20); lane pills lifted
- Mobile type pills are white cards in a single horizontal-scroll row with the active glow
- Popularne cards: grey subtitle, correct radii, desktop vertical spec dividers, ink-deep CTA

---

## Phase 6D: Landing tablet layout (compose ScreenTabletHome)

### Overview

The heavyweight (1a): build the missing 834-band layout by composing the now-corrected
components (`design-audit.md` §1 1a).

### Changes Required:

#### 1. Tablet hero + sections

**File**: `src/pages/index.astro`

**Intent**: Add a tablet tier (≈`md`/`lg`→`xl`) reproducing `ScreenTabletHome`.

**Contract**: 452px photo stage; 2-col hero grid `1.25fr/0.95fr` gap 36 align-end — heading
(`62px/lh62/-2.4`, 11px accent-circle dot) + bullets (24px circled checks) LEFT, the white
search card RIGHT; trust as a 3-across white bar (`1fr 1fr 1fr`, radius 20, cells `10px 18px`,
`#EEF1F5` splits); Popularne 3-col across the tablet band; wordmark `210px/-9/top-118`,
scrims 150/150. **HeroSearch stays a single mount** — position its wrapper into the hero's
right column at the tablet tier without a second island instance.

#### 2. Tablet nav

**File**: `src/components/LandingNav.astro`

**Contract**: Over-hero glass pill (`rgba(255,255,255,0.12)`, blur, Start/Flota/Cennik/FAQ) +
glass phone/book toggle (`rgba(255,255,255,0.14)`, phone active #fff / book active accent) for
the tablet band; reconcile with the existing `lg` white pill.

#### 3. Tablet section treatments

**Files**: `src/components/landing/ProcessSteps.astro`, `src/components/landing/TypeSelector.astro`

**Contract**: Add the tablet arrangements per `ScreenTabletHome` (process 2-col; type pills
wrap row). Port exact 834 values from the design screen.

### Success Criteria:

#### Automated Verification:

- Types: `npx astro check` · Lint: `npm run lint` · Build: `npm run build`

#### Manual Verification:

- At 834: 2-col hero with search card right, 3-across trust bar, glass nav+toggle, 3-col Popularne — matches `ScreenTabletHome`
- HeroSearch is a single island (no duplicated state); mobile + desktop unchanged
- Vision-diff `/` at 390 / 834 / 1440 converges (minus recorded deviations)

**Implementation Note**: Close by re-capturing `/` and `/fleet` at **true** 390 / 834 / 1440
(impl-review recommended this — prior shots were ~2× too wide) and vision-diffing both.

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

### Phase 6A: Fleet controls & cards — fidelity fixes

#### Automated

- [x] 6A.1 Types pass: `npx astro check` — df87f85
- [x] 6A.2 Lint passes: `npm run lint` — df87f85
- [x] 6A.3 Production build succeeds: `npm run build` — df87f85
- [x] 6A.4 Unit tests pass: `npm test` — df87f85

#### Manual

- [x] 6A.5 Ładowność/Sortowanie render 52px desktop / 50px mobile (like Termin); icon chips have breathing room — df87f85
- [x] 6A.6 Mobile rows: bare calendar glyph; Ładowność/Sortowanie labels dark, not muted — df87f85
- [x] 6A.7 Scroller expand/collapse is smooth (no padding snap); instant nav + no-JS still work — df87f85
- [x] 6A.8 3-col cards show price-left / Rezerwuj-right at ~1280px — df87f85
- [x] 6A.9 Result heading gone; pill bar ~40px below header at all breakpoints — df87f85
- [x] 6A.10 Filter apply / date validation / clear-all unchanged — df87f85

### Phase 6B: Landing hero, nav & trust-card polish

#### Automated

- [x] 6B.1 Types pass: `npx astro check` — ab03c60
- [x] 6B.2 Lint passes: `npm run lint` — ab03c60
- [x] 6B.3 Production build succeeds: `npm run build` — ab03c60

#### Manual

- [x] 6B.4 Trust card: no tiles, faint glyph per row; desktop no dividers / mobile dividers; width 300 desktop — ab03c60
- [x] 6B.5 Mobile hero dot is a circle; wordmark + sheet spacing match design — ab03c60
- [x] 6B.6 `/reserve`, `/about`, `/pricing` unaffected — ab03c60

### Phase 6C: Landing sections + Popularne card fidelity

#### Automated

- [x] 6C.1 Types pass: `npx astro check` — cdcd43e
- [x] 6C.2 Lint passes: `npm run lint` — cdcd43e
- [x] 6C.3 Production build succeeds: `npm run build` — cdcd43e

#### Manual

- [x] 6C.4 Desktop process steps tighter (title 16.5/21, desc 13/20); lane pills lifted — cdcd43e
- [x] 6C.5 Mobile type pills are white cards in a single horizontal-scroll row with active glow — cdcd43e
- [x] 6C.6 Popularne cards: grey subtitle, correct radii, desktop vertical spec dividers, ink-deep CTA — cdcd43e

### Phase 6D: Landing tablet layout (compose ScreenTabletHome)

#### Automated

- [x] 6D.1 Types pass: `npx astro check` — 858bfcf
- [x] 6D.2 Lint passes: `npm run lint` — 858bfcf
- [x] 6D.3 Production build succeeds: `npm run build` — 858bfcf

#### Manual

- [x] 6D.4 At 834: 2-col hero + search card right, 3-across trust bar, glass nav+toggle, 3-col Popularne (matches ScreenTabletHome) — 858bfcf
- [x] 6D.5 HeroSearch is a single island (no duplicated state); mobile + desktop unchanged — 858bfcf
- [x] 6D.6 Vision-diff `/` at 390 / 834 / 1440 converges (minus recorded deviations) — 858bfcf
- [x] 6D.7 Re-capture `/` and `/fleet` at true 390 / 834 / 1440 and vision-diff both — 858bfcf
