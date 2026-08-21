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

## Phase 6: One `Termin` field, no date hint, mobile picker as its own layer

### Overview

Three surface changes requested after driving the shipped slice, all three already made in the design source
(`manual-reservation.jsx`, pushed via DesignSync 2026-08-21) and verified by rendering the boards. Appended
here rather than opened as a new change because they are small and live entirely in the code Phases 3–4 wrote
— the same call S-12 made when its review became that plan's Phase 9.

**What prompted it.** Switching vehicle with a range already picked showed **"Pojazd wolny do 1 paź"** for a
booking five weeks out, which reads as a claim about the range being booked rather than about the _next_
reservation. The clause that made it legible — the source's `· kolejna rez. {reference}` — is exactly what D10
dropped for want of a reference in the PII-safe payload. Chasing that surfaced a worse one: because
`nextBusyRangeAfter` counts only bookings starting **strictly after** the return day (matching the source's
`b.s > ret`), a range ending on a booking's pickup day — legal, since return is 10:00 and pickup 14:00 —
reports **"Brak innych rezerwacji w tym okresie."** while a reservation starts that afternoon. Verified against
the running app: `22 → 24 sie` gives "Pojazd wolny do 25 sie"; `22 → 25 sie` gives the false "no other
reservations". Rather than repair a hint nobody asked for, the hint goes.

### Changes Required

#### 1. Retire the next-free hint

**Files**: `src/components/dashboard/ManualReservationModal.tsx`, `src/lib/availability.ts`,
`src/lib/availability.test.ts`

**Intent**: The available state becomes status only, matching the revised source. The conflict subtitle stays —
it explains the status rather than asserting a date.

**Contract**: `MrAvailability`'s available branch renders the **Termin wolny** title alone, `items-center` like
the single-line `checking` state. `COPY.avAvailableUntil` / `avAvailableSubNone` and the `nextBusyPickup` prop
go. `nextBusyRangeAfter` has no other caller, so it and its `describe` block are **deleted** — leaving a
tested-but-dead export is how the next slice inherits a trap. D10 is rewritten from "the reference clause is
dropped" to "the whole subtitle is dropped", with the same-day-changeover silence recorded as its reason.

#### 2. One `Termin` field

**File**: `src/components/dashboard/ManualReservationModal.tsx`

**Intent**: The picker sets both ends of the range, so two triggers only restated what the calendar already
carries — and invited the reading that each opened a different calendar.

**Contract**: a single full-width `mrDateBtn` — same `h-10 / rounded-[10px] / border --flota-hair / bg-card /
px-2.5 / gap-2 / text-[13px] font-semibold` — holding calendar icon 14, the range `{d MMM} – {d MMM yyyy}`
(`"1 kwi – 2 kwi 2026"`, the first date's year elided since both share it), the day count `{n} dni` at
`12px/600` muted, then chevron 13. Active keeps `border-[var(--foreground)]` +
`shadow-[0_0_0_4px_rgba(15,23,42,0.06)]`. The two `mrFieldCap` captions (**Odbiór** / **Zwrot**) go with the
second field; the **Termin** section label already names the block. Desktop's tail re-centres to
`calc(50% - 6px)`. With no dates yet the button reads **"Wybierz termin"** and the day count is hidden —
`deviation(undrawn-state)` **D18**, replacing D16's `"—"`, since a single field showing `"— – —"` reads as
broken rather than empty.

#### 3. Mobile: the picker is its own layer

**Files**: `src/components/dashboard/ManualReservationCalendar.tsx`,
`src/components/dashboard/ManualReservationModal.tsx`,
`src/components/hooks/useMediaQuery.ts` _(new — recorded retroactively in Phase 7, F5)_

The breakpoint has to be read **in JS**, not as a responsive variant: the picker needs two different
positions in the tree (in flow under the trigger on desktop; a sibling layer over the form sheet on mobile),
and a Tailwind variant can only show/hide — which would mean mounting two live copies of an interactive
widget and letting CSS pick one. The hook is SSR-safe (`useSyncExternalStore` with a `() => false` server
snapshot) and the modal only ever mounts on a click, never during SSR or hydration.

**Intent**: In flow inside a scrolling body, the mobile picker moves under the thumb as the body reflows and a
tap beside the grid can dismiss it mid-range. It becomes a sheet over the form instead.

**Contract**: the calendar takes `variant: "popover" | "sheet"`. `popover` is today's card (`bg-card`,
`border --flota-hair-2`, `rounded-[16px]`, `p-4`, `shadow-overlay`) and stays desktop-only, in flow, with the
tail. `sheet` drops that chrome so the sheet owns the surface — no card inside a card — and the modal renders
it on mobile as a layer **above** the form sheet: `z-[70]` over the form's `z-[60]`, scrim
`bg-[rgba(20,18,22,0.5)]` + `backdrop-blur-sm`, `items-end`, panel `bg-card rounded-t-[26px] px-4 pt-3.5 pb-[22px]`
with the source's `40×4` `rounded-full` grab handle above the grid. **No outside-click dismiss** — only
**Zastosuj** closes it, so a stray tap cannot discard a half-made range. It stays inside Phase 1's busy freeze:
not rendered while `busy`, exactly as the in-flow popover is not.

