# RPC EXECUTE-Grant Hardening — Plan Brief

> Full plan: `context/changes/rpc-execute-grant-hardening/plan.md`

## What & Why

Close the RPC EXECUTE-grant gap repo-wide. `grant execute … to authenticated` on a `SECURITY DEFINER` RPC restricts nothing — Postgres grants EXECUTE to `PUBLIC` and Supabase adds an explicit `anon` grant, so every RPC is anon-callable at the grant layer. S-05 fixed its own five RPCs; this applies the same `revoke`-first posture to the four pre-existing staff RPCs and makes future functions start closed. Verified not-exploitable today (in-function role gates hold) — this is defense-in-depth, not an open hole.

## Starting Point

The four staff RPCs (`decide_reservation`, `set_vehicle_active`, `list_pending_reservations`, `list_reservations_for_calendar`) are granted to `authenticated` but never revoked from `public, anon`. `current_app_role()` — called in 16 RLS policies — has no explicit grant. No migration uses `alter default privileges`, so future functions still start open. The S-05 migration already models the fix pattern.

## Desired End State

The four staff RPCs are executable only by `authenticated`; `current_app_role()` has an explicit `authenticated` grant; any future `public` function starts with no `public`/`anon`/`authenticated` EXECUTE grant unless the migration opts it in. An integration test proves anon is refused on the staff RPCs and still works on the four public RPCs. `db reset` + full suite pass.

## Key Decisions Made

| Decision                          | Choice                                                     | Why (1 sentence)                                                             | Source       |
| --------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------ |
| Start-closed posture              | Schema-level `alter default privileges` + targeted revokes | Fixes the class, not just the four instances                                 | Plan         |
| Test breadth                      | Anon-rejection + public-RPC regression guards              | Pins both sides so a future over-revoke can't silently break public booking  | Plan         |
| `current_app_role()`              | Explicit `grant … to authenticated`                        | Matches the lessons carve-out; removes the implicit default-grant dependency | Plan         |
| Staff RPCs' `authenticated` grant | Keep (revoke only `public, anon`)                          | Staff call them; the in-function gate handles role                           | Known-issues |
| Four public RPCs                  | Untouched                                                  | Must stay anon-callable for the booking funnel                               | Known-issues |

## Scope

**In scope:** one grants-only migration (default privileges + 4 revokes + 1 explicit grant); one integration test.

**Out of scope:** app/service/route/policy/table/type changes; the five already-fixed S-05 RPCs; `service_role`; any in-function gate.

## Architecture / Approach

Data-layer-first: one deterministic grants-only migration, then a test that pins it. The only non-deterministic part is the schema-level `alter default privileges` (role-scoped — can silently no-op), verified by a throwaway-`__canary()` spike on `db reset` before it's trusted, with a role-qualified fallback if needed.

## Phases at a Glance

| Phase        | What it delivers                                                                   | Key risk                                                                                |
| ------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1. Migration | Default privileges + revokes on 4 staff RPCs + explicit `current_app_role()` grant | `alter default privileges` silently no-ops if role-scoping is wrong — spike-verified    |
| 2. Test      | Anon refused on staff RPCs; public RPCs still work for anon                        | `create_reservation_request` guard must assert a business result, not insert a real row |

**Prerequisites:** local Supabase running (`npx supabase start`); S-05 shipped (done).
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- `alter default privileges` role-scoping is the only real unknown — resolved by the Phase 1 spike, not assumption.
- Assumes the migration executor is consistent between `db reset` (local) and `db push` (prod); if not, the spike surfaces it before prod.
- After this lands, every future `public` function must explicitly grant EXECUTE to its intended role — a forward-looking convention shift.

## Success Criteria (Summary)

- Anon is refused on the four staff RPCs; the four public RPCs still serve anon (booking funnel intact).
- `npx supabase db reset` and the full unit + integration suites pass with no regression.
- A future RPC that forgets its grant is callable by no one — proving the class is closed.
