# Availability-Aware Date Picker in the Manual-Reservation Modal — Implementation Plan

## Overview

Replace the manual-reservation modal's two blind `<input type="date">` fields with the availability-aware
range calendar the design source already draws (`MrCalendarPopover`), scoped to the vehicle selected in the
modal's picker. An employee on the phone with a customer sees the vehicle's taken days — interiors fully
greyed, changeover days half-available — **while** picking, instead of learning "Termin zajęty" after both
dates are set.

Roadmap slice **S-12a**, a refinement of **S-12** (`context/changes/manual-reservation/`).

## Current State Analysis

**What ships today.** `ManualReservationModal.tsx:355-390` renders two native date inputs. Every edit
restarts a 420 ms debounce (`useManualReservation.ts:20`), then `GET /api/availability` answers a single
boolean that drives the `MrAvailability` panel through `available` / `conflict`. Nothing tells the employee
which days are free until both dates exist and the round-trip returns.

**What already exists and is reusable.**

- `get_vehicle_busy_ranges(uuid)` — PII-safe definer RPC, floored to `return_date >= current_date`
  (`supabase/migrations/20260616120000_vehicle_busy_ranges_date_floor.sql`), already granted to
  `anon, authenticated`. **No migration is needed.**
- `getVehicleBusyRanges()` (`src/lib/services/reservations.ts:289`) — swallows RPC errors and returns `[]`.
  Reusable, but **not as-is**: Phase 2 §1 makes the failure visible before the panel leans on it.
- `dayAvailabilityMap()` / `checkRangeBookable()` (`src/lib/availability.ts:116,157`) — pure, unit-tested,
  derived from the same `PICKUP_HOUR`/`RETURN_HOUR` as the `EXCLUDE` constraint.
- `cell-pickup-only` / `cell-return-only` utilities (`src/styles/global.css:234-241`).
- `ui/calendar.tsx` + `react-day-picker` v10 — already dependencies.
- `BookingWidget.tsx:217-260` — a complete working reference: `disabled` matchers, `modifiers`,
  `excludeDisabled`, the `onSelect` veto, `labelDayButton` aria suffixes, and a legend.

**The gap that forces new code.** `getVehicleBusyRanges` is only reachable server-side today
(`src/pages/fleet/[id]/[...slug].astro:33`), because the public path has its vehicle fixed by the URL. The
modal switches vehicle client-side, so it needs a staff-gated HTTP route.

**Two upstream corrections this plan absorbs.**

1. **S-12's Phase 9 is unimplemented.** `reviews/impl-review-2.md` confirmed two bugs against the running
   app: **F11** (the whole form stays editable during the POST, so the done panel can print dates that were
   never booked) and **F12** (the conflict banner outlives the range it describes). Both live in the exact
   code this slice rewrites — the busy-freeze and the clear-on-(vehicle, pickup, return) trigger.
2. **The design source already draws the calendar.** `manual-reservation.jsx` contains `MrCalendarPopover`
   plus `MrD_Pick` / `MrM_Pick` boards; the `Termin` fields are `mrDateBtn` **buttons**, not date inputs. The
   "design blocker" recorded in `change.md` and the roadmap is void — no mock update is required. What is
   required is correcting S-12's `design-contract.md`, which records the native inputs as `exact`.

**The one open blocker is an export, not a design.** The six boards the vision-diff gate compares against
(`MrD_Pick` / `MrM_Pick` — never exported — plus the four re-exported form boards) are not in
`design-review/`; the directory is empty, and this slice's `design-contract.md` closes on
**"BLOCKED — awaiting 6 canonical screenshots"** with the filenames under "Screenshots required (hand-off)".
Phase 4's 4.10 and all of Phase 5 depend on them. `change.md` and the roadmap currently read "blocker
resolved / none", which is true of the mock and false of the exports.

## Desired End State

Opening **Nowa rezerwacja**, picking a vehicle, and tapping **Odbiór** or **Zwrot** expands a one-month
range calendar directly beneath the two fields. The selected vehicle's blocking reservations are greyed:
interior days solid, changeover days split on the diagonal (morning taken = upper-left, afternoon taken =
lower-right) with the source's divider line. Fully-blocked days are unclickable; a range that would collide
on a changeover boundary is vetoed on selection with a specific Polish hint. The availability panel resolves
**instantly and without a network call**, and when the range is free it reads
"Pojazd wolny do {date}" — or "Brak innych rezerwacji w tym okresie." when nothing follows it.

Verify by opening the modal against a vehicle with a seeded booking: its days are greyed before any date is
chosen, and no request to `/api/availability` appears in the Network tab (the route no longer exists).

### Key Discoveries

- **`busyHalves` and `dayAvailabilityMap` agree exactly.** The source folds bookings as `P → pm busy`,
  `R → am busy`, interiors both (`shared.jsx:1311`); our `pmTaken` is `P <= d < R` and `amTaken` is
  `P < d <= R` (`src/lib/availability.ts:206,211`). Same model, so the port needs no new availability logic.
