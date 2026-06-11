<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Public Reservation Request (S-02 — North Star)

- **Plan**: context/changes/public-reservation-request/plan.md
- **Mode**: Deep
- **Date**: 2026-06-11
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

14/14 reused paths ✓ (`src/components/ui/input.tsx` already exists — see F2). Symbols ✓: `validateDateRange` (`src/lib/catalog-filters.ts:116`), `getVehicleById` (`src/lib/services/vehicles.ts:126`), `bookingWindow`/`windowsOverlap`/`hasConflict` (`src/lib/availability.ts`), `available_vehicles` RPC with `grant execute ... to anon, authenticated` and the matching `tsrange(pickup+14:00, return+10:00, '[)')` window, `reservations_no_overlap` EXCLUDE constraint, anon-denied `reservations` RLS, `/reserve` CTA in `src/components/vehicle/VehicleDetail.astro:44`. Brief↔plan consistent. Progress↔Phase: 4/4 phases mapped, all success criteria numbered ✓. Contract surfaces (`docs/reference/contract-surfaces.md`): plan reuses `App.Locals.supabase`, `available_vehicles`, `getVehicleById`, `validateDateRange` without renames or shape changes ✓.

## Findings

### F1 — Reference minting vs. seed backfill: collision path underspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 #1 (RPC) + #2 (seed backfill); Key Discoveries
- **Detail**: The RPC mints `reference` "R-XXXX" from "a bigint sequence, base36" (plan line 87) under a `unique` constraint, and the seed backfills `reference` on existing rows (lines 96–98). Two gaps: (a) the exception block shown maps only `exclusion_violation` → `conflict`; line 36 also mentions catching `unique_violation` "on a token/reference clash" but never says what it returns — mapped to `conflict` it shows the user a false "vehicle just taken", uncaught it's a 500. (b) A sequence is monotonic, so the only real collision is the seed's hardcoded references vs. the sequence's starting range — which the plan doesn't connect; the first real RPC call could hit a backfilled value.
- **Fix**: Specify that the seed backfill uses references OUTSIDE the RPC sequence's range (or advances the sequence past them), and state the RPC's handling of a reference `unique_violation` explicitly — a sequence-minted reference cannot collide at runtime, so a `unique_violation` there should propagate as an error (a bug), NOT be silently mapped to `conflict`. Only the `exclusion_violation` (23P01) maps to `conflict`.
- **Decision**: PENDING

### F2 — Phase 4 re-adds `input.tsx`, which already exists

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 #1 — shadcn primitives
- **Detail**: Phase 4 #1 says add `{input,label,checkbox}.tsx` via `npx shadcn@latest add`, but `src/components/ui/input.tsx` already exists (created Jun 6, S-01). Running the add prompts an overwrite that could clobber the existing component or its relative-import rewrite.
- **Fix**: Change the list to `{label,checkbox}` only; reuse the existing `input.tsx`.
- **Decision**: PENDING

### F3 — Stepper model doesn't cover the `cancelled` enum value

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 #3 (`reservation-status.ts`) + Phase 3 status page
- **Detail**: `reservation_status` is a 4-value enum: pending / confirmed / rejected / cancelled (migration `20260603155136`, lines 23–27). The plan's `stepperFor(status)` and status pill cover pending/confirmed/rejected but never `cancelled`. `/r/<token>` for a cancelled reservation would hit an undefined stepper/pill branch. Cancellation isn't built in S-02, but the token link is durable and the type is exhaustive.
- **Fix**: Have `stepperFor` and the status pill handle all four enum values (a `cancelled` terminal branch, even if just a greyed "Anulowane" pill) so the render path is total.
- **Decision**: PENDING

### F4 — Honeypot "success-shaped" response redirects to a dead token; no volumetric guard

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 #4 (API route) — honeypot handling; abuse guards
- **Detail**: "Honeypot hits return a benign success-shaped response without inserting" (plan line 280). If that 201 carries a fabricated `token`, the island redirects to `/r/<token>` → a 404 (no row). Harmless for a bot, but the response shape is internally inconsistent. Separately: the abuse guards (honeypot + Origin + zod + terms) stop cross-site and naive bots but not volumetric abuse — a same-origin script can spam `pending` rows, each locking a date window via the EXCLUDE constraint, degrading real availability. Acceptable for an MVP, but currently unflagged.
- **Fix**: Either return a 201 with no token (and have the island treat a tokenless 201 as a soft success) for honeypot hits, or note the dead-link behavior as intentional. Add one line to "What We're NOT Doing" acknowledging no rate limiting in v1.
- **Decision**: PENDING
