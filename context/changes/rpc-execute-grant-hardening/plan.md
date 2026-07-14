# RPC EXECUTE-Grant Hardening Implementation Plan

## Overview

Close the RPC EXECUTE-grant gap repo-wide. During S-05 (2026-07-10) we confirmed that `grant execute … to authenticated` on a `SECURITY DEFINER` RPC restricts nothing — Postgres grants EXECUTE to `PUBLIC` by default and Supabase's default privileges add an explicit `anon` grant on top, so every RPC is anon-callable at the grant layer. S-05 fixed its own five RPCs in-slice; the four **pre-existing** staff RPCs were verified not-exploitable (each refuses at its in-function `current_app_role()` gate) but still carry the wide-open grant. This change applies the same `revoke`-first posture to those four, makes future functions start closed via schema-level default privileges, and pins the result with a test.

## Current State Analysis

**The four staff RPCs are granted to `authenticated` but never revoked from `public, anon`** — so anon holds EXECUTE at the grant layer (defense-in-depth gap, not an open hole; the in-function role gate refuses):

- `decide_reservation(uuid, text, text, text)` — grant at `supabase/migrations/20260617120000_reservation_approval.sql:157`
- `set_vehicle_active(uuid, boolean)` — grant at `20260625120000_fleet_management.sql:123`
- `list_pending_reservations()` — grant at `20260617121000_list_pending_reservations.sql:50`
- `list_reservations_for_calendar(date, date)` — grant at `20260617122000_list_reservations_for_calendar.sql:39`

**The four intentionally-public RPCs carry an explicit `grant … to anon`** and must stay callable by anon:

- `available_vehicles(date, date)` — `20260605132958_public_fleet_catalog.sql:56`
- `get_vehicle_busy_ranges(uuid)` — `20260613170000_vehicle_busy_ranges.sql:41`
- `get_reservation_status(uuid)` — `20260611190621_status_read_customer_email.sql:45`
- `create_reservation_request(…)` — `20260613090000_reservation_b2b_fields.sql:100` (the b2b signature)

**`current_app_role()` (`20260604153139_employee_admin_roles.sql:47`) has no explicit grant** and is invoked in **16 RLS policy clauses**. It runs on the default grant today; `lessons.md` says a policy helper needs its own explicit `authenticated` grant.

**No migration uses `alter default privileges`** — every future function still starts open. The S-05 migration (`20260710120000_issue_protocol.sql:255-262,372-378`) already models the `revoke … from public, anon; grant … to authenticated;` pattern per RPC.

## Desired End State

The four staff RPCs are executable only by `authenticated` (anon revoked); `current_app_role()` carries an explicit `authenticated` grant; and any **future** function created in `public` starts with no `public`/`anon`/`authenticated` EXECUTE grant unless the migration opts it in. An integration test proves anon is refused on the four staff RPCs and still succeeds on the four public RPCs. `npx supabase db reset` and the full test suite pass.

### Key Discoveries:

- **The grant is decorative** — `lessons.md` → "Revoke EXECUTE before granting it"; verified against `pg_proc.proacl` 2026-07-10 (S-05 migration comment `20260710120000_issue_protocol.sql:255-260`).
- **Revoke template** (copy verbatim): `revoke execute on function public.<fn>(<args>) from public, anon; grant execute on function public.<fn>(<args>) to authenticated;` (`20260710120000_issue_protocol.sql:372-378`).
- **Anon-rejection test idiom**: `expect((await anonClient().rpc("<fn>", <args>)).error).not.toBeNull();` (`tests/integration/dispatch-list.test.ts:170`, `protocols-rls.test.ts:225-248`). Helpers: `anonClient`, `as`, `serviceClient` from `tests/helpers/clients.ts`.
- **`alter default privileges` is role-scoped** — it only affects objects created by the role that runs it, for objects created _after_ it. If it doesn't match the migration executor, it silently no-ops (the very "decorative" trap this change fixes). Must be verified empirically.

## What We're NOT Doing

- **Not touching the four intentionally-public RPCs' `anon` grant** — they must stay anon-callable (public booking funnel).
- **Not revoking `authenticated` from the four staff RPCs** — staff call them as `authenticated`; the in-function `current_app_role()` gate handles role. Only `public, anon` are revoked.
- **Not revoking from `service_role`** — the test harness and any admin path use it; `lessons.md` scopes the revoke to `public, anon, authenticated`.
- **Not re-verifying or re-testing the five S-05 RPCs** — already revoked and tested in-slice.
- **Not changing any app code, service, route, RLS policy, table, or type** — this is a grants-only migration plus a test.
- **Not adding an in-function gate anywhere** — the gates already exist and stay; this hardens the grant layer beneath them (defense in depth).

