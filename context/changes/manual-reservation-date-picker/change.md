---
change_id: manual-reservation-date-picker
title: Availability-aware date picker in the manual-reservation modal
status: impl_reviewed
created: 2026-08-18
updated: 2026-08-21
archived_at: null
---

## Notes

Roadmap slice **S-12a** (`context/foundation/roadmap.md`), a refinement of **S-12**
(`context/changes/manual-reservation/`).

The S-12 modal ships the design source's two native `<input type="date">` fields, so an employee picks
dates blind and only learns the range is taken after both are set and the debounced
`GET /api/availability` returns — while a customer waits on the phone. Meanwhile the **public** booking
widget greys out the selected vehicle's taken days on a range calendar. Staff have the weaker tool.

Replace the two inputs with that same calendar, scoped to the vehicle chosen in the modal's picker.

**Reuse (most of this already exists):**

- `get_vehicle_busy_ranges(uuid)` — already granted to `anon, authenticated`, so **no migration**.
- `getVehicleBusyRanges()` — `src/lib/services/reservations.ts:289`.
- `dayAvailabilityMap()` / `checkRangeBookable()` — `src/lib/availability.ts:116,157`; pure, unit-tested.
- `ui/calendar` + `react-day-picker` v10 — already dependencies.
- `src/components/vehicle/BookingWidget.tsx:217-260` — working reference, including the S-02a half-day
  turnaround modifiers (return 10:00 / pickup 14:00).

**Net-new:** a staff-gated `GET /api/vehicles/[id]/busy-ranges` (mirroring `api/availability.ts`). The
public path gets by without one because the vehicle is fixed by the URL and
`fleet/[id]/[...slug].astro` fetches server-side; the modal switches vehicle client-side.

**Design blocker — RESOLVED 2026-08-20, it was never real.** A DesignSync pull during `/10x-plan`
found that `manual-reservation.jsx` **already draws the calendar**: `MrCalendarPopover` (availability-aware,
half-day cells via the shared `busyHalves`/`DayCell` atoms, 3-item legend, "Zastosuj") plus `MrD_Pick` /
`MrM_Pick` boards, with the `Termin` fields as `mrDateBtn` **buttons**, not native date inputs. The source was
updated after S-12's screenshots were exported. So no mock edit is needed — but the six boards still have to be
**exported** into `design-review/` (empty today; the design contract's verdict is "BLOCKED — awaiting 6
canonical screenshots"), which is this slice's one remaining blocker. Instead of a mock edit, the **S-12
contract is wrong** where it records the native inputs `exact` (same class of error as the three lines its Phase 7 already
corrected), and the 10 S-12 screenshots are stale for the `Termin` block. See
`design-contract.md` in this folder.

**Open scope questions — resolved at plan time (2026-08-20):**

- **Availability check:** `checkRangeBookable` becomes the gate; the debounced `/api/availability` is deleted
  (it has no other caller). The `EXCLUDE` constraint stays the authority either way.
- **D2 affordances:** the dates-only hint is **in** ("Pojazd wolny do {date}", with the source's own
  "Brak innych rezerwacji w tym okresie." fallback); the clashing-booking card is **out** — it needs customer
  identity the PII-safe RPC deliberately withholds, as does the source's `· kolejna rez. {reference}` clause.
- **S-12's unimplemented Phase 9** (F11 in-flight form freeze, F12 stale conflict banner) is **absorbed as this
  plan's Phase 1** — both live in the lifecycle this slice rewrites.

Plan: `plan.md` · Brief: `plan-brief.md` · Design: `design-contract.md` · Review: `reviews/plan-review.md`