- **`DayCell` half geometry matches our utilities.** Source: `am → polygon(0 0, 100% 0, 0 100%)` (upper-left),
  `pm → polygon(100% 0, 100% 100%, 0 100%)` (lower-right) — identical to `cell-pickup-only` /
  `cell-return-only`. Only the **fill** differs: source `#D7DCE3` + a 1.2px `#A9B2BE` divider, ours
  `var(--muted)` = `#EEF1F5` with no divider.
- **The "next free" hint is only half-portable.** The source renders
  `Pojazd wolny do {date} · kolejna rez. {R-2402}`; `get_vehicle_busy_ranges` returns date bounds only, with
  no reference. The date clause ports; the reference clause does not.
- **The modal already receives the whole fleet client-side** (`reservations.astro:52` →
  `NewReservationButton client:load vehicles={fleet}`), so a per-vehicle fetch is the only new network cost.
- **`/api/availability` has exactly one consumer** (`useManualReservation.ts:83`). Once the local check is
  the gate, the route is unreachable.
- **Two more S-12 contract lines are wrong against the source**: desktop `max-height` is `94%` (the contract
  says 90%, and the code ships `md:max-h-[90%]`), and the submit button's background goes
  `tokens.muted` while `av.state === 'conflict'` on top of the `opacity 0.4`.

## What We're NOT Doing

- **No migration and no new RPC.** `get_vehicle_busy_ranges` already exists with the right grants.
- **No clashing-booking card.** The source's conflict card shows the colliding customer's name, initials,
  reference and status — none of it in the PII-safe payload. D2 survives in reduced form.
- **No `kolejna rez. {reference}` clause** in the available hint, for the same reason.
- **No restyle of the public `BookingWidget`.** Its lighter `--muted` busy fill stays; reconciling the two
  treatments is recorded as a follow-up, not done here.
- **No calendar-cell entry point** (`MrD_Confirm`), **no quick-action menu** (`MrD_Menu`) — still out of
  scope per S-12's D4.
- **No new e2e spec.** Coverage is unit + integration.
- **No maintenance/"Pojazd w serwisie" state** — still D3, no backing in the model.

## Implementation Approach

Four working phases, ordered so each leaves the app shippable.

Phase 1 lands S-12's outstanding correctness fixes on the current surface, so they are verifiable on their
own before the surface moves. Phase 2 adds the data path (route + hook) without touching the UI. Phase 3
flips the panel's authority from the server boolean to the local `checkRangeBookable` and deletes the now
unreachable endpoint — at which point the modal still shows date inputs but is already network-free. Phase 4
swaps the `Termin` block for the source's buttons-plus-popover. Phase 5 is the verification and vision-diff
gate.

The `EXCLUDE` constraint inside `create_confirmed_reservation` remains the sole authority. Everything in the
client is advisory, exactly as it is today; a lost race is still a 409 on the create, not a double booking.

## Critical Implementation Details

**Panel state mapping — no new copy is needed.** The two new failure modes map onto states the panel already
has: while the busy ranges are loading the panel is `checking` ("Sprawdzanie dostępności…"), and when the
ranges fetch fails it is `error` ("Nie udało się sprawdzić dostępności."). Because `canCreateReservation`
requires `state === "available"`, a failed range fetch leaves the submit button disabled — the existing safe
default, preserved rather than re-derived.

**That default only survives if the read reports its failures.** `getVehicleBusyRanges` swallows RPC errors
and answers `[]` today, and an empty list through `checkRangeBookable` is indistinguishable from a genuinely
free vehicle — it resolves to `available` and arms submit. Promoting an intentionally-swallowing advisory read
to be the panel's authority is what would invert the default, so Phase 2 §1 changes its shape to
`{ ok, ranges }` and gives the route a 500 branch. The public detail page, where greying really is sugar,
keeps the swallow by ignoring `.ok`.

**Ordering: Phase 3 must precede Phase 4.** If the surface swaps first, the debounced GET fires on every
calendar click and the panel briefly contradicts the cells it sits under. Flipping the authority first means
the calendar renders over a panel that already agrees with it.

**The veto is not optional.** `excludeDisabled` only rejects ranges that _span_ a fully-`blocked` day. A range
ending on a `pickupOnly` day, starting on a `returnOnly` day, or crossing a half-day interior passes that
filter — `checkRangeBookable` in `onSelect` is what catches those, resetting to the just-clicked day. This is
the same trap `BookingWidget.tsx:228-240` documents.

## Phase 1: Carry over S-12's outstanding correctness fixes

### Overview

Land `impl-review-2.md`'s F11 and F12 on the current two-input modal, so both are verifiable before the
`Termin` block is replaced. Absorbed here rather than run as S-12 Phase 9 because both fixes live in the
lifecycle this slice rewrites.

### Changes Required

#### 1. Freeze the form while a create is in flight (F11)

