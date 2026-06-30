# Finding F2 — Inconsistent anon HTTP status across protected API routes (open product decision)

- **Status**: OBSERVED — documented, not fixed (per the planning decision; the
  suite asserts the current contract as-is)
- **Risk**: #4 (broken authorization) — `context/foundation/test-plan.md` §2
- **Severity**: Cosmetic — the protection is identical; only the status code a
  signed-out caller sees differs
- **Found**: 2026-06-30 (rollout Phase 2, authz matrix)

## Observed contract (per route)

A **signed-out** caller (no session) hitting each protected route gets a
different status depending on the route family:

| Route                                  | Method | Signed-out status | Gate shape                                          |
| -------------------------------------- | ------ | ----------------- | -------------------------------------------------- |
| `src/pages/api/vehicles.ts`            | POST   | **401**           | explicit `!locals.user` → 401, then role → 403     |
| `src/pages/api/vehicles/[id].ts`       | PATCH  | **401**           | explicit `!locals.user` → 401, then role → 403     |
| `src/pages/api/vehicles/[id]/active.ts`| POST   | **401**           | explicit `!locals.user` → 401, then role → 403     |
| `src/pages/api/reservations/calendar.ts`| GET   | **403**           | no user check; `isRoleSufficient(role)` (null → 403)|
| `src/pages/api/reservations/[id].ts`   | PATCH  | **403**           | no user check; `isRoleSufficient(role)` (null → 403)|

For all five routes a **wrong-role** authed caller (`norole` — a valid session
with no `profiles` row, `current_app_role()` = null) gets **403**. Only the
*signed-out* status differs.

## Why it happens

The vehicle routes carry an explicit two-step gate — `if (!context.locals.user)
return json(401, …)` followed by a `requireRole(...)` → 403 (e.g.
`src/pages/api/vehicles.ts:38-42`). The reservation routes skip the
distinct-auth step and gate only on the role
(`isRoleSufficient(context.locals.role, "employee")` →
`src/pages/api/reservations/calendar.ts:26-27`,
`src/pages/api/reservations/[id].ts:118-119`). Because the role helper
fail-closes on a null role, a signed-out caller (whose `locals.role` is null)
falls through to **403** rather than a distinct **401**.

Both shapes are *correct* in that no unauthorized caller ever passes — the
difference is purely which 4xx the client observes. (CSRF still precedes both:
a foreign/missing `Origin` on a mutation route returns 403 before any auth
check fires.)

## Impact

Cosmetic / API-ergonomics only. Same protection either way: anon and wrong-role
callers are denied at the app gate before reaching the DB (which re-gates a
third time via RLS / the role-checked RPC). The only consequence is a client
can't uniformly distinguish "not signed in" (401) from "signed in, not allowed"
(403) across the whole API surface.

## Open product question

**Normalize to 401-for-anon everywhere?** Adding the explicit
`if (!context.locals.user) return json(401, …)` step to the two reservation
routes would make the contract uniform (401 = unauthenticated, 403 =
authenticated-but-forbidden) across all `/api/*`. This is a one-line-per-route
change with a DB backstop unchanged — but it is a **product/API-contract
decision**, deferred out of this test-rollout change (which only *documents* and
*asserts* the current behavior). The authz suite encodes the split as-is, so if
the decision is made later the suite's expected statuses are the single place to
flip.

## References

- Risk + response: `context/foundation/test-plan.md` §2 (#4), §2 Risk Response
- Regression contract: `tests/integration/api-authz.test.ts` (asserts 401 for
  vehicle routes, 403 for reservation routes, 403 for `norole` everywhere)
- Lesson (every `/api` route self-gates): `context/foundation/lessons.md` —
  "API routes are outside middleware's gate"
- Vehicle gate (401 branch): `src/pages/api/vehicles.ts:38-42`
- Reservation gate (role-only, null → 403):
  `src/pages/api/reservations/calendar.ts:26-27`,
  `src/pages/api/reservations/[id].ts:118-119`