#### 4. Contract + board refresh

**Files**: `context/changes/manual-reservation-date-picker/design-contract.md`,
`context/changes/manual-reservation-date-picker/design-review/*.png`,
`context/changes/manual-reservation/design-contract.md`

**Intent**: The six boards and both contracts describe the two-field surface with the hint. Leaving them is the
exact staleness that started this slice, where S-12's contract recorded native inputs as `exact`.

**Contract**: re-render the six boards from the revised source through the project's `export-shot.html`
harness with the app's own font files (provenance already recorded); rewrite the contract's `Termin` and
available-state sections; add **D18**, retire **D16**, restate **D10**. The S-12 contract's busy-guard line
loses its "both `Termin` fields" plural.

### Success Criteria

#### Automated Verification

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests pass: `npm test`
- `nextBusyRangeAfter` is gone: `grep -rn "nextBusyRangeAfter" src` returns nothing

#### Manual Verification

- The available panel shows **Termin wolny** alone; no date line in any vehicle/range combination
- One `Termin` field showing `1 kwi – 2 kwi 2026` + the day count; **Wybierz termin** before anything is picked
- Switching vehicle with a range already chosen no longer produces a date claim about another month
- At 390px the picker opens as a sheet over the form, survives taps beside the grid, and closes only on **Zastosuj**
- With the create held open the mobile sheet is gone — Phase 1's freeze re-run on the new layer
- Vision-diff against the re-rendered boards clean apart from recorded deviations

---

## Phase 7: Implementation-review findings (F1–F9)

### Overview

The full-plan implementation review (`reviews/impl-review.md`, 2026-08-21) returned no critical findings and
zero plan drift — every contract claim across Phases 1–6 verified literally against the code, and every
automated gate re-ran green. What it did surface is nine defects in the shipped surface, four of them
warnings. Two are behavioural and reachable on the happy path: the calendar's arrow keys do not move focus,
and the first click on any day briefly renders a validation error. Appended here rather than opened as a new
change for the same reason Phase 6 was — they live entirely in the code Phases 2–4 wrote.

### Changes Required

#### 1. Restore keyboard navigation in the calendar (F1)

**File**: `src/components/dashboard/ManualReservationCalendar.tsx`

**Intent**: `components={{ DayButton: MrDayCell }}` (:237) replaces shadcn's `CalendarDayButton`, and
`MrDayCell` (:82) drops the focus plumbing that component carries — `ui/calendar.tsx:134-141` keeps a
`useRef` plus `useEffect(() => { if (modifiers.focused) ref.current?.focus() })` and passes `ref={ref}`. The
only `.focus()` call in all of `react-day-picker` lives in its own default `DayButton`; the library moves
focus by state alone (`useFocus.js` → `setFocused`) and never touches the DOM. So arrow keys currently
update `modifiers.focused` and `tabIndex` while DOM focus stays on the first day button — Enter re-activates
the originally-focused day, and a screen reader announces it. The header comment at :32-34 asserts the
opposite ("the house pattern … gives keyboard and screen-reader behaviour for free"); `BookingWidget` earns
that for free precisely because it overrides only `labelDayButton`, never the component.

**Contract**: `MrDayCell` takes the `ref` + `modifiers.focused` effect verbatim from `CalendarDayButton` and
forwards `ref={ref}` to its `<button>`. The header comment is corrected to say the house pattern gives this
behaviour _when `DayButton` is overridden with the ref carried over_, so the next reader does not re-derive
the trap.

