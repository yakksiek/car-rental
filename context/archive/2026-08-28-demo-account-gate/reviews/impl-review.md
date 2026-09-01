<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Demo Account Gate

- **Plan**: `context/changes/demo-account-gate/plan.md`
- **Scope**: Phases 1–3 of 4 (Phase 4 dropped by the owner 2026-08-28)
- **Date**: 2026-09-01
- **Verdict**: REJECTED at review time — live security exposure on production; 9 of 10 findings resolved during triage, F4 skipped by owner
- **Findings**: 2 critical, 6 warnings, 2 observations

## Automated verification

All green, before and after the triage fixes.

| Check                      | Result                                                         |
| -------------------------- | -------------------------------------------------------------- |
| `npm test`                 | 436/436 pass                                                   |
| `npm run test:integration` | 307/307 pass (was 303 — +4 added for F3)                       |
| `npm run test:e2e`         | 29/29 pass                                                     |
| `npx astro check`          | 0 errors, 0 warnings                                           |
| `npm run lint`             | 0 errors (2 pre-existing warnings in `ReturnProtocolForm.tsx`) |
| `npm run build`            | succeeds                                                       |
| Prettier                   | clean on all touched files                                     |

**Not run:** `npx supabase db reset` (plan rows 1.1 / 2.9). It is destructive against a Docker
stack shared with sibling worktrees. Verified the equivalent instead: both migrations recorded in
`supabase_migrations.schema_migrations`, and `profiles.is_demo` is `boolean NOT NULL DEFAULT false`.

## Production state at review time

The plan's Phase 4 drop note asserted "there is no prod demo account at all." That was stale:

- `https://fleetrent.marcin-kulbicki.workers.dev/auth/signin` renders the demo card with working
  published credentials.
- `supabase migration list --linked` confirms `20260828120000` and `20260828140000` applied on prod.

So the slice is fully deployed. Local `main` is 5 commits ahead of `origin/main`, so it shipped from
the feature branch or a manual `wrangler deploy`. **The prod account's `is_demo` flag state could not
be confirmed** — the sandbox classifier blocked signing into production, and the attempt was not
worked around. F3's fix makes that unverifiable state self-correcting: if the account is not flagged,
the card now disappears.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | FAIL    |
| Architecture        | WARNING |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

**What was built well.** The three route guards sit exactly where the plan specified (verified
after `requireRole`, before body parse and admin-client construction, in all three). The DB gate's
`current_is_demo()` is correctly shaped — `STABLE SECURITY DEFINER`, `search_path = ''`,
revoke-before-grant, `(select …)` scalar-subquery wrapping in all four policy call sites. The sign-in
card is a faithful transcription: all 10 contract lines match by token, all six Polish strings
byte-for-byte. `e2e/demo-gate.spec.ts` is the strongest test in the branch — its admin control stops
it passing for the wrong reason. Pattern compliance is clean throughout.

**What failed.** The gate closes three doors in a much larger building, and the building was already
open to the internet.

Progress row 2.11 was independently re-verified during this review: with the published credentials
against local PostgREST, direct `UPDATE`/`DELETE` on the owner's profile and `deactivate_staff` all
no-op'd (returning `"demo"`), owner row unchanged. That claim holds.

## Findings

