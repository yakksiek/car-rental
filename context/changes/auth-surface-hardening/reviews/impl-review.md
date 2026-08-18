<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Auth Surface Hardening (S-14)

- **Plan**: `context/changes/auth-surface-hardening/plan.md`
- **Scope**: All 5 phases (full plan)
- **Date**: 2026-08-17
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 2 warnings · 8 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Objective verified behaviourally

The slice's reason to exist — F1, a reproduced critical — is closed, and this was checked
against the running app rather than by reading code:

| Step                                                                   | Result                                      |
| ---------------------------------------------------------------------- | ------------------------------------------- |
| Ordinary `signInWithPassword` session POSTs `/api/auth/reset-password` | **403**                                     |
| Sign in afterwards with the _proposed_ password                        | **rejected** (`error=invalidCredentials`)   |
| Sign in afterwards with the _original_ password                        | **accepted** — password genuinely unchanged |
| Cross-origin POST                                                      | **403**                                     |
| Absent `Origin` POST                                                   | **403**                                     |

Run against a throwaway employee so a failed gate could not rotate a seeded account.

## Success criteria (re-run independently)

`npx astro check` 0 errors · `npm run lint` 0 errors · `npm test` 340/340 ·
`npm run test:integration` 214/214 · `npm run test:e2e` 13/13 on :4321 · `npm run build` ✓.

Manual Progress rows spot-checked against the diff — each has observable evidence; no
rubber-stamping found.

## Documented deviations (not counted as drift)

- **Phase 2 §4** — the e2e non-consumption test opens a fresh browser context instead of
  clicking sign-out on R11, because `/api/auth/signout` is global-scope and would revoke the
  shared `playwright/.auth/employee.json` for every later spec. Recorded in
  `e2e/e2e-rules.md:73-82`. Cost: the R11 button itself has no automated cover (manual 2.6).
- **Phase 4 §4** — `StatusHead` ships `--flota-*` vars rather than the plan's `/80`
  approximations. The design contract pins the literal hexes (§7.1), so the shipped values
  are the more faithful ones per the "port exact values, never tune by eye" rule.
- **Phase 5 §1** — `secure` derives from `import.meta.env.PROD || url.protocol === "https:"`
  rather than the protocol alone. Owner-approved mid-phase; rationale in the Progress note.

All seven "What We're NOT Doing" boundaries held.

## Findings

### F1 — Set-password page doesn't mirror the route's role gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: `src/pages/auth/reset-password.astro:74-91`
- **Detail**: The page comment promises it mirrors the route's gate; it mirrors four of five
  and omits (c) role. A deactivated staffer (`middleware.ts:30` → `role = null`) can request a
  reset, reach the full form, submit, and get an unstyled `Forbidden` from
  `reset-password.ts:75-77`.
- **Fix**: Add a role branch between the `origin !== "link"` and `!mode` branches using the
  existing `StatusHead` / `AuthPrimaryLink` idiom.
  - Strength: One branch; closes the gap the comment already claims is closed.
  - Tradeoff: Presentation only; the route keeps its hard 403.
  - Confidence: HIGH — verified no role read on the page; route 403 asserted at
    `reset-password.test.ts:196-206`.
  - Blind spot: Copy decision — neutral vs. naming the deactivation.
- **Decision**: QUEUED → `follow-ups/review-fixes.md` §1

### F2 — 15-min marker contradicts the 60-min link and the shipped copy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: `src/lib/auth-session.ts:46,54`
- **Detail**: `maxAge: 900` commented "matches the reset window (15 min)", but
  `config.toml:238` `otp_expiry = 3600` and `:171` `jwt_expiry = 3600`, and the copy says
  "ważne 60 minut" in three places. At minute 16 the user gets a false "Link wygasł" whose CTA
  requests a new link, which `/auth/callback` then refuses because they are still signed in on
  the link session — a loop escapable only via R11's sign-out.
- **Fix A ⭐ Recommended**: Raise `maxAge` to 3600 so the marker matches the link it gates.
  - Strength: Code, config and copy agree; the loop disappears. Freshness is carried by
    "stamped by this navigation" + the one-shot delete, not by the lifetime.
  - Tradeoff: Loses a window tighter than the session.
  - Confidence: HIGH — one constant; tests assert marker survival/deletion, not lifetime.
- **Fix B**: Keep 900, correct the comment, give the branch its own copy, sign the user out
  before its CTA.
- **Decision**: FIXED via Fix A — `maxAge: 3600`, comment rewritten to state why it must not
  be shorter.

