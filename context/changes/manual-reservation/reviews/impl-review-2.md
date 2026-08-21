<!-- IMPL-REVIEW-REPORT -->

# Implementation Review 2: Manual reservation — Phases 5–8

- **Plan**: `context/changes/manual-reservation/plan.md`
- **Scope**: Phases 5–8 (the fix set produced by `impl-review.md`), commits `aa98711`…`864c60f`
- **Date**: 2026-08-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations
- **Triage**: both accepted and reproduced against the running app; fixes queued as plan **Phase 9** (per the "record improvements as plan phases, batch-run /10x-implement" preference)

## Automated criteria — verified at review time

| Check             | Result                                                        |
| ----------------- | ------------------------------------------------------------- |
| `npx astro check` | 0 errors, 0 warnings, 5 hints                                 |
| `npm run lint`    | 0 errors, 2 warnings (pre-existing, `ReturnProtocolForm.tsx`) |
| `npm test` (unit) | 321 passed / 27 files                                         |

## Verified clean

- **F9 migration faithfulness.** Both function bodies in `20260810140000_reservation_date_order_guard.sql` were extracted and diffed against their originals (`20260810120000_manual_reservation.sql`, `20260613090000_reservation_b2b_fields.sql`). The only deltas are `create` → `create or replace`, the guard block, and one reflowed comment. No silent body drift.
- **ACLs survived the replace.** Live `pg_proc.proacl`: `create_confirmed_reservation` = `{postgres, authenticated, service_role}` — no PUBLIC entry. `create_reservation_request` = `{PUBLIC, postgres, anon, authenticated, service_role}`; its PUBLIC grant is pre-existing and deliberate (`20260714120000_rpc_execute_grant_hardening.sql` lists it under "DELIBERATELY UNTOUCHED"), not something the replace re-opened. Both functions carry the guard in the live DB.
- **Phase 7 contract corrections match the shipped code**, not just themselves: D8 native-`<select>`, D6 `rounded-t-[26px]` with no drag handle, D9 same-day copy plus the four undrawn states, and every "confirmed-exact" line — `tracking-[0.3px]` (`:360`, `:378`, `:451`), badge `10` (`:169`) / `9.5` (`:293`), done panel `rounded-[22px]` / `md:rounded-[20px]` (`:159`), shell `md:w-[560px]` / `md:rounded-[20px]` (`:284`).

## Findings

### F11 — The form stays editable while the create is in flight

- **Dimension**: Correctness
- **Location**: src/components/dashboard/ManualReservationModal.tsx:334, :364, :382, :406, :416, :426
- **Detail**: Phase 5's F6 fix disarmed the submit button (`:463`), the scrim (`:278`) and the X (`:301-302`) on `busy`, but stopped there. The vehicle `<select>` and all five text/date inputs stay live for the whole POST. Both the done panel and `markConflict()` read _current_ state rather than the state that was submitted, so a mid-flight edit lands in the wrong place. The window is not microscopic: the endpoint awaits the confirmation e-mail (`api/reservations/manual.ts:102`) before answering, which in production is a Resend round trip.

  **A — the done panel prints dates that were never booked** (reproduced 2026-08-18 against the app on :4330, with the manual-create response held 8s via a console `fetch` wrapper):
  1. An employee fills the modal for a vehicle, `2026-09-01` → `2026-09-05`; panel goes **Termin wolny**.
  2. They click **Utwórz rezerwację**; `submit()` (`:236`) POSTs the payload built at `:220-227`.
  3. Mid-flight they correct **Zwrot** to `2026-09-06` (`:382`).
  4. The 201 lands; `setCreated(...)` (`:240`) renders `DonePanel` with `pickup={pickup} returnDate={returnDate}` (`:265-266`) — current state — so the confirmation reads **1–6 wrz**.
  5. The row and the customer's e-mail say **1–5 wrz**. Nothing on screen contradicts the wrong dates. The same applies to `customerName` (`:263`).

  **B — the F1 symptom returns**: with the POST in flight the employee edits **Odbiór**; the render-phase reset (`useManualReservation.ts:67-70`) clears `resolved` and schedules a debounced GET. The 409 arrives, `markConflict()` (`:247`) pins **Termin zajęty** onto a range nobody checked; ~420ms later that GET resolves `available` and overwrites it (`useManualReservation.ts:89`), leaving a green panel under the red "Termin został właśnie zajęty" banner — exactly the pairing F1 removed.

- **Fix**: `disabled={busy}` on the select and the five inputs — the treatment the X already got in Phase 5, and what CLAUDE.md's async-button rule implies for the form as a whole. Freezing the inputs makes the state at `setCreated` identical to the state at POST time, which closes A and B together.
- **Decision**: ACCEPTED — queued as plan **Phase 9**

### F12 — The conflict banner outlives the range it describes

- **Dimension**: Correctness
- **Location**: src/components/dashboard/ManualReservationModal.tsx:237, :248, :440
- **Detail**: `banner` is written at `:248` / `:253` / `:256` and cleared in exactly one place — `:237`, the top of the _next_ `submit()`. No input change clears it, so it survives a move to a completely different range. F1 was raised as "a 409 leaves the panel green while the banner is red"; Phase 5 fixed the panel half and left this one. Unlike F11 this needs no race and no mid-flight editing — it is the ordinary recovery flow (reproduced 2026-08-18, two tabs, no console patch):
  1. Tab 1: an employee fills the modal for vehicle X, 1–5 Oct; the panel resolves **Termin wolny** and nothing re-polls it (the GET fires only on an input change).
  2. Tab 2: a colleague books that exact vehicle and range.
  3. Tab 1 submits. The `reservations_no_overlap` EXCLUDE rejects the insert, the endpoint answers 409, and the modal correctly shows **Termin zajęty** plus the banner "Termin został właśnie zajęty. **Wybierz inny termin.**"
  4. The employee does exactly that — 10–15 Oct, clear of the booking.
  5. The panel resolves **Termin wolny** and submit re-arms, while the red banner still instructs them to choose another date. Green availability panel, red conflict banner, same screen.

- **Fix**: clear `banner` on the trigger that already drops the availability answer — a change to (vehicle, pickup, return) — mirroring the hook's render-phase reset (`useManualReservation.ts:62-70`) so it goes in the same render the input changed. Customer-field edits must not clear it.
- **Decision**: ACCEPTED — queued as plan **Phase 9 §2**

## Noted, not counted as findings

- `markConflict()` also fires on the `unavailable` outcome (`:251-253`), so an inactive-vehicle race renders "Termin zajęty" ("this slot is booked") above a banner saying the vehicle is gone. Not a regression: `isVehicleAvailable` goes through `available_vehicles`, which already filters inactive vehicles, so the GET path renders that case as `conflict` too. The panel's boolean vocabulary conflates "range taken" with "vehicle not bookable" — recorded as D3, and only reachable if a vehicle is deactivated while the modal is open.
- The `20260810140000` header says a drop+create "would silently re-open the built-in PUBLIC execute grant on both functions". True for `create_confirmed_reservation`; `create_reservation_request` is already PUBLIC-executable by design, so for that one the sentence overstates the risk. Comment-only.
- `formatPlnAmount`'s first unit test asserts it against `formatPln(...).replace(" zł", "")`, which is now tautological — `formatPln` is implemented in terms of it. The second test (NBSP grouping) carries the real assertion.
