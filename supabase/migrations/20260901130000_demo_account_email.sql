-- demo_account_email() — publish the demo address FROM the flag, not beside it.
--
-- `demo-account-gate` shipped the published credentials as two independent
-- secrets (`DEMO_EMAIL` / `DEMO_PASSWORD`) and rendered the card whenever both
-- were merely PRESENT (`src/pages/auth/signin.astro:29`). Nothing checked that
-- the account they named was actually marked `profiles.is_demo`, so the two
-- switches could disagree — and the disagreement fails OPEN: point `DEMO_EMAIL`
-- at a real admin, or set the secrets before marking the account, and
-- `/auth/signin` publishes working credentials for an UNGATED admin to the
-- internet. `context/foundation/known-issues.md` concedes the ordering
-- dependency ("provided the account is marked `is_demo` last"), which is exactly
-- an admission that a provisioning window exists where this is wrong.
--
-- This makes the flag the single source of truth: the page asks the database
-- which account is the demo account, so it can only ever publish an address that
-- is genuinely gated. `DEMO_PASSWORD` stays a secret — it is the half that
-- rotates, and the half the database must not know.
--
-- Fail-closed by construction. Returns NULL — and the card therefore does not
-- render — when there is no demo account, when the demo account is deactivated,
-- and when there is MORE than one. Ambiguity is refused rather than guessed at:
-- picking a row would mean publishing an address nobody deliberately chose.
--
-- Anon-executable on purpose, and it leaks nothing: the value it returns is
-- printed on a public page for anyone to read. That is the whole point of it.
-- `available_vehicles` (`20260611171737_public_reservation_request.sql`) is the
-- established precedent for an anon-callable definer RPC.
--
-- Rollback: `drop function public.demo_account_email();` and restore
-- `DEMO_EMAIL` to `astro.config.mjs` + `signin.astro`.

create or replace function public.demo_account_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- LIMIT 2, not 1: two rows must resolve to NULL, so the count has to be
  -- observable. `having count(*) = 1` over the limited set does that.
  select max(u.email)::text
  from (
    select p.user_id
    from public.profiles p
    where p.is_demo
      and p.deactivated_at is null
    limit 2
  ) d
  join auth.users u on u.id = d.user_id
  having count(*) = 1;
$$;

-- Per-function revoke BEFORE the grant: a grant alone restricts nothing against
-- Postgres' default PUBLIC execute grant (lessons.md → "Revoke EXECUTE before
-- granting it"). `anon` is granted back deliberately — the sign-in page renders
-- for signed-out visitors, which is the only caller.
revoke execute on function public.demo_account_email() from public, anon, authenticated;
grant execute on function public.demo_account_email() to anon, authenticated, service_role;

comment on function public.demo_account_email() is
  'E-mail of the single active published demo account (profiles.is_demo), or NULL when there is no such account, it is deactivated, or there is more than one. Lets /auth/signin derive the address it publishes from the flag that gates it, so the card can never name an ungated account. Anon-executable: the value is printed on a public page by design.';
