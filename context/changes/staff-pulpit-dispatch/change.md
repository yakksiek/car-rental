---
change_id: staff-pulpit-dispatch
title: Rebuild the staff pulpit into the full dispatch cockpit (desktop + mobile)
status: implemented
created: 2026-07-24
updated: 2026-07-28
archived_at: null
---

## Notes

Rebuild the `/dashboard` staff pulpit into the full dispatch cockpit (desktop + mobile)
to match the updated design. The current pulpit is a thin "Wymaga decyzji + two link
cards" page — it shipped as an intentional slice at S-03 with pickups/returns/overdue
deferred to S-05/S-06/S-07, which are now all done.

- **Desktop:** greeting header, 4 clickable KPI stat cards (incl. filled-danger Overdue
  - PILNE), two-column layout — grouped Today's Schedule (Wydania/Zwroty with progress
    counters + done-state rows) on the left, Need-a-decision rail on the right.
- **Mobile:** header (keep "Pulpit" title; search deferred), functional filter chips
  (Wszystko / Wydania / Zwroty / Wnioski), Pickups today, Returns today, Pending
  requests; remove the two link cards.
- **Reuse:** `NeedDecisionPanel`, `PickupQueue`/`ReturnQueue` row rendering. **Wire:**
  `listDispatchToday` + `listReturnsToday` into `dashboard.astro` (mirror `pickups.astro`).
  Completion state derives from `DispatchRow.protocol_id` (null = awaiting → "Protokół";
  set = done → "Zakończone"). No new backend.
- **Nav unchanged** — the design's sidebar + mobile bar already match the built employee
  nav (verified against live capture).
- **Deferred:** real `Szukaj…` search backend, the mobile Profile tab (icon stays inert
  this slice), and any nav/role restructuring.

Design fidelity artifacts colocated in this folder:

- `design-audit.md` — full discrepancy audit + decisions + navigation map.
- `design-targets/` — updated desktop (v3) + mobile target mockups.
- `current-state/` — live pulpit screenshots (desktop + mobile) captured 2026-07-24 via
  the Playwright employee harness, confirming the gap.
