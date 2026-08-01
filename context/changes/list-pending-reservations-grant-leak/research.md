---
date: 2026-07-31T21:15:33+0200
researcher: MarcinK
git_commit: 56729a9c9279d59ec55f145121128fcdc0adbc1f
branch: main
repository: car-rental
topic: "Why does tests/integration/rpc-execute-grants.test.ts fail?"
tags: [research, codebase, rpc, grants, supabase, migrations, security, regression]
status: complete
last_updated: 2026-07-31
last_updated_by: MarcinK
---

# Research: Why does `tests/integration/rpc-execute-grants.test.ts` fail?

**Date**: 2026-07-31T21:15:33+0200
**Researcher**: MarcinK
**Git Commit**: 56729a9c9279d59ec55f145121128fcdc0adbc1f
**Branch**: main
**Repository**: car-rental

## Research Question

`tests/integration/rpc-execute-grants.test.ts` — this test fails. Check if that is
true and, if so, what is the cause.

## Summary

**Yes, the test genuinely fails.** Running it against local Supabase produces
**1 failed / 7 passed**. The single failing case is:

> `RPC EXECUTE-grant hardening > anon is refused on the four staff RPCs > list_pending_reservations -> permission denied`
> `AssertionError: expected false to be true`

**Root cause — a real grant regression, not a flaky/broken test.** A later
migration re-opened `list_pending_reservations()` to anonymous callers. Migration
`supabase/migrations/20260728120000_list_pending_reservations_add_plate.sql`
`DROP`s and re-`CREATE`s the function (to add the `vehicle_plate` OUT column),
re-`grant`s EXECUTE only to `authenticated`, and **omits the
`revoke execute ... from public, anon`** that the hardening migration
`20260714120000_rpc_execute_grant_hardening.sql` had put in place. A `DROP FUNCTION`
discards all prior grants, and a freshly-created function inherits Supabase's default
**PUBLIC + anon EXECUTE** grant (`lessons.md` → "Revoke EXECUTE before granting it").
So anon can call `list_pending_reservations()` again, and the regression guard fires.

This is precisely the "a future migration silently re-opens a staff RPC to anon"
scenario the test was written to catch — the guard is working; the migration is the bug.

**Is data leaking?** No PII is exposed. The function body gates rows with an inline
`where ... and public.current_app_role() in ('employee','admin')` filter, so an anon
caller gets an **empty result set**, not reservation data. But because the gate is a
`WHERE` filter (not a `RAISE`), anon receives **no error at all** — which is exactly
why the test sees `res.error === null` and `isPermissionDenied(null) === false`. The
defense-in-depth in-function gate holds; the durable grant-layer control is missing.

## Detailed Findings

### 1. The observed failure (verified by running it)

Command: `npx vitest run --project integration tests/integration/rpc-execute-grants.test.ts`

```
❯ tests/integration/rpc-execute-grants.test.ts (8 tests | 1 failed)
  × list_pending_reservations -> permission denied
    AssertionError: expected false to be true
    ❯ tests/integration/rpc-execute-grants.test.ts:60:45
Test Files  1 failed (1)
     Tests  1 failed | 7 passed (8)
```

The assertion (`tests/integration/rpc-execute-grants.test.ts:58-61`):

```ts
it("list_pending_reservations -> permission denied", async () => {
  const res = await anonClient().rpc("list_pending_reservations");
  expect(isPermissionDenied(res.error)).toBe(true); // <-- fails: error is null
});
```

`isPermissionDenied` (`tests/integration/rpc-execute-grants.test.ts:27-30`) returns
`true` only for a Postgres `42501` code or a `/permission denied/i` message. A `null`
error → `false` → assertion fails.

### 2. Live grant state proves the leak (`pg_proc.proacl`)

Queried directly against the running DB container `supabase_db_10x-astro-starter`:

| function                         | proacl                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `decide_reservation`             | `{postgres=X, authenticated=X, service_role=X}` ✅ no anon                                        |
| `list_reservations_for_calendar` | `{postgres=X, authenticated=X, service_role=X}` ✅ no anon                                        |
| `set_vehicle_active`             | `{postgres=X, authenticated=X, service_role=X}` ✅ no anon                                        |
| **`list_pending_reservations`**  | **`{=X, postgres=X, anon=X, authenticated=X, service_role=X}`** ❌ PUBLIC (`=X`) + `anon` present |

The three correctly-hardened staff RPCs have **no** `PUBLIC` (`=X`) and **no** `anon`
entry. `list_pending_reservations` carries both — the untouched Supabase default.

Corroborating detail: the function's **OID is 33295**, far higher than its siblings
(`decide_reservation` 18569, `list_reservations_for_calendar` 18572, `set_vehicle_active`
18576). A higher OID = created later. This is the fingerprint of a `DROP`+`CREATE` that
happened _after_ the original batch and _after_ the hardening migration.

### 3. Live anon call returns `[]`, no error (the exact failure mechanism)

`POST /rest/v1/rpc/list_pending_reservations` with the anon key returns `[]` (HTTP 200,
empty array, no error). Because:

1. anon **holds EXECUTE** (the leak) → the grant layer does not refuse (no 42501).
2. The function body (`pg_get_functiondef(33295)`) is `LANGUAGE sql` and gates via
   `where r.status = 'pending' and public.current_app_role() in ('employee','admin')`.
   For an anon caller `current_app_role()` is `null`, so the predicate is false → zero rows.

Net: `res.error` is `null`. This is why the test's `isPermissionDenied(res.error)` is
`false`. Contrast the three passing staff RPCs, where anon is refused at the grant layer
(`42501`) before the body ever runs.

### 4. The offending migration

`supabase/migrations/20260728120000_list_pending_reservations_add_plate.sql`:

```sql
-- lines 10-12 (comment):
-- The OUT columns change, so CREATE OR REPLACE can't alter the signature —
-- drop and recreate. Additive column; role gate, definer hygiene, and grant
-- are re-stated verbatim from 20260617121000_list_pending_reservations.

drop function if exists public.list_pending_reservations();          -- line 14  (discards the revoke)
create function public.list_pending_reservations() ...               -- line 16  (defaults to PUBLIC+anon EXECUTE)
grant execute on function public.list_pending_reservations() to authenticated;  -- line 53
-- NO `revoke execute ... from public, anon;`  <-- the bug
```

The comment is the smoking gun: it re-states things **"verbatim from
20260617121000_list_pending_reservations"** — but that original create migration
**never contained a revoke**. The revoke lived in a _separate_, later hardening
migration (`20260714120000_rpc_execute_grant_hardening.sql:37`). So faithfully copying
the original file reproduced the _pre-hardening_ state and silently undid the hardening.

### 5. The three sibling staff RPCs are fine (why only this one fails)

`20260714120000_rpc_execute_grant_hardening.sql` revokes anon on all four staff RPCs
(lines 35-38). Only `list_pending_reservations` is redefined _after_ that migration
(in `20260728120000`), so only its revoke was discarded. `decide_reservation`,
`set_vehicle_active`, and `list_reservations_for_calendar` are never redefined again —
their revokes stand.

### 6. The four public RPCs are fine (why the other 4 tests pass)

`available_vehicles`, `get_vehicle_busy_ranges`, `get_reservation_status`, and
`create_reservation_request` retain their explicit `grant ... to anon`. Where they were
recreated, it was either a same-signature `create or replace` (preserves grants,
`get_vehicle_busy_ranges`) or a `DROP`+`CREATE` that correctly re-granted anon
(`get_reservation_status`, `create_reservation_request`), and all _predate_ the hardening
migration. Their test-call argument signatures also match the current definitions, so
those calls execute cleanly and return `res.error === null` as the test expects.

## Code References

