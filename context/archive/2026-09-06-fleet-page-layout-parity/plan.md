# Fleet page layout parity — Implementation Plan

## Overview

Bring the public vehicle detail page (`/fleet/<id>`) into line with the live Claude Design source, in two independently shippable tracks: the booking calendar's layout (Phases 1–2) and the car-information blocks below the photo (Phases 3–5), closed by a cross-surface regression sweep (Phase 6).

The listing page `/fleet` is already at parity and is **not** being restyled. It enters this plan only as a regression target, because Phase 1 touches a component it shares.

## Current State Analysis

The detail page was built in June 2026 against an early S-02 export (`4a2911a`, `a73fd57`) and was explicitly excluded from the August restyle that brought the listing to parity: `context/archive/2026-08-02-landing-fleet-restyle/plan.md:105-106` — "No vehicle-detail (`/fleet/[id]`) restyle — deferred to a later change". It has never had a `design-contract.md`, so there is no register of agreed values or deviations to check against. This plan authors one.

Measured differences are catalogued in `research.md` §2, §3, §8, §9 and §10. The three that drive this plan:

- **The calendar does not fill its container.** It is capped at `max-w-[300px]` inside a 470.41px content box, leaving 85.2px of dead space on each side, while every sibling (the date field row, the CTA) spans the full width. The design's calendar is flush at 436.88px. `research.md` §8.
- **The car-information blocks are structurally different.** The design puts the eyebrow and title left and outside the card at desktop; the app centres them inside the gallery card at every width. Spec tiles stack a 32px icon box above the label, making them 116.5px tall against the design's ~78px. The what's-included row is three white cards with the same check icon repeated, against the design's bare items with three distinct glyphs at 42.8px total height. `research.md` §2, §10.
- **The busy-day treatment is the known open item D14.** The public calendar greys with `--muted` #eef1f5 and no divider; the staff picker already ships the design's `--flota-busy` #d7dce3 plus a 1.2px `--flota-busy-divider` band. `context/foundation/roadmap.md:346-349`.

## Desired End State

At 1440 the detail page's booking calendar spans the full inner width of its widget inside a bordered month frame, with the caption left-aligned and the two nav buttons grouped right as small squares. Busy days read in the design's darker grey with a visible diagonal divider. Below the photo, the header sits left and outside the card at desktop and centred inside it on mobile; spec tiles are compact single-row-plus-value; and the what's-included row is a light strip of three bare items with three different icons.

Verify by rendering the page at 390 / 834 / 1440 against the design boards, with a temporary future booking seeded so the busy days and legend are visible. The listing popover, landing hero search and staff manual-reservation picker render byte-identically to before.

### Key Discoveries:

- **The pattern this plan needs already exists in the codebase.** `src/components/dashboard/ManualReservationCalendar.tsx:333-361` renders the design's calendar faithfully — wide rectangular cells, left caption, 26px square nav grouped right, two-letter weekday headers, 4px row gap, and the design's three-item legend — using **only** a `classNames` map plus `components={{ DayButton: MrDayCell }}`. It does not touch `ui/calendar.tsx`. Measured baseline: grid 478px, cell 64.84 × 34, `aspect-ratio: auto`, radius 9px, weekday `Pn` 10.5px/600, row gap 4px. Phase 1 ports this approach rather than inventing a new prop.
- **Caller `classNames` slots replace, they do not merge.** `src/components/ui/calendar.tsx:139` spreads `...classNames` last, so a caller-supplied slot wholly replaces the built-in one. That is how the staff picker escapes `aspect-square` on the `day` slot; `components={{ DayButton }}` is how it escapes the same utility inside `CalendarDayButton`.
- **The shared calendar has four consumers**: `BookingWidget.tsx`, `FilterBar.tsx` (listing popover), `HeroSearch.tsx` (landing), `ManualReservationCalendar.tsx` (staff, pinned by the S-12a design contract). Because Phase 1 no longer edits the shared file, none of the other three can regress by construction.
- **The D14 utilities already exist.** `cell-busy-am`, `cell-busy-pm`, `cell-busy-full` and `legend-busy-half` are defined in `src/styles/global.css:257-290` with the correct fill and divider. Phase 2 is largely a re-point, not new CSS.
- **`--flota-success-soft` is `#e3f5ec`**, an exact match for the design's `greenSoft`. The trust row currently uses `bg-success/10` instead.
- **The seed has no live bookings.** Today is 2026-09-06 and the latest `return_date` in the database is 2026-09-05, because the seed writes `current_date - N` offsets that are evaluated once at insert time. The busy-ranges RPC floors at `return_date >= current_date`, so the legend and half-cells render on no vehicle. `research.md` §9.
- **The icon set has `check`, `clock` and `shield` but no `key`** (`src/components/icons/info-icons.ts`).