#### 2. Open the range on the first click (F2)

**File**: `src/components/dashboard/ManualReservationCalendar.tsx`

**Intent**: `<Calendar mode="range">` (:184) passes no `min`, so `useRange` forwards `undefined` and
`addToRange` takes its `min = 0` default, whose empty-range branch is
`range = { from: date, to: min > 0 ? undefined : date }` — the **first** click yields a same-day range.
`onSelect`'s `if (next?.from && next.to)` (:196) is therefore true on click one; `checkRangeBookable(busy, d, d)`
returns `ok` (rule 3 skips both endpoints), so no veto fires and `onChange(d, d)` pushes `pickup === returnDate`
into the modal. `resolveAvailability` then fails `validateDateRange` and the panel renders `invalid` —
"Data zwrotu musi być późniejsza niż data odbioru." — between the two clicks, with the trigger reading
"3 wrz – 3 wrz 2026" and the footer "0 dni". That is the "reads as broken rather than empty" state **D18**
was written to prevent. Verified at the library level: `addToRange(d, undefined)` → `{from: d, to: d}`;
`addToRange(d, undefined, 1)` → `{from: d, to: undefined}`.

**Contract**: `min={1}` on `<Calendar>`. Only `min > 1` triggers `addToRange`'s `diff < min` reset, so
one-day spans stay selectable and no other branch changes behaviour. After the first click the panel stays
`idle` and the trigger keeps its **Wybierz termin** empty state.

#### 3. Tell the calendar when the read is loading or failed (F3)

**Files**: `src/components/dashboard/ManualReservationCalendar.tsx`,
`src/components/dashboard/ManualReservationModal.tsx`,
`context/changes/manual-reservation-date-picker/design-contract.md`

**Intent**: `Props` (:116-125) carries `busyRanges` but no fetch state, and `useVehicleBusyRanges` wipes to
`setRanges([])` on failure — so `[]` means "no bookings", "still loading" and "read failed" identically. The
trigger is `disabled={busy}` only (modal :487), nothing gates it on `rangesState`, so the picker opens in the
error state over a fully-free month: `disabledDays` holds only the past-day matcher, `dayModifiers` is empty,
and the veto passes everything. The submit gate still holds — the panel resolves `error` and
`canCreateReservation` only passes `available` — so this cannot double-book; the harm is an employee reading
availability off the grid to a customer on the phone. It is worst on mobile, where the sheet is
`absolute inset-0 z-[70]` (modal :642) and covers the availability panel outright: the all-free grid is on
screen and "Nie udało się sprawdzić dostępności." is behind it.

**Contract**: the calendar takes `rangesState: BusyRangesFetchState` and the modal passes it at both call
sites (:524 desktop, :653 mobile). While `loading`, the grid is non-interactive; while `error`, the grid is
non-interactive and the popover/sheet carries the panel's own
**"Nie udało się sprawdzić dostępności."** — the same string, not a new one. Both are undrawn in the source,
so record them as `deviation(undrawn-state)` **D19** in the contract. The trigger stays enabled in both
states: it is the calendar that must stop asserting availability, not the entry point that must disappear
(the rejected alternative was `disabled={busy || rangesState !== "ready"}`, which makes the common path pay
for the rare failure and gives no reason for the dead button).

#### 4. Guard the effect's commit with the id it fetched for (F4)

**File**: `src/components/hooks/useVehicleBusyRanges.ts`

**Intent**: the effect's `.then` commits unconditionally (:79-82) while `refetch` guards the identical commit
with `if (currentId.current === vehicleId)` (:104, :110). The `AbortController` does not close the gap: on a
switch A→B the render-phase reset (:57-61) commits synchronously, but `controller.abort()` only runs when
React flushes passive effects, in a later task. A response for A landing in that window is neither aborted
nor filtered, so it paints A's busy days and resolves the panel under B's name until B's fetch lands — and a
failure for A can commit `state: "error"` against B. Narrow and self-healing, but it contradicts the hook's
own comment at :54-55, "the calendar must never paint another vehicle's busy days."

**Contract**: `currentId.current = vehicleId` moves into the render-phase reset block (:57-61), and both the
effect's `.then` and its `.catch` open with `if (currentId.current !== vehicleId) return;` — the guard
`refetch` already uses. The `AbortError` early-return stays; the two mechanisms are complementary, not
redundant. The comment at :63-68, which currently explains why the ref is assigned in the effect, is rewritten
to say why it is assigned during render.

