<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: S-14 Review Follow-ups

- **Plan**: `context/archive/2026-08-17-auth-followups/plan.md`
- **Scope**: Phases 1–3 of 3 (full plan)
- **Date**: 2026-08-18
- **Verdict**: NEEDS ATTENTION (at review) → **APPROVED** after triage — all 9 findings fixed
- **Findings**: 0 critical, 2 warnings, 7 observations

## Verdicts

| Dimension           | At review | After triage           |
| ------------------- | --------- | ---------------------- |
| Plan Adherence      | WARNING   | PASS (F2, F3)          |
| Scope Discipline    | PASS      | PASS                   |
| Safety & Quality    | WARNING   | PASS (F1, F4, F6)      |
| Architecture        | PASS      | PASS                   |
| Pattern Consistency | WARNING   | PASS (F7, F8, F9)      |
| Success Criteria    | PASS      | PASS (F5 strengthened) |

## Success criteria — re-run at review time

All 22 progress items verified green on 2026-08-18:

| Command                                  | Result                                                       |
| ---------------------------------------- | ------------------------------------------------------------ |
| `npx astro check` (1.1 / 2.2 / 3.1)      | 0 errors, 0 warnings, 5 pre-existing hints                   |
| `npm run lint` (1.2 / 2.3 / 3.2)         | 0 errors, 2 pre-existing warnings (`ReturnProtocolForm.tsx`) |
| `npm test` (1.3 / 3.3)                   | 340 passed / 29 files                                        |
| `npm run test:integration` (1.4/2.4/3.4) | 216 passed / 21 files                                        |
| `npm run test:e2e` :4321 (1.5 / 2.5)     | 14 passed, incl. new `auth-hardening.spec.ts:132`            |
| `npm run build` (3.5)                    | Complete in 7.37s                                            |

Manual items: 1.6 is covered by the new e2e spec; 1.7 confirmed by branch trace; 1.8 / 2.6 / 2.7
covered by the passing `staff-auth.spec.ts` invite and recovery specs; 3.6 by the unchanged
sign-in happy path. **2.8** (`&flow=invite` no longer flips the screen) has no test — its evidence
is that no reader of `?flow` remains in `src/`, verified by grep. No rubber-stamping found.

## Scope discipline

All six "What We're NOT Doing" guardrails held: the route's 403, middleware's 403,
`forgot-password.ts`, F10 (`signout.ts` global scope), the import-header retrofit limit, and the
absence of a page-render harness. The only EXTRA files are `reviews/plan-review.md` and a control
case in the new probe test — both justified workflow artifacts.

## Findings

