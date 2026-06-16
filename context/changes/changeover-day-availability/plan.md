# Changeover-day Half-Availability Implementation Plan

## Overview

The per-vehicle booking calendar (`BookingWidget`) currently greys each booked range **inclusive of both bounds**, so it refuses back-to-back rentals that the database actually permits. The DB authority is the half-open window `[pickup 14:00, return 10:00)`, which leaves a booking's two **changeover days** half-free: the pickup day's morning is still valid as a new *return*, and the return day's afternoon is still valid as a new *pickup*. This plan makes the calendar render those two days as **half-available** (diagonal half-grey, selectable only as the matching range end), closing the calendar↔DB asymmetry surfaced in the S-02 Phase-6 review (finding F1).

The change is **entirely client-side**: `get_vehicle_busy_ranges` already returns exactly `[pickup_date, return_date]` per blocking reservation — the sufficient input. No migration, no RPC change, no type regen.

## Current State Analysis

- **Calendar greying** (`src/components/vehicle/BookingWidget.tsx:90-100`): `disabledDays` is a `Matcher[]` of `{ before: today }` plus one `{ from: pickup_date, to: return_date }` per busy range — **inclusive of both ends**. `excludeDisabled` (line 177) resets any selection that spans a disabled day.
- **DB authority** (`supabase/migrations/20260603155136_booking_integrity_data.sql:104-129`): `reserved_period` is `tsrange(pickup + 14:00, return + 10:00, '[)')`, guarded by an `EXCLUDE … with &&` constraint. Same-day turnover is *allowed* (return 10:00 adjacent to, not overlapping, pickup 14:00).
- **Pure mirror** (`src/lib/availability.ts:18-59`): `PICKUP_HOUR = 14`, `RETURN_HOUR = 10`, `bookingWindow`, `windowsOverlap`, `hasConflict`. This is the existing, tested twin of the `EXCLUDE` rule — the new helper must reuse these hours so it cannot drift.
- **Data flow**: `get_vehicle_busy_ranges` RPC (`supabase/migrations/20260613170000…` + date floor `20260616120000…`) → `getVehicleBusyRanges` (`src/lib/services/reservations.ts:132-147`, fail-soft `[]` on error) → SSR in `src/pages/fleet/[id]/[...slug].astro:33` → `VehicleDetail.astro:174` → `BookingWidget` prop `busyRanges: VehicleBusyRange[]` (`{ pickup_date: string; return_date: string }`, ISO `YYYY-MM-DD`).
- **shadcn Calendar primitive** (`src/components/ui/calendar.tsx`): wraps `DayPicker`. `CalendarDayButton` (lines 131-159) already destructures `modifiers` — custom modifiers flow through, so half-cells can render via `modifiers` + `modifiersClassNames` without re-plumbing the primitive. The `disabled` classNames slot is line 97.
- **Test infra**: Vitest is configured (`vitest.config.ts`, `"test": "vitest run"`); `src/lib/availability.test.ts` already exists and covers the half-open window — the new helper extends the same file.
- **Date helpers**: `fromIsoDate` / `toIsoDate` (`src/lib/date-iso.ts`), `validateDateRange` (`src/lib/catalog-filters.ts:116-142`, the existing pre-`navigate` guard in `handleReserve`).
- **Design system**: `context/foundation/design-system.md:93-115` already specifies a *"booked or requested"* **legend** for this picker (currently unshipped). `--muted`, `--primary`, hairline `--flota-hair-2` tokens live in `src/styles/global.css`.

## Desired End State

On a vehicle's booking calendar:

- A booked range's **pickup day** shows a diagonal half-grey (morning/upper-left greyed) and is selectable **only as a new return**.
- Its **return day** shows the mirror diagonal (afternoon/lower-right greyed) and is selectable **only as a new pickup**.
- A day that is both a return-of-one and pickup-of-another (seed `07-10`) and every interior day stay **fully disabled**.
- A visitor can select a back-to-back range that meets an existing booking on a changeover day (e.g. existing `07-01→07-10`, new `07-10→07-15`), and it passes through to `/reserve`.
- Completing a range that violates the half-day rule resets the selection to the just-clicked day and shows an inline Polish hint.
- A visible legend explains the half-cell; screen-reader/keyboard users get a per-day `aria-label` describing each changeover day's rule.
- The pre-submit `available_vehicles` re-check and the `EXCLUDE` constraint remain the authority — greying stays UX sugar.

