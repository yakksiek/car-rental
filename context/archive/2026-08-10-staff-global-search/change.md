---
change_id: staff-global-search
title: Staff global search — header ⌘K omnisearch across reservations / returns / vehicles / customers
status: archived
created: 2026-08-10
updated: 2026-08-26
archived_at: 2026-08-26T14:43:33Z
---

## Notes

Roadmap slice **S-13** (`context/foundation/roadmap.md`). Framing cohort:
`context/changes/staff-ops-features/frame.md`.

A logged-in employee searches across **reservations, returns, vehicles, and
customers** from a **header ⌘K search box** — grouped live results in a dropdown,
a resting state (recent searches + quick-jumps), and a no-results state. Desktop
dropdown + mobile full-screen. Full omnisearch as designed (owner decision).

> **Narrowed 2026-08-17, before merge, by `staff-search-dashboard-only`**: search
> is reached from **Pulpit only** and resolves **entirely in the dropdown**. The
> full results page (`/dashboard/search`) and the per-screen entry points are
> gone; the RPC's per-group cap rose 8 → 25 so the scrolling dropdown carries the
> whole result set. See `../staff-search-dashboard-only/change.md`.

Design mockup: `search-flow.jsx` (live in Claude Design
`352d78a6-84fd-49a2-8b38-2fe289691fc3`; pull via DesignSync).

Key net-new plumbing:

- A **new role-gated search RPC** — the reservations table SELECT is revoked and
  existing RPCs are pending-only / calendar-only; search over reservations
  (name / phone / reference / plate / dates) needs a new definer RPC. Vehicle
  search can reuse `listFleet`.
- **Klienci** is **derived from denormalized reservation fields** (no customer
  entity); **Zwroty** = return protocols (S-06).
- The **⌘K global shortcut** + a **full results page/route** are net-new.

**Coordination (cohort S-11/S-12/S-13) — this is the invasive one, sequenced LAST:**

- The staff header has **no action slot today**; several pages set
  `showHeader={false}` and draw their own headers. A persistent global search bar
  is a structural **`StaffShell` restructure** touching all staff pages.
- **Sequence last** so S-11 (owns the "Profil" nav entry) and S-12 (stays off the
  nav) land rebase-free; S-13 restructures the settled shell.