## What We're NOT Doing

- No restyle of the `/fleet` listing page. It is at parity; it is a regression target only.
- No green "Dostępny w Twoim terminie" availability strip. Recorded decision D4 stands.
- No model subtitle under the `h1`. The schema has no trim field.
- No breadcrumb above the hero.
- No adoption of the design's copy strings. The app keeps `Zarezerwuj`, `Szacunkowa cena`, `/doba` and its shorter reassurance line. The per-day suffix split is documented as deliberate at `src/lib/i18n/fleet.ts:79-83`.
- No change to the weekday header abbreviations, the outside-month days, or the today highlight. All three stay as shipped and are recorded as deviations.
- No change to the shared calendar's defaults, and no restyle of the staff picker.
  **Amended 2026-09-07 by Phase 7**: the listing popover and landing hero search
  are no longer out of scope — but only their **mobile** shell. Their desktop
  appearance stays frozen, and `src/components/ui/calendar.tsx` still is not
  edited.
- No seed file changes. Verification seeds through a throwaway script.
- No mobile re-flow of the booking widget beyond what the hero restructure requires. The Option A decision (the detail page hosts the widget) stands.

## Implementation Approach

Two tracks that do not share files, so either can ship first.

Track A changes the calendar. Phase 1 ports the override pattern the staff picker already uses, so the shared component is not modified at all and the other three consumers cannot regress. Phase 2 re-points the busy-day modifiers at the existing darker utilities. Both phases are largely transcription from two working precedents in this repo rather than new design work.

Track B changes markup in `VehicleDetail.astro` only, one block per phase, each independently revertible.

Phase 6 verifies the three untouched calendar consumers and signs off the design contract.

## Critical Implementation Details

**Class-slot replacement.** Because `src/components/ui/calendar.tsx:139` spreads the caller's `classNames` last, any slot the booking widget supplies replaces the default entirely — the default's other utilities are lost, not merged. When overriding `day` or `week`, restate everything the default provided that is still wanted.

**Where the busy gradient is painted differs by surface.** The public utilities (`cell-pickup-only` / `cell-return-only`) are applied to the day gridcell via `modifiersClassNames`, so the gradient sits behind the ghost day button. The staff utilities (`cell-busy-am` / `cell-busy-pm`) are applied to the day button, where the selected-range background paints over them. Phase 2 must decide one target and confirm the selected-range and in-range styles still win over the fill; the two comment blocks at `src/styles/global.css:236-256` state each contract.

**Verification is invisible without seeded data.** Nothing in Phases 2 or 6 that concerns busy days, half-cells or the legend can be observed on the default database. Seed forward-dated bookings before capturing, and remove them afterwards.

**Regression baselines were captured before any code change** (2026-09-06, worktree server). Phase 6 compares against these, not against a re-derived "should be" — once Phase 1 lands, "identical to before" is otherwise unverifiable.

| Surface                         | Baseline image                               | Geometry fingerprint                                                                                                          |
| ------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Listing date popover            | `design-review/baseline-listing-popover.png` | grid 224px · cell 32 × 32 · aspect 1/1 · radius 12px · weekday `pon` 12.8px/400 · row gap 8px · 6 rows · 5 outside days       |
| Landing hero search             | `design-review/baseline-landing-hero.png`    | identical to the listing popover on every field above                                                                         |
| Staff manual-reservation picker | `design-review/baseline-staff-picker.png`    | grid 478px · cell 64.84 × 34 · aspect **auto** · radius 9px · weekday `Pn` 10.5px/600 · row gap 4px · 6 rows · 5 outside days |

