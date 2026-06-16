# Phase 6 review — follow-ups

Source: `reviews/impl-review-phase-6.md` (2026-06-16).

- **F2** (busy-ranges RPC error 500s the detail page) — **FIXED in place** (`src/lib/services/reservations.ts`: log + return `[]` on RPC error).
- **F3** (RPC returned all-time rows) — **FIXED in place** (migration `20260616120000_vehicle_busy_ranges_date_floor.sql`: `return_date >= current_date`).
- **F1** (inclusive greying over-blocks changeover days) — **deferred → roadmap slice `S-02a` (`changeover-day-availability`).** Full design proposal below; ready for `/10x-new changeover-day-availability` → `/10x-plan`.

---

# S-02a Design Proposal — Changeover-day half-availability

## Problem (not a bug, a UX over-restriction)

Phase 6's calendar greys each busy range `[pickup_date, return_date]` **inclusive of both
ends**. The DB authority is the half-open `EXCLUDE` window `tsrange(P 14:00, R 10:00, '[)')`,
which leaves the two changeover days *half*-free:

- A booked range's **pickup day `P`** is free in the morning → still valid as a new **return**
  (return 10:00 < pickup 14:00).
- Its **return day `R`** is free in the afternoon → still valid as a new **pickup**
  (pickup 14:00 > return 10:00).

So the calendar refuses bookings the database would accept. The seed proves it's real: one vehicle
has confirmed `2026-07-01→07-10` **and** `2026-07-10→07-15` — two legal back-to-back rentals meeting
at `07-10`. **No correctness/safety issue** — pre-check + RPC + `EXCLUDE` still block real conflicts;
this is lost bookable inventory + a "guess again" UX on changeover days.

## Key finding: no DB change needed

`get_vehicle_busy_ranges` already returns exactly `[pickup_date, return_date]` per blocking
reservation — sufficient input. **S-02a is entirely client-side.** No migration, no RPC change, no
type regen.

## Model — per-day half-state

For a calendar day `d`, derive two booleans by scanning every busy range `[P, R]`:

```
amTaken(d)  ⟺  ∃ range with P <  d ≤ R     // morning occupied: d is interior or a return day
pmTaken(d)  ⟺  ∃ range with P ≤ d <  R     // afternoon occupied: d is interior or a pickup day
```

Four states:

| State | am / pm | Meaning | Calendar treatment |
|---|---|---|---|
| **free** | free / free | fully bookable | normal |
| **pickupOnly** | taken / free | return day of an existing booking | selectable **as range start only**; morning half-greyed |
| **returnOnly** | free / taken | pickup day of an existing booking | selectable **as range end only**; afternoon half-greyed |
| **blocked** | taken / taken | interior day, or a day shared as return-of-one + pickup-of-another (seed `07-10`) | fully disabled |

## Validity of a new range `[p, r]`

```
1. !pmTaken(p)                                   // start day's afternoon free (new pickup)
2. !amTaken(r)                                   // end day's morning free (new return)
3. ∀ i, p < i < r:  !amTaken(i) && !pmTaken(i)   // every interior day fully free
```

Rule 3 is why this isn't just CSS: `disabled` + `excludeDisabled` only auto-rejects ranges that
*span a fully-disabled day*. A range whose interior contains a **half-day** must be vetoed in
`onSelect`.

## react-day-picker v10 integration (verified against installed 10.0.1)

- **`disabled`**: past days + `blocked` days. Keep `excludeDisabled` on → spanning a blocked day
  still resets selection.
- **`modifiers={{ pickupOnly: Date[], returnOnly: Date[] }}`** + **`modifiersClassNames`** → the
  diagonal half-grey. `CalendarDayButton` (`src/components/ui/calendar.tsx`) already receives
  `modifiers`, so the split renders via a CSS class:
  - `pickupOnly` (morning taken): `linear-gradient(135deg, var(--muted) 0 50%, transparent 50%)`
  - `returnOnly` (afternoon taken): `linear-gradient(135deg, transparent 0 50%, var(--muted) 50%)`
- **`onSelect(next, triggerDate, …)`** (selection is already controlled via `range` state): when a
  full range forms, run the validator; if invalid, reset to `{ from: triggerDate }` (restart from the
  clicked day) and show a Polish inline hint. Mirrors what `excludeDisabled` does for blocked days,
  extended to half-days.

UX wrinkle: range pickers treat the **first click as the start**. A `returnOnly` day is a valid
*end* but not a *start*. Date-order normalization handles the common path (click return day, then an
earlier pickup → from/to swap → valid). The only genuinely-invalid gesture (first-click a
`returnOnly` day then extend forward) is caught by rule 1 at completion. So: validate the completed
range; don't be clever on the first click.

## Where the logic lives (testability — load-bearing)

Extract the transform as a **pure, Vitest-tested** helper (no UI runner in this project, so the
correctness must live in a pure function):

```ts
// src/lib/availability.ts (or new busy-ranges.ts) — reuse existing bookingWindow hours so it
// cannot drift from the EXCLUDE constraint.
type DayAvailability = "free" | "pickupOnly" | "returnOnly" | "blocked";
function dayAvailabilityMap(busy: VehicleBusyRange[]): Map<string /* isoDate */, DayAvailability>;
function isRangeBookable(busy: VehicleBusyRange[], pickup: string, ret: string): boolean;
```

`BookingWidget` consumes it; only the thin RDP wiring is manual-verified.

## Test matrix (Vitest)

1. Single booking `16→20` → `16` pickupOnly, `17-19` blocked, `20` returnOnly.
2. Adjacent bookings sharing a day (`07-01→07-10`, `07-10→07-15`) → `07-10` **blocked**.
3. One-day gap between two bookings → gap day's states from both sides.
4. New range ending on a `pickupOnly` day → rejected (rule 2).
5. New range starting on a `returnOnly` day → rejected (rule 1).
6. Valid back-to-back: new `13→16` where `16` is an existing pickup day → accepted.
7. Range whose interior contains a half-day → rejected (rule 3).
8. Past + busy overlap (past day that's also a return day) → stays disabled.

## Files touched (estimate)

| File | Change |
|---|---|
| `src/lib/availability.ts` (+ `.test.ts`) | pure `dayAvailabilityMap` / `isRangeBookable` + tests |
| `src/components/vehicle/BookingWidget.tsx` | build `disabled`/`modifiers` from the map; `onSelect` veto + Polish hint |
| `src/components/ui/calendar.tsx` *(maybe)* | half-grey gradient classes / `modifiersClassNames` |
| `src/styles/global.css` *(maybe)* | gradient utilities + a legend swatch |
| `src/components/reservation/ReservationForm.tsx` | same wiring if the funnel calendar reuses it |
| design-system note + plan | record S-02a as the resolution of the conservative-greying tradeoff |

No migration, no RPC change, no type regen.

## Risks / call-outs

- **a11y**: half-cells aren't `aria-disabled` (they're selectable), so SR/keyboard users get no native
  signal of the start-only/end-only rule. Needs a visible **legend** + an `aria-label` describing the
  day's state. Biggest non-obvious cost.
- **Mobile** (`mobile-2`): the diagonal split on an `--spacing(8)` cell is hard to perceive/tap —
  verify on a real device; consider a dot/indicator if a pure gradient reads poorly.
- **Alternative considered (cheaper, rejected)**: keep conservative greying, add a tooltip
  "sąsiednie terminy mogą być dostępne — zapytaj." No correctness win, recovers no inventory. Fall
  back to this only if S-02a proves too heavy.
