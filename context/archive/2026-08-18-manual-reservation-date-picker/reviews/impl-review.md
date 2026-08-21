<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Availability-Aware Date Picker in the Manual-Reservation Modal (S-12a)

- **Plan**: `context/changes/manual-reservation-date-picker/plan.md`
- **Scope**: Phases 1–6 of 6 (full plan)
- **Date**: 2026-08-21
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 5 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Success criteria re-verification (2026-08-21)

| Gate                                    | Result                                                                                                                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx astro check`                       | 0 errors, 0 warnings, 5 hints                                                                                                                                                                                                                   |
| `npm run lint`                          | 0 errors, 2 warnings — both pre-existing `react-hooks/incompatible-library` on RHF `watch()` in protocol forms, untouched here                                                                                                                  |
| `npm run build`                         | Complete                                                                                                                                                                                                                                        |
| `npm test`                              | 327/327 across 27 files                                                                                                                                                                                                                         |
| `npm run test:integration`              | 210/211 — reproduces the plan's own 5.1 note. Confirmed environmental: `resolve_link_token` is in **none** of this repo's 25 migrations (sibling worktree on the shared local stack). `manual-reservation-api.test.ts` passes 10/10 standalone. |
| `grep -rn "nextBusyRangeAfter" src`     | no matches (6.5 PASS)                                                                                                                                                                                                                           |
| `grep -rn "api/availability" src tests` | no matches (3.6 PASS)                                                                                                                                                                                                                           |

Manual items: all 47 Progress rows carry substantive driven evidence (measured values, DOM counts, forced-state runs), not rubber-stamps. One coverage gap noted in F2.

## Plan adherence

Zero DRIFT, zero MISSING across all six phases. All eight high-risk contract claims verified literally against the code: the `{ ok, ranges }` reshape with `[...slug].astro` reading `.ranges` and ignoring `.ok`; the 401→403→400→200/500 gating order with verbatim Polish copy and the loose hex-UUID guard; `useVehicleBusyRanges`'s `{ ranges, state, refetch }` shape with AbortError excluded from the error path; `resolveAvailability`'s five-step precedence; the `submit()` pre-flight returning without POSTing on a failed check and falling through on `null`; the F11 freeze as `{pickerOpen && !busy && …}` on both breakpoints; the fully-removed next-free hint with no dead residue; and the single full-width `Termin` trigger.

Documented extras, all justified: `preflighting` (required to satisfy Phase 1 §1's invariant across the pre-flight window), the body-scroll lock (recorded in Progress 6.12), `legend-busy-half` and `showOutsideDays={false}` (both 4.10 vision-diff fixes). `useMediaQuery.ts` is the one unrecorded file — see F5.

## Findings

### F1 — Calendar keyboard navigation is dead

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/dashboard/ManualReservationCalendar.tsx:82,237
- **Detail**: `components={{ DayButton: MrDayCell }}` replaces shadcn's `CalendarDayButton`, but `MrDayCell` drops its focus plumbing — `ui/calendar.tsx:134-141` keeps `useRef` + `useEffect(() => { if (modifiers.focused) ref.current?.focus() })` and passes `ref={ref}`. The only `.focus()` call in all of react-day-picker lives in its default `DayButton`; RDP moves focus by state alone (`setFocused`). With no ref, arrow keys update `modifiers.focused` and `tabIndex` but DOM focus never leaves the first day button, so Enter re-activates the originally-focused day and screen readers announce it. The file's header at :32-34 claims the opposite ("the house pattern … gives keyboard and screen-reader behaviour for free") — `BookingWidget` gets it free precisely because it never overrides `DayButton`, only `labelDayButton`.
- **Fix**: Add the ref + `modifiers.focused` effect to `MrDayCell` verbatim from `CalendarDayButton`, then re-verify arrow-key navigation.
- **Decision**: QUEUED — plan.md Phase 7

### F2 — First click on any day flashes the "return before pickup" error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/ManualReservationCalendar.tsx:196
- **Detail**: `<Calendar mode="range">` is mounted with no `min` prop, so `addToRange` takes its `min = 0` default and the first click returns `{ from: date, to: date }` — a same-day range, not an open one. Verified empirically: `addToRange(d, undefined)` → `{from: d, to: d}`; `addToRange(d, undefined, 1)` → `{from: d, to: undefined}`; `checkRangeBookable([], d, d).ok` → `true` (the veto does not fire). So `onSelect`'s `if (next?.from && next.to)` is true on click one and `onChange(d, d)` pushes `pickup === returnDate` into the modal, where `resolveAvailability` → `validateDateRange` rejects it and the panel goes `invalid` with "Data zwrotu musi być późniejsza niż data odbioru." between the two clicks — trigger reading "3 wrz – 3 wrz 2026", footer "0 dni". That is the "reads as broken rather than empty" state D18 exists to prevent. Manual verification missed it because 6.7 drove the completed range and 4.8 drove the veto; no row drives the single-click state.
- **Fix**: Pass `min={1}` to `<Calendar>` — only `min > 1` gates the second click, so one-day spans are unaffected, and the first click yields `{from, to: undefined}`.
- **Decision**: QUEUED — plan.md Phase 7

### F3 — The calendar paints an all-free month when the busy-ranges read failed

> Queued via **Fix A** (pass `rangesState` into the calendar). Fix B (gating the trigger) was rejected in Phase 7 §3: it makes the common path pay for the rare failure and gives no reason for the dead button.

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/ManualReservationCalendar.tsx:116-125; src/components/dashboard/ManualReservationModal.tsx:487,524
- **Detail**: The calendar's props carry `busyRanges` but no fetch state, and the hook wipes to `setRanges([])` on failure, so `[]` means "no bookings", "still loading" and "read failed" identically. The trigger is `disabled={busy}` only — nothing gates it on `rangesState` — so the picker opens in the error state showing a fully-free month: `disabledDays` holds only the past-day matcher, `dayModifiers` is empty, and the `checkRangeBookable` veto passes everything. The submit gate still holds (panel resolves `error`; `canCreateReservation` only passes `available`), so no double booking is possible; the harm is an employee reading availability off the calendar to a customer. Worst on mobile, where the sheet is `absolute inset-0 z-[70]` and covers the availability panel entirely — the all-free grid is on screen and "Nie udało się sprawdzić dostępności." is hidden behind it.
- **Fix A ⭐ Recommended**: Pass `rangesState` into the calendar and render a loading/error treatment over the grid.
  - Strength: Fixes the ambiguity where it lives; the picker becomes self-describing on both breakpoints, including the mobile sheet where the panel is not visible at all.
  - Tradeoff: New prop plus a small undrawn UI state — the design source has no board for it, so it needs a `deviation(undrawn-state)` line like D18.
  - Confidence: HIGH — the hook already exposes `state` and the modal already destructures it at :237 for the panel.
  - Blind spot: Treatment not chosen (disable the grid vs. an inline message); the source gives no precedent.
- **Fix B**: Gate the trigger — `disabled={busy || rangesState !== "ready"}`.
  - Strength: One line; no new UI state and no contract change.
  - Tradeoff: Blocks the picker during every normal load, so the common path pays for the rare failure; the button also goes dead with no explanation.
  - Confidence: MEDIUM — correct, but trades a wrong-information bug for a happy-path responsiveness regression.
  - Blind spot: Typical fetch latency unmeasured, so the perceptibility of the disabled flash is unknown.
- **Decision**: QUEUED — plan.md Phase 7

### F4 — The effect commits its response without an identity guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useVehicleBusyRanges.ts:78-91
- **Detail**: The effect's `.then` commits unconditionally (`setRanges(fresh); setState("ready")`) while `refetch` guards the identical commit with `if (currentId.current === vehicleId)` (:104, :110). The AbortController cannot close the gap: on a switch A→B the render-phase reset (:57-61) commits synchronously, but `controller.abort()` only fires when React flushes passive effects, in a later task. A response for A landing in that window is neither aborted nor filtered, so it paints A's busy days and resolves the panel under B's name until B's fetch lands; symmetrically a failure for A can commit `state: "error"` against B. Narrow and self-healing, but it contradicts the hook's own comment at :54-55 ("the calendar must never paint another vehicle's busy days").
- **Fix**: Assign `currentId.current = vehicleId` in the render-phase reset block (:57-61) rather than the effect body, and guard both `.then` and `.catch` with the same check `refetch` already uses.
- **Decision**: QUEUED — plan.md Phase 7

### F5 — Unplanned `useMediaQuery.ts` appears in no Changes Required

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/hooks/useMediaQuery.ts (new, 33 lines)
- **Detail**: Phase 6 §3 lists only `ManualReservationCalendar.tsx` and `ManualReservationModal.tsx`. The hook is technically necessary — the picker needs two different tree positions (in flow vs. a sibling layer), which Tailwind variants can't express without mounting two live copies of an interactive widget — and it is SSR-safe (`useSyncExternalStore` with a `() => false` server snapshot; the modal only mounts on click, never during SSR). It is the one code file the plan never names; sibling extras were all recorded (body-scroll lock in 6.12, `legend-busy-half` and `showOutsideDays={false}` in 4.10).
- **Fix**: Add it to Phase 6 §3's file list so the plan stays accurate for future reviews.
- **Decision**: QUEUED — plan.md Phase 7

### F6 — The pre-flight re-read is cacheable

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useVehicleBusyRanges.ts:40; src/pages/api/vehicles/[id]/busy-ranges.ts:36
- **Detail**: `fetch()` sets no `cache` option and the route's `json()` helper emits only `Content-Type`. Plan §3.4 justifies `refetch` as the thing that keeps "the answer that actually gates the write re-read at the moment of the write" — a cached response would silently defeat exactly that.
- **Fix**: Pass `{ cache: "no-store" }` on the pre-flight read, or add `Cache-Control: no-store` to the route's headers.
- **Decision**: QUEUED — plan.md Phase 7

### F7 — A failed pre-flight strands the vehicle in `error` with no retry

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useVehicleBusyRanges.ts:109-115
- **Detail**: `refetch`'s catch runs `setRanges([]); setState("error")` and returns `null`, and `submit()` correctly falls through to the POST. But if the POST also fails, the surface sits permanently in `error` for that vehicle — the effect is keyed on `vehicleId`, so the only recovery is switching vehicle and back.
- **Fix**: Preserve the previously-fetched ranges on refetch failure, and/or add a retry action to `MrAvailability`'s error branch (:117-126).
- **Decision**: QUEUED — plan.md Phase 7

### F8 — Two design-contract divergences

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/dashboard/ManualReservationCalendar.tsx:100,248
- **Detail**: ~40 `exact` contract values transcribe correctly (trigger geometry, tail, caption, weekday row, cell radii, legend, footer, mobile sheet, `max-h-[94%]`, the conflict submit background, both busy tokens and the 1.2px divider band). Two exceptions: (a) :100 puts `opacity-75` on the `<button>`, fading the `--flota-busy` fill along with the label, where the contract (309-311, `exact`) scopes it to the label only — composited over white the fill renders ≈`#E1E5EA` rather than `#D7DCE3`; (b) :248 `gap-1.5` on the month-nav row is a magic value with no basis in the contract (278-285 specifies the 26×26 buttons, radius 8, hairline and 13px chevron, but no gap).
- **Fix**: Move the opacity to the label (`text-muted-foreground/75`), and transcribe the nav gap from the source or record it as `deviation(undrawn-value)`.
- **Decision**: QUEUED — plan.md Phase 7

### F9 — Stale references in shipped comments and the S-12 contract

- **Severity**: 📋 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/hooks/useVehicleBusyRanges.ts:53; context/changes/manual-reservation/design-contract.md
- **Detail**: (a) The hook cites "React's documented pattern, as `useAvailability` uses it" — but `useAvailability` was deleted by this same slice in Phase 3 §3, so the comment points at code that no longer exists. (b) The S-12 contract's available-state bullet still quotes "Pojazd wolny do {d MMM}" / "Brak innych rezerwacji w tym okresie.", copy Phase 6 §1 retired; it defers to the S-12a contract's D10 so a reader lands correctly, but the line itself is stale. Phase 6 §4 only mandated the busy-guard de-pluralization for that file, so this is outside the literal contract.
- **Fix**: Repoint the comment at the pattern (or `useVehicleBusyRanges` itself) and strike the retired copy from the S-12 bullet.
- **Decision**: QUEUED — plan.md Phase 7