**File**: `src/components/dashboard/ManualReservationModal.tsx`

**Intent**: The vehicle `<select>` and all five text/date inputs stay live for the whole POST, so a mid-flight
edit makes the done panel print dates that were never booked and lets `markConflict()` pin a conflict onto a
range nobody checked. Extend the `busy` guard already applied to the scrim, the X and the submit button to
every input in the form.

**Contract**: `disabled={busy}` on the vehicle `<select>`, both date inputs and the three customer inputs.
The invariant this establishes: the state read at `setCreated` is identical to the state POSTed.

#### 2. Clear the conflict banner when the range changes (F12)

**File**: `src/components/dashboard/ManualReservationModal.tsx`

**Intent**: `banner` is only cleared at the top of the next `submit()`, so after a 409 the employee moves to a
free range, the panel goes green, and the red "Wybierz inny termin." banner is still on screen. Clear it on
the same trigger that drops the availability answer — a change to (vehicle, pickup, return) — and only that
trigger; customer-field edits must not clear it.

**Contract**: a render-phase reset keyed on `${vehicleId}|${pickup}|${returnDate}`, mirroring
`useManualReservation.ts:62-70`, so the banner goes in the same render the input changed rather than one
paint later.

#### 3. Record the busy-guard widening

**File**: `context/changes/manual-reservation/design-contract.md`

**Intent**: Surface 1's `deviation(busy-guard)` currently covers only the close button. Extend it to the form
fields so the vision-diff does not re-flag the disabled treatment.

**Contract**: prose edit to the Surface 1 bullet.

### Success Criteria

#### Automated Verification

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests pass: `npm test`

#### Manual Verification

- With the create held open, the vehicle picker and all five fields refuse input; the done panel's dates and
  name match the `reservations` row
- A date cannot be edited mid-flight, so the panel never ends up green beneath the conflict banner
- After a 409, moving to a free range clears the banner; editing a customer field does not

**Implementation Note**: After completing this phase and all automated verification passes, pause here for
manual confirmation before proceeding.

---

## Phase 2: Staff-gated busy-ranges endpoint and client hook

### Overview

Give the client a way to read one vehicle's busy ranges. No UI change — the route and hook land tested and
unused.

### Changes Required

#### 1. The fallible read, and the route over it

**Files**: `src/lib/services/reservations.ts`, `src/pages/fleet/[id]/[...slug].astro`,
`src/pages/api/vehicles/[id]/busy-ranges.ts`

**Intent**: Expose `getVehicleBusyRanges` over HTTP for the modal, which switches vehicle client-side — and
first make its failures visible, because from Phase 3 this read _is_ the panel's authority. Today it swallows
RPC errors and returns `[]` (`reservations.ts:297-302`), which was right when the greying was advisory sugar
on a page whose real check lived elsewhere; fed to `checkRangeBookable`, an empty list resolves to
`available`, so a failed read would paint an empty calendar under a green "Termin wolny" **and arm the submit
button** — where today's `/api/availability` 500 disarms it. Mirror `api/availability.ts` otherwise, including
its comment that a GET read is not a CSRF sink, so no `Origin` check.

**Contract**: `getVehicleBusyRanges` returns `Promise<{ ok: boolean; ranges: VehicleBusyRange[] }>` —
`ok: false` for a null/misconfigured client, a malformed id, or an RPC error, keeping today's `console.error`
and `ranges: []` alongside it. Its one existing caller, `src/pages/fleet/[id]/[...slug].astro:33`, reads
`.ranges` and ignores `.ok`, so the public detail page keeps its deliberate "grey nothing and carry on"
behaviour verbatim.

The route: `GET`, gating in the order the lessons file mandates — `!context.locals.user` → 401
`Wymagane logowanie.`; `!isRoleSufficient(context.locals.role, "employee")` → 403 `Brak uprawnień.`; a
`params.id` failing the loose hex-UUID guard (not `z.uuid()`, which rejects the fixed seed ids) → 400
`Nieprawidłowe parametry zapytania.`; then `200 { ranges: VehicleBusyRange[] }` when `ok`, and
`500 { error: "Nie udało się sprawdzić dostępności." }` when not — fail closed, the same shape and message
`api/availability.ts:71-75` answers with today.

#### 2. The client hook

**File**: `src/components/hooks/useVehicleBusyRanges.ts`

**Intent**: Fetch the selected vehicle's ranges on every vehicle change, dropping superseded responses so a
fast switch cannot let stale ranges paint over newer ones.

**Contract**: `useVehicleBusyRanges(vehicleId: string): { ranges: VehicleBusyRange[]; state: "loading" | "ready" | "error"; refetch: () => Promise<VehicleBusyRange[] | null> }`.
`refetch` re-reads the same vehicle on demand and resolves to the fresh ranges (or `null` if the read failed);
Phase 3 §3 calls it as the create's pre-flight.
An `AbortController` cancels the in-flight request on change or unmount; an `AbortError` is a superseded
fetch, not a failure. Any non-OK response — including the route's fail-closed 500 — resolves to `error`, never
to empty ranges. No debounce — this fires on discrete vehicle selection, not on typing.