## Implementation Approach

Data-layer-first, mirroring the repo convention: one grants-only migration, then one integration test that pins it. The migration is deterministic for the targeted revokes and the explicit helper grant; the only non-deterministic part is the schema-level `alter default privileges`, which is verified by a throwaway-function spike on `db reset` before the change is trusted — the same "verify the boundary actually bites" discipline S-05 used for its storage-policy spike.

## Critical Implementation Details

**The `alter default privileges` statement can silently no-op.** Written bare — `alter default privileges in schema public revoke execute on functions from public, anon, authenticated;` — it applies only to functions created by the **current role**, and Supabase's own default-privilege grants (which add `anon`/`authenticated`) are attached to specific roles. If the executor doesn't match, a future function still lands open. **Verify with a spike**: after `db reset`, create a throwaway `public.__canary()`, confirm `anon` cannot execute it, then drop it. If anon _can_, fall back to the role-qualified form (`alter default privileges for role <migration-executor> …`) or an explicit per-role revoke, and re-verify. Settle this before trusting the statement.

**This makes future authenticated RPCs opt-in.** Once default privileges revoke EXECUTE from `authenticated`, every new staff RPC must carry its own `grant execute … to authenticated` or it is callable by no one. That is the intended "start closed" posture — but it is a forward-looking behavioral change every future migration author inherits.

## Phase 1: Migration — start-closed defaults + targeted revokes

### Overview

One grants-only migration: schema-level default privileges, targeted revokes on the four staff RPCs, and the explicit `current_app_role()` grant. Verified to apply cleanly and to actually bite.

### Changes Required:

#### 1. New migration

**File**: `supabase/migrations/<ts>_rpc_execute_grant_hardening.sql` (timestamp after `20260710120000`, e.g. `20260714120000`)

**Intent**: Make future functions start closed and close the four pre-existing staff RPCs' anon grant, so the "decorative grant" class of bug cannot recur.

**Contract**: One migration containing, in order:

- `alter default privileges in schema public revoke execute on functions from public, anon, authenticated;` — future functions start closed. (See Critical Implementation Details for the role-scoping verification and fallback.)
- Per staff RPC, using the S-05 template with the exact signatures: `revoke execute on function public.<fn>(<args>) from public, anon;` for `decide_reservation(uuid, text, text, text)`, `set_vehicle_active(uuid, boolean)`, `list_pending_reservations()`, `list_reservations_for_calendar(date, date)`. Do **not** revoke `authenticated`; their existing `authenticated` grants remain.
- `grant execute on function public.current_app_role() to authenticated;` — make the policy helper's grant explicit (carve-out per `lessons.md`).
- A header comment citing `lessons.md` → "Revoke EXECUTE before granting it" and noting the four intentionally-public RPCs are deliberately untouched.

#### 2. (Conditional) `current_app_role()` grant robustness

**File**: same migration

**Intent**: Ensure the 16 policies that call `current_app_role()` keep working after default privileges tighten.

**Contract**: The explicit `grant … to authenticated` above is sufficient because the helper already exists (default privileges only affect future functions). No policy edits. If the spike reveals the querying role needs more, add the minimal grant and note it — but the default expectation is one grant line.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly from scratch: `npx supabase db reset`
- Type checking / build passes (no schema-shape change expected): `npx astro sync && npm run build`
- Linting passes: `npm run lint`
- The full pre-existing suite still passes — proving no regression to staff flows or public booking: `npm test && npm run test:integration`

#### Manual Verification:

- **Default-privileges spike**: after `db reset`, create `public.__canary()`, confirm `anon` cannot `execute` it and `authenticated` (or the intended grantee) matches the new posture, then drop it. If anon can call it, apply the role-qualified fallback and re-verify.
- In Supabase Studio, confirm `pg_proc.proacl` for the four staff RPCs no longer lists `anon`, and that `available_vehicles` / `get_vehicle_busy_ranges` / `get_reservation_status` / `create_reservation_request` still list `anon`.

**Implementation Note**: Pause here for manual confirmation before proceeding.

---

## Phase 2: Anon-uncallability + public-RPC regression tests

### Overview

A dedicated integration test that pins both sides: anon is refused on the four staff RPCs, and the four public RPCs still work for anon.

### Changes Required:

#### 1. New integration test

**File**: `tests/integration/rpc-execute-grants.test.ts`

**Intent**: Lock the hardening so a future migration can't silently re-open the staff RPCs or lock anon out of the public booking RPCs.

