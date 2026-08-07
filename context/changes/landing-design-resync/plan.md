# Plan — Landing re-sync to the evolved live design

Re-sync the landing's **"Wybierz typ pojazdu"** and **"Popularne"** sections to the current
live Claude Design, and fix two real tablet layout bugs in the Popularne card. Purely
presentational (+ one seed-data check). No behaviour/data/API change.

- **Backing research + full decision list:** `context/changes/landing-fleet-restyle/research.md`
  → _"Follow-up Research 2026-08-07 — Full landing fidelity audit"_.
- **Design source of truth (live, via DesignSync):** project `Rental car company`
  (`352d78a6-84fd-49a2-8b38-2fe289691fc3`), file `customer-desktop.jsx` →
  `ScreenDesktopHome` / `ScreenTabletHome` / `ScreenMobileHome`, shared blocks `CalaFlotaCTA`
  (`:201-218`), `DesktopTypeExplorer` (`:220-238`), `PopularCard` (`:240-269`),
  `MobilePopularCard` (`:641-668`). Pull with `DesignSync get_file` if you need to re-check a
  value. Tokens live in `src/styles/global.css`.
- **Breakpoints:** mobile `<md` (390) · tablet `md`–`<xl` (834) · desktop `≥xl` (1440). Note:
  the Popularne card is a container-query component — its `@min-[Npx]:` thresholds measure the
  **card** width (the `@container` wrapper), not the viewport.
