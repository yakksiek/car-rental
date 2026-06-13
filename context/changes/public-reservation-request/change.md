---
change_id: public-reservation-request
title: Public reservation request with no account; overlaps blocked on submit
status: implementing
created: 2026-06-07
updated: 2026-06-13
archived_at: null
---

## Notes

Seeded from `context/foundation/roadmap.md` → **S-02: Public reservation request (north star)**.

- **Outcome:** A visitor can submit a reservation request (name, email, phone, vehicle, dates) without an account, and overlapping dates on an already-booked vehicle are blocked before submission; the request lands for employee approval.
- **PRD refs:** US-01, FR-004, FR-005
- **Prerequisites:** F-01 (booking-integrity-data, done), S-01 (public-fleet-catalog)
- **Risk:** This is the validation milestone — the overlap block must fire before submission, not as a post-hoc rejection, per the success criterion. The client-side date picker must agree with the server-side overlap rule or customers see phantom availability and a confusing late rejection.
