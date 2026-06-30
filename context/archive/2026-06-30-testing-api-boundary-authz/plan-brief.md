# API Boundary Tests — Authz Matrix + Input Parity — Plan Brief

> Full plan: `context/changes/testing-api-boundary-authz/plan.md`
> Research: `context/changes/testing-api-boundary-authz/research.md`

## What & Why

Rollout Phase 2 of the test plan. `/api/*` routes are **not** gated by
middleware — each handler is the only thing protecting itself. This phase stands
up an integration suite that proves those self-gates hold: a per-route role
matrix (Risk #4) and server-side validation wiring (Risk #5). Both risks are
already defended in current code, so the suite is a **regression guard**, not a
bug hunt.

## Starting Point

The Phase 1 harness drives Supabase clients directly (`anonClient()`,
`as(role)`, `serviceClient()`) and covers RLS + the overlap constraint. It
cannot test *routes* — handlers read `context.locals` and do a same-origin CSRF
check. Every protected route already self-gates (CSRF → auth/role → zod → DB),
and the DB re-gates a third time. `vehicleInputSchema` has zero unit tests.

## Desired End State

`npm run test:integration` runs two new route suites (authz matrix + validation
parity) green; `npm test` runs a new vehicle-schema unit suite; a reusable
`buildApiContext(...)` helper exists; cookbook §6.3 documents how to add an API
route test; the 401/403 anon-status quirk is written up as a product finding.

## Key Decisions Made

| Decision                  | Choice                                          | Why (1 sentence)                                                                 | Source   |
| ------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| Harness fidelity          | Direct handler invocation (option A) only       | Middleware doesn't gate `/api/*`, so an HTTP/cookie layer proves nothing extra.  | Plan     |
| Risk #4 framing           | Per-route role matrix, not IDOR                 | No per-resource ownership model exists; the axis is role, enforced per route.    | Research |
| Risk #5 framing           | Regression guard on schema wiring + no DB write | All write routes already validate server-side; nothing to "fix".                 | Research |
| Vehicle schema unit tests | Include this phase                              | Cheapest signal for vehicle input rules; closes a real zero-coverage gap.        | Plan     |
| Anon-status 401/403 split | Assert per-route, file as finding (no code fix) | Keeps the phase about tests, not refactors; documents the inconsistency.         | Plan     |
| `/r/[token]` + overlap    | Do not re-cover                                 | Already covered by Phase 1 suites.                                               | Research |

## Scope

**In scope:** `buildApiContext` harness primitive; authz matrix over 5 protected
routes + CSRF-origin cases + public-funnel openness/honeypot; validation-parity
(bad payload → 400 + no DB write) per write route; `vehicle-schema.test.ts`;
cookbook §6.3 + finding doc + rollout close-out.

**Out of scope:** route code changes; anon-status normalization; re-covering
`/r/[token]`, overlap, or RLS; HTTP-server/e2e harness; `PUT`/`DELETE` (none
exist); re-asserting zod field rules through the route.

## Architecture / Approach

A `buildApiContext({ method, path, supabase, user, role, params, body, origin })`
factory assembles the minimal `APIContext` handlers read and is cast to Astro's
type. It keeps the Supabase client's JWT role consistent with `locals.role`/
`locals.user` (mirroring middleware), so allow-paths pass both the app gate and
the DB backstop, and deny-paths fail at the app gate. Service-role seeds/tears
down disposable rows; every *assertion* runs through an anon/`as(role)` context.

## Phases at a Glance

| Phase                          | What it delivers                                            | Key risk                                                        |
| ------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Harness primitive           | `buildApiContext` + a smoke test driving a real handler    | Cast boundary / client-locals role drift                       |
| 2. Authz matrix (#4)           | Role × status matrix + CSRF + public funnel                | A deny case accidentally run through service-role passes falsely |
| 3. Validation parity (#5)      | Bad payload → 400 + no DB write per write route            | Asserting status only, not the actual no-write                 |
| 4. Vehicle schema unit suite   | `src/lib/vehicle-schema.test.ts`                           | Under-covering the transform/bounds breadth                    |
| 5. Cookbook + finding + close  | §6.3 recipe, finding doc, §3 row → complete                | Recipe not actionable for the next contributor                 |

**Prerequisites:** local Supabase running (`npx supabase start` + `db reset`);
Phase 1 harness in place (it is).
**Estimated effort:** ~1–2 sessions across 5 phases (Phases 2–3 are the bulk).

## Open Risks & Assumptions

- The constructed `APIContext` covers only the fields handlers touch today; a
  future handler reading another `context.*` field would need the factory
  extended (acceptable — caught at compile/test time).
- Allow-path PATCH/POST cases mutate state; correctness depends on idempotent
  disposable-scope teardown (pattern proven in `reservations-overlap.test.ts`).
- The 401/403 split persists until separately decided (captured as a finding).

## Success Criteria (Summary)

- Each protected route proven to deny anon + `norole` and admit only the right
  staff role; CSRF origin check proven to fire before auth.
- Each write route proven to reject a client-bypassing payload with a 4xx and
  write nothing.
- Vehicle input rules unit-covered; cookbook §6.3 usable; rollout Phase 2 closed.