#### 3. Integration coverage

**File**: `tests/integration/manual-reservation-api.test.ts`

**Intent**: Prove the new route enforces its own gate, since middleware does not cover `/api`.

**Contract**: a `GET /api/vehicles/[id]/busy-ranges (S-12a)` describe block driving the exported handler
through `anonContext()` / `asContext("norole")` / `asContext("employee")` — 401, 403, 200-with-correct-ranges
against the suite's disposable vehicle, and 400 on a malformed id. Deny assertions must use real
unauthenticated/role-null callers, never `serviceClient()`.

### Success Criteria

#### Automated Verification

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Integration tests pass: `npm run test:integration`

#### Manual Verification

- Signed in as an employee, the route returns the seeded vehicle's ranges; signed out it returns 401

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: Local availability resolution; retire `/api/availability`

### Overview

Move the panel's authority from the debounced server boolean to `checkRangeBookable` over the fetched ranges,
then delete the endpoint that is now unreachable. The modal still shows date inputs at the end of this phase —
it is simply network-free and instant.

### Changes Required

#### 1. The pure resolver

**File**: `src/lib/manual-availability.ts`

**Intent**: Replace `classifyAvailabilityInput`'s "can we ask the server?" question with a total function from
(vehicle, range, ranges-fetch state) to the panel's existing `AvailabilityState`, so the whole decision stays
unit-testable without a DOM or a network stub.

**Contract**: `resolveAvailability(vehicleId, pickup, returnDate, ranges, rangesState): AvailabilityState`.
Order matters — incomplete input → `idle`; `validateDateRange` failure → `invalid` (still the single source
for that rule, shared with the schema and the constraint); `rangesState === "error"` → `error`;
`rangesState === "loading"` → `checking`; then `checkRangeBookable` → `available` | `conflict`.
`canCreateReservation` is unchanged.

#### 2. The next-free helper

**File**: `src/lib/availability.ts`

**Intent**: Compute the "Pojazd wolny do …" clause — the first busy range starting after the chosen return
date, matching the source's `list.filter(b => b.s > ret).sort()[0]`.

**Contract**: `nextBusyRangeAfter(busy: VehicleBusyRange[], returnDate: string): VehicleBusyRange | null`.
ISO `YYYY-MM-DD` strings compare lexicographically as calendar order, as everything else in this file does.

#### 3. Rewire the modal off the network

**Files**: `src/components/dashboard/ManualReservationModal.tsx`, `src/components/hooks/useManualReservation.ts`

**Intent**: Drive `MrAvailability` from `resolveAvailability` over `useVehicleBusyRanges`, keeping
`markConflict()` as the 409's override. Delete `useAvailability` and its debounce, keeping `useManualReservation`'s
`create`.

**Contract**: `markConflict` moves to local component state layered over the resolver's answer, cleared by
the same (vehicle, pickup, return) reset Phase 1 added for the banner. `submit()` opens with a pre-flight:
`await refetch()`, then `checkRangeBookable` over the fresh ranges — on a failure it calls `markConflict()`
and returns **without POSTing**; on `null` (the read failed) it falls through to the POST, which is the
authority anyway. This is what keeps the verdict as fresh at submit time as today's debounced GET (see §4). The `available` subtitle becomes
"Pojazd wolny do {d MMM}" when a next range exists, else the source's
**"Brak innych rezerwacji w tym okresie."** — replacing S-12's invented "Można utworzyć rezerwację."

#### 4. Delete the endpoint

**Files**: `src/pages/api/availability.ts` (delete), `tests/integration/manual-reservation-api.test.ts`,
`src/pages/api/reservations/manual.ts`

**Intent**: With the local check as the gate the route has no caller, and a gated route nobody calls is
surface that must be defended forever. Both paths are check-then-act and the `EXCLUDE` constraint answers a
lost race with a 409 — but the staleness _window_ is not automatically the same, and that difference is worth
being precise about. Today's GET re-runs on every (vehicle, pickup, return) change, so the verdict on screen
is at most one debounce old relative to the last edit. Ranges fetched once per vehicle selection would instead
be judged against a snapshot that is as old as the phone call — minutes, in the surface this modal exists for,
with the calendar itself painting "free" days from it. §3's pre-flight `refetch` in `submit()` is what closes
that gap: the answer that actually gates the write is re-read at the moment of the write.

**Contract**: remove the route file, its `availabilityGET` import and the `GET /api/availability (S-12)`
describe block. Leave the manual-create _tests_ untouched — but repoint the comment at
`src/pages/api/reservations/manual.ts:81` ("…answer in shape, matching the sibling `api/availability.ts`") at
the new sibling `api/vehicles/[id]/busy-ranges.ts`. It is the one surviving textual reference, and the phase's
own `grep -rn "api/availability" src tests` gate fails on it otherwise.

