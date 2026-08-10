# Manual reservation (staff-created confirmed booking) — Plan Brief

> Full plan: `context/changes/manual-reservation/plan.md`
> Frame brief: `context/changes/staff-ops-features/frame.md` (cohort frame — S-11/S-12/S-13)
> Design contract: `context/changes/manual-reservation/design-contract.md`

## What & Why

A logged-in employee creates a **confirmed** reservation by hand for a phone-in customer — vehicle +
dates + customer name/email/phone, with a live availability check — so the slot is atomically blocked
and the customer is emailed a confirmation. The booking is tagged **"Ręczna"**. This is the S-12 slice
of the staff-console cohort: net-new, but almost entirely reuse over one new atomic write path.

## Starting Point

The public funnel's `create_reservation_request` hardcodes `status='pending'` and `decide_reservation`
only flips an existing pending row — neither creates a confirmed booking. The overlap `EXCLUDE`
constraint, the reference minting, the confirmed-email path, and the modal-overlay idiom all already
exist; there is no origin marker on `reservations` and no client-reachable availability endpoint.

## Desired End State

From `/dashboard/reservations`, a "Nowa rezerwacja" button opens a modal (desktop-centered / mobile
sheet). The employee picks a vehicle + dates + customer details; the availability panel resolves live;
**Utwórz rezerwację** creates a confirmed, "Ręczna"-tagged booking, atomically overlap-checked, and emails
the customer the standard confirmation. The booking shows on the calendar (green) with a "Ręczna" chip.

## Key Decisions Made

| Decision              | Choice                                                 | Why (1 sentence)                                                                                      | Source |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------ |
| Confirmed create path | New `create_confirmed_reservation` definer RPC         | The existing create RPC is pending-only; a raw insert would skip reference minting + the atomic guard | Frame  |
| Email                 | Reuse `notifyReservationConfirmed` (extracted)         | RPC RETURNS the same 11 columns `decide_reservation` does → the confirmed-email path is unchanged     | Plan   |
| Required fields       | Name + email + phone                                   | Email drives the confirmation; both are DB `NOT NULL` — diverges from the mockup's name-only enable   | Plan   |
| "Ręczna" tag          | Persist a `source` column + surface on the calendar    | Staff can tell phone-in from public where bookings actually live; feeds future S-13 search            | Plan   |
| Conflict panel        | Simple "Termin zajęty" message                         | Reuses the boolean `isVehicleAvailable`; the atomic EXCLUDE map is the authority (no clash-PII card)  | Plan   |
| Form factor           | Modal reusing `ReservationDecision` overlay            | The mockup is a modal/sheet and the hand-rolled overlay pattern already exists (no shadcn Dialog)     | Plan   |
| Entry point           | Button above `<PendingQueue>` on the reservations page | Frame constraint: stay off the shell nav (S-11 owns it)                                               | Frame  |

## Scope

**In scope:** the `create_confirmed_reservation` RPC + `source` column + calendar-RPC `source`; a service
wrapper + extracted shared confirmed-email helper; a staff-gated `POST /api/reservations/manual` + a
staff-gated `GET /api/availability`; the modal + trigger island on the reservations page; a "Ręczna" chip
in the calendar detail.

**Out of scope:** the calendar-cell entry point; the quick-action menu extras (Nowy klient / Dodaj pojazd /
Szybkie wydanie); the rich conflict card; B2B/notes fields; a new calendar bar color; any shell-nav edit.

## Architecture / Approach

Bottom-up. A new SECURITY DEFINER RPC inserts `status='confirmed', source='manual'` under the existing
`reservations_no_overlap` EXCLUDE (conflict → typed `conflict`), mints the reference, and RETURNS the
email-shaped columns. A staff-gated endpoint (Origin → auth → role → zod → RPC) creates the booking and
reuses the extracted `notifyReservationConfirmed` (→ `reservationConfirmedEmail` + `sendTracked`). A modal
island (hand-rolled overlay) drives a debounced availability GET and the create POST. The `source` marker
threads into the calendar RPC/type and shows as a chip.

## Phases at a Glance

| Phase                  | What it delivers                                                             | Key risk                                                      |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Data layer          | `source` column + `create_confirmed_reservation` RPC + calendar-RPC `source` | Atomic conflict on **insert** (not transition); grant hygiene |
| 2. Service + endpoints | Wrapper + shared email helper + create POST + availability GET               | Email reuse hinges on the RETURN-shape match; self-gating     |
| 3. Modal + entry point | The modal island + reservations-page button                                  | Design fidelity (vision-diff); live-availability UX           |
| 4. Ręczna on calendar  | `source` in `CalendarReservation` + chip in the detail                       | Small — additive type + UI only                               |

**Prerequisites:** F-02 (roles), S-02 (reservation model + overlap), S-03 (confirmed state), S-05/S-06 (email seam + `email_deliveries`) — all done.
**Estimated effort:** ~2 sessions across 4 phases (1 migration + 2 endpoints + 1 modal + calendar tag).

## Open Risks & Assumptions

- **TOCTOU on availability.** The live GET is advisory; the atomic EXCLUDE inside the RPC is the authority — a race yields a `conflict` response, not a double booking (covered by an integration test).
- **Email-required tradeoff.** Requiring the customer's email diverges from the mockup's name-only enable; a phone-in customer with no email can't be booked this way (accepted — the confirmation is a core outcome).
- **Shared calendar surface.** Phase 4 touches `ReservationCalendar`/`map.ts`; S-13 touches the shell header (not the calendar), so no collision — but Phase 4 is isolated regardless.

## Success Criteria (Summary)

- A staff member creates a confirmed, "Ręczna"-tagged booking from the reservations page; the slot is atomically blocked and the customer is emailed the standard confirmation.
- An overlapping range is rejected ("Termin zajęty" live; `conflict` on submit) with no double booking.
- The booking appears confirmed on the calendar with a "Ręczna" chip; the modal matches the design contract on a vision-diff.
