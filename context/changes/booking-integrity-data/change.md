---
change_id: booking-integrity-data
title: Vehicle/reservation data model with hotel-style overlap rule
status: planned
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

Roadmap item F-01 (foundation), from `context/foundation/roadmap.md`. North-star prerequisite.

Outcome: vehicle + reservation schema with RLS, the hotel-style availability/overlap rule (return by 10:00, pickup from 14:00; same-day turnover allowed) implemented and unit-verifiable, plus a minimal seed so the public catalog can render. Not user-visible on its own.

- PRD refs: FR-005, Guardrails (no double bookings — core data integrity guarantee), Business Logic (availability enforcement).
- Unlocks: S-01 (catalog), S-02 (north star overlap block), S-04 (real fleet CRUD), S-07 (overdue computed from dates).
- Watch the same-day buffer: an off-by-one in the overlap window either loses same-day revenue or admits a conflict.
- Scope cap: vehicles + reservations + the rule only. Protocol and employee-role schema come later (S-05/S-06, F-02), not here.
