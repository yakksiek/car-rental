---
change_id: fleet-management
title: Fleet management — add, edit, and remove vehicles with a deletion guard
status: implementing
created: 2026-06-17
updated: 2026-06-25
archived_at: null
---

## Notes

Roadmap slice **S-04** (`context/foundation/roadmap.md`).

- **Outcome:** A logged-in employee can add and edit vehicles in the fleet, and remove a vehicle — with removal blocked when active reservations exist (employee must cancel them first).
- **PRD refs:** FR-011
- **Prerequisites:** F-01 (booking-integrity-data — vehicle/reservation schema, done), F-02 (employee-admin-roles — role gating, done)
- **Parallel with:** S-01, S-02, S-03, S-07, S-08
- **Risk:** Replaces F-01's seed with real CRUD; the deletion guard protects integrity (no orphaned active reservations). Fully independent of the booking and protocol chains.
