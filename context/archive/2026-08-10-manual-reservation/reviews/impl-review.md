<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Manual reservation (staff-created confirmed booking)

- **Plan**: `context/changes/manual-reservation/plan.md`
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-08-10
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 7 warnings, 3 observations
- **Triage**: all 10 accepted; fixes queued as plan Phases 5–8 (per the "record improvements as plan phases, batch-run /10x-implement" preference)

## Automated criteria — verified at review time

| Check                      | Result                                                                |
| -------------------------- | --------------------------------------------------------------------- |
| `npx astro check`          | PASS — 0 errors, 0 warnings, 5 hints (244 files)                      |
| `npm run lint`             | PASS — 0 errors (2 pre-existing warnings in `ReturnProtocolForm.tsx`) |
| `npm run build`            | PASS                                                                  |
| `npm run test:integration` | PASS — 20 files, 209 tests                                            |
| unit (`npm test`)          | PASS — 319 tests                                                      |

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

**Verified clean:** revoke-before-grant issued on `create_confirmed_reservation` (migration `:149-152`) _and_ re-issued on the dropped-and-recreated `list_reservations_for_calendar` (`:199-200`) — the trap the plan flagged, now covered by `rpc-execute-grants.test.ts:63-83`. SECURITY DEFINER hygiene (`search_path=''`, schema-qualified body, in-function `current_app_role()` gate), self-gate order on both new routes, `exclusion_violation`/`unique_violation` split, availability-fetch race (AbortController + render-phase reset), email boundary (cannot throw), additive migration. 17 of 18 planned items MATCH; all "What We're NOT Doing" guardrails respected.

## Design-source verification

Mid-review the canonical source `manual-reservation.jsx` was pulled from the Claude Design project `352d78a6-84fd-49a2-8b38-2fe289691fc3`. It **confirmed F2 and F5 and reversed F4**, and dissolved four other suspected magic values — the modal is a more faithful port than the contract is a record of it.

