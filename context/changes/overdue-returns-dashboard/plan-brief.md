# Overdue Returns Dashboard (S-07) — Plan Brief

> Full plan: `context/changes/overdue-returns-dashboard/plan.md`
> Frame brief: `context/changes/overdue-returns-dashboard/frame.md`
> Design rebuild brief: `context/changes/overdue-returns-dashboard/design-rebuild-brief.md`
> Design contract: `context/changes/overdue-returns-dashboard/design-contract.md`
> Canonical screenshots (EN-reference): `context/changes/overdue-returns-dashboard/design-review/*.jpg`

## What & Why

FR-012 asks that "an employee sees vehicles past their expected return date flagged
automatically on their dashboard." The framing established that the _detection_ is
already shipped — S-06's Zwroty worklist already fetches every open overdue rental
and paints a red `Po terminie` flag. So S-07 is not a new dashboard; it is
**visibility polish, flag-only**: make the existing overdue **navigable, filterable,
and legible**. Read-only, no writes, no new tables.

## Starting Point

`/dashboard/returns` (the `ReturnQueue` island) already classifies each row as
`overdue`/`due`/`returned`, shows three static stat cards, and paints overdue rows.
The staff shell already renders a `pendingCount` badge on "Wnioski" (threaded per
page). Nothing today makes overdue _navigable from elsewhere_, _filterable_, or shows
_how many days_ overdue.

## Desired End State

From any staff page, a danger count badge on "Zwroty" signals overdue rentals;
opening it lands on the overdue-filtered list. The three stat cards toggle the
worklist (`Na dziś` / `Po terminie` / `Zwrócono`) with a visible selected state and a
click-to-clear. Overdue rows read `N dni po terminie`. When nothing is overdue, the
badge is hidden and the overdue filter shows `Wszystkie pojazdy wróciły na czas.`

## Key Decisions Made

| Decision            | Choice                                                                                         | Why                                                                                      | Source |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ |
| Nav surface         | Fold into Zwroty + nav badge (no dedicated page)                                               | Overdue is already flagged on Zwroty; a new page would re-invent detection               | Frame  |
| Scope               | Flag-only; no penalty, no extend, no contact _tracking_                                        | v1 PRD Non-Goals; extend is a separate write slice                                       | Frame  |
| Badge count source  | New `count_overdue_returns()` definer RPC + service                                            | Tables are RLS-locked (no direct SELECT); one integer, no PII, cheap across ~8 pages     | Plan   |
| Count parity        | Count RPC mirrors `list_returns_today` joins, strict-overdue-open subset                       | Badge must equal the page's overdue count or it reads as a bug                           | Plan   |
| Filter mechanism    | Client toggle in the island, seeded from server-parsed `?filter`                               | Rows already client-side → instant, live counts; deep-linkable badge; no hydration flash | Plan   |
| Clear affordance    | Click the active control again → `Wszystkie`                                                   | Minimal UI, no extra control                                                             | Plan   |
| Stat area           | **Rebuild as a filter bar** (desktop: `N dziś` total + 3 segments; mobile: 4 scrollable pills) | Matches the canonical design (supersedes "make 3 cards clickable")                       | Design |
| Mobile filters      | **4 scrollable pills** (`Wszystkie/Na dziś/Po terminie/Zwrócono`)                              | Canonical design; filter parity — supersedes the earlier 2-chip call                     | Design |
| Mobile badge        | Dot when tab inactive, **crimson count when active**                                           | Canonical mockups show the number on the active tab                                      | Design |
| Days-overdue        | `PO TERMINIE` eyebrow + `⚠ N dni po terminie` pill (replaces the plain badge)                  | Canonical design; `formatDuration(n)` gives the plural                                   | Design |
| Call action         | **Kept as a plain `tel:` link** on overdue rows (needs `customer_phone` on the returns RPC)    | User wants it; design-brief §4 allows a bare phone link (no logging)                     | Design |
| Search + sparkline  | **Cut**                                                                                        | Out of FR-012; the sparkline has no data source                                          | Design |
| Copy                | pl-PL canonical (contract); EN artboards are reference-only                                    | Project's #1 constraint; the export used the EN toggle                                   | Design |
| Empty-overdue state | `Brak zwrotów po terminie` / `Wszystkie pojazdy wróciły na czas.`                              | Reassuring "so-far-so-good"; distinct from the due-today empty card                      | Plan   |