- **What is deliberately NOT here:** serif→sans headings (#1 — keep serif), the footer
  (#12/#13), the nav phone glyph (#14 — already matches).

Each contract line is the exact target. Class values port directly from the design JSX to our
tree (per the "Port the design spec … with a vision-diff gate" lesson).

---

## Phase 1: "Wybierz typ pojazdu" — crimson "Cała flota" CTA, all breakpoints, in the pill row; mobile wraps

### Overview

Implements research items **#4, #5, #6, #11**. Today the see-all CTA is dark, desktop-only,
and sits in the heading row; the mobile pills horizontal-scroll. The live design puts a
**crimson** "Cała flota" (with a dark inner arrow-disc) as the **last item of the pill row** on
**every** breakpoint, and the mobile pills **wrap**.

### Changes Required

#### 1. TypeSelector — move + recolour the CTA, wrap mobile pills

**File**: `src/components/landing/TypeSelector.astro`

**Intent**: One crimson "Cała flota" CTA lives inside the pill container (last child), shown at
all breakpoints; mobile pills wrap instead of scroll.

**Contract**:

- **Delete** the dark heading-row CTA (`TypeSelector.astro:38-55`, the `hidden … xl:inline-flex`
  `bg-foreground text-background` `<a>`). The heading row is then just the `<h2>` — drop the
  `flex items-end justify-between` wrapper down to the heading alone (the design's heading row
  has no right-side element).
- **Pill container** (`:58-60`): change
  `flex flex-nowrap gap-2 overflow-x-auto md:flex-wrap md:gap-[10px] md:overflow-visible xl:inline-flex xl:gap-[9px] xl:overflow-visible xl:rounded-full xl:border xl:border-border xl:bg-card xl:px-2 xl:py-[7px]`
  → `flex flex-wrap gap-2 md:gap-[10px] xl:inline-flex xl:gap-[9px] xl:rounded-full xl:border xl:border-border xl:bg-card xl:px-2 xl:py-[7px]`
  (drop `flex-nowrap`, `overflow-x-auto`, `md:overflow-visible`, `xl:overflow-visible`). Mobile
  now wraps (design `flexWrap:'wrap'`, `customer-desktop.jsx:908`).
- **Add the CTA as the last child inside the container**, after the `CATEGORIES.map(...)`
  (ported from `CalaFlotaCTA`, `customer-desktop.jsx:201-218`):

  ```astro
  <a
    href="/fleet"
    class="bg-primary inline-flex shrink-0 items-center gap-2.5 rounded-full py-2 pr-2 pl-[18px] whitespace-nowrap [box-shadow:0_6px_18px_-4px_rgba(180,54,56,0.42)] transition hover:[box-shadow:0_10px_24px_-5px_rgba(180,54,56,0.52)] xl:-my-[11px] xl:-mr-1 xl:ml-1 xl:gap-[11px] xl:py-2.5 xl:pr-2 xl:pl-5"
  >
    <span class="text-[14px] font-semibold tracking-[-0.1px] text-white xl:text-[14.5px]">Cała flota</span>
    <span class="inline-flex size-7 items-center justify-center rounded-full bg-[var(--flota-ink-deep)] xl:size-[30px]">
      <svg
        class="size-3.5 xl:size-[15px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        style="color:#fff"
      >
        <path d="M5 12h14M13 6l6 6-6 6"></path>
      </svg>
    </span>
  </a>
  ```

  - The desktop `xl:-my-[11px] xl:-mr-1 xl:ml-1` overhang reproduces the design margin
    `-11px -4px -11px 4px` so the crimson pill bleeds to the bordered container's padding edge.
  - Non-overhang (mobile/tablet) padding `8px 8px 8px 18px` = `py-2 pr-2 pl-[18px]`, gap `10` =
    `gap-2.5`; disc `28px` = `size-7`, arrow `14` = `size-3.5`. Overhang (desktop) padding
    `10px 8px 10px 20px` = `xl:py-2.5 xl:pr-2 xl:pl-5`, gap `11`, disc `30`/arrow `15`.

- Update the file's top comment — the CTA is no longer a "dark rename" deviation; it now matches
  the live design (crimson, in the pill row, all breakpoints).

### Success Criteria

#### Automated Verification

- Types: `npx astro check` · Lint: `npm run lint` · Build: `npm run build`

#### Manual Verification

- Desktop: crimson "Cała flota" (dark arrow-disc) is the last chip **inside** the bordered pill
  container, bleeding to its right edge; the heading row has no right-side button.
- Tablet + mobile: the crimson CTA appears after the (wrapped) pills; mobile pills **wrap** to
  rows (no horizontal scroll bar).
- All pills still route to `/fleet?category=…`; "Cała flota" routes to `/fleet`.

---

## Phase 2: "Popularne" — drop the chip + "Wszystkie", subtitle = category · year

### Overview

Implements research items **#7, #8, #9**. The live design's Popularne heading is bare (the
see-all is now the type-row "Cała flota"), and the card subtitle carries a descriptor, not just
the year.

### Changes Required

#### 1. index.astro — strip the heading furniture

**File**: `src/pages/index.astro`

**Intent**: Heading row is just `<h2>Popularne</h2>` (no chip, no "Wszystkie").

**Contract**:

- Delete the accent chip (`index.astro:280-298`) and the "Wszystkie" `<a>` (`:300-317`).
- Collapse the heading wrapper to a single heading, keeping its type scale:
  `<h2 class="text-foreground mb-6 font-serif text-[26px] leading-none md:text-[30px] xl:text-[38px]">Popularne</h2>`
  (design sizes: mobile 26 / tablet 30 / desktop 38 — unchanged).
- Delete the now-dead `popularChipLabel` + `firstFeaturedCategory` consts (`:43-50`) and remove
  the now-unused `categoryLabelPl` import (`:18`) **from this file** (lint will flag it). Keep
  `featured`/`vehicles`.

#### 2. LandingVehicleCard — subtitle = category · year

**File**: `src/components/vehicle/LandingVehicleCard.astro`

**Intent**: Subtitle shows a descriptor + year, approximating the design (`"L3H2 · 2021"`,
`"Chłodnia · 2023"`); category is the descriptor available in our data model.

**Contract**:

- Add `categoryLabelPl` to the `../../lib/format` import.
- Change `const subtitle = vehicle.production_year ? String(vehicle.production_year) : "";`
  (`:30`) → `const subtitle = [categoryLabelPl(vehicle.category), vehicle.production_year].filter(Boolean).join(" · ");`
- Subtitle rendering (`:81`) and its style (`text-muted-foreground text-[13px]`) unchanged.

### Success Criteria

#### Automated Verification

- Types: `npx astro check` · Lint: `npm run lint` · Build: `npm run build`

#### Manual Verification

- Popularne heading is just "Popularne" — no chip, no "Wszystkie" link — at all breakpoints.
- Each card subtitle reads e.g. "Furgon · 2021" (category · year), not a bare year.
- The only see-all on the page is the type-row "Cała flota" (Phase 1).

---

## Phase 3: Popularne card — tablet layout fixes (stacked footer + spec truncation)

### Overview

Implements research items **#2, #3** — the genuine tablet bugs (broken against _any_ design
version). At 834 the 3-col grid makes each card ≈246px; the design stacks the card footer and
the app doesn't, so the price wraps to two lines and the 4-col spec values overflow/collide.

