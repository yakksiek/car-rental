<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Staff self-service account (S-11)

- **Plan**: `context/changes/staff-account/plan.md`
- **Scope**: All 3 phases (full plan)
- **Date**: 2026-08-10
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical · 5 warnings · 4 observations

Reviewed at `main...HEAD` (commits `346bb3c`, `3a7aa37`, `8d0c54c`, `4a3eaaa`, `5dec3c3`).
All automated success criteria re-run at review time: `astro check` 0 errors, `npm run lint`
0 errors (2 pre-existing warnings in `ReturnProtocolForm.tsx`), `npm run build` complete,
312 unit tests, 200 integration tests.

**Why NEEDS ATTENTION and not REJECTED**, despite a critical: F1's vulnerable code is not in
this diff. The shipped endpoint is correct. But F1 defeats the slice's stated purpose, so
Safety & Quality is recorded as FAIL rather than WARNING.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | FAIL    |
| Architecture        | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

## Findings

### F1 — /auth/reset-password changes any signed-in user's password without the current one

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/auth/reset-password.ts:29-33` (not in this diff)
- **Detail**: The route's comment claims "The recovery session must exist", but it only checks
  `!locals.user` — true for any signed-in staffer. `/auth/*` is absent from `ROUTE_ROLES`, so
  `reset-password.astro:31` renders the set-password form to any logged-in user.
  `config.toml:232` has `secure_password_change = false`, so GoTrue requires no reauth either.
  This bypasses the reauthentication gate S-11 built. **Reproduced end-to-end 2026-08-10**: an
  ordinary `POST /api/auth/signin` followed by `POST /api/auth/reset-password` returned
  `302 ?done=1`; the new password signed in, the old one did not.
- **Decision**: DEFERRED — routed to roadmap slice **S-14 `auth-surface-hardening`**. Full
  problem statement + reproduction in `../follow-ups/review-fixes.md`.

### F2 — Password change revoked no other sessions

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/auth/change-password.ts:71-92`
- **Detail**: `updateUser({ password })` revokes nothing, and the `signInWithPassword` reauth
  minted a second session that orphaned the caller's original — so a stolen cookie outlived the
  password change. **The originally recommended fix was withdrawn after probing**: `updateUser({
password, current_password })` is a silent no-op while `secure_password_change = false` (a
  deliberately wrong value changed the password anyway), so it could not replace the reauth.
- **Fix applied**: `await supabase.auth.signOut({ scope: "others" })` after a successful update.
  Probe-verified: kills the orphan and every other device, caller's own session survives.
- **Decision**: FIXED (+ integration test "revokes other sessions but keeps the caller signed in")

### F3 — Avatar initials came from the email, never from full_name

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (design contract)
- **Location**: `src/pages/dashboard/account.astro:32-46`
- **Detail**: The name preferred `full_name` but initials always came from
  `staffIdentity(user.email)`, so the hero read "Karolina Mazur" beside an "E" avatar.
- **Fix applied**: local `initialsOf()` derives initials from whichever source won the name.
  Verified in rendered HTML: now "KM".
- **Decision**: FIXED

### F4 — Mobile tab bar was at its width limit for admins

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture (shared surface)
- **Location**: `src/components/shell/StaffShell.astro:190-244`
- **Detail**: Fixed, centre-translated pill with no max-width and no wrap. Admin = 8 items =
  360px, exactly a 360px viewport; overflows at 320px. The plan's "the pill has room" held for
  employees only, and S-13 adds a ninth item.
- **Fix applied**: `max-w-[calc(100vw-24px)] overflow-x-auto` + hidden scrollbars (same idiom as
  `FleetTypeScroll.tsx:127`), items `shrink-0` so they keep their 40px hit target.
- **Decision**: FIXED

### F5 — Three reliability leaks in the endpoint

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/auth/change-password.ts:58-75, :82-88`
- **Detail**: (a) unguarded `request.formData()` → a malformed body escaped as a 500;
  (b) `form.get()` returns null for an absent field, failing zod's _type_ check so its English
  default reached a Polish UI; (c) all reauth errors flattened to "Nieprawidłowe obecne hasło",
  including GoTrue's 429 — whose bucket is shared app-wide behind Cloudflare Workers.
- **Fix applied**: guarded parse, `?? ""` coalescing, and a distinct `MSG.rateLimited` for a 429.
- **Decision**: FIXED

### F6 — ?error= is attacker-controlled and rendered verbatim

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `change-password.ts:88` → `account/password.astro:16` → `ServerError`
- **Detail**: Not XSS — both escaping hops verified. Content injection: any text in the query
  string renders inside a styled destructive alert on a legitimate authenticated URL. Also lets
  GoTrue's English `same_password` message into an all-Polish UI. The same idiom exists on
  `/auth/signin` and `/auth/reset-password`.
- **Decision**: DEFERRED — routed to roadmap slice **S-14 `auth-surface-hardening`** so all four
  auth surfaces are fixed together. Write-up in `../follow-ups/review-fixes.md`.

### F7 — profiles select narrowed from three columns to one

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: `src/pages/dashboard/account.astro:26`
- **Detail**: Contract said `.select("full_name, role, created_at")`; shipped `.select("full_name")`.
  Benign — `role` comes from locals, `created_at` unused — but undocumented.
- **Decision**: FIXED — plan contract amended to match the (better) narrower query.

### F8 — Mobile header→body gap was 12px; contract says 18px

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence (design contract)
- **Location**: `src/pages/dashboard/account.astro:48-56`
- **Detail**: Contract Surface 2 marks both `exact`: header padding 54/18/12, body padding-top 6px.
  The 6px was dropped.
- **Decision**: FIXED — `pt-1.5 md:pt-0` on the body column.

### F9 — aria-label="Profil" suppressed the chip's visible text

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: `src/components/shell/StaffShell.astro:126-137`
- **Detail**: Introduced by fixup `4a3eaaa`. At `lg` the chip visibly reads the staffer's name, but
  the accessible name became just "Profil" — WCAG 2.5.3 Label in Name, breaking voice control.
- **Decision**: FIXED — `aria-label={\`Profil — ${displayName}\`}`.

### F10 — The tests could not see the failure modes that mattered

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: `tests/integration/change-password.test.ts`
- **Detail**: (a) no missing-`Origin` case, despite the harness supporting `origin: null` and no
  suite in the repo exercising it; (b) the suite drives the route with `anonClient()`
  (`persistSession: false`) rather than the SSR cookie client, which is why F2's session story was
  invisible to a green run.
- **Decision**: FIXED (a) — added "rejects a POST with no Origin header at all"; `employeeContext`
  widened to accept `string | null`. (b) partially addressed by F2's revocation test; the
  cookie-client limitation remains and is noted here rather than in the plan.

## Lesson recorded

Appended to `context/foundation/lessons.md`: **"A typed, accepted API parameter is not evidence
that it is enforced — probe security behaviour against the real backend."** Written from the
`current_password` no-op discovered while triaging F2, which nearly shipped as a security
"improvement" that would have silently removed the verification it appeared to add.

## Cleared during review (no findings)

All six "What We're NOT Doing" guardrails held. The Profil tab did not leak into the desktop
sidebar. The endpoint's gate ordering is linear and cannot be bypassed within that route; no open
redirect; no user enumeration; missing `Origin` fails closed. The StaffShell chip's Tailwind
conflicts resolve correctly by specificity, so the active state paints. `min-h-16` and the mobile
bottom padding are both derived from contract values, not magic. The full design contract was
transcribed against the shipped markup and matched value-for-value apart from F8. Import-order
headers, the `@/`-alias ban, the `cn()` rule and the async-button pending-state rule are all
satisfied — the new files are more convention-compliant than the auth files they were forked from.
`tests/helpers/context.ts` was verified purely additive against all 7 existing consumers.
