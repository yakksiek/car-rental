# Changeover-day Half-Availability — Plan Brief

> Full plan: `context/changes/changeover-day-availability/plan.md`
> Design proposal (source): `context/changes/public-reservation-request/follow-ups/review-fixes.md` (S-02a section)
> Origin finding: `context/changes/public-reservation-request/reviews/impl-review-phase-6.md` (F1)

## What & Why

The per-vehicle booking calendar greys each booked range inclusive of both ends, so it refuses back-to-back rentals the database actually permits. The DB rule is a half-open window `[pickup 14:00, return 10:00)`, leaving a booking's two **changeover days** half-free — the pickup day's morning is still a valid new _return_, the return day's afternoon a valid new _pickup_. This slice (roadmap S-02a) renders those days as **half-available** so the UI matches the DB, recovering lost bookable inventory and removing a "guess again" UX.

## Starting Point

S-02 Phase 6 shipped per-vehicle greying via `disabled` matchers that cover `[pickup_date, return_date]` inclusively (`BookingWidget.tsx:90-100`). The pure rule mirror (`src/lib/availability.ts`) and the `get_vehicle_busy_ranges` RPC already exist; the RPC returns exactly the `[pickup_date, return_date]` pairs this slice needs. Vitest is configured with an existing `availability.test.ts`.

## Desired End State

A booked range's pickup day shows a diagonal half-grey and is selectable only as a new return; its return day shows the mirror diagonal and is selectable only as a new pickup; interior days and shared return+pickup days stay fully disabled. A visitor can book a back-to-back range meeting an existing booking on a changeover day; an invalid completed range resets to the clicked day with a Polish hint; a legend + per-day `aria-label`s explain the rule. The `available_vehicles` re-check and `EXCLUDE` constraint remain the authority.

## Key Decisions Made

| Decision                | Choice                                            | Why (1 sentence)                                                                    | Source   |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Where the logic lives   | Pure helper in `src/lib/availability.ts` + Vitest | No UI test runner — correctness must live in a tested pure function                 | Research |
| DB / RPC changes        | None — entirely client-side                       | `get_vehicle_busy_ranges` already returns the needed `[pickup, return]` pairs       | Research |
| Half-cell affordance    | 135° diagonal half-grey gradient                  | Spatially encodes which half (am/pm) is free; matches the proposal                  | Plan     |
| Accessibility           | Visible legend **+** per-day `aria-label` (full)  | Half-cells are selectable (not `aria-disabled`) so SR users need an explicit signal | Plan     |
| Invalid-range recovery  | Reset to the clicked day + inline Polish hint     | Mirrors how `excludeDisabled` already handles blocked days; lets user re-pick       | Plan     |
| Scope of release        | Everything-or-nothing (incl. real-device check)   | No half-finished half-cell UX in production                                         | Plan     |
| Invalid range caught by | `onSelect` veto via `isRangeBookable`, not CSS    | `excludeDisabled` only rejects ranges spanning a _fully_-disabled day               | Research |

## Scope

**In scope:** `BookingWidget` calendar — half-state helper + tests, modifier-driven greying, `onSelect` veto + Polish hint, diagonal half-cell visuals, legend, per-day aria-labels, mobile verification.

**Out of scope:** Migrations / RPC / `types.ts`; catalog calendars (`HeroSearch`, `FilterBar` — already correct); the `/reserve` funnel (no per-vehicle calendar); server pre-check and `EXCLUDE` constraint.

## Architecture / Approach

`busyRanges → dayAvailabilityMap()` (pure) → calendar consumes it three ways: `disabled` (past + `blocked` days), `modifiers={{pickupOnly, returnOnly}}` (the two half-states, rendered via `modifiersClassNames` diagonal gradients), and an `onSelect` veto calling `isRangeBookable()` to reject invalid completed ranges (resetting to the clicked day). The shadcn `CalendarDayButton` already forwards `modifiers`, so the primitive needs no rewrite.

## Phases at a Glance

| Phase                                         | What it delivers                                                | Key risk                                                        |
| --------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Pure helper + Vitest matrix                | `dayAvailabilityMap` / `isRangeBookable` + 8-case tests         | Edge cases (adjacent shared day, one-day gap) — caught by tests |
| 2. BookingWidget selection behavior           | Map-driven `disabled`/`modifiers`, `onSelect` veto + hint, aria | `onSelect` veto must catch interior half-days CSS can't         |
| 3. Half-cell visuals + legend + mobile verify | Diagonal gradients, legend, real-device check                   | Diagonal split illegible/untappable on small mobile cell        |

**Prerequisites:** S-02 Phase 6 (done). Seeded back-to-back bookings (`07-01→07-10` + `07-10→07-15`) present for manual verification.
**Estimated effort:** ~1-2 sessions across 3 phases (logic is small + pre-specified; bulk is UI wiring + a11y + mobile polish).

## Open Risks & Assumptions

- **Mobile perceptibility** — the diagonal on an `--spacing(9)` cell may read poorly; a dot/indicator fallback is the contingency before sign-off (everything-or-nothing means it doesn't ship illegible).
- **a11y wiring** — per-day `aria-label` on a selectable half-cell is the biggest non-obvious cost; assumed achievable via the existing `CalendarDayButton` + `modifiers`.
- **Polish copy** — hint and aria/legend strings to be finalized against design-system Polish-canonical tone at implement time.

## Success Criteria (Summary)

- A visitor can book a back-to-back range meeting an existing booking on a changeover day — the UI no longer refuses what the DB accepts.
- Invalid ranges are rejected client-side (reset + hint), with the `available_vehicles` re-check + `EXCLUDE` constraint still the backstop.
- The half-cell affordance is legible and the rule is conveyed to sighted, keyboard, and screen-reader users alike — verified on a real mobile device.