### F3 — Marker's value is still query-derived

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality (Security, cosmetic)
- **Location**: `src/pages/auth/callback.ts:43,75`
- **Detail**: `invite` comes from `?flow`/`?type`, so `&flow=invite` on a genuine recovery link
  renders the invite screen. The gate never reads the value, so impact is cosmetic — but
  `reset-password.astro:41-42`'s comment overstates the guarantee.
- **Fix**: Derive `invite` from the exchange result, or soften the comment.
- **Decision**: QUEUED → `follow-ups/review-fixes.md` §2

### F4 — Third "Hasło zaktualizowane" card kept the crimson CTA

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Design fidelity
- **Location**: `src/pages/dashboard/account/password.astro:67-72`
- **Detail**: Still `bg-primary h-12 rounded-xl text-sm font-semibold` — the idiom
  design-contract §7.3 names as divergent and §10 deviation 2 says Phase 4 corrected — and no
  `StatusHead`. Two sibling success cards rendered visibly different buttons.
- **Fix**: Swap to `AuthPrimaryLink` + `StatusHead tone="green" icon="shieldCheck"`.
- **Decision**: FIXED

### F5 — `signin.ts` has an unguarded `formData()` and lying casts

- **Severity**: OBSERVATION · **Impact**: 🏃 LOW · **Dimension**: Pattern Consistency
- **Location**: `src/pages/api/auth/signin.ts:8-10`
- **Detail**: Only auth handler without a body guard; `as string` can be `null`. Siblings
  try/catch to a `generic` code.
- **Decision**: QUEUED → `follow-ups/review-fixes.md` §3

### F6 — Five new `.astro` files omit the import-order headers

- **Severity**: OBSERVATION · **Impact**: 🏃 LOW · **Dimension**: Pattern Consistency
- **Location**: `link-conflict.astro`, `StatusHead/AccountBox/AuthBackLink/AuthPrimaryLink.astro`
- **Detail**: CLAUDE.md mandates `// core` / `// components` / `// others`. All 12
  non-conforming files repo-wide are in the auth surface; `password.astro` one directory over
  conforms — new code inheriting a local pocket's drift.
- **Decision**: QUEUED → `follow-ups/review-fixes.md` §3

### F7 — Cookie test double discards options

- **Severity**: OBSERVATION · **Impact**: 🏃 LOW · **Dimension**: Pattern Consistency
- **Location**: `tests/helpers/context.ts:78-99`
- **Detail**: `path` (called load-bearing) and `secure` cannot be asserted at integration
  level. Mitigated by the real-browser e2e flow.
- **Decision**: QUEUED → `follow-ups/review-fixes.md` §3

### F8 — `amr` OR-ordering is safe only because the callback refuses a live session

- **Severity**: OBSERVATION · **Impact**: 🏃 LOW · **Dimension**: Safety & Quality (latent)
- **Location**: `src/lib/auth-session.ts:138`
- **Detail**: `amr` accumulates and `otp` is checked first, so a both-methods session reads as
  `"link"`. Unreachable today only because `callback.ts:30-32` refuses an existing session and
  nothing else calls `verifyOtp`/`setSession`. The dependency was undocumented.
- **Decision**: FIXED — dependency named in a comment so a future link-exchange call site must
  preserve the guard.

### F9 — Done-cookie forgery claim overstated

- **Severity**: OBSERVATION · **Impact**: 🏃 LOW · **Dimension**: Doc accuracy
- **Location**: `src/pages/auth/reset-password.astro:32`
- **Detail**: `PW_SET_DONE_COOKIE` is writable via devtools; the real gain over `?done=1` is
  that it is no longer _linkable_. Self-inflicted, zero privilege.
- **Decision**: FIXED — comment reworded.

### F10 — `/api/auth/signout` signs out at global scope

- **Severity**: OBSERVATION · **Impact**: 🔎 MEDIUM · **Dimension**: Architecture (pre-existing)
- **Location**: `src/pages/api/auth/signout.ts:13`
- **Detail**: supabase-js defaults to `{ scope: 'global' }` (verified
  `@supabase/auth-js/.../GoTrueClient.js:3173`), so signing out of one browser revokes every
  device session. Outside S-14's scope, and currently recorded only in `e2e/e2e-rules.md` as a
  _test_ hazard rather than a product decision.
- **Decision**: SKIPPED — recorded in `follow-ups/review-fixes.md` under "Not queued" so it
  isn't lost.

## Triage summary

- **Fixed**: F2 (Fix A), F4, F8, F9
- **Queued** to `follow-ups/review-fixes.md`: F1, F3, F5, F6, F7
- **Skipped**: F10 (recorded, not queued)

All gates re-run green after the fixes: astro check 0 · lint 0 · unit 340/340 ·
integration 214/214 · e2e 13/13.
