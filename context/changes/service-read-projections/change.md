---
change_id: service-read-projections
title: Service-layer read projections — ship only the columns consumers actually read
status: new
created: 2026-08-24
updated: 2026-08-25
archived_at: null
---

## Notes

Split out of `staff-quick-actions` on 2026-08-24. Surfaced there as an incidental finding, but
the real question is broader than the one function that triggered it, so it gets its own change
rather than riding along as a phase.

**The trigger.** `listFleet` (`src/lib/services/vehicles.ts:366-387`) reads `select("*")` — all 23
columns of `vehicles` — and serves two callers with opposite needs:

- `dashboard/vehicles.astro:19` → `FleetList`, which genuinely renders the full row (photos, cargo
  dimensions, rates).
- `dashboard/reservations.astro:23` → `ManualReservationModal`, which reads **seven** fields:
  `id`, `name`, `make`, `model`, `plate`, `daily_rate`, `deposit` (`ManualReservationModal.tsx:87`,
  `:328`, `:344`, `:466`, `:485-486`, `:631`, `:636`).

**Measured on local Supabase, 7 active vehicles (2026-08-24):**

| Projection                     | Bytes (JSON) |
| ------------------------------ | ------------ |
| `select("*")`                  | **4906**     |
| the 7 columns the picker reads | **1183**     |
| `photos` alone                 | 995          |

So 4.1×, and `photos` is only ~27% of the waste — the rest is the spread of the other 15 unused
columns. Trimming `photos` alone would not fix it; the projection has to be explicit.

**Why it is not a one-line change.** The two callers share the function, so narrowing `select("*")`
in place breaks the fleet page. It needs an `opts.columns` argument or a separate
`listFleetForPicker()`. In-repo precedent for a narrow projection: `getCategoryCounts`
(`vehicles.ts:119`) does `select("category")`.

**Why the scope is wider than `listFleet`.** Two other reads in this family were noticed while
researching `staff-quick-actions`, which is what argues for a survey rather than a spot fix:

- `listPendingReservations` (`src/lib/services/reservations.ts:188-198`) returns full reservation
  rows, and **nine of ten staff pages call it only to read `.length`** for the shell's "Wnioski"
  nav badge. A `count_pending_reservations` RPC — mirroring the existing `count_overdue_returns`
  (`protocols.ts:385-395`) — would pay back across every staff page.
- Astro islands serialize their props into the page HTML, and with `<ClientRouter />` active
  (`Layout.astro:28`) and nothing marked `transition:persist`, an over-fetched prop is re-shipped
  and re-parsed on **every** staff→staff navigation, not cached once.

**~~Take into consideration while planning — a user-visible bug rides on this decision.~~ FIXED
2026-08-25, so it no longer rides on this change.** The "Wnioski" nav badge read 0 on
`/dashboard/protocols/[id]` — the one staff page that never passed `pendingCount`. S-12b Phase 3 took
exactly the cheap fix this note argued against (`listPendingReservations` + `.length`, the tenth
duplicated read), because the badge was misleading _today_ and the RPC was not going to land in that
slice. `known-issues.md` records it as closed.

**The efficiency half of that argument still stands, and is now the whole of it.** Nine — now ten —
staff pages fetch full reservation rows only to read `.length`. A `count_pending_reservations` RPC
mirroring `count_overdue_returns` removes all ten. This change no longer has a user-visible defect
attached to justify it; it is a pure efficiency case.

**Open question for research:** how many service-layer reads in `src/lib/services/` fetch columns
their consumers never touch, where does the cost actually land (Worker→Supabase round trip, island
props in HTML, client bundle), and which fixes are worth making versus noting? Severity is
efficiency, not correctness — nothing here is user-visible or broken today.

**Related:** `context/archive/2026-08-21-staff-quick-actions/` — the change this split off from,
merged and archived 2026-08-25.

**~~Sequencing matters: if that lands first, this becomes a second pass over the same code.~~
Resolved — it landed first and the concern did not materialise.** The worry was that its plan would
multiply `listFleet`'s `select("*")` across ~10 staff pages. It did the opposite: rather than passing
the fleet as an SSR prop to every page, it added `listFleetForPicker` — a 7-column projection behind
a lazy `GET /api/vehicles` that fires at most once per page view — and **removed** the `listFleet`
call from `reservations.astro` entirely. Measured 1149 B vs 4918 B for the same seven vehicles.

So `listFleet` itself is untouched and still `select("*")`, serving `/dashboard/vehicles` alone, which
genuinely renders the full row. That narrows this change rather than enlarging it: the picker case is
already solved, and what remains is the survey of every _other_ service-layer read.
