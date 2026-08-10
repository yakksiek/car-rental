---
change_id: staff-global-search
title: Staff global search — header ⌘K omnisearch across reservations / returns / vehicles / customers
status: implemented
created: 2026-08-10
updated: 2026-08-10
archived_at: null
---

## Notes

Roadmap slice **S-13** (`context/foundation/roadmap.md`). Framing cohort:
`context/changes/staff-ops-features/frame.md`.

A logged-in employee searches across **reservations, returns, vehicles, and
customers** from a **header ⌘K search box** — grouped live results in a dropdown,
a resting state (recent searches + quick-jumps), a no-results state, and
**Enter → a full results page** with filter chips. Desktop dropdown + mobile
full-screen. Full omnisearch as designed (owner decision).

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
