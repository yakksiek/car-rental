<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Logo Update (F-badge → motion-van mark)

- **Plan**: context/changes/logo-update/plan.md
- **Scope**: All 3 phases (full plan)
- **Date**: 2026-08-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

**Automated success criteria — all green:** `npx astro check` 0 errors · `npm run lint` 0 errors (2 pre-existing warnings in `ReturnProtocolForm.tsx`, unrelated) · `npm run build` ✅ (emits `favicon.svg`, `apple-touch-icon.png`, `favicon-32x32.png` in `dist/`) · unit `npm test` 7/7 (Brand/mark) · `test ! -f public/favicon.png` ✅ · grep: no old "F"-badge blocks. Architecture highlight: the plan's #1 risk (two renderers drifting) is cleanly solved — `mark.ts` exports primitive geometry consumed by both `Brand.astro` and `Brand.tsx`, no `set:html`/`dangerouslySetInnerHTML`.

## Findings

### F1 — StaffShell mark undersized; responsive split not in the contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/shell/StaffShell.astro:69
- **Detail**: Every other surface preserves its old badge height exactly; this one doesn't. Old badge was `size-[34px]` (34px); design-contract "Per-surface spec" said ~36px (preserve current). Shipped `markClass="h-6 lg:h-[30px]"` → 24px md icon-rail / 30px lg sidebar — smaller than both, with an md/lg split not recorded as a deviation, so Phase-2 manual criterion 2.6 ("only recorded deviations") was slightly overstated. The downsize is load-bearing: the van viewBox is 124×60 (~2.07:1), so `w-auto` at 34px height renders ~70px wide and overflows the ~56px-usable `md:w-[72px] md:px-2` icon-rail; `h-6` (~50px) fits.
- **Fix A ⭐ Recommended**: Record it as a `deviation()` in design-contract.md (keep shipped sizes).
  - Strength: Keeps rail-fitting values; closes the fidelity-gate gap so future reviews converge.
  - Tradeoff: Contract blesses an eyeballed value; worth a glance at the rendered sidebar.
  - Confidence: MED — width math explains the choice; sidebar not rendered to confirm balance.
  - Blind spot: Whether 24px is the _nicest_ rail size or just _a_ fitting one.
- **Fix B**: Bump to `h-[34px]` for exact old-badge parity.
  - Strength: No undocumented deviation; matches old badge 1:1.
  - Tradeoff: ~70px wide likely clips the ~56px md rail — reintroduces the problem the downsize solved; would need a rail-width bump too.
  - Confidence: MED — width math suggests overflow, unverified visually.
  - Blind spot: Haven't rendered md width to confirm the clip.
- **Decision**: FIXED via Fix A — added a `deviation(van aspect — 34px-tall mark is ~70px wide and overflows the 72px md icon-rail; downsized to h-6 / lg:h-[30px])` line to the StaffShell row in design-contract.md; bumped the recorded-deviation count in the contract verdict (2 → 3).

### F2 — `<Brand>` prop API differs from the plan (size:number → markClass)

- **Severity**: 🟡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/brand/Brand.astro:27-33 (+ Brand.tsx)
- **Detail**: Plan Phase-1 contract specified `size?: number` (mark height px). Implementation instead exposes `markClass?`/`wordmarkClass?: string` (Tailwind height classes), documented in the component header comment as more idiomatic (the codebase sizes with `h-*`/`size-*`) and it enables the responsive `h-6 lg:h-[30px]` used by StaffShell. Functionally equivalent; all per-surface visual targets hit.
- **Fix**: None needed — accept as-is.
- **Decision**: ACCEPTED — intentional, documented, equivalent.

### F3 — "Flota" announced twice by screen readers on mark+wordmark surfaces

- **Severity**: 🟡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/brand/Brand.astro:55-56; consumed at SiteFooter.astro:16, auth/AuthShell.astro:40 & :55, auth/signin.astro:87 & :102
- **Detail**: `variant="mark"` set `role="img" aria-label="Flota"` on the svg. Where a visible `<span>Flota</span>` sits beside it, a screen reader said "Flota" twice. Nuance: at StaffShell's collapsed md rail the wordmark is `hidden lg:block`, so there the mark's label is the ONLY accessible name — a blanket aria-hidden would regress it.
- **Fix**: Add a `label?: boolean` opt-out (default true) to `<Brand>`; the mark is labelled only when `variant="mark"` AND `label` — otherwise decorative (`aria-hidden`). Pass `label={false}` on surfaces with an unconditionally-visible sibling wordmark; leave StaffShell labelled.
- **Decision**: FIXED — added `label` prop to `Brand.astro` + `Brand.tsx` (`labelled = isMark && label`); applied `label={false}` to the 5 mark+visible-wordmark spots (SiteFooter, AuthShell ×2, signin ×2); StaffShell:69 left labelled (its wordmark is `hidden lg:block`). Verified: `astro check` 0 errors, eslint clean, unit 7/7.

### F4 — Old crimson square-badge silhouette lingers in the signin backdrop

- **Severity**: 🟡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/auth/signin.astro:22
- **Detail**: The decorative blurred "dispatch backdrop" behind the sign-in card draws a `bg-primary size-[30px] rounded-[9px]` crimson square where a logo would sit — the shape of the old badge this change retired. It's `aria-hidden`, blurred 7px, purely decorative (a fake dashboard mockup), so it's not a missed swap and not user-facing brand; just the one spot the retired square silhouette still faintly appears. Correctly out of the plan's scope.
- **Fix**: Optional — leave as-is, or swap the square for a tiny inline van outline.
- **Decision**: SKIPPED — blurred, aria-hidden, abstract placeholder; not worth touching.
