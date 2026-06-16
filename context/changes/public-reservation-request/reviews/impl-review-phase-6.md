<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Public Reservation Request (S-02) — Phase 6

- **Plan**: context/changes/public-reservation-request/plan.md
- **Scope**: Phase 6 of 6 (Availability Transparency — grey out unavailable dates)
- **Date**: 2026-06-16
- **Verdict**: NEEDS ATTENTION → all findings triaged (2 fixed, 1 fixed-as-followup-tracked)
- **Findings**: 0 critical, 2 warnings, 1 observation
- **Commit reviewed**: 2b6703d

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (F1 — documented divergence from "match EXCLUDE window exactly") |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (F2 reliability, F3 performance) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (db reset, gen types, astro check, lint, build, test all green) |

## Findings

### F1 — Inclusive greying is stricter than the EXCLUDE window the plan said to match

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/vehicle/BookingWidget.tsx:84-99
- **Detail**: The calendar greys each busy range inclusive of both bounds (`{from: pickup_date, to: return_date}`). The EXCLUDE window is half-open `[pickup 14:00, return 10:00)`, which permits back-to-back rentals sharing a changeover day (seed proves it: confirmed 2026-07-01→07-10 AND 07-10→07-15). Inclusive greying over-blocks those changeover days, so the calendar is stricter than `available_vehicles` — contradicting the plan's "greyed cells match the EXCLUDE window exactly" wording. Defensible product call (a whole-day cell can't express a half-day changeover), but it diverged silently.
- **Decision**: FIXED via Fix A + roadmap capture. Plan Phase-6 note amended to record the conscious stricter-at-changeover choice and its tradeoff. The half-available-changeover refinement promoted to roadmap slice **S-02a** (`changeover-day-availability`, after S-02) + Backlog Handoff row; Parked FR-014 line updated. Algorithm + tradeoffs captured in follow-ups/review-fixes.md.

### F2 — Busy-ranges RPC error 500s the whole vehicle-detail page for an advisory feature

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/lib/services/reservations.ts:129-143 + src/pages/fleet/[id]/[...slug].astro:33
- **Detail**: `getVehicleBusyRanges` degraded to `[]` only for a null client / malformed id; on an RPC error it threw, and the page call site has no try/catch — so a transient busy-ranges failure 500s the entire detail page (also funnel step 1), blocking all bookings for that vehicle. Greying is explicitly "UX sugar … EXCLUDE constraint remains the backstop," so its failure should not be fatal.
- **Decision**: FIXED via Fix now. Service now logs (matching the codebase `// eslint-disable-next-line no-console` + `[context]` convention) and returns `[]` on RPC error; the page renders, the constraint stays the backstop.

### F3 — Busy-ranges RPC returns all-time rows (no date floor)

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Performance)
- **Location**: supabase/migrations/20260613170000_vehicle_busy_ranges.sql:36-40
- **Detail**: The RPC filtered by vehicle_id + status but had no date floor, returning every pending/confirmed reservation for all time and serializing them into the SSR HTML on every load. Past ranges are harmless (calendar disables past dates) but the payload grows unbounded with history.
- **Decision**: FIXED via Fix now. New migration `20260616120000_vehicle_busy_ranges_date_floor.sql` (`create or replace`, grants persist) adds `and r.return_date >= current_date`. Verified: db reset clean, gen types in sync (signature unchanged).