### F1 — Arbitrary-recipient mail relay via `/api/reservations/manual`

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/reservations/manual.ts:58,102`
- **Detail**: The plan's foundational premise (`plan.md:21`), _"Only one route accepts a
  caller-supplied email address,"_ is false. `manual.ts` gated role only; `customer_email` comes
  straight from the request body (`src/lib/reservation-schema.ts:55`) and is mailed at `:102`.
  `QuickAddButton.tsx:71-73` deliberately kept the row live for demo, so it was one click from the
  published session. **Confirmed end-to-end**: `POST /api/reservations/manual` as the demo account
  returned `201`, and `email_deliveries` recorded `template: reservation_confirmed, status: sent`
  through the real Resend adapter (`.dev.vars` has `RESEND_API_KEY` + `EMAIL_FROM` set, so the
  dev/log seam was not in the path). An RFC-2606 `.example` recipient was used; no third party was
  reached, and both rows were deleted.
- **Fix A ⭐ Applied**: `isDemoAccount` guard at the `(b2)` position mirroring `api/staff.ts:65-67`;
  `res` row disabled in `QuickAddButton`; stale prop doc corrected.
- **Verified**: demo → `403 demo_blocked`; real admin → `201`. Control row cleaned up.
- **Decision**: FIXED via Fix A

### F2 — `reservations_insert_authenticated` is `WITH CHECK (true)`

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20260603155136_booking_integrity_data.sql:160-163`
- **Detail**: The only write policy on `reservations`, with a check expression of literally `true` —
  it never calls `current_app_role()`, so any authenticated caller qualified, including one with no
  `profiles` row. `20260617120000` dropped the UPDATE/DELETE siblings but scoped itself to those two,
  so INSERT survived. Consequences: the row joins the `reservations_no_overlap` EXCLUDE set with no
  DELETE policy and no cancel RPC (permanent inventory block), and it plants a caller-chosen address
  that the protocol `resend-email` chain will mail. `reservations.customer_email` is genuinely
  immutable (no UPDATE policy, no RPC writes it), so INSERT was the only way in.
- **Fix A ⭐ Applied**: `supabase/migrations/20260901120000_reservations_drop_insert_policy.sql`
  drops the policy outright. Verified first that no code path depends on it — all `src/` reservation
  writes go through SECURITY DEFINER RPCs, and the direct inserts in `tests/` and `e2e/fixtures/` use
  the service-role client. `reservations` now has RLS enabled with zero policies (deny-all for
  anon/authenticated), which neutralises the pre-existing table over-grants for this table.
- **Verified**: direct PostgREST INSERT as demo → `42501 permission denied`. Integration 25/25.
- **⚠️ Partial**: this does **not** close the inventory-blocking vector. See F4.
- **Decision**: FIXED via Fix A (partial — F4 covers the remainder)

### F3 — Publication and the `is_demo` flag were two unlinked switches

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: `src/pages/auth/signin.astro:29`
- **Detail**: `demo = DEMO_EMAIL && DEMO_PASSWORD ? {...} : undefined` checked only that both
  strings were _present_. Nothing verified the named account had `is_demo = true`. Point them at a
  real admin, or publish before marking, and the page hands out working credentials for an ungated
  admin — the failure mode is **open**. `known-issues.md` concedes the ordering dependency
  ("provided the account is marked `is_demo` last"), which is an admission that a provisioning window
  exists where this is exactly wrong.
- **Fix A ⭐ Applied**: `supabase/migrations/20260901130000_demo_account_email.sql` adds an
  anon-executable `demo_account_email()` returning the single active `is_demo` account's address, or
  NULL when there is none, it is deactivated, or there is more than one. `DEMO_EMAIL` removed from
  `astro.config.mjs` and `signin.astro`; `DEMO_PASSWORD` stays configuration. The RPC is skipped
  entirely when no password is set, so deployments that publish no demo pay no round trip.
- **Verified**: all four branches probed directly (1 flagged → address; 0 → NULL; 2 → NULL;
  deactivated → NULL; anon can execute). End-to-end through the page: un-flagging the account made
  the card disappear, re-flagging restored it. 4 regression tests added to
  `tests/integration/staff.test.ts`.
- **Note**: the repo's own `security-definer-anon-guardrail.test.ts` correctly failed on the new
  anon-executable definer function; it was added to the allowlist with a written justification.
- **Decision**: FIXED via Fix A

