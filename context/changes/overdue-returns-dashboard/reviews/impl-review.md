<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Overdue Returns Dashboard (S-07)

- **Plan**: context/changes/overdue-returns-dashboard/plan.md
- **Scope**: Full plan — Phases 1–3 of 3
- **Date**: 2026-07-23
- **Verdict**: APPROVED
- **Findings**: 0 critical · 0 warnings · 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Both review agents (plan-drift + safety/quality/pattern/design-fidelity) returned clean:
every planned change present and faithful to intent, all "What We're NOT Doing" guardrails
held (no penalty, no extend-rental, no last-contact tracking, no search bar, no sparkline,
no new tables, no reservation writes), count/list parity airtight (`count_overdue_returns`
mirrors `list_returns_today`'s joins + strict `<` overdue predicate + role gate),
revoke-before-grant correct, and Surface-C design fidelity matches the contract's exact
values. Success criteria: unit 279/279, integration (overdue-returns) 6/6, build + lint
green; manual rows confirmed by the user and backed by a rendered vision-diff at both
breakpoints.

## Findings

### F1 — Serial countOverdueReturns round-trip on 3 pages

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Performance)
- **Location**: src/pages/dashboard.astro:16-18, src/pages/dashboard/reservations.astro:15-17, src/pages/dashboard/vehicles/new.astro:17-18
- **Detail**: The plan said "fold `countOverdueReturns` into the existing `Promise.all` where one exists, else add an `await`." 3 of 9 staff pages (pickups, vehicles, returns) parallelize it; dashboard/reservations/vehicles-new used a serial `await` after another independent awaited call — one avoidable DB round-trip each. Not an N+1 (single `count(*)`); faithful to the plan's literal wording, so not drift.
- **Fix**: Wrap the two independent awaited calls in a single `Promise.all` on the 3 pages, mirroring the existing form on pickups/vehicles/returns.
- **Decision**: FIXED — commit `1885aa9` (parallelized all 3 pages; lint + build green).

### F2 — protocols/[id].astro passes overdueCount but no pendingCount

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dashboard/protocols/[id].astro:112-119
- **Detail**: The page now passes `overdueCount` (added by S-07) but still no `pendingCount`, so the Wnioski badge is absent on this one page while present on the other 8. Pre-existing gap, outside S-07's flag-only scope.
- **Fix**: (Optional, out of scope) thread `pendingCount` here too in a badge-consistency follow-up.
- **Decision**: SKIPPED — pre-existing, out of scope.

### F3 — list_pending_reservations lacks revoke-before-grant (pre-existing)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Security)
- **Location**: supabase/migrations/20260617121000_list_pending_reservations.sql:50
- **Detail**: The new S-07 migration does revoke-before-grant correctly; the older sibling `list_pending_reservations` grants without a preceding revoke, so anon can execute it via the PUBLIC default grant — but it refuses on its in-RPC role gate (no leak, no state change). Already the accepted, documented state in `lessons.md` ("Revoke EXECUTE before granting") and the prod-hardening memory.
- **Fix**: (Out of scope) a one-line revoke follow-up migration if the team wants the sibling brought in line; already tracked by the revoke-hygiene lesson.
- **Decision**: SKIPPED — pre-existing, safe (in-RPC gate), already tracked.
