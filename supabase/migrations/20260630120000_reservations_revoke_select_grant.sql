-- Data-layer Integrity Harness (test-plan Phase 1) — close the PII leak (F1)
--
-- CONFIRMED LEAK: any `authenticated` caller — including one with no `profiles`
-- row (`current_app_role()` = null) — could `select *` directly off
-- `public.reservations` and read every customer's name/email/phone. Two things
-- combined to open it:
--   1. a schema-wide base `SELECT` grant to `anon`/`authenticated` (the migration
--      comment at 20260617121000_list_pending_reservations.sql:4 wrongly believed
--      this absent), and
--   2. the `reservations_select_authenticated` policy gating on `using (true)` —
--      the literal "logged-in == allowed" anti-pattern, no row filter, no role
--      check (20260603155136_booking_integrity_data.sql:155-158).
--
-- FIX: remove the direct-table SELECT surface entirely. Every reservation read in
-- this codebase already flows through a SECURITY DEFINER RPC
-- (get_reservation_status, list_pending_reservations,
-- list_reservations_for_calendar, decide_reservation) which runs as the table
-- owner and is unaffected by these grants/policies — so no RPC, app code, or the
-- public booking flow changes. Verified by a transactional planning probe:
-- post-revoke, a direct SELECT as `authenticated` is BLOCKED while
-- `create_reservation_request` as `anon` still returns `created`.
--
-- SCOPE: SELECT only. The INSERT/UPDATE/DELETE over-grants from the same default
-- are deliberately left for test-plan §3 Phase 2 (write authz, risks #4/#5); see
-- finding-rls-pii-leak.md. This touches no RPC, the overlap constraint, or the
-- generated range. Forward-only; reversible by a symmetric grant + create policy.
--
-- This is NOT the "(select …)" InitPlan pattern from context/foundation/lessons.md:
-- we revoke the grant and drop the policy rather than add a per-row caller check,
-- so there is no predicate to wrap.

revoke select on public.reservations from anon, authenticated;

-- Drop the misleading `using(true)` policy so a future re-grant of SELECT cannot
-- silently re-open the hole through it.
drop policy if exists reservations_select_authenticated on public.reservations;