> **Addendum (implemented 2026-08-21, `d933d17`) — shipped by a different mechanism.** The contract above is
> **not implementable in this project**: a render-phase ref write is an ESLint _error_ under
> `react-hooks/refs` ("Cannot access refs during render"), and `npm run lint` is success criterion 7.2. The
> ref and the render-phase reset are both **gone**. In their place the fetched answer carries the vehicle it
> belongs to — `{ vehicleId, ranges, state }` — and the guard is a render-time derivation
> (`data.vehicleId === vehicleId ? data.ranges : []`). A superseded response can only write data stamped with
> the old id, which the render for the new vehicle ignores, so there is no window to hit rather than a
> narrower one. `refetch` keeps a functional guard for the reverse ordering. Verified by forcing the
> **un-aborted** path (a held-open `refetch`, since the effect's fetch is killed by its `AbortController` and
> never reaches the guard at all). One behaviour change came with the reset's removal: A→B→A now re-shows the
> cached answer with no loading beat — see the hook comment.

#### 5. Keep the pre-flight uncacheable (F6)

**Files**: `src/components/hooks/useVehicleBusyRanges.ts`, `src/pages/api/vehicles/[id]/busy-ranges.ts`

**Intent**: `readBusyRanges` (:40) sets no `cache` option and the route's `json()` helper emits only
`Content-Type`. Phase 3 §4 justifies the whole pre-flight as "the answer that actually gates the write is
re-read at the moment of the write" — a cached 200 would silently defeat exactly that, and the staleness
window Phase 3 argued about would quietly reopen.

**Contract**: `readBusyRanges` passes `cache: "no-store"`, merged with the existing conditional `signal`.
Comment it against Phase 3 §4 so the reason survives.

#### 6. Survive a failed pre-flight (F7)

**Files**: `src/components/hooks/useVehicleBusyRanges.ts`, `src/components/dashboard/ManualReservationModal.tsx`

**Intent**: `refetch`'s catch runs `setRanges([]); setState("error")` (:112-113) and returns `null`, and
`submit()` correctly falls through to the POST. But if that POST also fails, the surface stays in `error` for
that vehicle with no way out — the effect is keyed on `vehicleId`, so the only recovery is switching vehicle
and back.

**Contract**: `refetch`'s catch sets `state: "error"` but **leaves `ranges` untouched**, so a failed re-read
does not also discard a good earlier answer (the `error` state already disarms submit, which is what keeps
this safe). `MrAvailability`'s error branch (:117-126) gains a **Spróbuj ponownie** action calling `refetch`.
The label is undrawn in the source — record it as `deviation(undrawn-state)` alongside D19.

> **Addendum (implemented 2026-08-21, `d933d17` + review fix) — the retry needs BOTH surfaces.** A
> panel-only retry is **unreachable in the state that needs it**: `MrAvailability`'s error branch only renders
> once a complete range is picked (`resolveAvailability` returns `idle` while either date is empty), and §3
> makes the grid `inert` on a failed read — so no range can be picked to reveal it. Driven with the route
> forced to 500: the picker showed the failure with **zero** retry affordances. The action therefore ships in
> the picker's notice _and_ the panel. Both strings are shared from `AVAILABILITY_COPY`
> (`src/lib/manual-availability.ts`) so the two surfaces cannot drift.
>
> **Review fix (F1).** §3's freeze and this carry-over initially cancelled out — the preserved ranges were
> drawn but `inert` (driven: `busyCells=3`, `pointer=blocked`). `gridUsable` now splits the two failures:
> a failed FIRST read (no ranges) stays inert; a failed RE-read keeps its carried answer operable. Submit
> stays disarmed in both via `canCreateReservation`.

#### 7. Two design-contract divergences (F8)

**Files**: `src/components/dashboard/ManualReservationCalendar.tsx`,
`context/changes/manual-reservation-date-picker/design-contract.md`

