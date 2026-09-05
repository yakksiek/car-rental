-- English localization — Phase 10 §1: expose the reservation's language on the
-- tokenized status read.
--
-- The sixth read path, missed by 20260904120000_artifact_locale_reads.sql. That
-- migration opened the five paths that compose an outbound ARTIFACT (email, PDF).
-- `/r/<token>` is not an artifact — it is a page — so it was not on that list, and
-- it kept rendering in the SESSION language.
--
-- Why that is a regression rather than a gap: a Polish customer books in Polish,
-- receives a Polish confirmation e-mail, and clicks the status link inside it.
-- They arrive with no cookie and no account, so the session resolves to
-- `DEFAULT_LOCALE` (English). Before this change the page was always Polish. The
-- same rule the artifacts already follow settles it — the language belongs to the
-- RESERVATION, not to whoever is holding the browser.
--
-- DROP + CREATE rather than `create or replace`: adding an OUT column changes the
-- return type, which CREATE OR REPLACE refuses. The body is verbatim from
-- 20260611190621_status_read_customer_email.sql:35-43 apart from the added column.
--
-- A drop discards the ACL, so the standing RPC lesson applies: revoke from
-- public + anon FIRST, then grant. *** The anon grant here is INTENTIONAL and must
-- stay. *** This is one of the four deliberately-public RPCs listed in
-- 20260714120000_rpc_execute_grant_hardening.sql:26-30 — the whole point is a
-- customer with no account opening a tokenized link, and the `access_token` path
-- segment is the only credential. `reservations` itself stays anon-denied; this
-- definer function is the single narrow window onto it, and it exposes only the
-- token holder's own display fields.
--
-- Rollback is symmetric: drop this and re-create from 20260611190621, re-stating
-- both the revoke and the grant.
--
-- See context/changes/english-localization/plan.md (Phase 10 §1).

drop function public.get_reservation_status(uuid);

create function public.get_reservation_status(p_token uuid)
returns table (
  reference text,
  status public.reservation_status,
  pickup_date date,
  return_date date,
  customer_name text,
  customer_email text,
  created_at timestamptz,
  vehicle_make text,
  vehicle_model text,
  vehicle_production_year int,
  vehicle_category public.vehicle_category,
  vehicle_daily_rate numeric,
  vehicle_deposit numeric,
  locale text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.reference, r.status, r.pickup_date, r.return_date, r.customer_name,
    r.customer_email, r.created_at,
    v.make, v.model, v.production_year, v.category, v.daily_rate, v.deposit,
    r.locale
  from public.reservations r
  join public.vehicles v on v.id = r.vehicle_id
  where r.access_token = p_token;
$$;

revoke execute on function public.get_reservation_status(uuid) from public, anon;
-- Deliberately public: the anon grant is the feature, not an oversight. See the
-- header above and 20260714120000_rpc_execute_grant_hardening.sql:26-30.
grant execute on function public.get_reservation_status(uuid) to anon, authenticated;
