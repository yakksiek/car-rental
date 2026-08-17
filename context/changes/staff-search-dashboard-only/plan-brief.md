# Global search — Pulpit-only, dropdown-only — Plan Brief

> Full plan: `context/changes/staff-search-dashboard-only/plan.md`
> Change identity: `context/changes/staff-search-dashboard-only/change.md`
> Applied design change: `context/changes/staff-search-dashboard-only/design-request.md`

## What & Why

Global search becomes a **Pulpit-only, dropdown-only** feature. It is reached from the
dashboard alone — desktop and mobile — and resolves entirely in the dropdown: the user
types, the grouped list grows, they scroll it, and clicking or pressing `↵` on a row jumps
straight to that item. There is no dedicated results screen and no results URL.

Two reasons, decided separately and landing together. A magnifier in a section header
reads as "search _this section_" — on Flota it would sit directly above the `Marka, model…`
filter — so the entry point belongs on Pulpit only. And once the dropdown shows every match
and scrolls, a separate results page has nothing left to do.

## Starting Point

S-13 shipped complete on `feature/staff-global-search` (7 commits, unpushed): the
`search_staff` RPC, `GET /api/search`, an always-on shell top bar carrying the field on all
10 staff pages, a tab-bar magnifier on mobile, ⌘K inside the island, and `/dashboard/search`
with filter chips. Nothing has merged, so this narrowing lands before S-13 ever does — which
is the point: don't merge a shell restructure you are about to partly revert.

## Desired End State

An employee opens Pulpit and sees a 520px field at desktop widths, or a 44×44 magnifier
beside their avatar on mobile. Typing shows grouped, scrolling results; Enter opens the
highlighted row. From any other staff page ⌘K takes them to Pulpit with search already open.
`/dashboard/search` is gone and nothing anywhere offers "Zobacz wszystkie wyniki".

## Key Decisions Made

| Decision           | Choice                                     | Why                                                                                                    | Source |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------ |
| Entry points       | Pulpit only, desktop + mobile              | An icon inherits its container's scope; a section-header magnifier reads as scoped search              | Change |
| Results surface    | Dropdown only, no page, no URL             | The dropdown shows every match and scrolls, so the page is redundant                                   | Design |
| Per-group cap      | `limit 8` → `limit 25`                     | The 8-cap was only safe while the page was the escape hatch; unbounded is a perf risk on a definer RPC | Plan   |
| ⌘K off Pulpit      | Keep it; navigate to `/dashboard?search=1` | The desktop dropdown is anchored to the field, so with no field there is nothing to anchor             | Plan   |
| ⌘K discoverability | Accept no affordance outside Pulpit        | The field's `⌘ K` chips teach it on the screen everyone lands on — the standard palette bargain        | Plan   |
| Island mounting    | Mounted on all 10 pages, field on 1        | The island owns ⌘K and the mobile overlay, both of which must work off-Pulpit                          | Plan   |
| Vehicle row        | Adopt the design's row                     | The design draws one for the first time, so D9's "no mockup row" justification is gone                 | Plan   |
| Shell restructure  | Keep it                                    | Its original reason goes away, but it is now what gives every page a consistent header                 | Change |
| Test depth         | Minimal — repair only                      | Mostly deletion; the cap is the one behavioral risk a test can catch                                   | Plan   |

## Scope

**In scope:** widening the RPC cap; deleting `search.astro` + `SearchResults.tsx` + the
`/dashboard/search` access entry + the `header-title` slot; removing both "see all" call
sites and the no-results Enter fallback; a `search` prop on `StaffShell` and a `field` prop
on `GlobalSearch`; the dashboard hero magnifier; removing the tab-bar magnifier; ⌘K routing
and auto-open; the Pojazdy row; rewriting `design-contract.md` and the S-13 documents.

**Out of scope:** reverting the Phase 2 shell restructure; any search affordance on the other
9 pages; moving filter chips into the dropdown; a truncation state; scoped search on the
worklists; an E2E spec; hoisting the ⌘K listener into `Layout.astro`.

## Architecture / Approach

```
StaffShell (all 10 pages)
  ├─ header ─ search? → [GlobalSearch field 520px] → [header-action]     ← Pulpit only
  └─ <GlobalSearch field={search}>  ← ALWAYS mounted
        ├─ desktop: Popover anchored to the field      (only when field=true)
        ├─ mobile:  overlay portalled to <body>        (any page, any width)
        └─ ⌘K: below md → open overlay in place
                at md+ → field ? open dropdown : navigate to /dashboard?search=1
```

The field becomes conditional; the island does not. That is what keeps ⌘K instant below `md`
and gives the desktop branch somewhere to make its routing decision.

## Phases at a Glance

| Phase                      | What it delivers                                                     | Key risk                                                                                 |
| -------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Widen the cap           | Migration `limit 8` → `limit 25`, repaired cap test                  | The cap's new upper bound stays unverified — the fixture only reaches 9                  |
| 2. Delete the results page | Page, island, route entry, slot, both "see all" paths gone           | Missing a link into the deleted route and shipping a dead href                           |
| 3. Pulpit-only entry + ⌘K  | Conditional field, hero magnifier, tab-bar magnifier out, ⌘K routing | Cannot be split — a field-less page with no routing fallback opens an unanchored popover |
| 4. Vehicle row + contract  | Design-accurate Pojazdy row, rewritten contract, export list         | A stale deviation line re-flags on every future vision diff                              |

**Prerequisites:** local Supabase running (shared across worktrees — apply the migration via
psql, never `db reset`); dev server on a free port (4325; 4321 and 4322 are taken).

**Estimated effort:** ~2 sessions across 4 phases. Phase 3 is the bulk; phases 1 and 2 are
mechanical.

## Open Risks & Assumptions

- **25 is a judgment call, not a measured number.** It is 3× today's cap with a hard ceiling;
  nothing profiled says 25 is the right ceiling for this dataset.
- **The minimal test depth leaves three regressions manual-only** — field absent on 9 pages,
  ⌘K routing, and the deleted route.
- **D10's density tightening is kept though it is no longer strictly required** (7 entries fit
  at full sizing). Kept because S-11's "Profil" tab lands the pill at exactly 360px, the floor
  with zero margin. Flag it if you would rather restore full sizing and let S-11 re-solve it.
- **The canonical screenshots do not exist yet.** The design's `exports/global-search/` holds
  two overlapping sets and the current export request predates `ScreenSearchLiveScrolled`. The
  export list is rewritten as the last planning step, for you to run; the audit follows.

## Success Criteria (Summary)

- An employee reaches search from Pulpit — field on desktop, magnifier on mobile — and from
  nowhere else visually, while ⌘K still works from any staff page.
- Every match for a query is reachable by scrolling the dropdown; nothing is silently hidden
  and no "showing N of M" appears.
- `/dashboard/search` is gone and no surface links to it.
