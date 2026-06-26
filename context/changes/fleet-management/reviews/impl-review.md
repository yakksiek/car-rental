<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Fleet Management (S-04)

- **Plan**: context/changes/fleet-management/plan.md
- **Scope**: Phases 1–5 of 5
- **Date**: 2026-06-26
- **Verdict**: NEEDS ATTENTION → all findings triaged (5 fixed, 2 accepted)
- **Findings**: 0 critical · 3 warnings · 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria (lint / build / `astro sync`) all pass; manual checks 5.2–5.5 confirmed by the user. The retire guard is atomic with full definer hygiene; the three-layer trust boundary (route role gate → RLS WITH CHECK → SECURITY DEFINER RPC) is clean; all scope guardrails held (no plate/branch/status/upload leaked in).

## Findings

### F1 — getCategoryCounts misses the is_active guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (correctness)
- **Location**: src/lib/services/vehicles.ts:101-121
- **Detail**: The RLS broadening to `using(true)` means staff callers count retired vehicles; the compensating `.eq('is_active', true)` was added to `listVehicles`/`listFleet` but missed here, so the fleet subtitle + category pills over-count even with the retired toggle off.
- **Fix**: Added `.eq("is_active", true)` to the `select("category")` query and corrected the stale comment.
- **Decision**: FIXED

### F2 — getVehicleById contract comment is now false

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (contract drift)
- **Location**: src/lib/services/vehicles.ts:130-149
- **Detail**: Comment claimed it returns only active vehicles; post-broadening that's true only for anon (staff/edit page now get retired rows, intended). The reservation funnel is safe via the downstream `available_vehicles` RPC re-check.
- **Fix**: Rewrote the doc comment to state callers may receive inactive rows and why the booking path stays correct. Behavior unchanged.
- **Decision**: FIXED (comment only)

### F3 — photos z.url() doesn't constrain the scheme

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (input hardening)
- **Location**: src/lib/vehicle-schema.ts:115
- **Detail**: Bare `z.url()` accepts `javascript:`/`data:`/`mailto:`. Staff-only input rendered as `<img src>`; residual risk is a rogue staff account planting a `data:` image shown to public visitors.
- **Fix**: Tightened to `z.url({ protocol: /^https?$/, error: MSG.url })`.
- **Decision**: FIXED

### F4 — retire-guard TOCTOU comment overclaims

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Reliability
- **Location**: supabase/migrations/20260625120000_fleet_management.sql:50-54
- **Detail**: The single `UPDATE … WHERE NOT EXISTS` guard is correct; the comment overstated it as fully race-proof. A narrow READ COMMITTED window exists but is unreachable (the booking path filters `is_active`).
- **Fix**: Softened the migration comment to acknowledge the narrow, unreachable window.
- **Decision**: FIXED (comment only)

### F5 — category chips label association is a11y-inert

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Accessibility
- **Location**: src/components/fleet/VehicleForm.tsx (category chips)
- **Detail**: `<Label htmlFor="category">` targeted a `<div>`, not a focusable control, so a screen reader wouldn't announce the group from the label.
- **Fix**: Label is now a `<span id="category-label">`; the chip group is `role="group" aria-labelledby="category-label" aria-invalid=…` (keeps `id="category"`/`tabIndex=-1` for scroll-to-error).
- **Decision**: FIXED

### F6 — unbounded full-table reads in counts/list

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Performance
- **Location**: src/lib/services/vehicles.ts (getCategoryCounts, listFleet)
- **Detail**: Unbounded `select("*")`/`select("category")` counted in JS rather than a grouped DB count. Fine at rental-fleet scale; no N+1.
- **Decision**: ACCEPTED (conscious choice at fleet scale)

### F7 — dayjs added inside the p1 commit

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Scope Discipline
- **Location**: package.json
- **Detail**: `dayjs` was added in the p1 commit as a justified baseline repair for pre-existing S-03 calendar code; unrelated to S-04 and arguably its own commit. Benign, already in history.
- **Decision**: ACCEPTED (no action)