**Intent**: the review spot-checked roughly forty `exact` values and found two that diverge. (a) :100 puts
`opacity-75` on the `<button>`, so it fades the `--flota-busy` fill along with the label; the contract
(309-311, `exact`) scopes it to the label — composited over `--card` the fill renders ≈`#E1E5EA` instead of
`#D7DCE3`. (b) :248's `gap-1.5` on the month-nav row is a magic value with no basis in the contract, which
specifies the 26×26 buttons, radius 8, hairline and 13px chevron but no gap.

**Contract**: (a) the opacity moves to the label — `cell-busy-full` keeps its solid `--flota-busy` fill and
the text is `text-muted-foreground/75`; (b) the nav gap is transcribed from `MrCalendarPopover`'s header row
in the design source, or recorded as `deviation(undrawn-value)` if the source draws none.

#### 8. Stale references (F9)

**Files**: `src/components/hooks/useVehicleBusyRanges.ts`,
`context/changes/manual-reservation/design-contract.md`

**Intent**: two pointers into deleted code. The hook's comment at :53 cites "React's documented pattern, as
`useAvailability` uses it" — but Phase 3 §3 deleted `useAvailability` in this same slice. The S-12 contract's
available-state bullet still quotes **"Pojazd wolny do {d MMM}"** / **"Brak innych rezerwacji w tym okresie."**,
copy Phase 6 §1 retired; it defers to the S-12a contract's D10 so a reader lands correctly, but the line
itself is the same staleness that started this slice.

**Contract**: the comment names the pattern without the dead citation; the S-12 bullet drops the retired copy
and defers to D10 outright.

#### 9. Record `useMediaQuery` against Phase 6 §3 (F5)

**File**: `context/changes/manual-reservation-date-picker/plan.md`

**Intent**: `src/components/hooks/useMediaQuery.ts` is the one code file this plan never names. It is
justified — the picker needs two different tree positions (in flow under the trigger vs. a sibling layer over
the form sheet), which Tailwind variants cannot express without mounting two live copies of an interactive
widget — and SSR-safe, via `useSyncExternalStore` with a `() => false` server snapshot on a modal that only
mounts on click. Every sibling extra was recorded (the body-scroll lock in 6.12, `legend-busy-half` and
`showOutsideDays={false}` in 4.10); this one was not.

**Contract**: Phase 6 §3's **Files** line gains `src/components/hooks/useMediaQuery.ts`, with one sentence on
why a media-query hook rather than a responsive variant.

### Success Criteria

#### Automated Verification

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests pass: `npm test`

#### Manual Verification

- Tab into the grid, then arrow-key across days: DOM focus moves with the highlight, and Enter selects the
  day the arrows landed on — not the first one
- The first click on a free day leaves the panel `idle` and the trigger on **Wybierz termin**; no
  "Data zwrotu musi być późniejsza niż data odbioru." appears between the two clicks
- With the busy-ranges route forced to 500, the picker's grid is non-interactive and shows
  "Nie udało się sprawdzić dostępności." — on desktop **and** inside the mobile sheet, where the panel is
  covered; **Spróbuj ponownie** recovers the surface once the route is restored
- Switching vehicle rapidly never paints the previous vehicle's greying under the new vehicle's name
- The pre-flight request carries `no-store` and is not served from cache on a repeated create attempt
- A fully-blocked day's fill measures `#D7DCE3`, with only its label at 75% opacity
- Vision-diff against the six boards still clean apart from recorded deviations (now incl. D19)

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

### Phase 6: One `Termin` field, no date hint, mobile picker as its own layer

#### Automated

- [x] 6.1 Type checking passes: `npx astro check` — f8ade37
- [x] 6.2 Linting passes: `npm run lint` — f8ade37
- [x] 6.3 Build passes: `npm run build` — f8ade37
- [x] 6.4 Unit tests pass: `npm test` — f8ade37
- [x] 6.5 `nextBusyRangeAfter` is gone: `grep -rn "nextBusyRangeAfter" src` returns nothing — f8ade37

#### Manual