| Element                       | Design source (exact)                                                 | Shipped                                | Verdict                                     |
| ----------------------------- | --------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------- |
| `mrBtnPrimary` / `mrBtnGhost` | `borderRadius: 12`, `height: 46`                                      | `rounded-xl` = 20px                    | ❌ F2 confirmed                             |
| Chevron affordance            | `{ width: 30, height: 30, borderRadius: 8 }`                          | `rounded-lg` = 16px                    | ❌ F2 confirmed                             |
| Mobile sheet top radius       | `borderTopLeft/RightRadius: 26`                                       | `rounded-t-[26px]`                     | ✅ exact — the contract's 28px is wrong     |
| Mobile drag handle            | **none on this modal** (it's on the quick-action sheet, out of scope) | none                                   | ✅ exact — the contract invented it         |
| Invalid-range copy            | `"Data zwrotu jest wcześniejsza niż odbiór."`                         | `validateDateRange`'s string           | ❌ F5 confirmed (with a real justification) |
| Same-day range                | **valid** in the source (`ret < pick` → invalid)                      | rejected                               | our behaviour is correct — see F5/F9        |
| `mrFieldCap` / footer label   | `letterSpacing: 0.3`                                                  | `tracking-[0.3px]`                     | ✅ exact                                    |
| Ręczna badge — done / header  | `10` / `9.5`                                                          | `text-[10px]` / `text-[9.5px]`         | ✅ exact                                    |
| Done panel radius             | `22` mobile / `20` desktop                                            | `rounded-[22px]` / `md:rounded-[20px]` | ✅ exact                                    |
| Desktop shell                 | `width: 560`, `borderRadius: 20`                                      | `md:w-[560px]` / `md:rounded-[20px]`   | ✅ exact                                    |

## Findings

### F1 — A 409 conflict leaves the panel green and the button armed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/ManualReservationModal.tsx:236-239
- **Detail**: `useAvailability` derives only from (vehicle, pickup, return), so a 409 from the POST never touches `resolved`. After a lost race the modal renders the green "Termin wolny · Można utworzyć rezerwację." panel AND the red "Termin został właśnie zajęty." banner simultaneously, and `canCreate` (:224) stays true — the employee can resubmit and get an identical 409.
- **Fix**: Have `useAvailability` expose a `markConflict()` that forces `resolved` to `{state:"conflict"}`; call it from the `conflict` and `unavailable` branches of `submit()`.
  - Strength: Single source of truth for the panel; the button auto-disables via the existing `canCreate` path.
  - Tradeoff: Adds a setter to a hook written so the effect does nothing but fetch.
  - Confidence: HIGH — verified by reading the state flow end to end.
  - Blind spot: None significant.
- **Decision**: ACCEPTED — queued as plan **Phase 5 §1**

### F2 — `rounded-xl` is 20px in this project, not the source's 12px

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/dashboard/ManualReservationModal.tsx:450, :177, :184, :312
- **Detail**: `global.css:71` sets `--flota-radius-xl: 20px` and `:162` maps `--radius-xl` to it, so `rounded-xl` renders 20px — not Tailwind's stock 12px. The design source has `mrBtnPrimary = { height: 46, borderRadius: 12, … }` and `mrBtnGhost = { height: 46, borderRadius: 12, … }`, and the chevron span is `{ width: 30, height: 30, borderRadius: 8 }`; the contract (`:138`, `:114`) transcribed both correctly. Three buttons and the chevron each ship 8px too round.
- **Fix**: `rounded-xl` → `rounded-md` (12px) at :450/:177/:184; `rounded-lg` → `rounded-sm` (8px) at :312.
- **Decision**: ACCEPTED — queued as plan **Phase 5 §2**

### F3 — Native `<select>` ships where the contract records `ui/select.tsx`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/dashboard/ManualReservationModal.tsx:315-331
- **Detail**: `design-contract.md:114` states "Select via `ui/select.tsx` (replaces the mockup's native `<select>` overlay)" — an `exact` line the plan repeats. The code ships the transparent native `<select>` overlay and its comment argues the opposite rationale. The design source confirms the overlay is the mockup's own affordance (`position:absolute; inset:0; opacity:0`, `aria-label="Pojazd"`, the whole card as hit target). The code contradicts a recorded contract line rather than deviating on the record.
- **Fix A ⭐ Recommended**: Amend the contract line to `deviation(native-select: exact styling + native a11y/mobile picker)`.
  - Strength: The shipped control is better on mobile and keyboard/SR-accessible for free; keeps working code.
  - Tradeoff: Reverses a design-audit decision; the vision-diff baseline shifts.
  - Confidence: MED — the a11y argument is sound, but the contract line was deliberate.
  - Blind spot: Whether `ui/select.tsx` was chosen for a house-consistency reason recorded elsewhere.
- **Fix B**: Swap in the shadcn `Select`.
  - Strength: Honors the contract as written; matches other surfaces.
  - Tradeoff: Loses the native mobile picker; needs restyling to hit the card-with-chevron geometry.
  - Confidence: MED — restyle cost is real but bounded.
  - Blind spot: Haven't checked how `ui/select.tsx` is styled elsewhere.
- **Decision**: ACCEPTED via **Fix A** — queued as plan **Phase 7 §1**

### F4 (REVISED — reversed by the design-source pull) — the contract is wrong, not the code

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/manual-reservation/design-contract.md:90 (D6), :98
- **Detail**: Originally raised as a code defect (missing drag handle, `rounded-t-[26px]` vs a recorded 28px). The design source settles it the other way: the modal shell is `borderTopLeftRadius: 26, borderTopRightRadius: 26` and has **no drag handle** — its children are header → scroll body → footer. The only drag handle in the file belongs to the quick-action bottom sheet (`{ width: 40, height: 4, borderRadius: 99 }`), which this slice explicitly does not build. The shipped modal is an exact port; contract D6's "reuse `rounded-t-[28px]` sheet with drag-handle" describes a surface that does not exist.
- **Fix**: Correct `design-contract.md` — D6 drops the drag-handle clause and records the mobile top radius as **exact 26px** rather than a reuse-28px deviation. No code change.
- **Decision**: ACCEPTED — queued as plan **Phase 7 §1**

### F5 (REVISED) — invalid-range copy diverges, and the divergence is justified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/dashboard/ManualReservationModal.tsx:101 (also :48, :55-57)
- **Detail**: The contract (`:127`, verbatim list at `:167`) and the design source agree on "Data zwrotu jest wcześniejsza niż odbiór."; the code renders `validateDateRange`'s "Data zwrotu musi być późniejsza niż data odbioru." The source pull found why that matters: the mockup's guard is `new Date(ret) < new Date(pick)`, so a **same-day** range is valid there — while our stack rejects it (`catalog-filters.ts:135-136`), correctly, because `tsrange(pickup+14:00, return+10:00)` inverts on same-day (see F9). For `ret == pick` the contract's wording is literally false and the shipped wording is right. Separately, four strings at `:48` and `:55-57` (`avError` + three create-failure banners) cover states the contract never defined.
- **Fix**: Keep the code; record in the contract as `deviation(same-day-rejected: copy must cover ret == pick)` and add the four missing states/strings to the copy list.
- **Decision**: ACCEPTED — queued as plan **Phase 7 §1**

### F6 — Scrim and X close the modal mid-create, orphaning the booking

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/ManualReservationModal.tsx:263, :286
- **Detail**: Both `onClick={onClose}` handlers ignore `busy`. Clicking the scrim or X mid-POST unmounts the modal, but the request still completes: a confirmed booking is created and the customer emailed, while the employee never sees the reference — and may re-enter it, hitting a 409. The submit button itself is correctly guarded (`disabled={!canCreate || busy}` :447).
- **Fix**: `onClick={busy ? undefined : onClose}` on both, plus `disabled={busy}` on the X.
- **Decision**: ACCEPTED — queued as plan **Phase 5 §3**

### F7 — Plan closed out with all 9 manual gates — both vision-diffs — unrun

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/manual-reservation/plan.md (Progress)
- **Detail**: Commit `757d2aa` ("close out plan (epilogue)") checks every automated box, but 1.5, 2.5, 3.4–3.8, 4.4 and 4.5 are still `[ ]` — including 3.8, the rendered vision-diff gate the "Port the design spec … with a vision-diff gate" lesson makes load-bearing. F2 is exactly what that diff would have surfaced, and the 10 canonical PNGs are already in `design-review/` (mirrored at `exports/manual-reservation/` in the Design project), so it is runnable today. `change.md:4` also still read `status: implementing`.
- **Fix**: Run the manual passes and the 3.8 vision-diff after the Phase 5 and Phase 7 corrections land, then check the boxes.
  - Strength: Restores the gate the lesson exists to enforce; assets already in the repo.
  - Tradeoff: A real session of manual work before this ships.
  - Confidence: HIGH — checkbox state and commit history are unambiguous.
  - Blind spot: The manual steps may have been done informally and simply not recorded.
- **Decision**: ACCEPTED — queued as plan **Phase 8**

### F8 — Customer access_token returned to a client that never reads it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/reservations/manual.ts:89
- **Detail**: The 201 body carries `token`, the customer's secret `/r/<token>` credential, but nothing consumes it — `useManualReservation.ts:124-127` reads only `reference`, and `DonePanel` links to `/dashboard/calendar`. Copied from public `POST /api/reservations`, which genuinely needs it for its redirect.
- **Fix**: Drop `token` from the response and from the assertion at `tests/integration/manual-reservation-api.test.ts:100`.
- **Decision**: ACCEPTED — queued as plan **Phase 6 §1**

### F9 — RPC has no date-order guard; a same-day range raises instead of returning a typed tag

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260810120000_manual_reservation.sql:104-142
- **Detail**: `reserved_period` is `tsrange(pickup+14:00, return+10:00)` and `reservations_dates_ordered` only checks `return_date >= pickup_date` (`20260603155136:104-109`), so a same-day range makes lower > upper → `data_exception`, caught by neither exception arm. Unreachable via the endpoint (`catalog-filters.ts:135-136` requires start < end) but reachable by any employee calling the RPC through PostgREST. The pre-existing `create_reservation_request` has the identical gap and is **anon-reachable**. The design source treats same-day as valid, so it is a shape users will try.
- **Fix**: Early `if p_return <= p_pickup then return query select 'unavailable'::text, …` in **both** RPCs, via `create or replace` (which preserves privileges — a drop+create would re-open the PUBLIC execute grant).
- **Decision**: ACCEPTED, extended to **both RPCs** — queued as plan **Phase 6 §3**

### F10 — Two new routes disagree on RPC-error handling

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/reservations/manual.ts:77
- **Detail**: No try/catch around `createConfirmedReservation`, which throws on RPC error (`reservations.ts:110-112`) — e.g. the migration's deliberate `raise` after 3 `unique_violation` retries. That yields Astro's 500 HTML where the island expects JSON (it degrades to a generic banner, so nothing crashes). Matches the house pattern in `[id].ts:137` — but the sibling new route `availability.ts:63-75` _does_ wrap its throwing call, so the two files from the same phase are inconsistent.
- **Fix**: Wrap in try/catch → `json(500, { error: MSG.serverError })`, matching `availability.ts`.
- **Decision**: ACCEPTED — queued as plan **Phase 6 §2**

## Noted, not counted as findings

- The `reservations` table still carries default INSERT/UPDATE grants plus `with check (true)` policies (`20260603155136:159-174`) — pre-existing and tracked as deferred to test-plan Phase 2. Consequence for S-12: `source` is not tamper-proof; don't treat it as audit-grade downstream.
- The Ręczna chip guards on `source === "manual"` alone rather than `confirmed && manual` (identical in practice today — the only writer hardcodes `confirmed`).
- No integration test asserts the recreated calendar RPC actually _returns_ `source`; a regression dropping it would surface only as an `astro check` failure.
- `src/lib/calendar/map.ts` was planned for Phase 4 but correctly left untouched: `ReservationCalendar.tsx:298` resolves the clicked event back to the full row, so extendedProps would be dead data.
- `src/lib/manual-availability.ts` (+9 unit tests) and the `reservation-schema.ts` DRY refactor into shared `bookingFields`/`refineDateRange` are unplanned but sanctioned/sound extras.
