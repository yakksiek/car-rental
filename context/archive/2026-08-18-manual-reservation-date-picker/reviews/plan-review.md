<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Availability-Aware Date Picker in the Manual-Reservation Modal (S-12a)

- **Plan**: `context/changes/manual-reservation-date-picker/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-20
- **Verdict**: REVISE → **SOUND** after triage (all 7 findings fixed in the plan)
- **Findings**: 2 critical, 3 warnings, 2 observations

## Verdicts

| Dimension             | Verdict (at review) | After fixes |
| --------------------- | ------------------- | ----------- |
| End-State Alignment   | WARNING             | PASS        |
| Lean Execution        | PASS                | PASS        |
| Architectural Fitness | PASS                | PASS        |
| Blind Spots           | FAIL                | PASS        |
| Plan Completeness     | FAIL                | PASS        |

## Grounding

12/12 paths ✓ · 8/8 symbols ✓ · brief↔plan ✓ · Progress well-formed (5 phases, 35 rows at review;
39 after triage) · `docs/reference/contract-surfaces.md`: 0 of 3 surfaces touched.

Verified clean and not re-flagged: `checkRangeBookable`'s half-open `[14:00, 10:00)` model matches
`available_vehicles` and the `EXCLUDE` constraint byte-for-byte, so the local check is a faithful
replacement; and dropping `available_vehicles`' `is_active` filter is safe because
`create_confirmed_reservation` re-checks it (`20260810140000_reservation_date_order_guard.sql:172`) and
answers 409 `unavailable`, which the modal already handles.

## Findings

### F1 — The new busy-ranges path fails OPEN, not closed

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 + Phase 3 §1 / Critical Implementation Details
- **Detail**: `getVehicleBusyRanges` swallows RPC errors and returns `[]` (`reservations.ts:297-302`). Fed to
  `checkRangeBookable`, an empty list is indistinguishable from a free vehicle → route 200 `{ranges: []}` →
  hook `ready` → green "Termin wolny" with submit ARMED and the calendar greying nothing. Today the same
  failure throws (`reservations.ts:175-177`) → 500 (`api/availability.ts:71-75`) → panel `error` → submit
  disabled. The plan's claim that the safe default is "preserved rather than re-derived" is inverted.
- **Fix A ⭐ Recommended**: route gets its own error branch → 500; hook maps non-OK → `error`.
  - Strength: keeps the public SSR page's deliberate swallow; mirrors `api/availability.ts`'s catch→500 shape.
  - Tradeoff: two read paths over one RPC.
  - Confidence: HIGH — one caller each.
  - Blind spot: None significant.
- **Fix B**: `getVehicleBusyRanges` returns `{ ok, ranges }`; adapt `fleet/[id]/[...slug].astro:33`.
  - Strength: one function; failure visible at every call site.
  - Tradeoff: touches the public path this slice excludes.
  - Confidence: MEDIUM.
  - Blind spot: existing coverage of the `[]`-on-error contract not surveyed (none found).
- **Decision**: FIXED — Fix A + Fix B combined. Service returns `{ ok, ranges }`, the SSR page ignores `.ok`,
  the route 500s when `!ok`, the hook maps non-OK → `error`.

### F2 — Phase 5's vision-diff gate has no targets to diff against

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 (4.10), Phase 5 §2 (5.3)
- **Detail**: `design-review/` is empty; the slice's `design-contract.md` closes on "BLOCKED — awaiting 6
  canonical screenshots", yet the plan body never mentions it, Phase 5 §2 asserts the shots are "captured",
  and roadmap S-12a / `change.md` read "blocker resolved / none" (true of the mock, false of the exports).
- **Fix**: add the export as an explicit gating prerequisite + reconcile the roadmap and `change.md`.
- **Decision**: FIXED — Phase 4 §5 prerequisite, Progress row 4.11 gating 4.10, Phase 5 §2 reworded, roadmap
  and `change.md` corrected. Export list handed to the user (6 boards, 924×540, filenames per the contract).

### F3 — Phase 4 reopens the F11 hole Phase 1 just closed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §2/§3
- **Detail**: `disabled={busy}` on the trigger buttons does not close an open popover, and the footer submit
  sits outside the scrollable body — so submit-then-click-a-day moves `pickup`/`returnDate` mid-POST and
  `DonePanel` (`ManualReservationModal.tsx:262-268`) prints dates never booked. No Phase-4 row re-checks 1.6.
- **Fix**: unmount the popover while `busy`; add a Phase-4 manual row re-running 1.6 on the new surface.
- **Decision**: FIXED — open-field state resets on `busy`; new row 4.12.

### F4 — "Staleness protection is unchanged" is not accurate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 3 §4 / Performance Considerations
- **Detail**: today's GET re-runs on every (vehicle, pickup, return) change (`useManualReservation.ts:72-105`),
  so the verdict is at most one debounce old. Fetching ranges once per vehicle selection judges every later
  edit against a snapshot as old as the phone call — and the calendar paints "free" days from it.
- **Fix A ⭐ Recommended**: re-fetch + re-check inside `submit()` before the POST.
  - Strength: one request restores today's freshness at the only moment it matters; `markConflict` already
    owns the "just taken" copy.
  - Tradeoff: one extra request per create attempt.
  - Confidence: HIGH — reuses paths the plan already builds.
  - Blind spot: None significant.
- **Fix B**: accept the wider window and correct the claim.
  - Strength: zero code; EXCLUDE still prevents a double booking.
  - Tradeoff: more mid-call 409s.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED — Fix A. Hook exposes `refetch()`; `submit()` pre-flights and skips the POST on a
  conflict; new row 3.10; manual testing step 7 and Performance Considerations updated.

### F5 — Gate 3.6 can never pass as written

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Success Criteria / Progress 3.6
- **Detail**: `src/pages/api/reservations/manual.ts:81` comments "…matching the sibling `api/availability.ts`",
  which survives the deletion, so `grep -rn "api/availability" src tests` fails on a comment.
- **Fix**: Phase 3 §4 repoints that comment at `api/vehicles/[id]/busy-ranges.ts`.
- **Decision**: FIXED.

### F6 — Existing `classifyAvailabilityInput` tests aren't accounted for

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §1 / §5
- **Detail**: `src/lib/manual-availability.test.ts:15-38` is a five-case describe block for a function Phase 3
  deletes; §5 only enumerates cases to add, so `astro check` breaks until someone notices.
- **Fix**: state that the block is replaced, its cases carrying over to `resolveAvailability`.
- **Decision**: FIXED.

### F7 — Desktop scrim anchoring is `exact` in the contract, absent from the plan

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §3, criterion 4.6
- **Detail**: the contract marks the scrim's `align-items: flex-start; padding-top: 56` while a field is open
  as `exact`; Phase 4 §3 doesn't list it and 4.6 checks only 390px.
- **Fix**: add the scrim line to Phase 4 §3 and a desktop counterpart criterion.
- **Decision**: FIXED — new row 4.13.