### F4 — The gate stops at three routes while `current_app_role()` stays demo-blind

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architecture
- **Location**: `supabase/migrations/20260828140000_demo_account_write_gate.sql:5-7`
- **Detail**: Only `deactivate_staff` got a demo arm. Verified in the catalog that
  `create_confirmed_reservation`, `create_protocol`, `set_protocol_pdf`, `decide_reservation`,
  `set_vehicle_active`, `record_email_delivery` and `mark_password_set` are all SECURITY DEFINER and
  executable by `authenticated` — which includes demo. None consult `current_is_demo()`.
  **Proven**: as the demo account, `POST /rest/v1/rpc/create_confirmed_reservation` returned `200
"created"` with an attacker-chosen `customer_email` — so F2's policy drop does not close the
  inventory-blocking vector, because a definer RPC bypasses RLS. F1's route gate still holds (the
  send lives in the route), but the planted address stays reachable by the protocol resend chain.
  Also: `decide_reservation` is irreversible and fires real customer mail; `record_email_delivery`
  takes all six values caller-supplied into the append-only audit table; `mark_password_set()` has no
  role gate at all and writes `profiles`, bypassing the demo-gated UPDATE policy. `storage.objects`
  UPDATE permits upsert over an existing key, so signatures and signed PDFs can be overwritten.
- **Decision**: SKIPPED — owner's call. Needs a decision about what "demo" means across the whole
  app rather than a patch. **This is the largest residual risk in the slice.**

### F5 — Middleware coupled role resolution to the new column and discarded the error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/middleware.ts:31-41`
- **Detail**: `const { data: profile }` dropped `error`. Any select failure leaves `data` null, so
  `profile` is null and `role` resolves to null too — every authenticated staffer gets 403 on every
  gated route, silently, with nothing logged. Adding `is_demo` to the same select made a
  missing-column failure reachable where it previously was not. Security direction is fine
  (fail-closed); availability and diagnosability were not.
- **Fix Applied**: destructure and `console.error` the lookup failure, with the deploy-outran-its-
  migration case named in a comment. Fail-closed role behaviour unchanged.
- **Decision**: FIXED

### F6 — Phase 4 was dropped on a premise that is now false

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `plan.md:328-341`
- **Detail**: The drop note's stated trigger was "there is no prod demo account at all." There is
  one. Separately, `vehicles_update_staff` lets a demo caller UPDATE any vehicle and
  `vehicles_select_anon` is `using (is_active = true)` — so a visitor can set every vehicle inactive
  and **empty the public catalog**, not merely clutter the cockpit. The demo-password hijack was
  correctly re-homed to `known-issues.md` when Phase 4 was dropped; data rot was not, and would have
  left the durable register when the plan is archived.
- **Fix A ⭐ Applied**: drop note's premise corrected in place (the decision stands — the argument
  that survives is the second one). New `known-issues.md` entry "Demo visitors mutate live data with
  no reset path", including the public-catalog consequence and a cheaper mitigation than reviving
  Phase 4.
- **Decision**: FIXED via Fix A

### F7 — Un-contracted second UI surface, and the demo note was false on its own screen

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline / Design fidelity
- **Location**: `src/components/staff/StaffList.tsx:122,1213-1217`; `design-contract.md:3`
- **Detail**: Two halves. (1) The contract's scope line claimed one surface and "no new visual
  element"; Phase 2 added a roster card and Phase 3 a public footer link, neither contracted nor
  covered by the 3.7 vision-diff. The element itself is well-reasoned — `Button` carries
  `disabled:pointer-events-none`, so `title` never surfaces on hover and a visible note is genuinely
  needed — it was the record that was stale. Its code comment also cited §3.5/§3.13, which exist in
  an **archived** contract. (2) The copy _"Akcje wysyłające e-maile i usuwanie kont są w trybie demo
  wyłączone."_ sat in the same table as a live **"Wyślij zaproszenie"** button that sends email.
- **Fix A ⭐ Applied**: contract header corrected; new **§4** specifies both incidental surfaces with
  exact values, each marked `deviation`, including the two-cards-stacked note and the indexing
  concern. Copy narrowed and split by scope — sign-in card (app-wide, names the F1 fence):
  `Dodawanie i usuwanie kont, reset hasła oraz tworzenie rezerwacji są w trybie demo wyłączone.`;
  roster (screen-scoped): `Dodawanie i usuwanie kont oraz reset hasła są w trybie demo wyłączone.`
  Stale §3.5/§3.13 citations corrected.
