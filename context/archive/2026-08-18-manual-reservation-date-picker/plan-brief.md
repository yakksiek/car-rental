# Availability-Aware Date Picker in the Manual-Reservation Modal — Plan Brief

> Full plan: `context/changes/manual-reservation-date-picker/plan.md`
> Design contract: `context/changes/manual-reservation-date-picker/design-contract.md`

## What & Why

The staff manual-reservation modal ships two blind `<input type="date">` fields, so an employee picks dates
without seeing availability and only learns "Termin zajęty" after both dates are set and a debounced round-trip
returns — while a customer waits on the phone. The public booking widget already greys a vehicle's taken days
on a range calendar; staff have the weaker tool. This slice gives them the same calendar, scoped to the vehicle
selected in the modal.

## Starting Point

Everything except the delivery path already exists: `get_vehicle_busy_ranges` is a PII-safe definer RPC already
granted to `anon, authenticated`, `dayAvailabilityMap` / `checkRangeBookable` are pure and unit-tested,
`react-day-picker` is a dependency, and `BookingWidget.tsx:217-260` is a complete working reference. The one
gap is reachability — the busy-ranges read is server-side only today, because the public page has its vehicle
fixed by the URL while the modal switches vehicle client-side.

## Desired End State

Tapping **Odbiór** or **Zwrot** expands a one-month range calendar in flow beneath the two fields. The selected
vehicle's blocking reservations are greyed — interiors solid, changeover days split on the diagonal — fully
blocked days are unclickable, and a range colliding on a changeover boundary is vetoed with a specific hint.
The availability panel resolves instantly with no network call, reading "Pojazd wolny do {date}" or
"Brak innych rezerwacji w tym okresie."

## Key Decisions Made

| Decision                  | Choice                                                  | Why                                                                                           | Source |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| Availability authority    | Local `checkRangeBookable`; delete `/api/availability`  | One source of truth, so calendar and panel can't disagree; the endpoint has no other caller.  | Plan   |
| Busy-range delivery       | Staff-gated `GET /api/vehicles/[id]/busy-ranges`        | Payload scales to the vehicle in view and re-reads on each switch; thin wrapper over the RPC. | Plan   |
| D2 affordances            | Dates-only "next free" hint in; PII clashing card out   | The dates are already in the payload; the card needs customer identity the RPC withholds.     | Plan   |
| Picker presentation       | The source's date buttons expanding an in-flow calendar | It's what the canonical design draws — and it keeps the mobile sheet readable at rest.        | Design |
| Legend                    | Source legend verbatim (3 items)                        | Canonical Polish, and its wording explains the half-day rule better than the public widget's. | Plan   |
| Busy-cell fill            | Port the source's `#D7DCE3` + divider as new tokens     | Keeps the new surface `exact` without restyling the shipped public calendar mid-slice.        | Plan   |
| S-12's unfinished Phase 9 | Absorbed as this plan's Phase 1                         | F11/F12 live in the exact lifecycle this slice rewrites; fixing twice would be wasted work.   | Plan   |
| Test scope                | Unit + integration, no new e2e                          | Covers what fails silently — pure date logic and a self-gating `/api` route.                  | Plan   |

## Scope

**In scope:** the staff-gated busy-ranges route + client hook; local availability resolution replacing the
debounced GET; the `Termin` date buttons and calendar popover; the dates-only next-free hint; S-12's F11/F12
fixes; two new busy-cell tokens; unit + integration coverage; the design-contract corrections.

**Out of scope:** any migration or new RPC; the clashing-booking card and the `kolejna rez.` reference clause;
restyling the public `BookingWidget`; the calendar-cell entry point and quick-action menu; a new e2e spec; the
"Pojazd w serwisie" state.

## Architecture / Approach

`ManualReservationModal` → `useVehicleBusyRanges(vehicleId)` → `GET /api/vehicles/[id]/busy-ranges` →
`getVehicleBusyRanges` → `get_vehicle_busy_ranges` RPC. The fetched ranges feed both the calendar
(`dayAvailabilityMap` for cell states, `checkRangeBookable` for the `onSelect` veto) and the availability panel
(`resolveAvailability`). Nothing in the client is authoritative: the `EXCLUDE` constraint inside
`create_confirmed_reservation` remains the sole arbiter, and a lost race is still a 409 on the create.

## Phases at a Glance

| Phase                                           | What it delivers                                              | Key risk                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Carry over S-12's correctness fixes          | Form frozen mid-POST; conflict banner cleared on range change | Touches code Phase 4 rewrites — two `disabled` attrs are throwaway         |
| 2. Busy-ranges endpoint + hook                  | Staff-gated route, abortable client hook, integration tests   | A self-gating `/api` route is the shape that has leaked here before        |
| 3. Local resolution; retire `/api/availability` | Instant, network-free panel; endpoint deleted                 | Deleting a working tested route — reversible, but a one-way door in review |
| 4. The `Termin` surface swap                    | Date buttons + in-flow calendar, legend, hint, new tokens     | Largest surface; mobile sheet must absorb the calendar; vision-diff        |
| 5. Verification + vision-diff gate              | Full suite green, punch-list empty, change closed             | Blocked until the 6 canonical screenshots land                             |

**Prerequisites:** local Supabase running for the integration suite; **6 screenshots exported** from the Claude
Design project into `design-review/` (see the design contract's hand-off table) before Phase 5 can close.

**Estimated effort:** ~2–3 sessions across 5 phases. Phases 1–3 are small and mechanical; Phase 4 is the bulk.

## Open Risks & Assumptions

- **The design source was updated after S-12 shipped.** Its 10 screenshots and the S-12 contract's "Termin"
  section are stale. This plan corrects the contract rather than the design — but it assumes the current source
  is the intended one, not a work-in-progress.
- **The vision-diff gate is blocked** until `MrD_Pick` / `MrM_Pick` and the four re-exported form boards land.
- **Two busy-cell treatments will coexist** — staff `#D7DCE3` vs public `#EEF1F5` — until the recorded
  follow-up reconciles `BookingWidget`.
- **Busy ranges go stale while the modal is open**; nothing re-polls. This is unchanged from today's debounced
  boolean, and the 409 path remains the catch.
- Deleting `/api/availability` also drops the `is_active` filter that `available_vehicles` applied, so a vehicle
  deactivated mid-session is caught at create time rather than in the panel. Already the case for the GET path.

## Success Criteria (Summary)

- An employee sees the selected vehicle's taken days **before** picking, and switching vehicle repaints them.
- A colliding range cannot be selected — it is vetoed with a hint naming which boundary failed.
- The availability panel answers with no network request, and the mobile sheet keeps its footer total visible
  with the calendar open.
