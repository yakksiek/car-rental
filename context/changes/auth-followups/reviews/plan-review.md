<!-- PLAN-REVIEW-REPORT -->

# Plan Review: S-14 Review Follow-ups

- **Plan**: `context/changes/auth-followups/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-17
- **Verdict**: REVISE (at review) → **SOUND** after triage, with one accepted risk
- **Findings**: 0 critical, 4 warnings, 3 observations — 6 fixed, 1 accepted

## Verdicts

| Dimension             | At review | After triage                 |
| --------------------- | --------- | ---------------------------- |
| End-State Alignment   | WARNING   | PASS (F2 fixed)              |
| Lean Execution        | PASS      | PASS                         |
| Architectural Fitness | WARNING   | PASS (F7 fixed)              |
| Blind Spots           | WARNING   | PASS — F6 fixed, F3 accepted |
| Plan Completeness     | WARNING   | PASS (F1, F4, F5 fixed)      |

## Grounding

14/14 paths ✓ · 8/8 symbols ✓ (one plan claim contradicted — see F7) · Progress↔Phase ✓ (3
phases, 22 criteria ↔ 22 progress items, one `## Progress`, no stray checkboxes) ·
contract-surfaces: no surface name matched the plan text, check skipped per convention · no
`plan-brief.md` (optional).

Verified directly against the code rather than by sub-agent: `middleware.ts` role
resolution, `access.ts` route map and `requireRole` signature, `api/auth/reset-password.ts`
gate order, `auth/callback.ts` invite derivation, `api/auth/signin.ts` control flow,
`auth-messages.ts` code tables, `tests/helpers/context.ts` + `link-session.ts`,
`e2e/fixtures/staff.ts`, `e2e/auth-hardening.spec.ts`, `supabase/templates/{invite,recovery}.html`,
`supabase/config.toml`, `tsconfig.json`, `eslint.config.js`, and Astro's own
`AstroCookie` type.

Claims that held: `?flow` appears only on the invite template; `AccountBox` / `StatusHead` /
`AuthPrimaryLink` exist and fit the new card; the "five new `.astro` files" list is exactly
right (the three other files added on this branch either already carry headers or have no
imports); `dashboard/account/password.astro` really is the conforming counter-example;
`generic` really is in the signin copy table.

## Findings

### F1 — Cookie-double contract breaks an existing assertion, and the new assertion has nothing typed to read

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — §3 "Cookie double keeps its options (F7)"
- **Detail**: Two problems in "Store `{ value, options }` in the jar so `set`/`delete` record
  their third argument; keep `get` returning `{ value }` so no existing test changes."
  (a) `tests/integration/reset-password.test.ts:154` asserts
  `expect(context.cookies.get(LINK_ORIGIN_COOKIE)).toBeUndefined()` after a successful POST
  spends the marker. Any implementation where `delete` records its options _as a jar entry_
  leaves the key present, so `get` returns a truthy object and that assertion goes red —
  the plan's own "no existing test changes" promise fails. Where a delete's options live is
  unspecified. (b) `buildApiContext` returns `... as unknown as APIContext`
  (`tests/helpers/context.ts:141`), so a test sees Astro's `AstroCookies`, whose `get()`
  returns `{ value, json(), number(), boolean() }` — no `options`
  (`astro/dist/core/cookies/cookies.d.ts:7-12`). `tsconfig.json` includes `**/*` and ESLint
  runs `projectService: true`, so `get(X)?.options` fails criteria **3.1 and 3.2**, not just
  3.4.
- **Fix**: Keep the value jar as-is (live cookies only) and record options in a second map
  reached through an exported `cookieOptions(context, name)` typed as
  `AstroCookieSetOptions | undefined` — solves both halves at once.
- **Decision**: FIXED — contract rewritten in Phase 3 §3, with both constraints recorded.

### F2 — The role branch's placement rule is stated wrongly, and the chosen slot leaves R12's button pointing at a bare Forbidden

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 1 — §1 "Role branch on the page"
- **Detail**: The plan placed the new branch after `origin !== "link"` "so an ordinary
  signed-in staffer still gets R12". That constraint does not bind — a role-sufficient
  staffer passes `isRoleSufficient(role, "employee")` and falls through to R12 wherever the
  branch sits. What the slot actually decides is the deactivated staffer holding a
  **password** session: deactivation sets `role = null` (`middleware.ts:36`), sign-in still
  succeeds (`signin.ts` never checks role), and on `/auth/reset-password` they match the
  "not a link" branch → R12 → its button targets `/dashboard/account/password`, a
  `/dashboard` path, so `middleware.ts:57-59` answers a bare `Forbidden`. The defect the
  phase removes, relocated one click downstream. Separately, Desired End State's "no staff
  member ever meets a bare `Forbidden`" overclaims — middleware still answers one on any
  gated route, including straight after a successful sign-in.
- **Fix A ⭐ Recommended**: Move the branch to immediately after `!user`
  (done → `!user` → role → origin → `!mode` → form).
  - Strength: closes both deactivated paths; no role-sufficient behaviour changes at all.
  - Tradeoff: a deactivated staffer with a password session now sees the new card instead of
    R12 — correct, but broader than F1 as originally filed.
  - Confidence: HIGH — every branch traced against `access.ts` and `middleware.ts`.
  - Blind spot: none significant.