### Changes Required

#### 1. LandingVehicleCard — stack the footer on narrow cards; let spec cells truncate

**File**: `src/components/vehicle/LandingVehicleCard.astro`

**Intent**: Match `MobilePopularCard stack` (`customer-desktop.jsx:657-665,768`): stacked
price-over-full-width-CTA when the card is narrow (tablet 3-col), side-by-side when it has room
(mobile 1-col and desktop 3-col).

**Contract** (container-query thresholds measure the card wrapper):

- **Spec cell** (`:90`): add `min-w-0` →
  `<div class="flex min-w-0 flex-col items-center gap-1.5 text-center">` so the `truncate` on the
  value span (`:92`) actually engages instead of the cell expanding and colliding.
- **Footer container** (`:99`): change
  `mt-3.5 flex items-end justify-between gap-3 @min-[400px]:items-center` →
  `mt-3.5 flex flex-col items-stretch gap-3.5 @min-[280px]:flex-row @min-[280px]:items-end @min-[280px]:justify-between @min-[280px]:gap-3 @min-[400px]:items-center`
- **CTA span** (`:105-107`): add `w-full justify-center @min-[280px]:w-auto` so it is full-width
  when the footer is stacked and hugs its content when side-by-side. (Keep the rest:
  `inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[12px] bg-[var(--flota-ink-deep)] px-3.5 text-[13.5px] font-[650] text-white @min-[400px]:h-10 @min-[400px]:rounded-[11px] @min-[400px]:text-[14px]`.)

> **Threshold math (verify at implement):** the `@container` is the card wrapper. Tablet 834
> 3-col card ≈ **246px** (< 280 → stacks ✓); mobile 390 1-col card ≈ **350px** (≥ 280 → row ✓);
> desktop 1440 3-col card ≈ **434px** (≥ 400 → row, `items-center`, "od", 22px price ✓). If the
> measured widths differ, re-pick the `280` breakpoint to sit between the tablet and mobile card
> widths. The `@min-[400px]` "od"/price-size state is unchanged.

### Success Criteria

#### Automated Verification

- Types: `npx astro check` · Lint: `npm run lint` · Build: `npm run build`

#### Manual Verification

- At **834**: each Popularne card shows the price on its own line above a **full-width**
  "Rezerwuj" button; no two-line price wrap; the 4 spec values sit one-per-column and **truncate
  with an ellipsis** rather than colliding.
- At **390**: price-left / "Rezerwuj"-right side-by-side (unchanged), no "od".
- At **1440**: price-left / "Rezerwuj"-right, `items-center`, "od {x} zł /dzień" (unchanged).

---

## Phase 4: Popularne card images — seed-data check (#10)

### Overview

Implements research item **#10**. The featured cards render real photos that **aren't
vehicles** (clouds / beach / coast). The card code is correct (`photos[0]` → `<img>`, else the
on-brand silhouette); this is a **data** problem, not CSS.

### Changes Required

#### 1. Diagnose, then fix the data (not the component)

**Files**: `supabase/seed.sql` (local) and/or production data — **investigate first**.

**Contract**:

- Confirm where the bad photos come from: inspect the top-3 `listVehicles(…)` result
  (`vehicles.slice(0,3)` in `index.astro`) — are the non-vehicle URLs in `supabase/seed.sql`, or
  in the real DB?