The two public pickers share one fingerprint; the staff picker deliberately does not, and its shape is the one this plan is porting. Since Phase 1 no longer edits the shared file, all three should be untouched by construction — Phase 6 confirms rather than hunts.

---

## Phase 1: Calendar fills its container

### Overview

The booking calendar spans the full inner width of the widget, inside a bordered month frame, with a left caption and square nav buttons grouped right. The shared component gains an opt-in escape hatch; its defaults and its three other consumers are untouched.

### Changes Required:

#### 1. Booking widget — port the staff picker's override pattern

**Files**: `src/components/vehicle/BookingWidget.tsx`; **`src/components/ui/calendar.tsx` is NOT modified**

**Intent**: Escape the square cell aspect the same way the staff picker already does, rather than adding a prop to the shared component. `ManualReservationCalendar.tsx:333-361` is the working precedent and should be read before starting.

**Contract**: A `classNames` map supplying at minimum `day` (fixed height, full width, replacing the default's `aspect-square`), `week` (4px gap), `weekday`, `month_caption`, `nav`, `button_previous` and `button_next`; plus `components={{ DayButton }}` for a day button without `aspect-square`. Remember every supplied slot **replaces** the default wholesale, so restate any default utility still wanted. Values come from the design contract's Surface 1 table, not from copying the staff picker's numbers — the two surfaces differ in cell height (32 here, 34 there) and radius.

#### 2. Booking widget — adopt the full width

**File**: `src/components/vehicle/BookingWidget.tsx`

**Intent**: Remove the width cap so the calendar and the legend match every other element in the widget, and opt into the design's rectangular cells.

**Contract**: The `max-w-[300px]` wrapper around `Calendar` (line 200) and the same cap on the legend `ul` (line 269) both go. The calendar opts into the new cell shape at the design's ratio: cell 54.13 × 32px inside a 402.88px grid at the 1440 column width, with a 4px grid gap. Day number stays at the design's 12.5px / 500, selected 700.

#### 3. Booking widget — month frame, caption and nav

**File**: `src/components/vehicle/BookingWidget.tsx`

**Intent**: Frame the month so a full-width grid reads as deliberate, and stop the nav arrows floating to the far edges once the grid widens.

**Contract**: A wrapper with 1px `--flota-hair-2` border, 16px radius, 16px padding, 16px top margin. Caption becomes sentence-case `Marzec 2026` form at 13.5px / 700, letter-spacing -0.2, left-aligned — replacing the current uppercase centred formatter. Nav becomes two 26px squares, 8px radius, 1px `--flota-hair` border, 6px gap, grouped at the right of the caption row. The existing `nav` slot is absolutely positioned across the full width and must be re-anchored.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Production build succeeds: `npm run build`

#### Manual Verification:

- At 1440 the calendar's left and right edges align with the Odbiór/Zwrot field row and the CTA, side gap 0
- Day cells measure 54 × 32px, not 43 × 43px
- Caption is left-aligned sentence case with two square nav buttons grouped right
- Month frame border and radius match the design board
- The listing date popover at `/fleet` is visually unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Busy-day treatment (D14)

### Overview

The public calendar adopts the design's darker busy fill and its diagonal divider, reconciling it with the staff picker. This closes the long-standing D14 item.

### Changes Required:

#### 1. Re-point the busy modifiers

**File**: `src/components/vehicle/BookingWidget.tsx`

**Intent**: Replace the lighter, divider-less half-cell treatment with the design-faithful one that already exists for the staff picker.

**Contract**: `modifiersClassNames` maps `pickupOnly` → `cell-busy-am`, `returnOnly` → `cell-busy-pm`, `blocked` → `cell-busy-full`, replacing `cell-pickup-only`, `cell-return-only` and `bg-[var(--muted)]`. The semantic mapping is one-to-one; both comment blocks in `global.css` describe the same orientation. Confirm which element the class lands on (see Critical Implementation Details) and that the selected-range background still paints over a busy cell.

#### 2. Legend swatch

**File**: `src/components/vehicle/BookingWidget.tsx`

**Intent**: Keep the legend's swatches truthful to the cells they explain.

**Contract**: The blocked swatch uses `--flota-busy`; the two half swatches use `legend-busy-half`, which deliberately carries no divider. Legend copy, item count and the `availability.size > 0` visibility condition are unchanged.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- With seeded future bookings, interior busy days render solid `#d7dce3`
- Changeover days show the diagonal split with a visible 1.2px divider
- Selecting a range across a half-day still paints the selected background over the fill
- Legend swatches match the cells they describe
- The staff manual-reservation picker is visually unchanged

**Implementation Note**: Seed forward-dated bookings before verifying; none of the above is observable on the default database.

---

## Phase 3: Hero restructure

### Overview

The header moves left and outside the card at desktop while staying centred inside it on mobile, and the image gets its own card, matching both design boards rather than applying the mobile one everywhere.

### Changes Required:

#### 1. Responsive header placement

**File**: `src/components/vehicle/VehicleDetail.astro`

**Intent**: The design's desktop board puts the eyebrow and title left-aligned above a separate image card; its mobile board centres them inside the card. The app currently ships the mobile treatment at every width.

**Contract**: Below `lg`, the current single hero card with centred eyebrow, `h1` and media is preserved exactly. At `lg` and above, the eyebrow and `h1` sit outside and above the media card, left-aligned. `h1` goes to 48px, letter-spacing -1.6, line-height 1 at `lg`, from today's 44px / -1.1. Eyebrow keeps its 12px uppercase treatment, weight 650, letter-spacing 0.3.

#### 2. Image card

**File**: `src/components/vehicle/VehicleDetail.astro`

**Intent**: Once the header leaves the card at desktop, the card contains only the media and becomes the design's image card.

**Contract**: 24px radius, `40px 32px` padding, `shadow-card`, 24px vertical margin, 320px minimum height at `lg`. The `VehicleGallery` island, its `client:idle` directive, its thumbnails and its dot navigation are unchanged. Below `lg` the card keeps its current padding and contains the header as today.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- At 1440 the eyebrow and title are left-aligned outside the media card, `h1` at 48px
- At 390 the header remains centred inside the card, unchanged from today
- The transition at the `lg` boundary produces no orphaned padding or double card
- Gallery arrows, thumbnails and dots still work at their respective breakpoints
- The fixed mobile bottom bar still clears the content

---

## Phase 4: Spec tiles

### Overview

Spec tiles become compact: icon and label share a row, the value sits beneath, cutting tile height from 116.5px to roughly 78px.

### Changes Required:

#### 1. Tile internals

**File**: `src/components/vehicle/VehicleDetail.astro`

**Intent**: The app stacks a 32px icon container above the label, which is what makes the tiles tall. The design keeps a bare 15px icon inline with the label and puts the value on the second line.

**Contract**: Drop the 32px `bg-background rounded-[10px]` icon container. Icon renders at 15px in `--flota-muted`, inline with the label at 8px gap. Label 10.5px, weight 650, letter-spacing 0.2, uppercase, muted. Value 16px, weight 650, letter-spacing -0.3, 8px top margin. Tile padding 18px, radius 16px, `shadow-card`. Grid stays 3 columns at `sm` with a 12px gap; the 2-column mobile arrangement is unchanged. Field order and the six `dt`/`dd` pairs are unchanged.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Tile height measures approximately 78px at 1440, down from 116.5px
- Icon sits inline with the label, not above it
- All six specs still render, including the em-dash fallbacks for null values
- No text truncation on the longest value, `4.40 × 1.78 × 1.98 m`

---

## Phase 5: What's-included row

### Overview

The three white cards become bare items with three distinct icons, halving the row's height.

### Changes Required:

#### 1. Row and item structure

**File**: `src/components/vehicle/VehicleDetail.astro`

**Intent**: The design draws this as a light reassurance strip on the page ground, not as three cards. The card chrome plus a longer first note makes the app's row 87px against the design's 42.8px.

**Contract**: Remove `bg-card`, `shadow-card`, `rounded-lg` and the 16px padding from each item; item padding becomes `4px 2px`. Icon container becomes a 34px rounded square at 10px radius on `--flota-success-soft` — an exact match for the design's `#E3F5EC`, replacing today's 28px circle on `bg-success/10`. Note that `--flota-success-soft` has no Tailwind colour mapping today, so it is referenced as an arbitrary value or given one. Title 13.5px weight 650 letter-spacing -0.1; note 12px muted. Row top margin 16px, 12px gap, 3 columns at `sm`. Copy is unchanged.

#### 2. Per-promise icons

**Files**: `src/components/vehicle/VehicleDetail.astro`, `src/components/icons/info-icons.ts`

**Intent**: The design varies the glyph per promise — payment, insurance, availability. The app repeats the same check three times, which is the row's most visible defect.

**Contract**: Payment keeps `check`. Availability uses `clock`. Insurance uses `shield`, which the icon set already provides; the design uses a key here, so this is a recorded deviation rather than a new glyph. Icons render at 16px in `--flota-success`. If a key is preferred instead, it is a new path in `info-icons.ts` and the contract line changes to `exact`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Row height measures approximately 43px at 1440, down from 87px
- Three visually distinct icons, confirmed by counting distinct glyph shapes
- No card background, border or shadow behind the items
- Icon container green matches `--flota-success-soft` exactly
- At 390 the three items stack without the notes wrapping awkwardly

---

## Phase 6: Regression sweep and contract sign-off

### Overview

Confirm the three untouched calendar consumers are unchanged, then run the rendered comparison against the design boards and reconcile the contract.

### Changes Required:

#### 1. Seeding helper

**File**: scratchpad only — not committed

**Intent**: Make the busy days, half-cells and legend observable, since the database has no live bookings.

**Contract**: Insert two forward-dated confirmed reservations on one vehicle producing both a changeover day and interior blocked days, capture, then delete them and assert the reservation count and latest return date return to their prior values. Must not touch `supabase/seed.sql`.

#### 2. Contract reconciliation

**File**: `context/changes/fleet-page-layout-parity/design-contract.md`

**Intent**: Close the loop between what was built and what was agreed.

**Contract**: Every line resolves to `exact` or `deviation(reason)`. The deviations expected at sign-off are the weekday abbreviations, outside-month days, the today highlight, the omitted availability strip, the absent model subtitle and breadcrumb, the retained app copy, and the shield-for-key glyph swap.

### Success Criteria:

#### Automated Verification:

- Full lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Integration suite passes: `npm run test:integration`
- E2E suite passes: `npm run test:e2e`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Listing date popover at `/fleet` renders identically to before Phase 1
- Landing hero search calendar renders identically
- Staff manual-reservation picker renders identically and still matches its S-12a contract
- Detail page compared against the design boards at 390, 834 and 1440 with no unrecorded difference
- Every design-contract line is `exact` or a recorded `deviation`

---

## Phase 7: Mobile shell for the two public date pickers

> Added 2026-09-07, after Phases 1–6 shipped. Found while checking the shared
> calendar on a phone: both public pickers open the same desktop-sized popover at
> every viewport. Not a regression from this change — `HeroSearch.tsx`,
> `FilterBar.tsx` and `ui/calendar.tsx` are byte-identical to the branch point —
> but it is the same shared calendar this change is already about, so it lands
> here rather than in a new change folder.

### Overview

The landing hero search and the `/fleet` filter bar open a fixed 248px popover on
a phone, with 30.6px day cells. The staff picker, by contrast, swaps to a
full-width bottom sheet below `md`. This phase gives the two public pickers a
mobile shell of their own. The shared `ui/calendar.tsx` is **not** edited, so the
Phase 1 guarantee holds: sizing is done caller-side.

### Measured problem (2026-09-07, worktree server, 390 × 844)

| Surface                        | Calendar width | % of viewport | Day tap target |
| ------------------------------ | -------------- | ------------- | -------------- |
| Landing hero popover           | 248px          | 61.1%         | 30.8px         |
| `/fleet` listing popover       | 248px          | 60.8%         | 30.6px         |
| Staff manual-reservation sheet | 358px          | 91.8%         | 47.7px         |

30.6px is under the 44px iOS and 48px Android minimum touch target. On the
landing page there is a second, separate defect: the search card's `Szukaj`
button paints **over** the open popover, and the popover overlaps the card's own
`ODDZIAŁ` row.

### Changes Required:

#### 1. Design Alignment Audit — resolve a real design gap FIRST

**File**: `context/changes/fleet-page-layout-parity/design-contract.md`

**Intent**: There is **no board for either public date picker at mobile**. This
was checked against the live source on 2026-09-07, not assumed:

- `customer-screens.jsx` → `ScreenHome` draws no date control at all on mobile.
- `customer-screens.jsx` → `ScreenFleet` draws the date control as a 30px-tall
  `Pill` reading `24 – 27 Mar` beside a `Filtry` pill. What opens when it is
  tapped is **not drawn**.
- The bottom sheet is a **staff** pattern (`manual-reservation.jsx`), not a
  public one. Lifting it across would be invention, not a port.

The nearest specified public surface is `customer-screens.jsx` → `ScreenReserve`,
which draws the mobile calendar **inline in a card**, not in an overlay:

| Element  | Value in `ScreenReserve`                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------ |
| Card     | `bg-card`, radius 20, padding 16, `shadow-card`                                                        |
| Grid     | `repeat(7, 1fr)`, gap 4                                                                                |
| Day cell | `DayCell size={34} radius={8}`                                                                         |
| Weekday  | 11px, weight 600, muted, margin-bottom 4                                                               |
| Caption  | `Marzec 2026` 11px/600 muted uppercase ls 0.2, over `24 – 27 marca · 3 dni` 15px/650 ink ls -0.2       |
| Nav      | two 28 × 28 **round** buttons on `--flota-bg`, gap 6                                                   |
| Legend   | 2 items, 18 × 18 swatches at radius 6, 11.5px/540 muted, mt 12, pt 12, 1px `--flota-hair-2` top border |

Note these deliberately differ from `MiniMonth`'s desktop values that Phase 1
ported (32px cell, radius 9, 26px **square** nav, 10.5px weekday, 12px swatch).

**Contract**: Decide and record ONE of:

- **(a) Sheet** — adopt the staff bottom-sheet shell for both public pickers.
  Consistent with the rest of the app, biggest tap targets, fixes the `Szukaj`
  stacking bug for free by construction. Records as a new deviation: the design
  draws no such sheet for public surfaces.
- **(b) Widened popover** — keep the popover, size it from `ScreenReserve`'s
  metrics (34px cells, radius 8). Closer to the only specified public mobile
  calendar, but leaves the popover overlaying the card and needs the stacking bug
  fixed separately.

Do not start §2 until this line is written into the contract as `exact` or
`deviation(reason)`. Whichever is chosen, the day cell must be ≥ 44px or the
choice must be recorded as a knowing accessibility deviation.

#### 2. Mobile shell for both pickers

**Files**: `src/components/vehicle/HeroSearch.tsx`, `src/components/vehicle/FilterBar.tsx`; **`src/components/ui/calendar.tsx` is NOT modified**

**Intent**: Give each picker a viewport-appropriate shell, reusing what exists
rather than inventing a mechanism.

**Contract**: Branch on `useMediaQuery` (`src/components/hooks/useMediaQuery.ts`)
at the same breakpoint the staff modal uses — `!useMediaQuery("(min-width: 48rem)")`,
`ManualReservationModal.tsx:364`. The desktop branch renders today's
`PopoverContent` **unchanged**, so the desktop fingerprint (grid 224px, cell
32 × 32, aspect 1/1, radius 12px) is preserved exactly. The mobile branch renders
the shell chosen in §1; if (a), model it on `ManualReservationModal.tsx:825-833`
— `absolute inset-0 z-[70] flex items-end`, `rgba(20,18,22,0.5)` scrim,
`backdrop-blur-sm`, card at `rounded-t-[26px] px-4 pt-3.5 pb-[22px]`, grab handle
`h-1 w-10 rounded-full bg-[var(--flota-hair)]`.

Cell size is set caller-side, the way Phase 1 did it: the shared `day` slot keeps
`aspect-square`, so raising `[--cell-size:…]` on the calendar's `className`
grows the squares without touching the shared file.

#### 3. Landing-page stacking

**File**: `src/components/vehicle/HeroSearch.tsx`

**Intent**: The `Szukaj` CTA currently paints over the open popover.

**Contract**: The open picker sits above the search card's own controls at every
viewport. If §1 chose (a), confirm this is already satisfied by the overlay
rather than adding a second fix.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- E2E suite passes: `npm run test:e2e`
- Production build succeeds: `npm run build`

#### Manual Verification:

- At 390 the day cell in both public pickers is ≥ 44px, or the shortfall is a recorded deviation
- At 390 the open picker is not overlapped by `Szukaj` or by the card's own rows
- At ≥ 768 both pickers are byte-identical to today: grid 224px, cell 32 × 32, aspect 1/1, radius 12px, weekday 12.8px/400, row gap 8px
- The staff manual-reservation picker is unchanged: grid 478px, cell 64.86 × 34, aspect auto, radius 9px
- The booking widget on `/fleet/<id>` is unchanged at every width
- Every new contract line is `exact` or a recorded `deviation`

**Implementation Note**: `ui/calendar.tsx` stays closed. It has four consumers and
Phase 1 avoided it precisely so the other three could not regress; reopening it
would void that guarantee and the Phase 6 sign-off.

---

## Testing Strategy

### Unit Tests:

- No new pure functions are introduced. Existing `src/lib/availability.test.ts` covers the day-availability mapping that Phases 1–2 re-style but do not change.

### Integration Tests:

- No API, RPC or schema change, so the integration suite is a regression gate rather than a target for new cases.

### Manual Testing Steps:

1. Seed two forward-dated bookings on one vehicle via the throwaway script.
2. Open the detail page at 1440 and confirm the calendar spans the widget's inner width with zero side gap.
3. Select a range that crosses a changeover day; confirm the selected background wins over the busy fill.
4. Compare against the design board; confirm frame, caption, nav and busy treatment.
5. Repeat at 834 and 390.
6. Open `/fleet`, the landing page and the staff manual-reservation modal; confirm all three calendars are unchanged.
7. Delete the seeded bookings and confirm the database is back to its prior row count and latest return date.

## Performance Considerations

None material. All changes are markup and CSS on server-rendered Astro output plus two existing React islands. No new island, no new network call, no change to the SSR data path.

## Migration Notes

Not applicable. No schema, data or configuration change.

## References

- Research: `context/changes/fleet-page-layout-parity/research.md` (§2, §3, §8, §9, §10)
- Design contract: `context/changes/fleet-page-layout-parity/design-contract.md`
- Design source: Claude Design project `Rental car company`, `customer-desktop-reserve.jsx` → `ScreenDesktopDetail` / `MiniMonth`, `customer-screens.jsx` → `ScreenDetail`, `shared.jsx` → `DayCell` / `busyHalves`
- Rendered design board: `context/changes/fleet-page-layout-parity/design-review/d-detail-mock.png`
- Listing parity precedent: `context/archive/2026-08-02-landing-fleet-restyle/design-contract.md`
- D14 origin: `context/foundation/roadmap.md:346-349`
- Existing busy-cell utilities: `src/styles/global.css:236-290`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Calendar fills its container

#### Automated

- [x] 1.1 Type checking passes: `npx astro check` — f658d7c
- [x] 1.2 Linting passes: `npm run lint` — f658d7c
- [x] 1.3 Unit tests pass: `npm test` — f658d7c
- [x] 1.4 Production build succeeds: `npm run build` — f658d7c

#### Manual

- [x] 1.5 Calendar edges align with the field row and CTA, side gap 0 at 1440 — f658d7c
- [x] 1.6 Day cells measure 54 × 32px — f658d7c
- [x] 1.7 Caption left-aligned sentence case, square nav grouped right — f658d7c
- [x] 1.8 Month frame border and radius match the design board — f658d7c
- [x] 1.9 Listing date popover visually unchanged — f658d7c

### Phase 2: Busy-day treatment (D14)

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — 281b76b
- [x] 2.2 Linting passes: `npm run lint` — 281b76b
- [x] 2.3 Production build succeeds: `npm run build` — 281b76b

#### Manual

- [x] 2.4 Interior busy days render solid `#d7dce3` — 281b76b
- [x] 2.5 Changeover days show the diagonal split with a 1.2px divider — 281b76b
- [x] 2.6 Selected range paints over the busy fill — 281b76b
- [x] 2.7 Legend swatches match the cells they describe — 281b76b
- [x] 2.8 Staff manual-reservation picker visually unchanged — 281b76b

### Phase 3: Hero restructure

#### Automated

- [x] 3.1 Type checking passes: `npx astro check` — 9f0c596
- [x] 3.2 Linting passes: `npm run lint` — 9f0c596
- [x] 3.3 Production build succeeds: `npm run build` — 9f0c596

#### Manual

- [x] 3.4 Eyebrow and title left-aligned outside the media card at 1440, `h1` 48px — 9f0c596
- [x] 3.5 Header remains centred inside the card at 390 — 9f0c596
- [x] 3.6 No orphaned padding or double card at the `lg` boundary — 9f0c596
- [x] 3.7 Gallery arrows, thumbnails and dots still work — 9f0c596
- [x] 3.8 Fixed mobile bottom bar still clears the content — 9f0c596

### Phase 4: Spec tiles

#### Automated

- [x] 4.1 Type checking passes: `npx astro check` — 45c4eaf
- [x] 4.2 Linting passes: `npm run lint` — 45c4eaf
- [x] 4.3 Production build succeeds: `npm run build` — 45c4eaf

#### Manual

- [x] 4.4 Tile height approximately 78px at 1440 — 45c4eaf
- [x] 4.5 Icon inline with the label, not above it — 45c4eaf
- [x] 4.6 All six specs render, including em-dash fallbacks — 45c4eaf
- [x] 4.7 No truncation on the longest cargo value — 45c4eaf

### Phase 5: What's-included row

#### Automated

- [x] 5.1 Type checking passes: `npx astro check` — ccecace
- [x] 5.2 Linting passes: `npm run lint` — ccecace
- [x] 5.3 Production build succeeds: `npm run build` — ccecace

#### Manual

- [x] 5.4 Row height approximately 43px at 1440 — ccecace
- [x] 5.5 Three visually distinct icons — ccecace
- [x] 5.6 No card background, border or shadow behind the items — ccecace
- [x] 5.7 Icon container green matches `--flota-success-soft` — ccecace
- [x] 5.8 Items stack cleanly at 390 — ccecace

### Phase 6: Regression sweep and contract sign-off

#### Automated

- [x] 6.1 Full lint passes: `npm run lint` — b923d3f
- [x] 6.2 Unit tests pass: `npm test` — b923d3f
- [x] 6.3 Integration suite passes: `npm run test:integration` — b923d3f
- [x] 6.4 E2E suite passes: `npm run test:e2e` — b923d3f
- [x] 6.5 Production build succeeds: `npm run build` — b923d3f

#### Manual

- [x] 6.6 Listing date popover identical to `baseline-listing-popover.png` and its fingerprint — b923d3f
- [x] 6.7 Landing hero search identical to `baseline-landing-hero.png` and its fingerprint — b923d3f
- [x] 6.8 Staff picker identical to `baseline-staff-picker.png` and its fingerprint — b923d3f
- [x] 6.9 Detail page matches the design boards at 390, 834 and 1440 — b923d3f
- [x] 6.10 Every design-contract line is `exact` or a recorded `deviation` — b923d3f

### Phase 7: Mobile shell for the two public date pickers

#### Automated

- [x] 7.1 Type checking passes: `npx astro check` — ace72a7
- [x] 7.2 Linting passes: `npm run lint` — ace72a7
- [x] 7.3 Unit tests pass: `npm test` — ace72a7
- [x] 7.4 E2E suite passes: `npm run test:e2e` — ace72a7
- [x] 7.5 Production build succeeds: `npm run build` — ace72a7

#### Manual

- [x] 7.6 Mobile shell decision recorded in `design-contract.md` before any code — ace72a7
- [x] 7.7 Day cell at 390 is >= 44px in both public pickers, or the shortfall is a recorded deviation — ace72a7
- [x] 7.8 Open picker at 390 is not overlapped by `Szukaj` or the card's own rows — ace72a7
- [x] 7.9 Both pickers unchanged at >= 768: grid 224px, cell 32x32, aspect 1/1, radius 12px — ace72a7
- [x] 7.10 Staff picker unchanged: grid 478px, cell 64.86x34, aspect auto, radius 9px — ace72a7
- [x] 7.11 Booking widget on `/fleet/<id>` unchanged at every width — ace72a7
- [x] 7.12 Every new design-contract line is `exact` or a recorded `deviation` — ace72a7
