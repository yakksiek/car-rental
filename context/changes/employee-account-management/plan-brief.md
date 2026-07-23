# Employee Account Management (S-08) — Plan Brief

> Full plan: `context/changes/employee-account-management/plan.md`

## What & Why

FR-013: an admin adds and removes employee accounts, and every staff member can self-service reset their own password by email. This is the slice F-02 explicitly deferred three things into — **service-role key wiring**, the **password-reset flow**, and the **admin user-management UI** — so it completes the staff-access story.

## Starting Point

Auth + the employee/admin role model (F-02) are live: `profiles(user_id→role)`, `current_app_role()`, `requireRole`, and — already reserved — `ROUTE_ROLES: /dashboard/staff → admin`. But there is **no** service-role key, **no** admin (RLS-bypass) client, **no** password-reset flow of any kind, and `profiles` has no name/email. The Employees page (`src/pages/dashboard/staff.astro`) does not exist yet.

## Desired End State

An admin at `/dashboard/staff` sees a searchable roster (name · email · role · ACTIVE/INVITED status · last-active) with filter tabs, invites employees by email (GoTrue invite → they set their own password), soft-removes them behind self / last-admin / typed-confirm guards, and triggers a per-row password reset. Any staffer can recover their password from the sign-in screen. Emails are verified in local Inbucket.

## Key Decisions Made

| Decision                   | Choice                                                                               | Why                                                                                                                                               | Source |
| -------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Onboarding + reset channel | Native Supabase GoTrue (`inviteUserByEmail` / `resetPasswordForEmail`)               | Standard, least code; matches the design's INVITED status; recovery flow reused for the admin reset action                                        | Plan   |
| Remove semantics           | Soft-deactivate (not hard delete)                                                    | `protocols.created_by → auth.users` (no cascade) makes the DB reject deleting anyone who filled a protocol; consistent with vehicles' `is_active` | Plan   |
| Removal guardrails         | Block self **and** last-admin **and** typed email confirmation                       | Prevent self-lockout, org admin lockout, and mis-clicks                                                                                           | Plan   |
| Create role scope          | Employees only; admins stay runbook-provisioned                                      | Smallest privilege-escalation surface; matches the "Add employee" label + F-02 runbook                                                            | Plan   |
| Roster data source         | Admin-gated `SECURITY DEFINER list_staff()` RPC                                      | Keeps the service-role key out of page reads; mirrors `list_pending_reservations`                                                                 | Plan   |
| Name storage               | New `profiles.full_name` (+ `deactivated_at`); email stays canonical in `auth.users` | Listable/RLS-safe name; no email duplication                                                                                                      | Plan   |
| Last-active source         | `auth.users.last_sign_in_at`, rendered relative                                      | Free via the RPC join; no per-request writes ("Online now" is approximate)                                                                        | Plan   |
| In-app change password     | Out of scope                                                                         | FR-013 requires only email-based reset                                                                                                            | Plan   |
| Re-adding a removed email  | Reactivates the account                                                              | Intuitive recovery from accidental removal; no orphaned emails                                                                                    | Plan   |
| Email delivery DoD         | Local Inbucket verification                                                          | Fully verifiable in dev; prod SMTP is a documented ops step                                                                                       | Plan   |

## Scope

**In scope:** service-role key + admin client; `list_staff` / `deactivate_staff` RPCs + `profiles` columns; `/api/staff*` admin mutations (invite / deactivate / reset); PKCE recovery flow (`forgot-password` → `callback` → `reset-password`) shared with invite-accept; the Employees page + admin-only "Zespół" nav; integration tests.

**Out of scope:** creating admins from the UI; hard delete; in-app change-password; true presence tracking; a "show deactivated" filter; prod email send; custom/branded email templates; other tables' RLS.

## Architecture / Approach

Reads flow through an **admin-gated definer RPC** on the normal cookie client (no service-role at render). Writes (invite / deactivate / reset) flow through admin-gated `/api/staff*` routes that construct a **service-role admin client** locally — RLS-bypassing, so the in-handler `requireRole(admin)` gate is the real boundary. Removal is a guarded state change (`deactivate_staff` RPC sets `deactivated_at`; the service then bans the auth user); middleware treats `deactivated_at` as `role=null`. Invite + recovery both ride GoTrue's PKCE `?code=` link → `/auth/callback` (`exchangeCodeForSession`) → `/auth/reset-password` (`updateUser`). UI mirrors `FleetList` (table/cards + hand-rolled confirm modal; inline banner + optimistic update — no shadcn Table/Dialog/toast in the repo).

## Phases at a Glance

| Phase                    | What it delivers                                                                                                              | Key risk                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1. Data & plumbing       | `profiles` columns, `list_staff`/`deactivate_staff` RPCs, service-role env + admin client, middleware deactivation gate, seed | Service-role client bypasses RLS — must stay server-only, route-gated                            |
| 2. Service & admin API   | `staff.ts` + `/api/staff*` (invite/deactivate/reset) + integration tests                                                      | Guard correctness (self / last-admin); reactivation branch on re-add                             |
| 3. Reset + PKCE callback | `forgot-password` → `callback` → `reset-password`, sign-in link, config redirect URLs                                         | PKCE `exchangeCodeForSession` ordering; `config.toml` redirect allow-list (reload on stop/start) |
| 4. Employees UI          | Admin-only "Zespół" nav, page, `StaffList` island (roster/add/remove/reset)                                                   | Design fidelity vs the canonical design set; SSR/CSR locale hydration                            |

**Prerequisites:** F-02 (done). Local Supabase running; the local `service_role` key in `.dev.vars`.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- Prod email + redirect config (Supabase SMTP, `additional_redirect_urls`, `SUPABASE_SERVICE_ROLE_KEY` Worker secret) are **ops steps outside this slice** — DoD is local-Inbucket only, so real prod delivery is unproven in-slice (accepted).
- The service-role client is a new RLS-bypass capability; a mis-gated `/api/staff*` route would be a serious hole — mitigated by the mandatory self-gate + confining the client to those routes.
- `config.toml` redirect changes load only on `supabase stop && start` — easy to miss; called out in Phase 3.

## Success Criteria (Summary)

- An admin can invite an employee who then sets their own password and signs in (INVITED→ACTIVE), verified via Inbucket.
- An admin can soft-remove staff — never themselves or the last admin, and only after typing the email — and re-adding reactivates.
- Any staffer can reset their password from the sign-in screen; the Employees page matches the canonical design.
