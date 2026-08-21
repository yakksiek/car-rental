---
change_id: manual-reservation
title: Manual reservation — staff-created confirmed booking for a phone-in customer
status: implemented
created: 2026-08-10
updated: 2026-08-21
archived_at: null
---

## Notes

Roadmap slice **S-12** (`context/foundation/roadmap.md`). Framing cohort:
`context/changes/staff-ops-features/frame.md`.

A logged-in employee creates a **confirmed** reservation by hand for a phone-in
customer — pick vehicle + dates/times, enter customer name/phone/email, with a
**live availability check** — the slot is blocked in the calendar and the customer
is emailed a confirmation. Tagged **"Ręczna"** (manual).

Key net-new plumbing: a **`create_confirmed_reservation` SECURITY DEFINER RPC** —
the existing `create_reservation_request` hardcodes `status='pending'`
(`…reservation_b2b_fields.sql:71-78`) and `decide_reservation` only transitions
existing rows. The new RPC gates on `current_app_role() IN ('employee','admin')`,
inserts `status='confirmed'`, mints the reference via the existing sequence; the
`EXCLUDE` constraint protects it atomically. Reuses the overlap pre-check
(`isVehicleAvailable`/`available_vehicles`) and the confirmed-email template.

Design mockup: `manual-reservation.jsx` (live in Claude Design
`352d78a6-84fd-49a2-8b38-2fe289691fc3`; pull via DesignSync).

**Scope / coordination:**

- **Entry point on the reservations page, NOT the nav** — avoids a nav-registry
  clash with S-11 (which owns the "Profil" nav entry). S-12 stays off the shell nav.
- Quick-action menu extras (**Nowy klient / Dodaj pojazd / Szybkie wydanie**) are
  **out of scope** ("Nowy klient" implies a customer DB v1 lacks).
- The mockup's calendar-cell-click entry point is a possible follow-up, not this slice.
- **Blind date fields are a known gap, split out as S-12a** (`manual-reservation-date-picker`): the modal
  ships the source's two native `<input type="date">`, so availability only lands after both dates are
  picked. The public booking widget already greys a vehicle's taken days; staff get the weaker tool. The
  source's own "next free" hint — dropped as **D2** because the boolean check can't populate it — is the
  cheaper half of the same gap.