- If **seed-only**: replace those `photos` with real vehicle imagery, or clear them so the
  `VehicleSilhouette` placeholder renders (matches the design's gradient placeholder intent).
  Do **not** hard-code the landing to always use the silhouette — real photos are correct when
  they are actually of the vehicle.
- If **production data** has non-vehicle photos: this is a content task for the owner — record it
  and stop (out of a presentational change's remit).

### Success Criteria

#### Manual Verification

- The Popularne cards show either a real vehicle photo or the on-brand silhouette — never an
  unrelated stock photo. (If production-data, the finding is documented and handed off.)

---

## Phase 5: "Wybierz typ pojazdu" — remove the active pill state; hover-only; crimson only on "Cała flota"

### Overview

Follow-up flagged at owner review (2026-08-07), after Phases 1–4 shipped. The live design's
`DesktopTypeExplorer` renders **every** type pill with `active={false}`
(`customer-desktop.jsx:226`) — there is **no** persistent selected/crimson pill; crimson lives
only on `CalaFlotaCTA`. Pills carry a **hover** treatment instead. The app currently marks
"Furgon" active (crimson), which the owner does not want.

### Changes Required

#### 1. TypeSelector — drop the active state, add hover, keep crimson on the CTA only

**File**: `src/components/landing/TypeSelector.astro`

**Intent**: All 5 pills render in the default (unselected) state with a hover effect; no crimson
pill; crimson is only the "Cała flota" CTA (unchanged).

**Contract** (port from `TypePill` `:140-152`, hover CSS `:158`, `MobileTypePill` `:611-625`):

- Remove the `active` prop and the `isActive` branch. Replace the pill's
  `class:list={cn("<geometry>", isActive ? "<crimson>" : "<default>")}` with a **single static
  class** (no crimson/active variant). Resulting class:
  `inline-flex shrink-0 items-center gap-2 rounded-full border bg-card border-border py-[11px] pr-4 pl-[13px] text-[14px] font-[550] text-[var(--flota-ink-2)] transition hover:bg-[#F6F7F9] hover:border-[#D7DCE5] xl:border-transparent xl:bg-transparent xl:py-3 xl:pr-5 xl:pl-[18px] xl:text-[14.5px] xl:hover:bg-[#F1F2F5] xl:hover:border-transparent xl:hover:text-foreground`
  - Mobile/tablet default = design `MobileTypePill` `#fff` / `1px #E7EAF0` → our `bg-card` /
    `border-border`; hover `background:#F6F7F9; border-color:#D7DCE5` (`:158`) → `hover:bg-[#F6F7F9] hover:border-[#D7DCE5]`.
  - Desktop (xl) default = transparent in the bordered container; hover
    `background:#F1F2F5; span color:#141922` (`:158`) → `xl:hover:bg-[#F1F2F5] xl:hover:text-foreground`.
    `deviation(token: design hover text #141922 → our --flota-ink #0f172a via the app-wide
dark-ink mapping)`.
  - Geometry classes unchanged (gap/padding/radius/text sizes as above).
- Icon: drop the `isActive ? "text-primary-foreground" : "text-[var(--flota-ink-2)]"` →
  always `text-[var(--flota-ink-2)]` (keep the `category === "car_transporter" && "md:size-[20px]"` size conditional).
- Remove `interface Props { active?: VehicleCategory }` + `const { active = "cargo_van" } = Astro.props;`
  (the component takes no props now). If `cn` becomes unused, drop the import (verify — lint will flag).
- Update the top comment: remove the "Furgon is the active (accent) pill" line; the selector is
  now stateless click-to-route, hover-only pills, crimson only on the CTA.

#### 2. index.astro — drop the `active` prop

**File**: `src/pages/index.astro`

**Contract**: `<TypeSelector active="cargo_van" />` (`:259`) → `<TypeSelector />`.

### Success Criteria

#### Automated Verification

- Types: `npx astro check` · Lint: `npm run lint` (no unused `cn` / `active`) · Build: `npm run build`

#### Manual Verification

- No pill is crimson/filled at any breakpoint (Furgon is no longer active). Hovering a pill
  lightens it — desktop `#F1F2F5` bg + darker text; mobile/tablet `#F6F7F9` bg + `#D7DCE5` border.
- The only crimson element in the section is the "Cała flota →" CTA.
- Pills still route to `/fleet?category=…`.

---

## Phase 6: "Popularne" — 2-column grid on tablet (removes the truncation)

### Overview

Follow-up flagged at owner review (2026-08-07). The live design's `ScreenTabletHome` lays
Popularne out as a **2-column** grid (`customer-desktop.jsx:768` — `gridTemplateColumns:'1fr 1fr'`,
gap 16). The app uses `md:grid-cols-3`, so at 834 each card is ~246px — which is exactly what
forces the Phase-3 spec-value truncation. Two columns at 834 make each card ~377px, wide enough
that specs no longer truncate.

### Changes Required

#### 1. index.astro — tablet Popularne = 2 columns; desktop stays 3

**File**: `src/pages/index.astro`

**Intent**: `md`/`lg` (incl. tablet 834) render 2 columns; only `xl` (desktop ≥1280) renders 3.

**Contract**:

- Popularne grid (`:268`): `grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3` →
  `grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3` (drop `md:grid-cols-3`, add
  `xl:grid-cols-3`). `gap-4` = 16 matches the design gap.
- No `LandingVehicleCard` edits needed (its internal layout is container-query driven). Card
  widths become **390 → 350px (1-col)**, **834 → ~377px (2-col)**, **1440 → 435px (3-col)** — all
  ≥ 280, so the Phase-3 stacked-footer + `w-full`/`@min-[280px]:w-auto` spec-truncation states go
  **dormant** (never trigger). Leave them in place as the narrow-card safety net —
  `deviation(reason: superseded by 2-col tablet; truncation no longer reachable, kept as fallback)`.
- The footer at tablet 377px renders **side-by-side** (`@min-[280px]:flex-row`), consistent with
  the app's user-approved mobile row footer. The design's tablet `MobilePopularCard stack` is a
  column footer — `deviation(reason: app pattern is row-when-wide; 377px has ample room)`. If the
  owner later prefers the design's stacked tablet footer, raise the footer stack threshold above
  377px instead (separate call, not this phase).

### Success Criteria

#### Automated Verification

- Types: `npx astro check` · Lint: `npm run lint` · Build: `npm run build`

#### Manual Verification

- At **834**: Popularne is **2 columns** (2 cards row 1, 1 card row 2); spec values show **in full**
  with no truncation/ellipsis and no collision.
- At **390**: 1 column (unchanged). At **1440**: 3 columns (unchanged).

---

## Testing Strategy

- **No new logic** → no new unit suites. Keep the existing unit + integration suites green
  (nothing here touches filters, query routing, or services).
- **Primary gate is the rendered vision-diff.** Re-shoot `/` at true viewports **390 / 834 /
  1440** (retina ×2) and diff the two sections against the live design
  (`ScreenMobileHome` / `ScreenTabletHome` / `ScreenDesktopHome`). A reusable Playwright capture
  approach: launch chromium from `@playwright/test`, one context per breakpoint, screenshot the
  `section`s containing the "Wybierz typ pojazdu" and "Popularne" headings. Converge to empty
  (minus the kept-serif deviation).
- **Regression sweep:** load `/fleet`, `/reserve`, `/about`, `/pricing` — the shared
  `VehicleCard` / `CategoryIcon` / `SpecIcon` must be unaffected (this change forks only
  `LandingVehicleCard` and `TypeSelector`).

## Migration Notes

None — presentational. Revert is a straight `git revert` of the touched components/page. Phase 4
may touch `supabase/seed.sql` (data only).

## References

- Backing research: `context/changes/landing-fleet-restyle/research.md` (2026-08-07 follow-up).
- Design (live): `customer-desktop.jsx` — `CalaFlotaCTA:201-218`, `DesktopTypeExplorer:220-238`,
  `PopularCard:240-269`, `MobilePopularCard:641-668`, `ScreenTabletHome:670-776`,
  `ScreenMobileHome:778-941`.
- Prior slice: `context/changes/landing-fleet-restyle/` (plan Phase 6B–6D, `design-audit.md`).
- Lessons: "Port the design spec … with a vision-diff gate"; "size internal layout by container
  width, not the viewport".

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not
> rename step titles.

### Phase 1: TypeSelector — crimson "Cała flota", all breakpoints, mobile wraps

#### Automated

- [x] 1.1 Types pass: `npx astro check` — df6c442
- [x] 1.2 Lint passes: `npm run lint` — df6c442
- [x] 1.3 Production build succeeds: `npm run build` — df6c442

#### Manual

- [x] 1.4 Desktop: crimson CTA (dark arrow-disc) is the last chip inside the bordered pill container; heading row has no button — df6c442
- [x] 1.5 Tablet + mobile: crimson CTA after the wrapped pills; mobile pills wrap (no scroller) — df6c442
- [x] 1.6 Pills route to `/fleet?category=…`; "Cała flota" routes to `/fleet` — df6c442

### Phase 2: Popularne — drop chip + "Wszystkie", subtitle = category · year

#### Automated

- [x] 2.1 Types pass: `npx astro check` — f576312
- [x] 2.2 Lint passes: `npm run lint` (no unused `categoryLabelPl` in index.astro) — f576312
- [x] 2.3 Production build succeeds: `npm run build` — f576312

#### Manual

- [x] 2.4 Popularne heading is bare "Popularne" — no chip, no "Wszystkie" — all breakpoints — f576312
- [x] 2.5 Card subtitle reads "{Category} · {year}" (e.g. "Furgon · 2021") — f576312

### Phase 3: Popularne card — tablet stacked footer + spec truncation

#### Automated

- [x] 3.1 Types pass: `npx astro check` — f576312
- [x] 3.2 Lint passes: `npm run lint` — f576312
- [x] 3.3 Production build succeeds: `npm run build` — f576312

#### Manual

- [x] 3.4 At 834: stacked price above full-width "Rezerwuj"; no two-line price wrap — f576312
- [x] 3.5 At 834: spec values truncate one-per-column (no "AutomatycznaDiesel" collision) — f576312
- [x] 3.6 At 390 / 1440: footer side-by-side unchanged ("od" + 22px price on desktop) — f576312

### Phase 4: Popularne card images — seed-data check

#### Manual

- [x] 4.1 Located the non-vehicle photo source (seed vs production)
- [x] 4.2 Seed fixed (real photos or cleared → silhouette), or production finding handed off
- [x] 4.3 Cards never show an unrelated stock photo

### Phase 5: TypeSelector — remove active pill state, hover-only, crimson only on "Cała flota"

#### Automated

- [x] 5.1 Types pass: `npx astro check` — 4fa475f
- [x] 5.2 Lint passes: `npm run lint` (no unused `cn` / `active`) — 4fa475f
- [x] 5.3 Production build succeeds: `npm run build` — 4fa475f

#### Manual

- [x] 5.4 No pill is crimson/active at any breakpoint; hover lightens (desktop #F1F2F5 + darker text; mobile/tablet #F6F7F9 + #D7DCE5 border) — 4fa475f
- [x] 5.5 The only crimson in the section is the "Cała flota →" CTA — 4fa475f
- [x] 5.6 Pills still route to `/fleet?category=…` — 4fa475f

### Phase 6: Popularne — 2-column grid on tablet (removes truncation)

#### Automated

- [x] 6.1 Types pass: `npx astro check`
- [x] 6.2 Lint passes: `npm run lint`
- [x] 6.3 Production build succeeds: `npm run build`

#### Manual

- [x] 6.4 At 834: Popularne is 2 columns; spec values show in full — no truncation/collision
- [x] 6.5 At 390: 1 column (unchanged); at 1440: 3 columns (unchanged)

### Final gate

- [x] G.1 Rendered vision-diff `/` at 390 / 834 / 1440 vs the live design — TypeSelector + Popularne converge (minus the kept-serif deviation)
- [x] G.2 `/fleet`, `/reserve`, `/about`, `/pricing` unaffected
