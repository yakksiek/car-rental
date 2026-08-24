<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Invite Journey Fixes — Implementation Plan

- **Plan**: `context/changes/invite-journey-fixes/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-20
- **Verdict**: REVISE → **SOUND after fixes** (10/10 findings fixed in plan)
- **Findings**: 3 critical, 5 warnings, 2 observations

## Verdicts

| Dimension             | Verdict (as reviewed) | After fixes |
| --------------------- | --------------------- | ----------- |
| End-State Alignment   | WARNING               | PASS        |
| Lean Execution        | PASS                  | PASS        |
| Architectural Fitness | WARNING               | PASS        |
| Blind Spots           | FAIL                  | PASS        |
| Plan Completeness     | WARNING               | PASS        |

## Grounding

21/21 paths ✓, 14/14 symbols ✓, brief↔plan ✓, Progress↔Phase 6/6 phases + 71/71 criteria ✓
(76/76 after fixes). Verified live against local Supabase (GoTrue v2.188.1) and the working tree.

## Findings

### F1 — Token-lookup RPC cannot tell a live link from an expired one

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 4 §1 — Token-lookup RPC
- **Detail**: The RPC was specified lookup-only over `auth.one_time_tokens`, returning "no row when
  the hash is unknown". That table has **no expiry column**, and GoTrue deletes a token on _use_, not
  on expiry — probed 2026-08-20, the local table held a row 3 days old against
  `config.toml otp_expiry = 3600`. So the lookup resolves dead links, the form renders, and the hire
  only learns the link is dead after submitting a password. Phase 4's own criterion 4.11 could not
  hold under the contract as written.
- **Fix A ⭐ Recommended**: Give the RPC the expiry predicate
  - Strength: Keeps 4.11 achievable; `auth.users.confirmation_sent_at` / `recovery_sent_at` both
    confirmed present, so the join is already in the spec'd shape.
  - Tradeoff: Hardcodes the 3600s window in SQL, duplicating `config.toml`.
  - Confidence: HIGH — the columns exist.
  - Blind spot: Which timestamp GoTrue measures from is unverified; the plan now requires a probe.
- **Fix B**: Accept the deferral — render the form, let the POST refuse
  - Strength: No expiry logic outside GoTrue.
  - Tradeoff: Real UX regression on day-old invite mail; 4.11 must be rewritten.
  - Confidence: HIGH — this is the plan as written, named honestly.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — phase 4 §1 clause 2

### F2 — R14 regresses: the RPC's role is not deactivation-aware

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §1
- **Detail**: `profiles.role` stays `'employee'` after `deactivate_staff` runs, and
  `current_app_role()` (`20260604153139:54`) reads it with no deactivation check. The only place the
  null-ing happens is `middleware.ts:36`, which never runs for a session-less path. An RPC returning
  `profiles.role` verbatim hands a deactivated staffer `'employee'`, passing them through branch 3 to
  the set-password form — the defect `auth-followups` shipped R14 to close. `e2e/auth-hardening.spec.ts:132`
  asserts this and was missing from phase 6's inventory.
- **Fix**: Return a null role when `deactivated_at is not null`, mirroring `middleware.ts:36` rather
  than `current_app_role()`; add e2e `:132` to phase 6's review list.
- **Decision**: FIXED — phase 4 §1 clause 3 + phase 6 §4

### F3 — Nothing vouches for the caller-supplied `type` any more

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §1–§2
- **Detail**: `callback.ts:56-78` documents that only `verifyOtp` resolving the token by hash **and**
  type makes the caller-supplied `?type` trustworthy — that is the `auth-followups` F3 fix. Phase 4
  removes `verifyOtp` from the GET, but the RPC contract stated "no row when the hash is unknown" and
  never made the type part of the lookup predicate. `LINK_TYPES` validates membership in a closed
  set, never the pairing. So `&type=invite` on a genuine recovery link would render "Witaj we Flocie"
  again. Verified the enum distinguishes them: `recovery_token` vs `confirmation_token`.
- **Fix**: Match on `token_hash` AND the mapped `token_type`, mismatch → no row; update `callback.ts`'s
  comment block, which credits `verifyOtp` with the guarantee.
- **Decision**: FIXED — phase 4 §1 clause 1 + §2

### F4 — Phase 5's branch spec contradicts itself; R12 becomes unreachable

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 5 §2 — The set-password page
- **Detail**: The contract asserted both "branch order preserved — done → **no token** → no staff role
  → …" and "branch 4 (R12) keeps its screen: a signed-in staffer **with no pending token**". If
  branch 2 is "no token" it fires first for exactly branch 4's population — they get R13 instead of
  R12, and R12's block (incl. its `AccountBox` at `:133`) goes dead. Design-contract §8.2 asserts R12
  parity, so this would surface as a failed vision-diff rather than a caught bug.
- **Fix**: Branch 2 = "no pending token AND no session"; branch 4 = "a session, but no pending token".
  R12's AccountBox stays on `Astro.locals.user` (no token → the RPC has no input).
- **Decision**: FIXED — phase 5 §2 now carries a six-row predicate table

### F5 — Phase 4 puts `createAdminClient()` on an unauthenticated route

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 §1 — grants
- **Detail**: Two problems. (1) `src/lib/supabase.ts:43-45` and `docs/reference/contract-surfaces.md`
  both document `createAdminClient()` as "`/api/staff*` routes only, which self-gate with
  `requireRole`" — `/auth/callback` is the app's one deliberately unauthenticated route. (2) It
  returns `null` without `SUPABASE_SERVICE_ROLE_KEY` (`supabase.ts:51-53`), a registered **optional**
  server secret; today an unconfigured deployment loses staff management but keeps the invite and
  recovery journeys working. Depending on it here would silently kill the link journey on a missing
  secret, with a symptom that reads as an expired link.
- **Fix A ⭐ Recommended**: Grant the RPC to `anon`, call it on `locals.supabase`
  - Strength: Keeps the service-role boundary intact; the caller must already hold a valid
    `token_hash`, and the function returns nothing without one.
  - Tradeoff: Needs an explicit anon grant + "intentionally public" comment (lessons.md carve-out
    (a)); the grants test asserts anon CAN call it.
  - Confidence: MEDIUM — matches the four public booking RPCs, but this one reads `auth.*`.
  - Blind spot: Rate-limiting a hash-guessing loop is unaddressed either way (now noted in the plan).
- **Fix B**: Keep service-role, handle the null client
  - Strength: Un-guessable RPC; no anon grant over an `auth.*` table.
  - Tradeoff: Requires amending the `supabase.ts` comment + contract-surfaces row, plus explicit
    null-client copy.
  - Confidence: HIGH.
  - Blind spot: Whether prod has the secret set.
- **Decision**: FIXED via Fix A — phase 4 §1 grants, with the rejected option recorded

### F6 — Phase 3's "repaired but mail failed" banner has no phase

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 3 §4
- **Detail**: Design-contract §9 assigns `repairedMailFailed` to phase 3 and phase 3's Intent named
  `api/staff.ts` and `StaffList` — but neither file was in phase 3's Changes Required, and no
  criterion mentioned the banner. `StaffList.tsx:481-486` treats HTTP 200 as unqualified success
  (merges the row, `setAddOpen(false)`, returns) before any banner code, so the service change would
  land with nowhere to render.
- **Fix**: Add both files as phase 3 §5 — stay HTTP 200 per the house pattern, carry the outcome in
  the body, branch inside the existing success arm, error tone with no retry per §8.1. Add criteria.
- **Decision**: FIXED — new phase 3 §5 + criteria 3.5, 3.13, 3.14

### F7 — The AccountBox loses its name (and initials) under option C

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 5 §2
- **Detail**: `reset-password.astro:76` derives `fullName` from `user.user_metadata`, which option C
  removes; `AccountBox.astro:34` uses it for the initials avatar via `staffInitials(fullName, email)`.
  The RPC's stated return was email + role only, so the invite form's avatar would silently degrade
  to an email fallback — contradicting "No visual change is intended on any of these screens".
- **Fix**: Add `full_name` to the RPC's return (it already joins `public.profiles`) and state the
  phase 5 wiring.
- **Decision**: FIXED — phase 4 §1 return + phase 5 §2 data-sources paragraph + criterion 5.12

### F8 — Four registered contract surfaces change shape; the registry is never updated

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Plan-wide
- **Detail**: `docs/reference/contract-surfaces.md` opens with "Do not rename or change the shape of
  anything listed here without updating every consumer." The plan changes `list_staff()` (new OUT
  column), `CreateEmployeeResult` (new arms + field), `profiles` (new column), and `/auth/callback`
  (its row reads "PKCE recovery + invite-accept"; phase 4 deletes the PKCE arm) — and mentioned the
  file nowhere. Blast radius itself is clean: all four were grepped and every consumer is already
  inventoried in the plan. This is a stale-registry problem, not a missed-caller problem.
- **Fix**: Registry updates in phase 2 (schema/RPC/result rows) and phase 4 (callback row + the new
  RPC), each with its own criterion.
- **Decision**: FIXED — phase 2 §4, phase 4 §5, criteria 2.8 and 4.9

### F9 — The known-issues entry is promised but unassigned

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §1; `plan-brief.md` Open Risks
- **Detail**: Both documents say the `auth.one_time_tokens` GoTrue-upgrade coupling should be recorded
  in `known-issues.md`. The file exists, but no phase's Changes Required included it and no criterion
  checked it — so the durable record of this change's most open-ended risk depended on memory.
- **Fix**: Add `context/foundation/known-issues.md` to phase 4's Changes Required with a criterion,
  naming the probed GoTrue version (v2.188.1, 2026-08-20).
- **Decision**: FIXED — phase 4 §5 + criterion 4.9

### F10 — Design-contract §9 specifies a straight quote where the codebase ships a curly one

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `design-contract.md` §9; Progress 1.10
- **Detail**: §9 specified `„Ponów"` / `„Resetuj hasło"` — opening `„` (U+201E), closing straight
  ASCII `"`. Its own cited precedent ships the pair: `reset-password.astro:130` renders
  `„Zmień hasło”` (U+201D), and §9 mis-transcribed that line too. Progress 1.10 verifies the copy
  "verbatim" against §9, so following the contract exactly would ship the wrong glyph and pass.
- **Fix**: Correct the three §9 strings and the quoted precedent to close with `”`.
- **Decision**: FIXED — `design-contract.md` §9 (6 occurrences)

## Not findings — verified and clean

- **Blast radius**: `readSessionOrigin`, `LINK_ORIGIN_COOKIE`, `readLinkOrigin`, `PW_SET_DONE_COOKIE`,
  `CreateEmployeeResult`, `list_staff` — every consumer already appears in the plan's inventory.
- **PKCE `?code=` removal**: nothing in `src/pages`, `src/components`, or `supabase/templates/` mints
  a `?code=` link. Safe to delete, as claimed.
- **`api/staff.ts` exhaustiveness**: the contextually-typed `APIRoute` arrow does force a compile
  error when the union gains arms, so phase 1's "TypeScript points at this file" holds.
- **Lean Execution**: "What We're NOT Doing" closes five alternatives on evidence rather than
  preference; no premature abstraction or scope contradiction found.
