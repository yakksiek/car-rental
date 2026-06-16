---
change_id: changeover-day-availability
title: Changeover-day half-availability on the per-vehicle booking calendar
status: implementing
created: 2026-06-16
updated: 2026-06-16
archived_at: null
---

## Notes

Source: roadmap slice **S-02a** (`context/foundation/roadmap.md`), promoted from parked FR-014.

Refines S-02 Phase 6 (per-vehicle booking calendar greys booked dates, conservatively greying *both* changeover days). Goal: show a booked range's changeover days as **half-available** instead of fully greyed — the booking's pickup day stays selectable as a new **return**, its return day stays selectable as a new **pickup** — so back-to-back rentals (return 10:00, next pickup 14:00) can be booked from the UI, matching what the half-open `EXCLUDE` window already permits.

Prereqs: S-02 (done). PRD ref: FR-014 (refinement). Parallel with S-03, S-04, S-07, S-08.

Open unknown (design point, non-blocking): react-day-picker can't natively mark a day "valid only as range end" — selection rides a custom `onSelect` veto + custom modifiers; the half-grey cell needs a legend and keyboard/SR semantics.

Roadmap-suggested mitigation: extract the per-day half-state computation (`busyRanges → dayStates`) as a pure, Vitest-tested helper — that's where the edge cases live (adjacent bookings sharing a day, single-day gaps). Win: calendar then matches `available_vehicles` + the `EXCLUDE` constraint exactly, closing the calendar↔catalog asymmetry from the S-02 Phase-6 review.
