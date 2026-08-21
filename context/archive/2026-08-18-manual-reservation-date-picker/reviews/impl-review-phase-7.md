<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Availability-Aware Date Picker in the Manual-Reservation Modal (S-12a)

- **Plan**: `context/changes/manual-reservation-date-picker/plan.md`
- **Scope**: Phase 7 of 7 (implementation-review findings F1–F9)
- **Date**: 2026-08-21
- **Verdict**: NEEDS ATTENTION → all findings triaged and fixed
- **Findings**: 0 critical, 2 warnings, 4 observations

> **Reviewer caveat.** This review was performed by the same session that wrote the Phase 7 code, so it
> carries self-review bias; sub-agents were not used, per a standing session instruction. F1 is the finding
> most worth an independent challenge — the same author wrote both sides of the conflict it describes.

## Verdicts

| Dimension           | Verdict | Note                                                      |
| ------------------- | ------- | --------------------------------------------------------- |
| Plan Adherence      | WARNING | F2 — plan text described two superseded mechanisms        |
| Scope Discipline    | PASS    | every change traces to one of F1–F9                       |
| Safety & Quality    | WARNING | F1, F4                                                    |
| Architecture        | PASS    | the stamped-data derivation is sound                      |
| Pattern Consistency | WARNING | F3, F6                                                    |
| Success Criteria    | WARNING | automated all green; 10 manual rows pending, 7.12 not run |

## Success criteria re-verification (2026-08-21)

| Gate              | Result                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| `npx astro check` | 0 errors, 0 warnings, 5 hints                                            |
| `npm run lint`    | 0 errors, 2 warnings — both pre-existing RHF `watch()` in protocol forms |
| `npm run build`   | Complete                                                                 |
| `npm test`        | 327/327 across 27 files                                                  |

Independently verified beyond the plan's own claims:

- **F2's `min={1}`** checked against `node_modules/react-day-picker/dist/cjs/utils/addToRange.js`: the empty
  branch is `{ from: date, to: min > 0 ? undefined : date }`, and the reset branch is `min > 1 && diff < min`
  — so the first click opens the range and one-day spans are genuinely unaffected.
- **Phase 1's busy freeze** still intact at `ManualReservationModal.tsx:408,538,668`.

Manual rows 7.5–7.14 remain `- [ ]` pending user confirmation. Driven evidence exists for 7.5–7.11;
**7.12 (vision-diff against the six boards) has not been run**, and F1's fix adds a fourth grid state to diff.

## Findings

### F1 — F3's inert grid cancelled out F7's carried-over ranges

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/components/dashboard/ManualReservationCalendar.tsx` (`gridUsable`) ·
  `src/components/hooks/useVehicleBusyRanges.ts:128-138`
- **Detail**: Two fixes in the same phase pulled against each other. F7 makes a failed re-read KEEP the
  previous good ranges, justified as "does not blank the grid the employee is reading from", with "the error
  state already disarms submit, which is what keeps this safe" — i.e. only submit was meant to be disarmed.
  F3 then mapped `rangesState === "error"` to an inert, 50%-opacity grid. Driven (good read, then a failed
  submit pre-flight): healthy `busyCells=3, inert=false`; after the failed re-read `busyCells=3, inert=true,
pointer=blocked`. The preserved availability was drawn but not operable.
- **Fix A ⭐ Recommended**: split the two failures —
  `gridUsable = rangesState === "ready" || (rangesState === "error" && busyRanges.length > 0)`.
  - Strength: restores exactly what F7 argued for; a failed INITIAL read (no ranges) still freezes, which is
    the case F3 was actually about.
  - Tradeoff: the employee may pick dates off a possibly-stale snapshot — submit stays disarmed via
    `canCreateReservation`, and the retry sits directly above.
  - Confidence: HIGH — both states already derived; one predicate.
  - Blind spot: adds a fourth grid state to the 7.12 vision-diff.
- **Fix B**: keep as shipped; amend D19 + §6 to state that error always means non-interactive.
- **Decision**: FIXED via Fix A. Re-driven: carried ranges now `inert=false, pointer=hit-testable`, while the
  failed-initial-read path still reports `gridInert=true`.

### F2 — Phase 7's plan text still described two superseded mechanisms

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `plan.md` Phase 7 §4 and §6
- **Detail**: §4 prescribed `currentId.current = vehicleId` in the render-phase reset — a `react-hooks/refs`
  ESLint **error**, so unimplementable under success criterion 7.2. §6 placed the retry only in
  `MrAvailability`'s error branch, which is unreachable while the grid is inert. Both replacements were
  recorded in the commit body and D19, but not in the plan, so a future reviewer reading Phase 7 straight
  would re-flag both as drift.
- **Fix**: add addenda to §4 and §6 recording the shipped mechanism and why it replaced the planned one.
- **Decision**: FIXED — both addenda added, including F1's follow-on split.

### F3 — Two Polish strings duplicated across COPY maps

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `ManualReservationModal.tsx` · `ManualReservationCalendar.tsx`
- **Detail**: "Nie udało się sprawdzić dostępności." and "Spróbuj ponownie" existed in both files. D19
  requires them identical but nothing enforced it, and the design system treats Polish copy as canonical. The
  in-code justification cited `formatDayShort` as precedent — that is a pure function, not user-facing copy.
- **Fix**: export both from one module and import in both.
- **Decision**: FIXED — hoisted to `AVAILABILITY_COPY` in `src/lib/manual-availability.ts`, which both
  components already import from (zero new coupling; `src/lib/format.ts` already carries Polish copy). Zero
  literals remain in either component.

### F4 — F6 protected the caller only; the route sent no cache header

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/vehicles/[id]/busy-ranges.ts`
- **Detail**: `cache: "no-store"` on the fetch binds only that caller; the route emitted just `Content-Type`,
  leaving any future caller or intermediary unprotected. The original finding offered either fix, and the
  plan's Files line named the route, which had gone untouched.
- **Fix**: add `Cache-Control: no-store` to the route's `json()` helper.
- **Decision**: FIXED — verified live: `cache-control: no-store` on the response.

### F5 — Dropping the render-phase reset changed A→B→A behaviour

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/components/hooks/useVehicleBusyRanges.ts` (derivation block)
- **Detail**: the reset used to clear to `[]` + loading on every vehicle change. With it gone, switching away
  and back re-shows the cached answer immediately as `ready`, with no loading beat. Safe — it is the right
  vehicle's data, and `submit()` re-reads via `refetch` before POSTing — but an unrecorded change to
  behaviour Phase 3 documented deliberately.
- **Fix**: record the intentional cache-on-return in the hook comment.
- **Decision**: FIXED.

### F6 — The hook's fail-closed header no longer covered the carry-over

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/hooks/useVehicleBusyRanges.ts` (header)
- **Detail**: "A non-OK response … resolves to `error` and never to empty ranges" predated F7, which added a
  third outcome: a failed RE-read keeps the previous ranges. Still fail-closed, but the paragraph no longer
  described the file — the same staleness class F9 was cleaning out of this very file.
- **Fix**: extend the paragraph to name the refetch case.
- **Decision**: FIXED — now distinguishes the failed first read from the failed re-read.