**Contract**: Using `anonClient()` from `tests/helpers/clients.ts`:

- **Rejection**: for each of `decide_reservation`, `set_vehicle_active`, `list_pending_reservations`, `list_reservations_for_calendar`, assert `(await anonClient().rpc(fn, args)).error` is non-null (permission denied at the grant layer). Use minimal/throwaway args — the call must fail before doing work.
- **Public regression**: assert anon still executes the four public RPCs. For the read-only three (`available_vehicles`, `get_vehicle_busy_ranges`, `get_reservation_status`) assert no permission error (`.error` null or a benign not-found). For `create_reservation_request`, call with a non-existent vehicle id and assert the result is a **business** outcome (a tag / row), **not** a permission error — proving EXECUTE is intact without inserting a real reservation. If any variant does insert, clean up via `serviceClient()` in `afterEach`.
- A file header explaining this guards the grant layer beneath the in-function gates.

### Success Criteria:

#### Automated Verification:

- The new test passes: `npm run test:integration`
- Anon is refused on all four staff RPCs; anon still succeeds (no permission error) on all four public RPCs
- Full integration suite still green: `npm run test:integration`

#### Manual Verification:

- Skim the test to confirm the assertion polarity is correct: a **permission** rejection (error present) for the staff RPCs, a **business** result (no permission error) for the public RPCs — not the reverse.

**Implementation Note**: Pause here for manual confirmation before proceeding.

---

## Testing Strategy

### Integration Tests:

- **Anon rejection**: the four staff RPCs return an error to `anonClient()` (grant-layer denial).
- **Public regression**: the four intentionally-public RPCs remain anon-executable — the guard against an over-aggressive future revoke breaking public booking.
- **No-regression**: the existing suites (`decide`/`dispatch`/`api-authz`/reservations) still pass, proving authenticated staff flows and the RLS-policy helper are unaffected.

### Manual Testing Steps:

1. `npx supabase db reset`, then run the throwaway-`__canary()` spike to confirm `alter default privileges` bit; drop the canary.
2. Inspect `pg_proc.proacl` in Studio for the four staff RPCs (no `anon`) and the four public RPCs (still `anon`).
3. Smoke the app: anon can browse availability (public RPCs) and a signed-in employee can still confirm a reservation (authenticated staff RPC).

## Migration Notes

- **Rollback** is a symmetric migration re-granting EXECUTE (`grant execute on function … to anon` for the affected RPCs) and dropping the default-privileges change — no data is touched.
- **Forward-looking**: after this lands, every new `public` function must carry an explicit `grant execute … to authenticated` (or the relevant role) or it is callable by no one. Intended "start closed" posture.
- No `supabase gen types` change expected — no tables, columns, or function signatures are added or altered.
- Prod: applies via `npx supabase db push` alongside a deploy; grants-only, so no data risk and no downtime.

## References

- Lesson: `context/foundation/lessons.md` → "Revoke EXECUTE before granting it — a grant alone never restricts an RPC"
- Known issue: `context/foundation/known-issues.md` → "Queued: repo-wide RPC EXECUTE-grant hardening"
- Origin + not-exploitable verification: `context/archive/2026-07-09-issue-protocol/change.md` (Phase 1 note, 2026-07-10)
- Revoke template: `supabase/migrations/20260710120000_issue_protocol.sql:255-262,372-378`
- Anon-rejection test idiom: `tests/integration/dispatch-list.test.ts:170`, `tests/integration/protocols-rls.test.ts:225-248`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration — start-closed defaults + targeted revokes

#### Automated

- [x] 1.1 Migration applies cleanly from scratch: `npx supabase db reset`
- [x] 1.2 Type checking / build passes: `npx astro sync && npm run build`
- [x] 1.3 Linting passes: `npm run lint`
- [x] 1.4 The full pre-existing suite still passes: `npm test && npm run test:integration`

#### Manual

- [x] 1.5 Default-privileges spike: `__canary()` proves anon is refused after `db reset`, then dropped (apply role-qualified fallback if it didn't bite)
- [x] 1.6 `pg_proc.proacl`: the four staff RPCs no longer list `anon`; the four public RPCs still do

### Phase 2: Anon-uncallability + public-RPC regression tests

#### Automated

- [ ] 2.1 New test passes: anon refused on the four staff RPCs; anon still succeeds on the four public RPCs
- [ ] 2.2 Full integration suite still green: `npm run test:integration`

#### Manual

- [ ] 2.3 Skim the test to confirm assertion polarity (permission rejection for staff RPCs, business result for public RPCs)