#### 5. Unit coverage

**File**: `src/lib/manual-availability.test.ts`, `src/lib/availability.test.ts`

**Intent**: Cover the resolver's precedence order and the next-free helper.

**Contract**: the existing `classifyAvailabilityInput` describe block (`manual-availability.test.ts:15-38`)
is **replaced**, not extended — the function goes with §1, so leaving it would fail `astro check`; its
idle / inverted-range / same-day / past-pickup cases carry straight over as `resolveAvailability` cases.
Then: a case for each `AvailabilityState` branch — notably that `invalid` beats a loading fetch and that
`error` disables submit — plus `nextBusyRangeAfter` with no following range, one, and several unsorted.

### Success Criteria

#### Automated Verification

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests pass: `npm test`
- Integration tests pass after the endpoint removal: `npm run test:integration`
- No reference to `/api/availability` remains: `grep -rn "api/availability" src tests` returns nothing

#### Manual Verification

- Picking a vehicle and a range resolves the panel with no `/api/availability` request in the Network tab
- A free range shows "Pojazd wolny do {date}"; a vehicle with no later booking shows "Brak innych rezerwacji w tym okresie."
- Blocking the busy-ranges request shows the warning state and leaves submit disabled
- A range taken by another tab after it was picked is caught by the create's pre-flight re-read, not only by the 409

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: The `Termin` surface — date buttons and the in-flow calendar

### Overview

Replace the two native date inputs with the source's `mrDateBtn` buttons and the `MrCalendarPopover` they
expand. Every value is transcribed from `manual-reservation.jsx` / `shared.jsx`; see
`design-contract.md` in this change folder for the per-element spec.

### Changes Required

#### 1. Busy-cell tokens and utilities

**File**: `src/styles/global.css`

**Intent**: The source fills busy halves with `#D7DCE3` and draws a 1.2px `#A9B2BE` divider along the
diagonal; the shipped `cell-pickup-only` / `cell-return-only` use the lighter `var(--muted)` and no divider.
Add the source's treatment as its own tokens and utilities rather than restyling the public calendar.

**Contract**: `--flota-busy: #d7dce3` and `--flota-busy-divider: #a9b2be`; utilities `cell-busy-am`
(upper-left), `cell-busy-pm` (lower-right) and `cell-busy-full`, each carrying the divider on the half
variants. The existing utilities are untouched — `BookingWidget` keeps its current look, recorded as a
follow-up in the design contract. Note that Tailwind will not generate a never-before-used utility while
`npm run dev` is running; verify against a production build.

#### 2. The date buttons

**File**: `src/components/dashboard/ManualReservationModal.tsx`

**Intent**: Swap the two `<input type="date">` for the source's buttons, which show the formatted date and
which field is being edited.

**Contract**: per field a `mrFieldCap` caption (**Odbiór** / **Zwrot**) over a button — `h-10`, `rounded-[10px]`,
`border` `--flota-hair`, `bg-card`, `px-2.5`, `gap-2`, `text-[13px] font-semibold`; calendar icon 14 (muted,
ink when active), the date via a `d MMM yyyy` formatter ("1 kwi 2026"), chevron 13 muted. Active adds
`border-[var(--foreground)]` and `shadow-[0_0_0_4px_rgba(15,23,42,0.06)]`. Grid stays `2 cols gap-2.5`.
Buttons carry `disabled={busy}` from Phase 1 — and the open-field state resets to `null` when `busy` flips
true, so the freeze also **closes** the popover instead of leaving it live behind a disabled trigger (see §3).

#### 3. The calendar popover

**File**: `src/components/dashboard/ManualReservationCalendar.tsx` (new)

**Intent**: Port `MrCalendarPopover` onto `ui/calendar` + `react-day-picker`, re-authored in our idioms
rather than copied. Rendered **in flow** beneath the two fields when a field is open — not absolutely
positioned — so the body grows and the modal footer stays pinned on both breakpoints. Desktop has one
consequence of that growth the contract records `exact` and this phase must implement: while a field is open
the scrim switches from centered to `align-items: flex-start` with `padding-top: 56`, so the taller modal
rides the top of the viewport instead of straining a centered box.

**Contract**: a card — `bg-card`, `border` `--flota-hair-2`, `rounded-[16px]`, `p-4`, `shadow-overlay` — with a
`12×12` `rotate-45` tail at `top:-6px`, `left:24%` for Odbiór / `74%` for Zwrot. Inside: `mode="range"`,
`numberOfMonths={1}`, `[--cell-size:--spacing(8.5)]` (34px), grid gap 4, caption `{Miesiąc} {rok}` at
`13.5px/700/-0.2px` and **not uppercased**, weekday headers forced to `Pn Wt Śr Cz Pt So Nd` via
`formatWeekdayName`, day radius 9 on the range endpoints and 0 between. `disabled` = past days plus fully-
blocked days; `modifiers` carry the two half states; `onSelect` applies the `checkRangeBookable` veto and its
three hints; `labelDayButton` appends the start-only/end-only aria suffixes — all as `BookingWidget.tsx:217-260`
does. Legend and footer copy are verbatim from the source; **Zastosuj** closes the popover.