- `tests/integration/rpc-execute-grants.test.ts:58-61` — the failing assertion (`list_pending_reservations -> permission denied`)
- `tests/integration/rpc-execute-grants.test.ts:27-30` — `isPermissionDenied()` (matches `42501` / `/permission denied/i` only)
- `supabase/migrations/20260728120000_list_pending_reservations_add_plate.sql:14` — `drop function` (discards the revoke)
- `supabase/migrations/20260728120000_list_pending_reservations_add_plate.sql:53` — `grant ... to authenticated` with **no** following `revoke ... from public, anon`
- `supabase/migrations/20260728120000_list_pending_reservations_add_plate.sql:10-12` — the "verbatim from 20260617121000" comment that caused the omission
- `supabase/migrations/20260714120000_rpc_execute_grant_hardening.sql:37` — the revoke that was undone: `revoke execute on function public.list_pending_reservations() from public, anon;`
- `supabase/migrations/20260617121000_list_pending_reservations.sql:14,50` — original create + grant (never had a revoke)
- `tests/helpers/clients.ts:38-40` — `anonClient()` (anon key, no session)

## Architecture Insights

- **The grant layer and the in-function gate are two independent controls.** For a
  `plpgsql` RPC that `RAISE`s, a missing grant might still surface as _some_ error; but
  `list_pending_reservations` is a `LANGUAGE sql` function whose gate is a `WHERE`-clause
  `current_app_role()` filter — so a grant leak is **completely silent** (empty rows, no
  error). This is exactly why the grant-layer revoke is the "durable control" the lessons
  file insists on, and why a _grant-layer_ regression test (not just a behavioral one) is
  necessary.
- **`DROP FUNCTION` resets ACLs; `CREATE OR REPLACE` (same signature) preserves them.**
  Any migration that must change a function's return type/OUT columns is forced into
  `DROP`+`CREATE`, and therefore **must re-apply every `revoke`**, not just the `grant`.
  Keeping the revoke in a _separate_ hardening migration from the create makes this trap
  easy to fall into — the natural "copy the original create migration" move loses it.
- The test file's own header comment (lines 7-24) predicted this failure mode verbatim:
  _"so a future migration can neither silently re-open a staff RPC to anon nor lock anon
  out of a public one."_ The guard did its job.

## Historical Context (from prior changes)

- `context/foundation/lessons.md` → **"Revoke EXECUTE before granting it — a grant alone
  never restricts an RPC"** — the governing rule. Two relevant clauses: (1) a freshly
  created function gets the built-in PUBLIC execute grant, so per-function
  `revoke ... from public, anon` is mandatory _every time_; (2) there is no reliable
  schema-level "start closed" default in this Supabase env (spike-verified 2026-07-14).
- `context/archive/2026-07-14-rpc-execute-grant-hardening/change.md` — the change that
  added the hardening migration `20260714120000` and wrote this regression guard. Its
  notes record that the `alter default privileges` approach was dropped as a proven no-op,
  leaving per-function revokes as the only durable control — which is exactly what
  `20260728120000` failed to carry forward.

## Related Research

- `context/archive/2026-07-14-rpc-execute-grant-hardening/` — prior research/plan behind
  the grant-hardening migration and the test under investigation.

## Open Questions / Suggested Fix

The diagnosis is complete; the remaining decision is how to remediate (out of scope for
research, noted for the follow-up plan):

- **Fix (forward migration):** add a new migration
  `supabase/migrations/<newTs>_list_pending_reservations_revoke_anon.sql` that runs
  `revoke execute on function public.list_pending_reservations() from public, anon;`
  (do **not** edit the already-applied `20260728120000` in place — it has shipped to prod).
- **Verify:** re-run the suite (expect 8/8) and re-check `proacl` shows
  `{postgres=X, authenticated=X, service_role=X}` (no `=X`, no `anon`).
- **Guard the class of bug:** every `DROP`+`CREATE` of a definer RPC must re-apply its
  revoke. Worth considering a lessons.md addendum ("a DROP+CREATE that changes OUT columns
  resets the ACL — re-state the revoke, not just the grant") and/or auditing whether any
  _other_ staff RPC has been drop/recreated after its hardening migration.