### F1 — Phase 2's fix does not cover the second branch, and the comment above it says it does

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/auth/callback.ts:59-64`
- **Detail**:
  `/auth/callback` is the only place that writes the cookie `flota-link-origin`. Its value
  (`"invite"` or `"recovery"`) is what `/auth/reset-password:70` reads to choose between the
  new-hire welcome ("Witaj we Flocie" / "Ustaw hasło" / "Aktywuj konto") and the password-reset
  copy. Phase 2 existed to make that value derive from something the backend validates.

  On the `verifyOtp` branch it succeeds — GoTrue resolves the token by hash AND type, and the new
  probe pins that. But `invite` is computed at `:64`, **above** the `try`, straight off the query
  string, before either branch is chosen:

  ```ts
  42:  const type = url.searchParams.get("type");
  64:  const invite = type === "invite" || type === "signup";
  68:    if (code) {
  69:      const { error } = await supabase.auth.exchangeCodeForSession(code);
  ```

  `exchangeCodeForSession` never looks at `?type`. On the `?code=` branch `?type` is therefore
  read by nobody and validated by nobody — the exact position `?flow` was in.

  Walkthrough. Anna is a current employee:
  1. She requests a reset at `/auth/forgot-password`. `forgot-password.ts:26` calls
     `resetPasswordForEmail` through a client `@supabase/ssr` hard-defaults to PKCE, so her
     browser holds a code verifier.
  2. Her mail arrives. With this repo's `supabase/templates/recovery.html` it is a `token_hash`
     link, so today Anna is fine. If the hosted project's Recovery template was left on GoTrue's
     default `{{ .ConfirmationURL }}`, the link is `/auth/callback?code=XYZ`.
  3. Anna opens that URL with `&type=invite` appended.
  4. Line 64 sets `invite = true`. Line 69 exchanges the code successfully — it never sees `type`.
  5. Line 96 stamps `flota-link-origin` as `"invite"`.
  6. Anna lands on the set-password page and is greeted as a new hire.

  That is the defect F3 was filed to remove, surviving on the sibling branch. Impact is copy only —
  no session or authorization consequence — hence WARNING, not CRITICAL. The durable half is the
  comment at `:59-63`: "The PKCE `?code=` branch carries no type at all … so `invite` stays false
  there". The link carries no type; the code reads one anyway.

- **Fix A ⭐ Recommended**: Compute `invite` inside the `token_hash` branch; hardcode `recovery` on the `code` branch.
  - Strength: Makes the code do what the comment claims, and closes the hole regardless of what the hosted templates emit. Contained — `let invite = false`, assign where `verifyOtp` succeeds, move `mode` below the try.
  - Tradeoff: Touches control flow in the app's single session-minting choke point.
  - Confidence: HIGH — branch traced end to end; `mode` and the cookie write at `:96` are the only consumers.
  - Blind spot: None significant.
- **Fix B**: Leave the code; correct the comment to say the `?code=` branch is unreachable with this repo's templates and its `type` is unvalidated.
  - Strength: Zero risk to the hardened path; honest about a branch our own mails never take.
  - Tradeoff: Keeps a latent defect whose reachability is controlled by hosted config this repo cannot see — the same unknown as F3.
  - Confidence: MEDIUM — rests on prod templates staying on `token_hash`, which F3 cannot confirm.
  - Blind spot: Whether the hosted Recovery template currently uses `{{ .ConfirmationURL }}`.
- **Decision**: FIXED via Fix A — `invite` is now `let invite = false`, assigned only inside the `token_hash` arm after `verifyOtp` succeeds; `mode` moved below the try. The `?code=` arm can no longer read `?type`.

### F2 — plan.md contradicts the shipped code in three places

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/archive/2026-08-17-auth-followups/plan.md:129`, `:131`, `:296`
- **Detail**: Three contract points shipped differently from what the plan still says. All are
  defensible and two are recorded elsewhere, but the plan is what gets archived and read first.
  1. **Subtitle copy.** Plan `:129` says `To konto zostało dezaktywowane, więc nie można ustawić dla niego hasła. Skontaktuj się z administratorem, jeśli to pomyłka.` Shipped (`reset-password.astro:107`) is `Nie można ustawić hasła do nieaktywnego konta. Jeśli to pomyłka, skontaktuj się z administratorem.` — byte-identical to `design-contract.md:375`, where it is justified as an owner re-authoring at the Phase 1 gate.
  2. **`AuthBackLink`.** Plan `:131` says the card carries one. It does not; `reset-password.astro:110-114` is a five-line comment explaining why, and `design-contract.md:383-387` records the decision.
  3. **Sign-in casts.** Plan `:296` says replace both `as string` casts with `?? ""`. Shipped `signin.ts:26-29` uses `typeof emailRaw === "string" ? emailRaw : ""` — strictly better, and consistent with the narrowing at `:35`.
- **Fix**: Amend plan.md Phase 1 §2 and Phase 3 §1 to the three shipped contracts, each with a one-line pointer to the design-contract entry or in-code rationale.
- **Decision**: FIXED — plan.md Phase 1 §2 and Phase 3 §1 now state the shipped contracts, each pointing at its recorded rationale.

### F3 — The accepted deploy-time check has no home outside a review file, and Migration Notes still denies it

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `context/archive/2026-08-17-auth-followups/plan.md` (Migration Notes)
- **Detail**: The plan review's own F3 was ACCEPTED, not fixed: deleting the `?flow` clause is safe
  only if the hosted project's Invite template still carries `type=invite`. This repo can prove
  that for the local stack only — `supabase/config.toml` registers templates by `content_path`, a
  local mechanism; hosted templates are dashboard-configured. If prod's invite link lost
  `type=invite`, a new hire's first-day link now renders the reset copy instead of the welcome,
  silently, and e2e cannot catch it (the fixture mints links from the repo's own hardcoded shape).

  Two things make this worth restating now the code has shipped:
  - Migration Notes still reads "No schema change, no data migration, no config change. Nothing in
    this slice affects the S-08 production rollout chain." The plan review deliberately left that
    text and made its own finding the record — so the only copy of this obligation lives in
    `reviews/plan-review.md:100-118`, inside a folder headed for archive. There is no
    `context/changes/deployment/` in this repo, and the archived
    `2026-05-29-deployment/deployment-plan.md` has no email-template step.
  - It is **the same unknown as F1**. Whether prod's mails carry `token_hash` + `type` or fall back
    to `{{ .ConfirmationURL }}` decides both whether F3's risk fires and whether F1's branch is
    reachable. One check at deploy time answers both.

- **Fix**: Drop the "no config change / no rollout impact" claim from Migration Notes; replace it
  with the concrete pre-deploy step — confirm the hosted Invite and Recovery templates both emit
  `token_hash` + `type` — noting it also governs F1.
- **Decision**: FIXED — Migration Notes replaced with the concrete pre-deploy check on both hosted templates, cross-referencing F1.

### F4 — `type` reaches verifyOtp through an unchecked cast, with no closed whitelist

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/auth/callback.ts:76`
- **Detail**: `type: type as "recovery" | "invite" | "signup" | "email"` narrows nothing at runtime —
  `type=magiclink`, `type=email_change` and anything else are forwarded verbatim. Not exploitable
  today (GoTrue rejects hash/type mismatches, which the probe pins, and the marker value is
  separately constrained at `:64`), but this is the boundary where a future GoTrue type gets
  silently accepted. A real guard here also makes F1's fix fall out naturally.
- **Fix**: Replace the cast with a `const LINK_TYPES = [...] as const` membership check, redirecting
  to the expired page otherwise.
- **Decision**: FIXED — closed `LINK_TYPES` set plus an `isLinkType` type guard; the `as` cast is gone and `verifyOtp` receives a narrowed value. Anything outside the set falls through to the expired redirect.

### F5 — The probe pins `type=invite` but not `type=signup`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/integration/auth-callback.test.ts:73`
- **Detail**: `callback.ts:64` accepts two strings — `"invite"` and `"signup"` — but the committed
  probe only exercises `type: "invite"`. Relabelling a recovery link `&type=signup` is the identical
  move with a different string, and nothing committed proves GoTrue rejects it, though the file's
  stated purpose is "so a later GoTrue cannot loosen it silently". (The paired control test
  asserting the token IS accepted as `type: "recovery"` is a good addition beyond the plan's ~10
  lines — it is what makes the negative meaningful.)
- **Fix**: Add a `type: "signup"` rejection case, or drop `signup` from line 64 since
  `enable_signup = false` means no signup token is mintable.
- **Decision**: FIXED — added a third case pinning that a recovery token presented as `type=signup` is also rejected. Verified against GoTrue: 3/3 pass.

### F6 — The "two awaits wide" false-positive window has a permanent sibling the contract does not name

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/staff.ts:198-204`
- **Detail**: Phase 1 knowingly accepts that the new "Konto jest nieaktywne" card can lie during the
  new-hire race, on the grounds the window is "two sequential awaits wide". There is a second path
  that is not a window at all: if the invite succeeds and the `profiles` insert then fails, the
  GoTrue invite is already sent and is not rolled back. That hire owns a permanently profile-less
  `auth.users` row, so `middleware.ts:36` resolves their role to null forever, and their invite link
  tells them their account was deactivated. Pre-existing and outside this slice's scope — but the
  accepted-risk note understates the case.
- **Fix**: Widen the accepted-risk note in plan.md / design-contract.md to name the failed-insert
  path; queue the rollback itself separately.
- **Decision**: FIXED — accepted-risk notes in plan.md and design-contract.md widened to name the failed-insert path; the missing invite rollback is queued at `../follow-ups/review-fixes.md` with three options.

### F7 — The two files this change edited most still lack import headers

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/auth/reset-password.astro:2-10`, `src/pages/api/auth/signin.ts:1-5`
- **Detail**: The five files that got headers are each single-group, so +1 line is exactly right for
  all five — verified import by import. But Phase 1 added the `requireRole` import to
  `reset-password.astro` and Phase 3 added 15 lines to `signin.ts`, and both still have no headers
  while spanning two groups each. The plan scopes this out explicitly (`plan.md:81`, `:306`), so it
  is deliberate, not drift — the likely reason being that these two need two headers plus a blank
  line rather than the +1 the others needed. Ten files repo-wide remain non-conformant.
- **Fix**: Either add the two-group headers to these two files now, or leave them to the standalone
  cleanup the plan names.
- **Decision**: FIXED — two-group import headers added to `reset-password.astro` and `signin.ts`; the plan's guardrail amended to record that two of the seven were done and five remain deferred.

### F8 — Design-contract entry 14 has two gaps

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `context/archive/2026-08-11-auth-surface-hardening/design-contract.md:364-393`
- **Detail**: The card itself is clean — wrapper, title, subtitle and button classes are
  byte-identical to the four sibling states in the same file, and it introduces zero new class
  strings, so the "inherited-exact" claim holds literally. Two documentation gaps: (a) the entry
  never states the account-box decision, though §8.1–8.3 state theirs explicitly and here there IS
  an account to name; (b) the three new Polish strings live in §10 rather than §9, which the
  contract itself labels "Canonical. Port exactly".
- **Fix**: Add the account-box line to entry 14 and move (or mirror) the three strings into §9.
- **Decision**: FIXED + copy unified — account-box omission recorded in entry 14 with its reason; the two new strings added to §9; and the CTA changed from `Wróć do logowania` to the existing `backToLogin` string `Powrót do logowania`, so one phrasing ships.

### F9 — Two stale comments in the new e2e spec

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `e2e/auth-hardening.spec.ts:39-41`, `:149`
- **Detail**: Line 149 says "the four tests above" — there are three (`:53`, `:76`, `:107`). The file
  header at `:39-41` says "The last test carries a second, later risk", but the new test is now 4th
  of 5 and the last is `:171`. The spec itself is correct: anonymous context, role-based locators,
  timestamped emails, cleanup via the existing `afterEach`, no `waitForTimeout`, and the awaited
  `toBeVisible()` correctly ordered before the two `toHaveCount(0)` checks.
- **Fix**: Update both comments to the current test count and ordering.
- **Decision**: FIXED — both comments corrected to the current test count and ordering.

## Verified clean

Checked against code rather than comments, no defect found:

- **Role-branch placement.** Admins pass `requireRole(locals, "employee")` via
  `ROLE_RANK.admin (2) >= employee (1)` (`access.ts:18-21, 69-73`), so the new card never falsely
  accuses them. No session shape reaches a state it could not before; the branch only removes
  reachable states for role-null sessions. No XSS surface (static text, no interpolation).
- **Sign-in catch path.** `safeRedirectPath(null)` short-circuits to the `/dashboard` constant
  (`safe-redirect.ts:12-15`); no request-derived data reaches the catch, so no open redirect. No
  enumeration change — unparseable body and wrong password both land on closed-set error codes.
- **Cookie double.** `WeakMap` key identity holds across the `as unknown as APIContext` cast; no
  leak; the `delete`-clobbers-`set` hazard is real but untriggered (the handler touches two
  different keys). Astro's own `delete` applies no `path` default, so the new assertion measures
  something real, and all four pre-existing cookie assertions stay green with the value jar
  untouched.
- **E2E spec and integration conventions.** Both match their siblings; the minted probe user is
  cleaned up; `fileParallelism: false` guarantees serial execution.

## Triage outcome (2026-08-18)

All nine findings fixed. Post-triage full-suite verification:

| Check                      | Result                                                    |
| -------------------------- | --------------------------------------------------------- |
| `npx astro check`          | 0 errors                                                  |
| `npm run lint`             | 0 errors, 2 pre-existing warnings                         |
| `npm test`                 | 340 passed                                                |
| `npm run test:integration` | **217** passed (was 216; +1 from F5's `type=signup` case) |
| `npm run test:e2e`         | 14 passed on :4321                                        |
| `npm run build`            | Complete                                                  |

Behaviour changes shipped by this triage, beyond documentation:

- `src/pages/auth/callback.ts` — `?type` is validated against a closed set before the
  exchange, and is read for the marker's value **only** on the arm `verifyOtp` vouched for.
- `src/pages/auth/reset-password.astro` — the refusal card's CTA reads `Powrót do logowania`,
  matching the `backToLogin` string used everywhere else in the auth surface.
- `tests/integration/auth-callback.test.ts` — a third case pinning `type=signup` rejection.

### Note on verification — a stale dev server produced six false failures

Midway through triage the e2e suite went 6-red against a long-lived `npm run dev`. The
failures looked like a regression in the F1 fix (the invite path's `Witaj we Flocie` assertion
among them). They were not. The rendered page showed `Witaj **w** Flocie` — a superseded
string that exists nowhere in the source tree (`ResetPasswordForm.tsx:62` has `we`;
`design-contract.md:312` records `w` as the string it supersedes), so the server was serving a
stale compiled island. The same server had logged `Invalid hook call` and
`Cannot read properties of null (reading 'useState')` at startup. Killing it, clearing
`node_modules/.vite`, and letting Playwright start a fresh one returned 14/14 with the fix
unchanged. Worth knowing before reading e2e red as a code defect.

### Queued, not fixed

- **Invite rollback** (F6) — `context/archive/2026-08-17-auth-followups/follow-ups/review-fixes.md`.
- **Pre-deploy template check** (F3) — now in the plan's Migration Notes, not just this file.
- **Five remaining non-conformant import-header files** (F7) — still their own cleanup.
- **F10 from the S-14 review** (global-scope `signOut`) — unchanged, still needs a product call.