The popover is inside Phase 1's busy freeze, not outside it. `disabled` on a trigger button does not close an
already-open popover, and the footer submit sits outside the scrollable body — so with the calendar open an
employee can press **Utwórz rezerwację** and then click a day, moving `pickup`/`returnDate` mid-POST and
landing F11 again through the new surface (`DonePanel` would print dates that were never booked). Not
rendering the popover while `busy` is the whole fix; day cells, month nav and **Zastosuj** need no guards of
their own once it is unmounted.

#### 4. The available-state hint

**File**: `src/components/dashboard/ManualReservationModal.tsx`

**Intent**: Render the Phase 3 helper's output in the panel's available state.

**Contract**: subtitle only; box, icon and title are unchanged.

#### 5. Prerequisite — the six canonical exports

**File**: `context/changes/manual-reservation-date-picker/design-review/` (currently empty)

**Intent**: 4.10 is a vision-diff, and a vision-diff with no mockup to diff against is a checkbox, not a gate.

**Contract**: the six boards listed in `design-contract.md` → "Screenshots required (hand-off)" land in
`design-review/` before 4.10 is attempted. If they have not landed, 4.10 and 5.3 stay unchecked and the phase
does not close — do **not** substitute the stale S-12 shots, whose `Termin` block is the very thing that moved.

#### 6. Contract corrections carried from the source pull

**Files**: `context/changes/manual-reservation/design-contract.md`, `src/components/dashboard/ManualReservationModal.tsx`

**Intent**: Three lines are wrong against the current source and were found during this plan's audit.

**Contract**: (a) desktop `max-height` is `94%`, not `90%` — drop the `md:max-h-[90%]` override; (b) the submit
button's background is `tokens.muted` while the panel is in `conflict`, on top of the `opacity 0.4`;
(c) Surface 2's "Termin" block is rewritten to the buttons-plus-popover spec and its `exact` claim on the
native inputs withdrawn.

### Success Criteria

#### Automated Verification

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests pass: `npm test`

#### Manual Verification

- The two fields render as buttons showing "1 kwi 2026" with the calendar icon and chevron; the open one
  carries the ink border and 4px ring
- Tapping a field expands the calendar in flow; at 390px the footer stays pinned and the total remains visible
- A vehicle with a booking greys interiors solid and changeover days on the diagonal with the divider line;
  switching vehicle repaints the greying
- A range ending on a `pickupOnly` day is vetoed with the specific hint and resets to the clicked day
- The legend reads Wybrane / Dzień odbioru / zwrotu — wciąż dostępny / W pełni zajęte, and Zastosuj closes
- Vision-diff of the picker-open and form states (desktop + mobile) clean apart from recorded deviations
- The six canonical boards are exported into `design-review/` — this gates the vision-diff above
- With the create held open, the calendar is gone and no day can be clicked — Phase 1's 1.6 re-run on the new surface
- On desktop the scrim top-aligns (`flex-start`, `padding-top: 56`) while a field is open and re-centers when it closes

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 5: Verification and vision-diff gate

### Overview

Run the whole slice green, execute every manual item with evidence, and close the rendered vision-diff.

### Changes Required

#### 1. Full-suite run and evidence pass

**File**: `context/changes/manual-reservation-date-picker/plan.md`

**Intent**: Execute the deferred manual items and record them against the Progress section.

**Contract**: every Progress row checked with a commit sha or an evidence note.

#### 2. Rendered vision-diff

**File**: `context/changes/manual-reservation-date-picker/design-contract.md`

**Intent**: Render the real modal at both breakpoints and diff against the canonical screenshots, iterating to
an empty punch-list minus recorded deviations.

**Contract**: diff targets are the six screenshots in `design-review/`, landed via Phase 4 §5 (see the
Design Alignment Audit in the contract). Findings that are recorded deviations are not re-flagged.

#### 3. Close-out

**Files**: `context/changes/manual-reservation-date-picker/change.md`, `context/foundation/roadmap.md`

**Intent**: Move the change past `implementing` and mark S-12a done, noting the busy-cell reconciliation
follow-up against `BookingWidget`.

**Contract**: frontmatter `status` + `updated`; roadmap slice `Status:`.

### Success Criteria

#### Automated Verification

- Full suite green: `npx astro check`, `npm run lint`, `npm run build`, `npm test`, `npm run test:integration`

#### Manual Verification

- Every manual item from Phases 1–4 executed and checked with evidence
- Vision-diff punch-list empty apart from recorded deviations
- `change.md` status moved past `implementing`; roadmap S-12a marked done with the follow-up noted

