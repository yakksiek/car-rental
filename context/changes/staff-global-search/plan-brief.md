# Staff global search (header ⌘K omnisearch) — Plan Brief

> Full plan: `context/changes/staff-global-search/plan.md`
> Frame brief: `context/changes/staff-ops-features/frame.md` (cohort frame — S-11/S-12/S-13)
> Design contract: `context/changes/staff-global-search/design-contract.md`

## What & Why

Give staff a **⌘K global search** in the console header: type a query → grouped live results
(**Rezerwacje / Zwroty / Pojazdy**) in a dropdown → jump to a result, or Enter → a full results page with
filter chips. Desktop = a persistent inline header field + dropdown; mobile = a full-screen search from the
tab bar. This is S-13, the invasive member of the staff-console cohort — sequenced **last** so S-11 and S-12
land rebase-free.

## Starting Point

Reservations table SELECT is revoked (all reads go through definer RPCs), so search needs a new one. The
staff shell has no header action slot and no mobile header; 5 of 10 staff pages hand-roll their own desktop
headers. There's no cmdk, no global-hotkey precedent, and no per-reservation detail route.

## Desired End State

From any staff page, ⌘K (or the header field / mobile search icon) opens search; typing shows grouped live
results that deep-link to their surfaces (reservation → calendar focus, return → return flow, vehicle →
edit); Enter opens `/dashboard/search?q=`. Before typing, the dropdown shows quick-jumps with live counts.

## Key Decisions Made

| Decision                | Choice                                              | Why (1 sentence)                                                                      | Source           |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------- |
| Search backend          | One role-gated `search_staff` definer RPC (ILIKE)   | Reservations SELECT is revoked; ILIKE fits the small dataset                          | Frame + Research |
| Groups                  | Rezerwacje / Zwroty / Pojazdy (omit Klienci)        | No customer entity/page; a name still matches within reservations                     | Plan             |
| Shell surfacing         | Persistent inline header field on all desktop pages | Faithful to the mockup + owner "as designed"; the invasive restructure                | Plan             |
| Mobile entry            | Search icon in the floating tab bar → full-screen   | Shared/global, lowest blast radius (no shell mobile header exists)                    | Plan             |
| Command list / keyboard | Add the `cmdk` package                              | Battle-tested filtering + ↑↓ nav; much less hand-rolled code                          | Plan             |
| Resting state           | Quick-jumps only (omit recent searches)             | Avoids caching customer-name queries on shared terminals; quick-jumps carry the value | Plan             |
| Reservation deep-link   | Calendar focus                                      | The one view that shows any reservation; reuses a shipped link (no detail route)      | Plan             |

## Scope

**In scope:** the `search_staff` RPC + `GET /api/search` + service/types; the StaffShell restructure
(persistent desktop header field on all 10 pages, mobile tab-bar search icon, `active="search"`, global ⌘K
listener, cmdk); the live dropdown (3 groups, resting quick-jumps, no-results, keyboard nav, deep-links); the
`/dashboard/search` results page with filter chips (desktop + mobile).

**Out of scope:** the Klienci group; recent-searches persistence; FTS/tsvector; a search nav tab; the
calendar shortcut button; any dependency on S-12's `source` column.

## Architecture / Approach

One `search_staff(p_query)` SECURITY DEFINER RPC (role-gated, ILIKE, tagged rows) behind a role-gated `GET
/api/search`. A `GlobalSearch` React island lives in the (Astro) shell header (cmdk `Command` inline in a
radix Popover) and as a mobile full-screen view; a `useSearch` hook debounces the fetch. A net-new global ⌘K
`keydown` listener binds on `astro:page-load` (view-transitions). Enter → a standard `/dashboard/search?q=`
page that SSRs the query + initial results and hydrates a chip-filtered island.

## Phases at a Glance

| Phase                         | What it delivers                                                   | Key risk                                                                        |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1. Search backend             | `search_staff` RPC + `GET /api/search` + service/types             | RLS/role gate + revoke/grant hygiene; ILIKE shape                               |
| 2. Shell restructure + entry  | Persistent header field on all 10 pages, mobile tab icon, ⌘K, cmdk | The invasive shared-surface change; view-transition rebind; page reconciliation |
| 3. Live dropdown + deep-links | Grouped results, quick-jumps, no-results, keyboard nav             | Debounce/cancellation; correct state-specific deep-links                        |
| 4. Full results page          | `/dashboard/search?q=` + filter chips + mobile                     | Chip filtering; deep-link parity                                                |

**Prerequisites:** F-02, S-02/S-03 (reservations), S-04 (vehicles), S-05/S-06 (returns) — all done. **Merge last** in the cohort.
**Estimated effort:** ~2–3 sessions across 4 phases (1 RPC + shell restructure + island + results page).

## Open Risks & Assumptions

- **Shared StaffShell restructure.** The persistent field touches all 10 pages (5 with custom headers) — the reason S-13 is last; Phase 2 isolates it. Adds `"search"` to the `active` union (append-only over S-11's `"me"`).
- **Mobile tab-bar density (cross-slice).** Once S-11's Profil tab and this search icon both merge, the icon-only pill carries up to 9 entries (admin) — Phase 2 must check it doesn't overflow at 360px and apply a recorded fallback if it does (see the plan's Critical Implementation Details).
- **⌘K + view-transitions.** The global listener must rebind on `astro:page-load` or it dies after the first SPA swap.
- **Independent of S-12.** The search RPC must not reference S-12's unmerged `source` column.
- **Canonical screenshots pending.** The contract is transcribed from `search-flow.jsx`; the rendered vision-diff needs the mockup PNGs in `design-review/`.

## Success Criteria (Summary)

- Staff open search via ⌘K / the header field / the mobile icon from any page (surviving view-transition navs); typing shows grouped live results that deep-link correctly.
- Enter opens `/dashboard/search?q=` with working filter chips; the dropdown, results page, and mobile views match `search-flow.jsx` (minus recorded deviations).
- Search is role-gated (a non-staff caller gets nothing).