Verify: `npm run test` (new matrix green), `npx astro check`, `npm run lint`, `npm run build` all pass; manual desktop + **real mobile device** walk-through of the back-to-back booking and the invalid-range reset.

### Key Discoveries:

- No DB work: `get_vehicle_busy_ranges` already returns `[pickup_date, return_date]` — `src/lib/services/reservations.ts:132-147`.
- `CalendarDayButton` already forwards `modifiers` — `src/components/ui/calendar.tsx:131` — so half-cells need only a `modifiers` + `modifiersClassNames` pair, not a primitive rewrite.
- `excludeDisabled` only auto-rejects ranges that **span a fully-disabled day**; a range whose *interior* contains a half-day must be vetoed in `onSelect` (rule 3 below). This is why CSS alone is insufficient.
- Reuse `PICKUP_HOUR`/`RETURN_HOUR` from `availability.ts` so the half-state cannot drift from the `EXCLUDE` window.

## What We're NOT Doing

- No migration, RPC, or `src/types.ts` change.
- No change to catalog calendars (`HeroSearch.tsx`, `FilterBar.tsx`) — they query `available_vehicles` across the fleet (already correct, not per-vehicle).
- No change to the `/reserve` funnel (`ReservationForm.tsx`) — it carries dates via URL params read-only; it renders no per-vehicle availability calendar.
- No change to the server pre-check or `EXCLUDE` constraint — the authority is untouched.
- No tooltip-only fallback (the cheaper alternative considered in the design proposal and rejected — recovers no inventory).

## Implementation Approach

The half-state model is a pure transform of `busyRanges`; the calendar then consumes it three ways — `disabled` (blocked + past), `modifiers` (the two half-states), and an `onSelect` validity veto. Build correctness first as a tested pure function, then wire selection behavior, then the visual/legend/a11y layer. Per the "everything-or-nothing" decision, all three phases ship together and the mobile-device check is part of done.

### The model (per-day half-state)

For a calendar day `d`, scanning every busy range `[P, R]`:

```
amTaken(d)  ⟺  ∃ range with P <  d ≤ R     // morning occupied: interior or a return day
pmTaken(d)  ⟺  ∃ range with P ≤ d <  R     // afternoon occupied: interior or a pickup day
```

| State        | am / pm       | Meaning                                            | Calendar treatment                          |
| ------------ | ------------- | -------------------------------------------------- | ------------------------------------------- |
| `free`       | free / free   | fully bookable                                      | normal                                      |
| `pickupOnly` | taken / free  | **return day** of an existing booking               | selectable as range **start** only; am half-grey |
| `returnOnly` | free / taken  | **pickup day** of an existing booking               | selectable as range **end** only; pm half-grey |
| `blocked`    | taken / taken | interior day, or shared return+pickup (seed `07-10`) | fully disabled                              |