---

## Testing Strategy

### Unit Tests

- `resolveAvailability` precedence: `idle` before anything is asked; `invalid` beating a loading fetch;
  `error` when the ranges fetch failed; `checking` while loading; `available` / `conflict` from
  `checkRangeBookable`.
- `nextBusyRangeAfter`: no following range → `null`; exactly one; several supplied out of order.
- `canCreateReservation` unchanged — still false for every state except `available`.

### Integration Tests

- `GET /api/vehicles/[id]/busy-ranges`: 401 anon, 403 role-null, 200 for `employee` with the seeded
  vehicle's ranges, 400 on a malformed id. Deny cases through real unauthenticated / role-null contexts.
- The existing manual-create suite must stay green after `/api/availability` is removed.

### Manual Testing Steps

1. Seed a confirmed reservation on a vehicle, open **Nowa rezerwacja**, select that vehicle, tap **Odbiór** —
   its days are greyed before any date is picked.
2. Select a range ending on the booking's pickup day (a `returnOnly` day) — accepted, since the afternoon
   is free.
3. Select a range ending on the booking's return day (a `pickupOnly` day) — vetoed with the return-day hint.
4. Switch vehicle mid-pick — the greying repaints for the new vehicle.
5. At 390px, open the calendar and confirm the footer total stays pinned and reachable.
6. Throttle the busy-ranges request to failure — panel shows the warning state, submit stays disabled.
7. Two tabs: book the range in tab 2, submit in tab 1 — the pre-flight re-read catches it and the panel goes
   red with no POST (a 409 if it was taken in the gap between the re-read and the write); banner shown; move
   to a free range and confirm the banner clears.

## Performance Considerations

One extra request per vehicle switch plus one pre-flight per create attempt, each returning date bounds only
and floored to current + future ranges. The retired debounce removes up to one request per keystroke on two
date fields, so the net request count still falls sharply. The pre-flight is the deliberate exception to
"resolves without a network call": the _panel_ stays instant and local, and only the write re-reads.
`dayAvailabilityMap` is memoized on the fetched ranges exactly as `BookingWidget.tsx:112` does.

## Migration Notes

None. `get_vehicle_busy_ranges` already exists with `anon, authenticated` execute grants; no schema, RPC or
grant changes.

## References