- **Outstanding**: the Claude Design mockup (`staff-login.jsx` / `shared.jsx`
  `STR.{EN,PL}.login.demo`) still carries the old string. `DesignSync` requires `/design-login`,
  which the user must run.
- **Decision**: FIXED via Fix A (design-project sync pending authorization)

### F8 — Integration negative control asserts a different refusal, not success

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/integration/staff.test.ts:884-888`
- **Detail**: Phase 2 §4 contracted "the same calls as a non-demo admin still succeed." The test
  asserts a code-less `unconfigured` 403 instead, because vitest stubs `astro:env/server`
  unconfigured so all four routes end there regardless of caller. The reasoning is documented
  honestly in-code and the discriminator is genuine — but unlike the plan's two other in-flight
  changes it was never written back, so the plan read as though the stronger assertion shipped.
  Real-admin success is proven elsewhere in E2E for `POST /api/staff` and deactivate;
  **`reset-password`'s success path is asserted nowhere.**
- **Fix Applied**: supersession recorded in `plan.md` Phase 2 §4 in the same style as the other two
  in-flight changes, naming the remaining hole.
- **Decision**: FIXED (write-back only; reset-password coverage gap left open and documented)

### F9 — Test cleanup can leave the demo admin deactivated

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `tests/integration/staff.test.ts:154` vs `:620-631`
- **Detail**: The last-admin test deactivates every other active admin, queried rather than
  hardcoded, so the silenced set provably includes `demo@fleetrent.test`. Its `finally` restores it,
  but the `afterAll` net only restored `SEED_ADMIN`. A killed run leaves the demo admin deactivated;
  middleware then resolves its role to null and the next Playwright run fails at `authenticate as
demo` with nothing pointing back. The guard at `:627-628` also omitted the `DEMO_ADMIN` assertion
  its own comment exists for.
- **Fix Applied**: `afterAll` widened to `.in("user_id", [SEED_ADMIN, DEMO_ADMIN])`; missing
  assertion added.
- **Decision**: FIXED

### F10 — Progress row 3.10 has no code artifact

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `plan.md` Progress 3.10 / `src/components/auth/SignInForm.tsx`
- **Detail**: "Password manager autofill does not fight the prefill" is ticked, but the
  `autoComplete` attributes predate this change and `dc624cc` touches neither line. Nothing in the
  diff would fail if the behaviour regressed. It is the one manual row with no observable evidence;
  every other row has some.
- **Fix Applied**: annotated in `plan.md` as observed-manually-only, left ticked.
- **Decision**: FIXED (annotation)

## Triage summary

```
Fixed:     F1, F2, F3 (Fix A) · F5, F8, F9, F10 · F6, F7 (Fix A)   (9)
Skipped:   F4                                                      (1)
```

## Residual risk after triage

1. **F4 (skipped)** — seven demo-callable SECURITY DEFINER write RPCs, proven exploitable for
   `create_confirmed_reservation`. Inventory-blocking and the protocol mail chain remain open.
2. **F6 (accepted)** — a visitor can empty the public catalog; no reset path. Documented in
   `known-issues.md`.
3. **F7 (pending)** — Design project copy diverges from the app until `/design-login` is run.
4. **Unverified** — the prod demo account's `is_demo` flag state. F3's fix makes this self-revealing:
   after deploying, if the card disappears from prod, the account was never flagged.

## Deployment note

`supabase/migrations/20260901120000_*` and `20260901130000_*` are applied to the **local** stack
only. Per the plan's own Migration Notes and the repo's operating history, merging to `main`
auto-deploys the Worker but pushes **no** migrations. `signin.astro` now calls
`demo_account_email()`; if the Worker ships without the migration, the RPC 404s, the card silently
stops rendering, and the prod relay fix in `manual.ts` still holds. Run `npx supabase db push` and
confirm with `npx supabase migration list --linked`.
