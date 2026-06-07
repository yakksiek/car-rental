# Runbook: Create the First Admin in Production

**Scope:** one-time, per-deployment operator action. Public self-service signup is
disabled (F-02), and no admin exists on a fresh production database — so the first
admin must be created manually. Every subsequent staff account is created by an
existing admin through the S-08 management flow, **not** this runbook.

> The dev seed (`supabase/seed.sql`) already provisions `admin@fleetrent.test` /
> `employee@fleetrent.test` locally. Those credentials are **dev-only** and must
> never exist in production. This runbook is the production-only path.

## Why this is manual

- `enable_signup = false` (`supabase/config.toml`) and the inert
  `POST /api/auth/signup` route both refuse self-service registration.
- A row in `auth.users` with **no** `public.profiles` row resolves to `role = null`
  and is denied every gated route (fail-closed). Creating a user is therefore not
  enough — a `profiles` row with `role = 'admin'` must be granted deliberately.
- The `profiles` INSERT policy is admin-only, so the grant must run as a privileged
  context (the SQL editor / service role), not as the new (role-less) user.

## Steps

1. **Create the user** in the Supabase dashboard:
   **Authentication → Users → Add user** → enter the admin's email and a strong
   password → **Create user**. (Tick "Auto Confirm User" so they can sign in
   immediately.)

2. **Grant the admin role.** In the dashboard **SQL Editor** (runs as a privileged
   role that bypasses RLS), insert the profile for that user:

   ```sql
   insert into public.profiles (user_id, role)
   select id, 'admin'
   from auth.users
   where email = '<admin-email>';
   ```

   Replace `<admin-email>` with the exact email used in step 1.

3. **Verify.**
   - Confirm the grant:
     ```sql
     select u.email, p.role
     from auth.users u
     join public.profiles p on p.user_id = u.id
     where u.email = '<admin-email>';
     ```
     Expect one row with `role = admin`.
   - Sign in to the app as that user and confirm `/dashboard` resolves the **admin**
     role and an admin-only route is allowed.

## Notes

- Run this **once** per production deployment. If an admin already exists, use the
  S-08 staff-management flow instead.
- To bootstrap an **employee** manually (rare), use the same SQL with `'employee'`.
- Revoking access: `delete from public.profiles where user_id = '<id>';` returns the
  user to `role = null` (denied everywhere) without deleting their auth account.