- Roadmap slice: `context/foundation/roadmap.md` — S-12a
- Parent change: `context/changes/manual-reservation/` (plan, design contract, `reviews/impl-review-2.md`)
- Design contract for this slice: `context/changes/manual-reservation-date-picker/design-contract.md`
- Working reference: `src/components/vehicle/BookingWidget.tsx:217-260`
- Availability model: `src/lib/availability.ts:116,157`
- Route gating pattern: `src/pages/api/availability.ts`, `src/pages/api/vehicles/[id]/active.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Carry over S-12's outstanding correctness fixes

#### Automated

- [x] 1.1 Type checking passes: `npx astro check` — 847ad96
- [x] 1.2 Linting passes: `npm run lint` — 847ad96
- [x] 1.3 Build passes: `npm run build` — 847ad96
- [x] 1.4 Unit tests pass: `npm test` — 847ad96

#### Manual

- [x] 1.5 With the create held open, the picker and all five fields refuse input; the done panel's dates and name match the `reservations` row (driven: select + all 5 fields report disabled; done panel read "2 wrz – 5 wrz · 3 dni" / "Zażółć Gęślą Jaźń", matching the POSTed range) — 4b57ea7
- [x] 1.6 A date cannot be edited mid-flight, so the panel never ends up green beneath the conflict banner (driven: both Termin controls disabled and the calendar unmounted — 0 day cells in the DOM) — 4b57ea7
- [x] 1.7 After a 409, moving to a free range clears the banner; editing a customer field does not (driven: banner survived a Telefon edit, cleared on the range change, panel went "Termin wolny") — 4b57ea7

### Phase 2: Staff-gated busy-ranges endpoint and client hook

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — 1097951
- [x] 2.2 Linting passes: `npm run lint` — 1097951
- [x] 2.3 Build passes: `npm run build` — 1097951
- [x] 2.4 Integration tests pass: `npm run test:integration` — 1097951

#### Manual

- [x] 2.5 Signed in as an employee, the route returns the seeded vehicle's ranges; signed out it returns 401 (driven over HTTP on :4321 — employee 200 {"ranges":[…]}, signed out 401 {"error":"Wymagane logowanie."}) — 4b57ea7

### Phase 3: Local availability resolution; retire `/api/availability`

#### Automated

- [x] 3.1 Type checking passes: `npx astro check` — 571df4a
- [x] 3.2 Linting passes: `npm run lint` — 571df4a
- [x] 3.3 Build passes: `npm run build` — 571df4a
- [x] 3.4 Unit tests pass: `npm test` — 571df4a
- [x] 3.5 Integration tests pass after the endpoint removal: `npm run test:integration` — 571df4a
- [x] 3.6 No reference to `/api/availability` remains: `grep -rn "api/availability" src tests` returns nothing — 571df4a

#### Manual

- [x] 3.7 Picking a vehicle and a range resolves the panel with no `/api/availability` request in the Network tab (driven: the only /api/ request across a full pick was GET /api/vehicles/{id}/busy-ranges) — 4b57ea7
- [x] 3.8 A free range shows "Pojazd wolny do {date}"; a vehicle with no later booking shows "Brak innych rezerwacji w tym okresie." (driven: both variants rendered — "Pojazd wolny do 10 wrz" and the fallback) — 4b57ea7
- [x] 3.9 Blocking the busy-ranges request shows the warning state and leaves submit disabled (driven: route forced to 500 → "Nie udało się sprawdzić dostępności." visible, submit disabled with a valid customer) — 4b57ea7
- [x] 3.10 A range taken by another tab after it was picked is caught by the create's pre-flight re-read, not only by the 409 (driven: booking inserted out-of-band after the pick → banner shown, panel conflict, and NO POST fired) — 4b57ea7

### Phase 4: The `Termin` surface — date buttons and the in-flow calendar

#### Automated

- [x] 4.1 Type checking passes: `npx astro check` — 4b57ea7
- [x] 4.2 Linting passes: `npm run lint` — 4b57ea7
- [x] 4.3 Build passes: `npm run build` — 4b57ea7
- [x] 4.4 Unit tests pass: `npm test` — 4b57ea7

#### Manual

- [x] 4.5 The two fields render as buttons showing "1 kwi 2026" with the calendar icon and chevron; the open one carries the ink border and 4px ring (driven: h40/r10/border rgba(15,23,42,.08)/13px/600; active border rgb(15,23,42) + shadow 0 0 0 4px rgba(15,23,42,.06); label "2 wrz 2026") — 4b57ea7
- [x] 4.6 Tapping a field expands the calendar in flow; at 390px the footer stays pinned and the total remains visible (driven at 390×780: submit box y=716..762, total visible) — 4b57ea7
- [x] 4.7 A vehicle with a booking greys interiors solid and changeover days on the diagonal with the divider line; switching vehicle repaints the greying (driven: interior bg #D7DCE3 + disabled; changeover gradients carry #A9B2BE at calc(50%±0.6px); vehicle switch → transparent) — 4b57ea7
- [x] 4.8 A range ending on a `pickupOnly` day is vetoed with the specific hint and resets to the clicked day (driven: hint "Wybrany dzień zwrotu jest niedostępny…" shown, range reset to the clicked day) — 4b57ea7
- [x] 4.9 The legend reads Wybrane / Dzień odbioru / zwrotu — wciąż dostępny / W pełni zajęte, and Zastosuj closes (driven: all three labels visible; Zastosuj hides the popover) — 4b57ea7
- [x] 4.10 Vision-diff of the picker-open and form states (desktop + mobile) clean apart from recorded deviations (2 findings, both fixed: legend half-swatch drew a divider the source's swatch has not; neighbouring months' days were rendered where the source builds the current month only) — 83721c1
- [x] 4.11 The six canonical boards are exported into `design-review/` — this gates the vision-diff above (rendered from the canonical `manual-reservation.jsx` + `shared.jsx` through the design project's own `export-shot.html` harness at 2×; provenance recorded in `design-contract.md`) — 83721c1
- [x] 4.12 With the create held open, the calendar is gone and no day can be clicked — Phase 1's 1.6 re-run on the new surface (driven: 0 day cells in the DOM, all 6 controls disabled, done panel dates match the POSTed range) — 4b57ea7
- [x] 4.13 On desktop the scrim top-aligns (`flex-start`, `padding-top: 56`) while a field is open and re-centers when it closes (driven: center/32px → flex-start/56px → center) — 4b57ea7

### Phase 5: Verification and vision-diff gate

#### Automated

- [x] 5.1 Full suite green: `npx astro check`, `npm run lint`, `npm run build`, `npm test`, `npm run test:integration` — check/lint/build/unit (331) green. Integration 210/211: the one failure is `security-definer-anon-guardrail` flagging `resolve_link_token`, a function absent from this repo's 25 migrations that a sibling worktree applied to the SHARED local stack mid-session (this same suite was 214/214 at 10:20 and 211/211 at 10:24 today, on this branch). Environmental, not caused by this change — left alone rather than dropped, since dropping it would break the sibling worktree. — 83721c1

#### Manual

- [x] 5.2 Every manual item from Phases 1–4 executed and checked with evidence — daf47a6 (4.10 / 4.11 closed in the same phase)
- [x] 5.3 Vision-diff punch-list empty apart from recorded deviations (empty after the two fixes above; D10–D17 + D2 not re-flagged) — 83721c1
- [x] 5.4 `change.md` status moved past `implementing`; roadmap S-12a marked done with the follow-up noted — 83721c1
