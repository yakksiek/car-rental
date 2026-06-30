# Finding F1 — Direct-table customer-PII leak on `reservations` (found & fixed)

- **Status**: FOUND-AND-FIXED (fix shipped in this change, rollout Phase 1 /
  test-plan §3 Phase 1)
- **Risk**: #1 (RLS PII leak) — `context/foundation/test-plan.md` §2
- **Severity**: High (customer PII exposure to any logged-in account)
- **Found**: 2026-06-27 (planning probe) · **Confirmed in harness**: 2026-06-30 ·
  **Fixed**: 2026-06-30

## Confirmed behavior (pre-fix)

Against local Supabase with the seed loaded, using anon-key + real JWT clients
(no service-role bypass):

- An **`authenticated` user with no `profiles` row** (`current_app_role()` =
  null — the `norole@fleetrent.test` fixture) ran
  `from("reservations").select("*")` and received **all 4 seeded customer rows**,
  including `customer_name`, `customer_email`, and `customer_phone`.
- `has_table_privilege('authenticated', 'public.reservations', 'SELECT')`
  returned **`t`**.
- **`anon`** (no JWT) read **0 rows** — denied by default (no anon SELECT
  policy), even though it _also_ held the base SELECT grant.

So the leak was reachable by **any signed-in account**, regardless of role, and
worst for the role-null case (a valid session with no authorization at all).

## Root cause

Two independently-insufficient layers lined up to open the hole:

1. **An implicit schema-wide base `SELECT` grant** to `anon`/`authenticated` on
   `public.reservations` (Supabase's default table grant). The migration comment
   at `supabase/migrations/20260617121000_list_pending_reservations.sql:4`
   asserted the role grants "carry only Dxtm (no table SELECT)" — that belief was
   **wrong**; the grant was present.
2. **The `reservations_select_authenticated` policy gated on `using (true)`**
   (`supabase/migrations/20260603155136_booking_integrity_data.sql:155-158`) —
   the literal "logged-in == allowed" anti-pattern: no row filter, no role check.

With both present, RLS permitted every authenticated caller to read every row.
The leak was invisible in normal use only because the app never reads the table
directly — all reads go through SECURITY DEFINER RPCs (`get_reservation_status`,
`list_pending_reservations`, `list_reservations_for_calendar`,
`decide_reservation`), which run as the table owner and were never the problem.

## Fix applied (this change, Phase 3)

Migration `supabase/migrations/20260630120000_reservations_revoke_select_grant.sql`:

```sql
revoke select on public.reservations from anon, authenticated;
drop policy if exists reservations_select_authenticated on public.reservations;
```

- Removes the direct-table SELECT surface entirely; all reservation reads now
  flow exclusively through the existing SECURITY DEFINER RPCs (unaffected — they
  run as owner).
- Drops the misleading `using(true)` policy so a future re-grant of SELECT can't
  silently re-open the hole through it.
- **Scope: SELECT only** (see Residual items #1).
- No app-code change. The public booking flow and the `/r/<token>` status page
  both go through RPCs — verified by a transactional planning probe (post-revoke,
  a direct SELECT as `authenticated` is BLOCKED while `create_reservation_request`
  as `anon` still returns `created`) and by re-running the Phase 2 overlap suite.
- Not the `(select …)` InitPlan pattern from `context/foundation/lessons.md`: we
  revoke + drop rather than add a per-row caller check, so there's no predicate
  to wrap.

## Regression guard

`tests/integration/reservations-rls.test.ts` case **(e)**: as the `norole`
client, `from("reservations").select(...)` must return **0 PII rows**. This
assertion was RED against the pre-fix schema (returned 4 rows) and is GREEN after
the migration. The suite also asserts the full per-role RPC access matrix
(cases a–d). Run: `npm run test:integration`.

## Residual items (deliberately out of scope here)

1. **Over-broad WRITE grants still present.** The same schema-wide default also
   grants INSERT/UPDATE/DELETE to `anon`/`authenticated` on `reservations`. This
   change fixes only the confirmed **SELECT** (read) leak. Write authorization is
   **test-plan §3 Phase 2** (risks #4/#5). Mitigations today: writes still hit
   the GiST overlap constraint, and the blanket UPDATE/DELETE _policies_ were
   already dropped (writes route through the role-gated `decide_reservation` RPC)
   — but the raw grants remain and should be revoked/narrowed in Phase 2.
2. **Open question — "employee == admin for all reservation PII"?** Today there
   is no admin-only narrowing on reservation PII: `list_pending_reservations`
   (full PII incl. phone) and `decide_reservation` gate on
   `current_app_role() in ('employee','admin')` with no admin-only branch. The
   tests encode this as the **current reality**, not as an endorsement. If a
   narrower policy is intended, it does not exist yet — raise as a product
   decision.

## References

- Risk + response: `context/foundation/test-plan.md` §2 (#1), §2 Risk Response
- Research (RLS inventory, open question #1): `research.md` §B, §D, §E,
  "Open Questions"
- Leak surface policy:
  `supabase/migrations/20260603155136_booking_integrity_data.sql:155-158`
- Wrong "no SELECT grant" comment:
  `supabase/migrations/20260617121000_list_pending_reservations.sql:4`
- Fix migration:
  `supabase/migrations/20260630120000_reservations_revoke_select_grant.sql`
- Role helper (fail-closed null role):
  `supabase/migrations/20260604153139_employee_admin_roles.sql:47-55`
