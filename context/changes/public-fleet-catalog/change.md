---
change_id: public-fleet-catalog
title: Public fleet catalog — browse, filter by specs/dates, view vehicle detail card
status: implemented
created: 2026-06-05
updated: 2026-06-07
archived_at: null
---

## Notes

Roadmap item S-01 (first public slice), from `context/foundation/roadmap.md`. First user-visible surface in Stream A (public booking funnel); precedes the north star S-02.

Outcome: a visitor can browse vehicles by category, filter by specs and available dates, and open a vehicle detail card with technical specs, cargo dimensions, photos, and pricing.

- PRD refs: US-01, FR-001, FR-002, FR-003.
- Prerequisites: F-01 (`booking-integrity-data`, implemented) — the catalog renders off its schema + seed.
- Parallel with: F-02, S-04, S-08.
- Unlocks/feeds: S-02 (`public-reservation-request`, north star) consumes the same catalog + date selection.
- Design point (not a blocker): date-availability filtering must read the SAME overlap rule the server enforces (hotel-style: return by 10:00, pickup from 14:00, same-day turnover allowed) — client picker and server rule must agree or visitors see phantom availability. Owner: TBD.
- Risk: low (first public surface), but only renders once F-01's seed exists. Keep category handling graceful for a small fleet (PRD note on FR-001).
