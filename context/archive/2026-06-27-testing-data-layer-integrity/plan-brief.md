# Data-layer Integrity Harness — Plan Brief

> Full plan: `context/changes/testing-data-layer-integrity/plan.md`
> Research: `context/changes/testing-data-layer-integrity/research.md`

## What & Why

Stand up the project's first **integration-test harness** against local Supabase
and use it to lock down the two highest-priority data-layer risks from the test
plan: double-booking (#2) and customer-PII access (#1). These failures live in
hand-written SQL config (a GiST constraint, RLS policies/grants, SECURITY
DEFINER RPCs) that no cheaper test layer can observe — only a real client
talking to the real engine reveals them. Planning probes **confirmed a live PII
leak** (any logged-in user, even role-null, reads all customer PII off the
table); this change ships the regression test **and** the migration that closes
it.

## Starting Point

There is no integration layer today: `vitest.config.ts` is a single node config
globbing `src/**/*.test.ts` (9 pure-logic unit tests). Overlap is enforced by a
DB constraint (`reservations_no_overlap`, half-open `[14:00, 10:00)` range); RLS
for reservations is asymmetric — the table SELECT policy is `USING (true)` while
real reads go through role-gated RPCs. A planning probe **confirmed the F1 PII
leak is real**: the implicit schema-wide `authenticated` SELECT grant exists, so
a logged-in role-null user reads all customer PII straight off the table (`anon`
is safe — no anon policy).

## Desired End State

`npm test` runs the fast, DB-free unit project (unchanged); `npm run
test:integration` runs a serial integration project that proves the overlap
constraint rejects double-bookings while allowing same-day turnover, asserts the
full per-role PII access matrix, and **guards the now-closed leak** (non-staff /
role-null get 0 rows off the table). A client-factory helper, a `.env.test`
loader, and a permanent role-null seed user exist. The leak is closed by a
migration that revokes the direct-table SELECT grant + drops the dead policy;
the cookbook (§6.2) is filled and the leak is recorded as a found-and-fixed
finding.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| F1 PII-leak handling | **Fix in this change** | Planning confirmed the leak is real and live; ship the regression test + the fix migration together (Phase 3). | Plan |
| Leak fix mechanism | Revoke SELECT grant + drop the dead policy | All reads go via SECURITY DEFINER RPCs, so no direct-table read path is needed; strongest invariant, proven not to break booking. | Plan |
| Write over-grants (INSERT/UPDATE/DELETE) | Defer to test-plan Phase 2 | Write authz is Phase 2's scope (risks #4/#5); keep this change focused on the PII read leak. | Plan |
| Test placement + runner split | `tests/integration/` + Vitest `projects` | Slow DB tests never run in the default `npm test`; clean unit/integration separation. | Plan |
| Data isolation / teardown | Serial + service-role cleanup + scoped fixtures | Robust against the GiST write-constraint; service-role used only for teardown, never assertions. | Plan |
| Env / secret loading | `dotenv` + gitignored `.env.test` (+ example) | Explicit, documented, keys never committed. | Plan |
| Null-role fixture | Seed permanently in `seed.sql` | Deterministic, signable, documents the fail-closed case; sharpest probe for F1. | Plan |
| Overlap oracle | DB constraint + RPC/service path | The pure rule is already unit-tested; the residual risk is the DB+RPC layer. | Research |
| Access assertions client | anon-key + JWT only | RLS is the security boundary; a service-role client would mask a leak. | Research |

## Scope

**In scope:**
- Vitest unit/integration project split + `test:integration` script
- `dotenv` + `.env.test.example`, integration setup file with fail-fast env check
- Client-factory helper (`anonClient`, `serviceClient` teardown-only, `as(role)`)
- Permanent `norole@fleetrent.test` seed fixture (no `profiles` row)
- Overlap suite (#2) and RLS access-matrix suite (#1)
- **The PII-leak fix migration** (revoke direct-table SELECT + drop dead policy)
- Cookbook §6.2 fill-in + found-and-fixed finding artifact

**Out of scope:**
- Revoking the INSERT/UPDATE/DELETE over-grants (write authz → test-plan Phase 2)
- Re-testing the pure overlap rule (already unit-tested)
- CI wiring of the integration gate (test-plan §3 Phase 5)
- e2e / Playwright / vision layers; protocol-email tests (no surface yet)

## Architecture / Approach

One `vitest.config.ts` with two projects (root `resolve.alias` shared). Unit
project = today's `src/` glob, parallel, DB-free. Integration project =
`tests/integration/` glob, serial (`fileParallelism: false`), with a setup file
that loads `.env.test`. Tests use a client helper built directly on
`@supabase/supabase-js` (not the SSR-bound `src/lib/supabase.ts`). Each test owns
a disposable data scope cleaned up by a service-role client in teardown; all
*access assertions* run on anon/JWT clients.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Scaffolding | Config split, env loader, client helper, null-role seed, smoke test | Env/config wiring + keeping `npm test` DB-free |
| 2. Overlap (#2) | Reject-overlap / allow-turnover / non-blocking suite | Disposable-scope teardown vs the GiST constraint |
| 3. Close PII leak (#1) | Per-role access matrix + secure direct-table assertion + the revoke-SELECT fix migration | Fix must not break the public booking RPC (proven safe in planning) |
| 4. Cookbook + finding | §6.2 recipe + found-and-fixed leak write-up | Finding must capture evidence + the shipped fix |

**Prerequisites:** local Supabase running (`npx supabase start`), keys copied
into `.env.test`, a `db reset` to load the new seed user.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- The F1 leak is **confirmed** (planning probe), not assumed; the Phase 3
  migration is proven (transactionally) to close it without breaking the anon
  booking RPC or the `/r/<token>` status page.
- The fix is SELECT-only; the INSERT/UPDATE/DELETE over-grants remain and are
  flagged for test-plan Phase 2 (mitigated today by the GiST constraint + the
  already-dropped UPDATE/DELETE policies).
- "Employee == admin for all reservation PII" is encoded as current reality and
  flagged as an open product question, not changed here.

## Success Criteria (Summary)

- `npm test` stays green and DB-free; `npm run test:integration` is green against
  a freshly reset local Supabase.
- The overlap suite provably rejects a double-booking and allows same-day
  turnover; the RLS suite asserts the full role matrix with no service-role
  masking, and a role-null user reads **0 rows** off the table.
- The public booking flow still works post-fix; the cookbook §6.2 is filled and
  the leak is recorded as found-and-fixed.
