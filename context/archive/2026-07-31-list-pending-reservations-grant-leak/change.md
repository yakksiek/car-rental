---
change_id: list-pending-reservations-grant-leak
title: list_pending_reservations anon EXECUTE-grant regression
status: archived
created: 2026-07-31
updated: 2026-08-01
archived_at: 2026-08-01T13:22:36Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- 2026-07-31 — Opened from `/10x-research` on `tests/integration/rpc-execute-grants.test.ts`.
  Confirmed the test fails (1/8 cases). Root cause: migration
  `20260728120000_list_pending_reservations_add_plate.sql` does `drop function` +
  `create function` to add the `vehicle_plate` OUT column, re-grants only
  `authenticated`, and omits the `revoke ... from public, anon` that
  `20260714120000_rpc_execute_grant_hardening.sql` had established — so the DROP
  reset the ACL to Supabase's default PUBLIC/anon EXECUTE. See `research.md`.
  This is exactly the "silent re-open" the archived `rpc-execute-grant-hardening`
  change wrote the regression guard to catch.

- 2026-07-31 — **Fixed & verified (local).** Forward migration
  `20260731212650_list_pending_reservations_revoke_anon.sql` re-applies
  `revoke execute on function public.list_pending_reservations() from public, anon;`.
  Applied via `supabase migration up`; live `proacl` now
  `{postgres=X, authenticated=X, service_role=X}` (anon_x=f), matching the hardened
  siblings. `rpc-execute-grants.test.ts` → **8/8 passing**.
  - **⚠ NOT yet on prod.** Local only. Needs `supabase db push` to prod
    (`fmgbyfpilgzvhkziigsj`), where the same regression is live.
  - **Impact:** grant-layer (defense-in-depth) regression only — NOT a PII leak.
    A 4-agent adversarial audit simulated the anon call (`SET ROLE anon`) and got
    0 rows; the in-function `current_app_role() in ('employee','admin')` filter
    holds. Materially different from the (already double-closed) `reservations`
    table PII leak.

- 2026-07-31 — **Audit found the class has ONE instance** (this RPC). Full
  migration-history sweep: every other recreated staff RPC re-applied its revoke;
  all 14 other staff definer RPCs show anon*x=f. Two \_adjacent, lower-priority*
  over-grants surfaced (different class — pre-existing, neutralized by other
  layers, NOT part of this fix): (1) `current_app_role()` still has anon/PUBLIC
  EXECUTE — harmless-but-removable (returns NULL to anon; no anon RLS policy needs
  it); (2) `profiles` table has a redundant anon `SELECT` grant — RLS-neutralized
  (default-deny → 0 rows), single-layer vs the double-closed `reservations`.
  Both are candidates for the test-plan hardening phase (cf. the deferred
  `reservations` write over-grants). A guardrail idea: a test asserting no
  non-allowlisted definer function has anon EXECUTE.

- 2026-07-31 — **current_app_role carve-out completed** (user chose "current_app_role
  only"). Forward migration `20260731213618_current_app_role_revoke_anon.sql`
  revokes anon/PUBLIC EXECUTE (keeps `authenticated` + `service_role`). Pre-check:
  no `.rpc("current_app_role")` call in `src/`/`tests/` (only comments + generated
  types). Applied; live `proacl` now `{postgres, authenticated, service_role}`
  (anon_x=f, auth_x=t). **Full integration suite: 191/191 passing** — authenticated
  RLS policies, staff RPCs, and the anon booking funnel all unaffected.
  - **`profiles` anon SELECT over-grant DEFERRED** to the test-plan hardening phase.
  - **Both new migrations still need `supabase db push` to prod.**

- 2026-07-31 — **Note (not actioned):** the misleading root-cause comment in the
  already-applied `20260728120000_...add_plate.sql` (lines 11-12, "verbatim from
  20260617121000") is left as-is — migrations are immutable once applied/shipped.
  The correct history is recorded in `20260731212650_...revoke_anon.sql` and
  `research.md`.

- 2026-08-01 — **Shipped & confirmed on prod.** Guardrail test
  (`tests/integration/security-definer-anon-guardrail.test.ts` — property-based
  catalog sweep mirroring Supabase advisor lint 0028) + `tests/helpers/db.ts`
  postgres.js catalog helper added; local test hooks wired (pre-commit unit,
  pre-push full integration suite). Merged to `main` via PR #20 (migrations) and
  PR #21 (guardrail + hooks). **Prod push done:** `supabase migration list --linked`
  shows both `20260731212650` and `20260731213618` on remote (`fmgbyfpilgzvhkziigsj`);
  `supabase db push --dry-run` → "Remote database is up to date." The grant-layer
  gap on prod is closed. Change complete — archiving.