## Scope

**In scope:** overdue count badge on the "Zwroty" nav (new count RPC + service,
threaded across staff pages); the filter bar (desktop unified bar; mobile 4 scrollable
pills) with tone-specific selected states, live header, URL seed/sync, and the
positive empty-overdue state; an overdue-row restyle (`PO TERMINIE` eyebrow +
`N dni po terminie` indicator, overdue-first sort); a `Zadzwoń` `tel:` link on overdue
rows (needs `customer_phone` added to the returns RPC).

**Out of scope:** penalty/late-fee columns; extend-rental; last-contact **tracking**
(the `tel:` link records nothing); the header **search bar** and **trend sparkline**
(cut); new tables; any reservation write; vehicle photos; the two full-page
`[reservationId]` routes (no `StaffShell`); the Wnioski badge / other nav labels.

## Architecture / Approach

Backend-out, three additive phases. One read-only migration adds a scalar
`count_overdue_returns()` definer RPC (role-gated, revoke→grant) that counts the same
overdue-open subset the worklist paints, and drop+recreates `list_returns_today` with
a `customer_phone` column (for the Call link). A `countOverdueReturns` service wraps
the count; each staff page computes it (parallel with the existing pending fetch) and
threads `overdueCount` into `StaffShell`, which renders a danger pill (desktop) /
dot-or-count (mobile). The filter bar, overdue restyle, and `tel:` link are
self-contained inside the `ReturnQueue` `client:load` island — no refetch; filtering
and sorting are in-memory over already-hydrated rows.

## Phases at a Glance

| Phase                  | What it delivers                                                                              | Key risk                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Backend + nav badge | `count_overdue_returns()` + `customer_phone` on returns RPC + service + badge across ~8 pages | Count/list parity (mirror the worklist's joins); drop+recreate must re-apply grants |
| 2. Filter bar          | Desktop unified bar + mobile 4-pill scroll, URL-seeded filter, live header, empty states      | Hydration flash if the URL is read client-side (mitigated: SSR-parse)               |
| 3. Overdue-row restyle | `PO TERMINIE` + `N dni po terminie` indicator, `Zadzwoń` link, overdue-first sort             | A few exact values are `provisional` (screenshot-derived)                           |

**Prerequisites:** local Supabase running for the integration test + type-gen. The
canonical screenshots are **captured** (`design-review/*.jpg`, EN-reference).
**Estimated effort:** ~2–3 focused sessions across the three phases.

## Open Risks & Assumptions

- **Design audit: PASS (conditional).** 6 canonical states captured; scope reconciled
  (Call in as `tel:`, search + sparkline out, mobile 4 pills). Conditions: the EN copy
  is reference-only (Polish in the contract is canonical), and a few `provisional`
  values (selected `Na dziś`/`Zwrócono` pills, filter-bar spacing) resolve at
  implement — ideally by pulling the JSX via `DesignSync`.
- **Adding `customer_phone` forces a drop+recreate** of `list_returns_today` (return
  type change) — the migration must re-apply the `revoke/grant` or the RPC re-opens to
  `anon`.
- **First scalar-returning RPC** in the codebase — a new (but correct) pattern; the
  count must stay in lockstep with `list_returns_today`'s overdue subset.
- **Nav-item deep-link** — clicking "Zwroty" pre-filters to overdue whenever any
  exist; assumed desirable (flag → act). Recorded as a deviation to confirm on review.
- **Missing artboards** — no desktop overdue-filter-with-rows / desktop-empty, and no
  `Na dziś`/`Zwrócono` selected states; those specs are `provisional`.

## Success Criteria (Summary)

- From any staff page, the "Zwroty" badge equals the page's overdue count and is
  hidden when nothing is overdue.
- The stat cards filter the worklist with a clear selected/clear/deep-link behavior;
  the overdue-clear state reassures rather than misreads as "no returns today".
- Each overdue row legibly states how many days it is past due — and the rendered UI
  matches the canonical screenshots at both breakpoints.