- **Fix B**: Keep the placement, correct only the rationale text.
  - Strength: minimal edit; that user already met a 403 at sign-in.
  - Tradeoff: knowingly ships a card whose button is a 403 for one class of user.
  - Confidence: MEDIUM — rests on "they arrived by signing in", which a bookmark defeats.
  - Blind spot: a bookmarked `/auth/reset-password` reaches R12 without passing `/dashboard`.
- **Decision**: FIXED via Fix A. Desired End State narrowed to this surface, and a
  "What We're NOT Doing" bullet added for middleware's own 403.

### F3 — "Nothing affects the S-08 production rollout chain" is not established for Phase 2

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — §2, and Migration Notes
- **Detail**: `callback.ts:43` currently accepts two independent signals for invite mode
  (`flow=invite` OR `type=invite`/`signup`); Phase 2 deletes the first. The repo proves that
  is safe for the **local** stack only — `supabase/config.toml:257-263` registers
  `./supabase/templates/invite.html` by `content_path`, a local-stack mechanism. A hosted
  project's templates are configured out-of-band (dashboard → Authentication → Email
  Templates) and cannot be verified from this repo. If prod's invite link lost `type=invite`,
  the `flow` clause is currently the only thing carrying it: after Phase 2 the marker is
  stamped `recovery` and a new hire's first-day link renders "Ustaw nowe hasło" instead of
  "Witaj we Flocie" / "Ustaw hasło". It fails silently, and e2e cannot catch it — the fixture
  mints links from the repo's own hardcoded shape (`e2e/fixtures/staff.ts:112`).
- **Fix**: Add a pre-deploy check to Migration Notes (confirm the hosted Invite template URL
  contains `type=invite`) and drop the "no config change / no rollout impact" claim.
- **Decision**: ACCEPTED — owner will verify the hosted template at deploy time. The plan
  text was left unchanged; **this entry is the record of that outstanding deploy-time
  check.**

### F4 — Phase 1 omits `e2e/fixtures/staff.ts`; no deactivation fixture exists and the spec file is signed-in by default

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — §4 "E2E cover"
- **Detail**: The contract says "set `profiles.deactivated_at`", but the fixtures module
  exports no such helper and its service-role `admin()` client is module-private by design
  (`e2e/fixtures/staff.ts:16`, plus the file header's isolation invariant). The spec needs a
  new export in a file Phase 1 never listed as changed. Also `e2e/auth-hardening.spec.ts`
  runs on the chromium project's default `employee` storage state (spec header, lines 27-29),
  so "open it signed-out" must use the anonymous-context pattern already at lines 86-87 and
  108-110; a file-level `test.use` would break the four existing tests.
- **Fix**: Add `e2e/fixtures/staff.ts` to Phase 1 with a `deactivateStaffUser(id)` export
  (not the guard-carrying `deactivate_staff` RPC), and name the anon-context pattern in the
  spec contract.
- **Decision**: FIXED — both contracts written into Phase 1 §4, file list updated, Testing
  Strategy updated.

### F5 — The sign-in body guard cannot be written where the plan puts it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — §1 "Guard the sign-in body (F5)"
- **Detail**: "Wrap `formData()` in try/catch returning `back("generic")`" does not compile:
  in `signin.ts` the chain is `form` (8) → `redirectParam` (15) → `target` (16) → `back`
  (19), so a catch at line 8 has neither `back` nor `target` in scope. The named model,
  `reset-password.ts:96-101`, avoids this because its `fail()` takes what it needs as
  arguments.
- **Fix**: Spell out the working shape — the catch redirects directly to
  `/auth/signin?error=generic&redirect=` built from `safeRedirectPath(null)`.
- **Decision**: FIXED — compiling snippet written into Phase 3 §1.

### F6 — Phase 2's probe is thrown away, yet 2.1 is an automated criterion

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — §1, criterion 2.1
- **Detail**: The phase rests entirely on "GoTrue rejects a type-mismatched `verifyOtp`". The
  plan probes it — correctly, per the cited lesson — then discards the probe, so criterion
  2.1 can never be re-run and nothing pins the property across a GoTrue upgrade. Both hops
  already exist in `tests/helpers/link-session.ts:57-70`, so it is ~10 lines as a committed
  test. Secondary: the phase's fallback branch ("if accepted, soften the comment instead")
  has no Progress representation.
- **Fix**: Commit the probe as `tests/integration/auth-callback.test.ts`.
- **Decision**: FIXED — Phase 2 §1 rewritten, criterion 2.1 and Progress 2.1 reworded to
  match, Testing Strategy updated.

### F7 — The reason given for avoiding `requireRole` is factually wrong

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — §1
- **Detail**: The plan said to use `isRoleSufficient(role, "employee")` "rather than
  `requireRole`, which takes an `APIContext`-shaped `locals`". `requireRole(locals:
App.Locals, min: AppRole)` (`src/lib/access.ts:79`) takes `App.Locals`, and `Astro.locals`
  in a `.astro` file _is_ `App.Locals` — it compiles. Its own doc comment calls it the
  "In-handler guard for pages/API routes" (`access.ts:76-78`). Using it makes the page's
  branch textually identical to the gate it mirrors (`reset-password.ts:75`), which is the
  point of "parity".
- **Fix**: Use `requireRole(Astro.locals, "employee")` and delete the incorrect reasoning.
- **Decision**: FIXED — Phase 1 §1 now calls `requireRole`, with the correct note on types.
