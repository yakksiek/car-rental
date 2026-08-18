<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Fleet-Browse Restyle (`/fleet`)

- **Plan**: context/changes/landing-fleet-restyle/plan.md
- **Scope**: Full plan — Phases 1–5 of 5
- **Date**: 2026-08-02
- **Verdict**: NEEDS ATTENTION (at review time) → all findings triaged; 3 fixed, 2 skipped
- **Findings**: 0 critical, 2 warnings, 3 observations

## Method

- **Automated verification** (all phases): `npm run lint` ✅, `npx astro check` ✅ (0 errors), `npm test` ✅ (312 unit), `npm run build` ✅.
- **Plan-drift sub-agent**: PASS — every phase matches intent; six load-bearing behavior contracts preserved (instant-anchor category filtering, non-persisted FilterBar re-reading `initial`, date validation + inline error, real sort options, kept result-count/chips/"Wyczyść wszystko"/empty states); scope held to exactly the 4 planned files; no "What We're NOT Doing" boundary crossed.
- **Safety/quality/pattern/static-contract sub-agent**: no security/reliability/perf issues (href building routes through `serializeFilters`→`URLSearchParams`; date params regex-validated upstream; counts seeded to 0 so no `undefined`; island uses only `onClick`+`useState`, no listener leak; correct `client:visible`/`client:load` mounts). Two pattern warnings (F1, F2).
- **Rendered vision-diff** (3 breakpoints vs canonical mocks): mobile CONVERGED. Desktop/tablet inconclusive due to **under-width capture** (retina 2× → desktop ~1303 CSS vs 1440 target; tablet ~1061 = desktop range ≥ `lg` 1024). The agents' "structural drift" (3-col at tablet, stacked footer at desktop) is fully explained by capture width and verified correct at true widths via card-width math against `--container-app:1400` + `@min-[400px]:`. **Gate not formally closed — re-capture at browser viewports 1440 / 834 / 390 to confirm.**

## Verdicts

| Dimension           | Verdict                                   |
| ------------------- | ----------------------------------------- |
| Plan Adherence      | PASS                                      |
| Scope Discipline    | PASS                                      |
| Safety & Quality    | PASS                                      |
| Architecture        | PASS                                      |
| Pattern Consistency | WARNING                                   |
| Success Criteria    | PASS (vision-diff re-capture recommended) |

## Findings

### F1 — Dead `font-heavy` class under-weights filter labels

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (design-fidelity)
- **Location**: src/components/vehicle/FilterBar.tsx:59, :113
- **Detail**: `font-heavy` emits no CSS — the built bundle has a real `.font-bold{}` rule but no `.font-heavy{}` (the token is `--flota-fw-heavy`, not Tailwind's `--font-weight-*` namespace). So the filter field labels (TERMIN/ŁADOWNOŚĆ/SORTOWANIE) + "Filtry" chip rendered at inherited weight, not the contract's 700. Confirmed statically and by the desktop vision agent.
- **Fix**: Replace `font-heavy` with `font-bold` (real utility → 700, matches VehicleCard) at both lines.
- **Decision**: FIXED (Fix now) — both occurrences changed to `font-bold`.

### F2 — "Zastosuj" async-navigation button has no pending state

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — established pattern to copy (SubmitButton.tsx)
- **Dimension**: Pattern Consistency
- **Location**: src/components/vehicle/FilterBar.tsx:208-214
- **Detail**: "Zastosuj" fired `void navigate(...)` (async view-transition nav) with no disabled state and no spinner, contrary to the CLAUDE.md async-button rule. Slow nav → no feedback, double-fire risk.
- **Fix**: Add a `submitting` flag set true in handleApply after validation passes; disable the Button + swap the label for the `animate-spin` ring while in-flight. Resets on its own (non-persisted island remounts).
- **Decision**: FIXED (Fix now) — `submitting` state added; button disables + shows spinner + "Szukam…".

### F3 — Card footer side-by-side split only engages at viewport ≳1340px

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM — real-world tradeoff worth a conscious call
- **Dimension**: Architecture (design-robustness)
- **Location**: src/components/vehicle/VehicleCard.astro:102
- **Detail**: Footer price-left/CTA-right is gated by card width `@min-[400px]:`. With `--container-app:1400` + `lg:px-12` + 3 cols, a card reaches 400px only at viewport ≈1340px+. Matches the mock at exactly 1440, but common laptops (1280–1336px) render 3-col cards at ~380–398px → stacked full-width CTA. Correct per the plan's container-query intent; just a high threshold.
- **Fix**: Optionally lower to `@min-[380px]:` so standard laptops also get side-by-side; or accept (matches 1440 target).
- **Decision**: SKIPPED — accepted as-is; matches the 1440 design target.

### F4 — Mobile scroller duplicates CategoryIcon glyph paths

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency (maintainability)
- **Location**: src/components/vehicle/FleetTypeScroll.tsx:34-102
- **Detail**: The React island re-declares the 5 category `<path>` glyphs + "all" grid, byte-identical to CategoryIcon.astro (an Astro component can't render inside a React island — acknowledged in the file comment and plan). Currently in sync; silent-drift risk if either is edited.
- **Fix**: Extract glyph path data to a shared TS constant imported by both.
- **Decision**: SKIPPED — accepted; in sync and documented.

### F5 — Minor cosmetic nits (consolidated)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency (design-fidelity)
- **Detail**: (a) Sort empty-state `placeholder="domyślne"` (FilterBar:193) — mock placeholder word, real options intact, semantically "default order". (b) Scroller `text-white/70` vs contract `/72`; `transition-all` vs `transition-[flex]` — functionally equivalent. (c) VehicleCard uses `font-bold` where the contract wrote `font-heavy` — renders 700 correctly; naming only.
- **Fix**: Accept (a)/(b); unify the `font-heavy`→`font-bold` naming in the contract.
- **Decision**: FIXED (Tidy the naming) — all six `font-heavy` references in design-contract.md changed to `font-bold`; added a "Weight-utility note" to the token map warning that `font-heavy` is not a real Tailwind utility. Items (a)/(b) accepted as-is.

## Out-of-scope note (not a finding)

The landing (`/`) categories→popular **hover/tap-to-preview** interaction is not implemented — but this was a **deliberate, documented deferral** in the archived `landing-redesign` change (`src/components/landing/TypeSelector.astro:11-12`: click-to-route only, hover-hint dropped, `deviation(scope)`), and the landing page is explicitly outside this change's scope. The user **withdrew** the hover request in review; the shipped **click-to-route** is the intended behavior. No action.

## Re-capture recommendation (to formally close the vision-diff gate)

Re-shoot `/fleet` at browser **viewport** widths 1440 / 834 / 390 (retina shots will be ~2× those). The current app-shots were ~1303 / ~1061 / ~445 CSS px; the desktop and tablet ones sat in the wrong breakpoint band, so the gate could not converge on those two. Mobile already converged.