- [x] 6.6 The available panel shows **Termin wolny** alone; no date line in any vehicle/range combination (driven: panel text exactly "Termin wolny", box `align-items: center`; 0 matches for "Pojazd wolny do" / "Brak innych rezerwacji" across every range and vehicle tried) — f8ade37
- [x] 6.7 One `Termin` field showing `1 kwi – 2 kwi 2026` + the day count; **Wybierz termin** before anything is picked (driven: 1 trigger, h40/r10/13px/600, width 512 = full body width; "3 wrz – 5 wrz 2026" + "2 dni" at 12px/600 muted; "Wybierz termin" with no count when empty; 0 Odbiór/Zwrot captions; active border rgb(15,23,42) + 0 0 0 4px rgba(15,23,42,.06); tail centre x 660.0 = card centre x 660.0) — f8ade37
- [x] 6.8 Switching vehicle with a range already chosen no longer produces a date claim about another month (driven: 3–5 wrz picked, then vehicle switched → 0 date claims, panel simply re-resolves) — f8ade37
- [x] 6.9 At 390px the picker opens as a sheet over the form, survives taps beside the grid, and closes only on **Zastosuj** (driven at 390×844: `absolute inset-0 z-[70]`, rgba(20,18,22,0.5), items-end, rect exactly 390×844; panel rounded-t-[26px] / px-4 pt-3.5 pb-[22px] over a 40×4 handle, no card chrome inside; a tap beside the grid left sheet AND modal open; Zastosuj closed it. Desktop renders 0 sheet layers, mobile 0 in-flow cards) — f8ade37
- [x] 6.10 With the create held open the mobile sheet is gone — Phase 1's freeze re-run on the new layer (driven: 0 sheet layers, 0 day cells, trigger disabled, and a FORCED click on the frozen trigger still produced 0 layers. Also recorded: the sheet covers the footer, so on mobile a create cannot even be started while the picker is open) — f8ade37
- [x] 6.11 Vision-diff against the re-rendered boards clean apart from recorded deviations (punch-list empty; the only differences from the six boards are fixture data and the vehicle-thumbnail glyph already recorded in the S-12 contract) — f8ade37
- [x] 6.12 The page behind the modal no longer scrolls (added to this phase after manual verification surfaced it — pre-existing since S-12, not a Phase 6 regression: `document.body` was never locked, so a wheel over the scrim moved the dashboard 114px and the modal body's end chained through to the page. Fixed with the `MobileNav.tsx:65` idiom. Driven: overflow `hidden` while open incl. the done panel, `visible` again after X / scrim / Gotowe / a ClientRouter nav to /dashboard/calendar; modal body still scrolls internally 268/861) — f8ade37

### Phase 7: Implementation-review findings (F1–F9)

#### Automated

- [x] 7.1 Type checking passes: `npx astro check` — d933d17
- [x] 7.2 Linting passes: `npm run lint` — d933d17
- [x] 7.3 Build passes: `npm run build` — d933d17
- [x] 7.4 Unit tests pass: `npm test` — d933d17

#### Manual

- [ ] 7.5 Arrow keys move DOM focus across the grid and Enter selects the day the arrows landed on (F1)
- [ ] 7.6 The first click leaves the panel `idle` and the trigger on **Wybierz termin** — no return-before-pickup error between the two clicks (F2)
- [ ] 7.7 With the route forced to 500 the grid is non-interactive and shows "Nie udało się sprawdzić dostępności." on desktop and inside the mobile sheet (F3)
- [ ] 7.8 **Spróbuj ponownie** recovers the surface once the route is restored, and a failed re-read no longer discards good ranges (F7)
- [x] 7.9 Rapid vehicle switching never paints the previous vehicle's greying under the new vehicle's name (F4) (verified via the only path that reaches the guard: a HELD-OPEN response. Racing the effect is unfalsifiable — the AbortController kills the superseded request, `net::ERR_ABORTED`, so it passes with or without the guard. Driven instead with the old vehicle's re-read delayed past the new vehicle's answer: `[delivered] 44444444 200` landed after `[delivered] 11111111 200`, carrying blocked days, and the selected vehicle's grid held at busyCells=0, foreignPaintSeen=false)
- [ ] 7.10 The pre-flight request carries `no-store` and is not served from cache on a repeated create attempt (F6)
- [ ] 7.11 A fully-blocked day's fill measures `#D7DCE3` with only its label at 75% opacity; the nav gap is contract-backed (F8)
- [ ] 7.12 Vision-diff against the six boards clean apart from recorded deviations, now including D19 (F3, F7)
- [ ] 7.13 Stale references cleared: the hook's comment no longer cites the deleted `useAvailability`; the S-12 contract's available-state bullet no longer quotes the retired copy (F9)
- [ ] 7.14 Phase 6 §3's Files line records `src/components/hooks/useMediaQuery.ts` (F5)
