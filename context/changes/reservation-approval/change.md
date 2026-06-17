---
change_id: reservation-approval
title: Employee accept/reject of pending reservation requests
status: planned
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

Seeded from `context/foundation/roadmap.md` — slice **S-03: Reservation approval** (Stream B, employee handover lifecycle).

- **Outcome:** A logged-in employee can view all pending reservation requests and accept or reject each one; accepting confirms the booking against the overlap rule.
- **PRD refs:** US-01, FR-009, FR-010.
- **Prerequisites:** F-02 (employee/admin roles — done) and S-02 (public-reservation-request).
- **Dependency state (verified in code 2026-06-17, roadmap status is stale):** S-02 is **effectively shipped** despite the roadmap marking it "proposed" — migration `supabase/migrations/20260611171737_public_reservation_request.sql`, API `src/pages/api/reservations.ts`, form `src/pages/reserve.astro` + `ReservationForm.tsx`, service `src/lib/services/reservations.ts`. So **S-03 is unblocked.** Requests land in `'pending'` (status enum `pending → confirmed/rejected/cancelled`, defined in `20260603155136_booking_integrity_data.sql`).
- **Scope to build:** a pending-reservation list page for employees, accept/reject status-transition RPC + API route(s), reservation service mutations (`approveReservation`/`rejectReservation`), and confirm/reject notification emails (reuse S-02's `sendEmail` helper). Dashboard is currently a placeholder (`src/pages/dashboard.astro`).
- **Risk:** Accepting turns a request into a confirmed booking — re-check the overlap rule at accept time (a conflicting reservation may have been confirmed since submission). This confirmed-reservation state is what S-05 (issue-protocol) depends on.
- **Parallelizable with S-04 (fleet-management):** mutually code-independent (different tables); shared-file merge surface if run in parallel worktrees is `src/lib/access.ts`, `src/pages/dashboard.astro`, `src/types.ts`, and the generated `src/db/database.types.ts`.
