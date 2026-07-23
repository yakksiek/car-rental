---
change_id: overdue-returns-dashboard
title: Overdue returns dashboard
status: impl_reviewed
created: 2026-07-23
updated: 2026-07-23
archived_at: null
---

## Notes

Framed 2026-07-23 — see [frame.md](frame.md). Key outcome: FR-012's "flag overdue"
is already functionally shipped by S-06's Zwroty returns worklist, so this slice is
**scoped to visibility polish only, flag-only** — nav badge on "Zwroty" (reuse the
`pendingCount` pattern), clickable stat-card filters in `ReturnQueue`, a days-overdue
(`OPÓŹNIENIE`) label. No new tables, no writes.

**Explicitly out of this slice** (user decision, "split — plan S-07 visibility first"):

- **Extend-rental** — deferred to its own future slice (a new write capability:
  `extend_reservation` RPC, EXCLUDE-conflict handling, in-progress gate, recomputed
  total via `estimatedTotal`, confirmation email). Needs its own FR + roadmap entry.
- **Penalty / late-fee** (`STAWKA KARY` / `NALICZONE`) — v1 PRD Non-Goal; → v2.
- **Last-contact tracking** (`OSTATNI KONTAKT`) — needs new storage; Contact stays a
  plain `tel:` link if included at all.

**Design review 2026-07-23** — 6 canonical artboards captured in `design-review/`
(EN toggle → **reference-only**, Polish in `design-contract.md` is canonical). Scope
reconciled against the mockups: **`Zadzwoń` Call kept** as a plain `tel:` link (adds
`customer_phone` to the `list_returns_today` RPC — a read-only column, no logging);
**header search bar + trend sparkline cut** (out of FR-012 / no data source); **stat
area rebuilt as a filter bar** (desktop unified bar; mobile 4 scrollable pills,
superseding the earlier 2-chip call); mobile badge shows a **count when the tab is
active**, dot when inactive. Plan + contract + brief updated accordingly. Design
Alignment Audit: **PASS (conditional)** — a few selected-state values remain
`provisional` pending artboards/JSX.