> Naming note: a `pickupOnly` day (the existing booking's **return** day) is free in the afternoon, so a *new* booking can **pick up** there — hence "pickupOnly" = valid as a new range **start**. A `returnOnly` day (the existing **pickup** day) is free in the morning, so a new booking can **return** there — valid as a new range **end**. Keep the modifier names oriented to the *new* booking's action.

### Validity of a candidate new range `[p, r]`

```
1. !pmTaken(p)                                 // start day's afternoon free (new pickup)
2. !amTaken(r)                                 // end day's morning free (new return)
3. ∀ i, p < i < r:  !amTaken(i) && !pmTaken(i) // every interior day fully free
```

## Critical Implementation Details

- **`onSelect` veto, not CSS** — `disabled` + `excludeDisabled` only auto-reset ranges that *span* a fully-`blocked` day. A range whose interior contains a `pickupOnly`/`returnOnly` half-day, or that ends on a `returnOnly` day / starts on a `pickupOnly` day, passes `excludeDisabled` and **must** be vetoed in `onSelect` via `isRangeBookable`. Resetting to `{ from: triggerDate }` (the just-clicked day) mirrors what `excludeDisabled` already does for blocked days.
- **First-click is always treated as start by react-day-picker** — a `returnOnly` day is a valid *end* but not a *start*. Don't special-case the first click; validate the **completed** range only. Date-order normalization (`range.from`/`range.to`) handles the common "click the later day first" path; the one genuinely-invalid gesture (first-click a `returnOnly`, then extend forward) is caught by rule 1 at completion.
- **Hours must be shared** — derive `amTaken`/`pmTaken` from the same `PICKUP_HOUR`/`RETURN_HOUR` already in `availability.ts`; never hard-code 14/10 a second time.
- **Map keys are ISO `YYYY-MM-DD` strings**, not `Date` objects (avoids tz/identity pitfalls); the component converts calendar `Date`s with `toIsoDate` at the lookup boundary.

## Phase 1: Pure half-state helper + Vitest matrix

### Overview

Add the pure transform and the range validator to `src/lib/availability.ts`, fully covered by Vitest. All correctness lives here; later phases are thin wiring.

### Changes Required:

#### 1. Half-state helper

**File**: `src/lib/availability.ts`

**Intent**: Add a pure, I/O-free transform from busy ranges to a per-day availability map, plus a range validator that the component will call from its `onSelect` veto. Reuse the existing `PICKUP_HOUR`/`RETURN_HOUR` and half-open comparison so the half-state cannot drift from the `EXCLUDE` window.

**Contract**:

```ts
export type DayAvailability = "free" | "pickupOnly" | "returnOnly" | "blocked";

/** Map keyed by ISO YYYY-MM-DD; only changeover/interior days are present (absent ⇒ "free"). */
export function dayAvailabilityMap(busy: VehicleBusyRange[]): Map<string, DayAvailability>;

/** Validity of a candidate [pickup, return] under the half-day rules (1,2,3 above). */
export function isRangeBookable(busy: VehicleBusyRange[], pickup: string, returnDate: string): boolean;
```

`VehicleBusyRange` (`{ pickup_date: string; return_date: string }`) imported from `../types`. `amTaken`/`pmTaken` computed by iterating busy ranges; `dayAvailabilityMap` materializes a state per day across the union of all ranges; `isRangeBookable` evaluates rules 1-3 directly (it does not need the materialized map, but may reuse the same `amTaken`/`pmTaken` predicates).

#### 2. Test matrix

**File**: `src/lib/availability.test.ts`

**Intent**: Extend the existing test file with the 8-case matrix that pins the edge behavior (this is the load-bearing safety net — no UI test runner).

**Contract**: Vitest cases —
1. Single booking `16→20` ⇒ `16` (pickup day) `returnOnly`, `17-19` `blocked`, `20` (return day) `pickupOnly`.
2. Adjacent bookings sharing a day (`07-01→07-10`, `07-10→07-15`) ⇒ `07-10` `blocked`.
3. One-day gap between two bookings ⇒ gap day resolves from both sides.
4. New range *ending* on a `pickupOnly` day ⇒ `isRangeBookable` false (rule 2).
5. New range *starting* on a `returnOnly` day ⇒ false (rule 1).
6. Valid back-to-back: new `13→16` where `16` is an existing pickup day (`returnOnly`) ⇒ true.
7. Range whose interior contains a half-day ⇒ false (rule 3).
8. Empty `busy` ⇒ empty map; any well-ordered range bookable.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- The 8 matrix cases read as a faithful encoding of the half-state model (spot-check case 2 and case 6 by eye).

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: BookingWidget selection behavior

### Overview

Wire the helper into `BookingWidget`: derive `disabled` and `modifiers` from the map, veto invalid completed ranges with a restart-from-clicked-day + Polish hint, and attach per-day `aria-label`s. After this phase the back-to-back booking is selectable and invalid ranges are rejected — even before the visual polish lands.

### Changes Required:

#### 1. Derive disabled + modifiers from the map

**File**: `src/components/vehicle/BookingWidget.tsx`

**Intent**: Replace the inclusive `{ from, to }` matchers with map-driven inputs: `disabled` keeps `{ before: today }` plus only the `blocked` days; the two changeover states become `modifiers={{ pickupOnly: Date[], returnOnly: Date[] }}`. Keep `excludeDisabled` on (it still resets ranges spanning a `blocked` day).

**Contract**: Build a `Map<string, DayAvailability>` once via `useMemo(() => dayAvailabilityMap(busyRanges), [busyRanges])`. `disabled: Matcher[]` = `[{ before: today }, ...blockedDates]`. `modifiers` = `{ pickupOnly: [...], returnOnly: [...] }` as `Date[]` (convert ISO keys with `fromIsoDate`). Remove the old inclusive-range loop at lines 90-100.

#### 2. Selection veto + Polish hint

**File**: `src/components/vehicle/BookingWidget.tsx`

**Intent**: In `onSelect`, when a full range (`from` + `to`) forms, run `isRangeBookable(busyRanges, pickupIso, returnIso)`; if false, reset selection to `{ from: triggerDate }` and set an inline Polish error hint instead of accepting the range. Date-order normalize before validating.

**Contract**: `onSelect={(next, triggerDate) => …}` (react-day-picker passes the clicked day as the 2nd arg). On veto: `setRange({ from: triggerDate })`, `setError(COPY.changeoverHint)`. On valid completion: existing `setRange(next); setError(null)`. Add `COPY.changeoverHint` — a Polish string explaining the day is only free for half the day (e.g. *"Wybrany termin nachodzi na dzień przekazania pojazdu. Wybierz inny zakres."* — finalize copy against design-system Polish-canonical tone). The existing `handleReserve` `validateDateRange` guard stays as the second line of defense.

#### 3. Per-day aria-labels

**File**: `src/components/vehicle/BookingWidget.tsx` (and a small prop pass-through if needed)

**Intent**: Give `pickupOnly` / `returnOnly` days an `aria-label` stating the rule so SR/keyboard users get the start-only/end-only signal the visual can't convey.

**Contract**: Supply day labels via react-day-picker's `labels`/`formatters` or a `modifiers`-aware `aria-label` on the day button (preferred: extend the existing `CalendarDayButton` to append a state-derived suffix when `modifiers.pickupOnly`/`modifiers.returnOnly` is set, keeping the primitive generic). Polish copy, e.g. *"dostępny tylko jako dzień odbioru"* / *"…jako dzień zwrotu"*.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- On a vehicle with the seeded back-to-back bookings, the existing pickup/return changeover days are selectable; a new range meeting an existing booking on a changeover day (e.g. `07-10→07-15`) is accepted and carries through to `/reserve`.
- Completing an invalid range (interior crosses a changeover day, or ends on a `pickupOnly` day) resets to the clicked day and shows the Polish hint.
- Keyboard tab/arrow onto a changeover day announces the start-only/end-only `aria-label` (VoiceOver/NVDA spot check).
- No regression: fully-booked interior days and past days remain unselectable.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 3.

---

## Phase 3: Half-cell visuals + legend + mobile verification

### Overview

Render the diagonal half-grey for the two changeover states, ship the visible legend, and verify perceptibility/tap on a real mobile device. This is the "everything-or-nothing" presentation gate.

### Changes Required:

#### 1. Diagonal half-grey modifier classes

**File**: `src/components/ui/calendar.tsx` + `src/styles/global.css`

**Intent**: Map the `pickupOnly` / `returnOnly` modifiers to diagonal-gradient classes so the cell shows which half is taken. `pickupOnly` (morning taken) greys the upper-left; `returnOnly` (afternoon taken) greys the lower-right.

**Contract**: Add `modifiersClassNames={{ pickupOnly: "…", returnOnly: "…" }}` wired through the `Calendar` wrapper (it already spreads `...props` to `DayPicker`, so `BookingWidget` can pass `modifiersClassNames` directly, or add named classes to the wrapper's `classNames`). Gradient utilities in `global.css`:
- `pickupOnly`: `linear-gradient(135deg, var(--muted) 0 50%, transparent 50%)`
- `returnOnly`: `linear-gradient(135deg, transparent 0 50%, var(--muted) 50%)`

Ensure the gradient sits behind the day number and does not fight the `range_start`/`range_middle`/`range_end` selected-state backgrounds (selected takes visual precedence).

#### 2. Legend

**File**: `src/components/vehicle/BookingWidget.tsx` (+ tokens in `global.css` if needed)

**Intent**: Add the design-system-specified legend below the calendar — small swatches for "niedostępny" (fully booked), "tylko odbiór" (pickupOnly), "tylko zwrot" (returnOnly) — so sighted users can decode the half-cells.

**Contract**: A compact legend row using the same gradient swatches as the cells; Polish-canonical copy; placed under the `<Calendar>` block (around `BookingWidget.tsx:188`). Reuse `--muted` / `--flota-hair-2` tokens; merge classes with `cn()`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Full test suite still green: `npm run test`

#### Manual Verification:

- Desktop: the two changeover days render the correct diagonal halves; the legend matches the cell treatment.
- **Real mobile device** (~390px, per `mobile-2`): the diagonal split is perceivable and the half-cell is tappable; if the pure gradient reads poorly at `--spacing(9)`, the fallback dot/indicator is added before sign-off (the slice does not ship with an illegible affordance).
- Selected range still renders correctly over a changeover cell (selected state visually wins).
- Legend copy is Polish-canonical and matches design-system tone.

**Implementation Note**: After automated verification passes, pause for final human confirmation (including the mobile-device check) before considering the slice done.

---

## Testing Strategy

### Unit Tests (Vitest — `src/lib/availability.test.ts`):

- The 8-case matrix in Phase 1 (single booking states; adjacent shared day `blocked`; one-day gap; the three validity rules; empty input).
- Reuse the existing seeded scenario (`07-01→07-10` + `07-10→07-15`) as the canonical adjacency fixture so the test mirrors production data.

### Manual Testing Steps:

1. Open a vehicle detail page with the seeded back-to-back bookings; confirm changeover days show half-grey, interior days fully grey.
2. Book `07-10→07-15` (return day of the prior booking as new pickup) → accepted → lands on `/reserve` with correct params.
3. Attempt a range whose interior crosses a changeover day → reset to clicked day + Polish hint.
4. Keyboard-navigate onto a changeover day → correct `aria-label`.
5. Repeat 1-2 on a real phone; confirm the diagonal is legible and tappable.

## Performance Considerations

`dayAvailabilityMap` is O(days × ranges) over a small, date-floored set (only pending/confirmed, `return_date >= current_date`), memoized on `busyRanges`. Negligible. No new network or SSR payload.

## Migration Notes

None — no schema, RPC, or type changes.

## References

- Design proposal (source): `context/changes/public-reservation-request/follow-ups/review-fixes.md` (S-02a section)
- Origin finding: `context/changes/public-reservation-request/reviews/impl-review-phase-6.md` (F1)
- Roadmap slice: `context/foundation/roadmap.md` (S-02a)
- Pure rule mirror: `src/lib/availability.ts:18-59`
- Calendar consumer: `src/components/vehicle/BookingWidget.tsx:90-100`, `:168-188`
- Calendar primitive (forwards `modifiers`): `src/components/ui/calendar.tsx:131-159`
- Design-system legend spec: `context/foundation/design-system.md:93-115`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure half-state helper + Vitest matrix

#### Automated

- [x] 1.1 Unit tests pass: `npm run test` — a4f7554
- [x] 1.2 Type checking passes: `npx astro check` — a4f7554
- [x] 1.3 Linting passes: `npm run lint` — a4f7554

#### Manual

- [x] 1.4 The 8 matrix cases read as a faithful encoding of the half-state model (spot-check cases 2 and 6) — a4f7554

### Phase 2: BookingWidget selection behavior

#### Automated

- [ ] 2.1 Type checking passes: `npx astro check`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Build passes: `npm run build`

#### Manual

- [ ] 2.4 Back-to-back range meeting an existing booking on a changeover day is selectable and carries through to `/reserve`
- [ ] 2.5 Invalid completed range resets to the clicked day and shows the Polish hint
- [ ] 2.6 Keyboard nav onto a changeover day announces the start-only/end-only `aria-label`
- [ ] 2.7 Fully-booked interior days and past days remain unselectable (no regression)

### Phase 3: Half-cell visuals + legend + mobile verification

#### Automated

- [ ] 3.1 Type checking passes: `npx astro check`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build passes: `npm run build`
- [ ] 3.4 Full test suite green: `npm run test`

#### Manual

- [ ] 3.5 Desktop: changeover days render correct diagonal halves; legend matches cell treatment
- [ ] 3.6 Real mobile device (~390px): diagonal split perceivable and half-cell tappable (fallback indicator added if illegible)
- [ ] 3.7 Selected range renders correctly over a changeover cell (selected state wins)
- [ ] 3.8 Legend copy is Polish-canonical and matches design-system tone
