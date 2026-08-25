---
change_id: vehicles-read-policy-gate
title: Vehicles read policy is USING (true) — no DB backstop under the new fleet endpoint
status: new
created: 2026-08-24
updated: 2026-08-25
archived_at: null
---

## Notes

Split out of `staff-quick-actions` on 2026-08-24, alongside `service-read-projections`.

**The finding.** `vehicles_select_authenticated` has the predicate `true` — any caller holding a
valid Supabase JWT can read every row, including retired vehicles. Writes on the same table _are_
role-gated. Reads are not.

Live policies (read from local Supabase 2026-08-24, not from the migration file):

| policy                          | role          | cmd    | predicate                                             |
| ------------------------------- | ------------- | ------ | ----------------------------------------------------- |
| `vehicles_select_anon`          | anon          | SELECT | `is_active = true`                                    |
| `vehicles_select_authenticated` | authenticated | SELECT | **`true`**                                            |
| `vehicles_update_staff`         | authenticated | UPDATE | `(select current_app_role()) = ANY (employee, admin)` |
| `vehicles_insert_staff`         | authenticated | INSERT | role-gated via `WITH CHECK`                           |

`authenticated` means "signed up", not "is staff" — `current_app_role()` is
`select role from public.profiles where user_id = auth.uid()`, so a signed-in user with no
`profiles` row resolves to `null`. The local DB currently has **2 such users** against 9 employees
and 1 admin.

**Schema-wide survey — this is the only case.** RLS is enabled on all 8 public tables. Only 3
SELECT policies exist in the entire schema:

- `vehicles_select_authenticated` → `true` ← **the outlier**
- `vehicles_select_anon` → `is_active = true`
- `profiles_select_authenticated` → `user_id = (select auth.uid()) OR (select current_app_role()) = 'admin'`

The other **six** tables (`reservations`, `protocols`, `protocol_photos`, `protocol_damages`,
`protocol_damage_photos`, `email_deliveries`) have **zero** SELECT policies, so direct table reads
return nothing and every read goes through a role-gated `SECURITY DEFINER` RPC. That is the house
architecture and it is sound. `vehicles` is the deliberate exception because it doubles as the
public catalog — the problem is only that the exception is wider than it needs to be.

**Nothing is exposed today.** `listFleet` is reachable only through two SSR staff pages behind the
middleware role gate (`src/lib/access.ts:33`). There is no route a non-staff user can call.

**Why it matters now.** `staff-quick-actions` adds `GET /api/vehicles`. Per
`context/foundation/lessons.md` ("API routes are outside middleware's gate"), `/api` paths are not
in `ROUTE_ROLES`, so the handler must gate itself. Because the read policy is `true`, that handler
gate is the **only** barrier — on a table with a discriminating read policy, forgetting the check
fails closed; here it fails open.

**Severity: low, and say so.** `vehicles` carries no customer PII, and anon already sees all active
vehicles publicly. The delta for a signed-in non-staff caller is **1 retired vehicle** plus internal
columns (`monthly_rate`, `km_limit`, `per_extra_km_rate`). Same _shape_ as the confirmed
`reservations` PII grant leak (default-open read path + non-discriminating policy), nowhere near the
same stakes. Do not write this up as a PII leak.

**The trap in the obvious fix.** Narrowing the policy to staff-only would break the customer path:
`getVehicle` (`src/lib/services/vehicles.ts:232`) and the catalog read (`:44`) run on the same
client, so a **signed-in customer browsing the fleet is `authenticated`, not `anon`** and would lose
the public catalog. The correct predicate mirrors what anon already gets:

```sql
is_active = true OR (select public.current_app_role()) in ('employee','admin')
```

Note the `(select …)` wrapper — required by the initplan lesson in
`context/foundation/lessons.md`, and consistent with how `vehicles_update_staff` and
`profiles_select_authenticated` are already written.

**Test obligation regardless of whether the policy changes.** The new endpoint's role check is
load-bearing on its own, so its integration test needs the explicit
**anon → 401 / role-null → 403 / employee → 200** triple. A test asserting only "employee gets 200"
passes with the hole open — which is how the `reservations` leak survived.

**Related:** `context/archive/2026-08-21-staff-quick-actions/` (introduced the endpoint that makes
this reachable — merged and archived 2026-08-25; it shipped the anon-401 / role-null-403 / employee-200
triple this change's notes ask for, in `tests/integration/api-authz.test.ts`, but deliberately changed
no policy, so the finding below is untouched) · `context/changes/service-read-projections/` (the other
split-out finding) ·
`context/archive/2026-06-27-testing-data-layer-integrity/` (the `reservations` PII grant leak fix,
the precedent for both the failure shape and the test shape).
