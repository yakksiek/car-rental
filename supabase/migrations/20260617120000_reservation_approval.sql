-- Reservation Approval (S-03) — Phase 1: decision RPC, reason columns, RLS tightening
--
-- Adds the employee decision write path on top of the public funnel (S-02). The
-- transition (pending -> confirmed/rejected) crosses the RLS boundary through a
-- single SECURITY DEFINER RPC that gates on the caller's app_role, guards the
-- still-pending invariant under a row lock, flips the status atomically, and
-- returns the customer/vehicle payload the notification email needs. Because the
-- only write path is now that definer RPC (which runs as owner, bypassing RLS),
-- the blanket authenticated UPDATE/DELETE policies are dropped — closing the hole
-- where any logged-in user could mutate any reservation.
-- Additive over F-01 (20260603155136) + F-02 (20260604153139) + S-02 (20260611171737).
-- See context/changes/reservation-approval/plan.md (Phase 1).

-- ---------------------------------------------------------------------------
-- reservations: rejection reason columns
-- ---------------------------------------------------------------------------

-- rejection_reason: a canned code, set only when a request is rejected. The
--   CHECK keeps the column honest in two ways: the value (when present) must be
--   one of the four known codes, and it is non-null iff the row is 'rejected'.
-- rejection_note: optional free text, used when the reason is 'other'.
alter table reservations
  add column rejection_reason text,
  add column rejection_note text;

alter table reservations
  add constraint reservations_rejection_reason_valid
    check (
      rejection_reason is null
      or rejection_reason in ('dates_unavailable', 'no_category', 'vehicle_withdrawn', 'other')
    );

-- A rejected row carries a reason; any other status carries none. This is what
-- prevents a stray reason on a confirmed row or a reasonless rejection.
alter table reservations
  add constraint reservations_rejection_reason_consistency
    check (
      (status = 'rejected' and rejection_reason is not null)
      or (status <> 'rejected' and rejection_reason is null)
    );

-- ---------------------------------------------------------------------------
-- decide_reservation — the guarded employee decision write
-- ---------------------------------------------------------------------------

-- The single atomic transition path. Definer hygiene mirrors S-02's RPCs
-- (security definer + set search_path = '' + every name schema-qualified):
--   * role gate: current_app_role() must be employee/admin, else 'unauthorized'.
--   * `select ... for update` locks and re-reads the row's status: this guard —
--     not the UI — is what makes two employees deciding the same request safe.
--   * status <> 'pending' -> 'already_decided' (no overwrite).
--   * confirm: pending -> confirmed (conflict-free by construction — pending
--     already participates in the reservations_no_overlap EXCLUDE set, so the
--     row already holds its slot; no overlap re-check is needed).
--   * reject: requires a valid p_reason (else 'invalid_reason'); stores the
--     reason + optional note and flips to rejected (freeing the slot).
-- Returns result = the new status ('confirmed'/'rejected') plus the customer +
-- vehicle fields the endpoint needs to compose the notification email without a
-- second query.
create function public.decide_reservation(
  p_id uuid,
  p_decision text,
  p_reason text default null,
  p_note text default null
)
returns table (
  result text,
  customer_name text,
  customer_email text,
  reference text,
  access_token uuid,
  pickup_date date,
  return_date date,
  vehicle_make text,
  vehicle_model text,
  vehicle_production_year int,
  vehicle_daily_rate numeric,
  vehicle_deposit numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_status public.reservation_status;
begin
  -- Role gate: only employees/admins may decide. A null role (no profile) fails
  -- closed, matching the access boundary's posture.
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query
      select 'unauthorized'::text, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
    return;
  end if;

  -- Lock and re-read the current status inside the transaction.
  select r.status into v_status
  from public.reservations r
  where r.id = p_id
  for update;

  if not found then
    return query
      select 'not_found'::text, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
    return;
  end if;

  if v_status <> 'pending' then
    return query
      select 'already_decided'::text, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
    return;
  end if;

  if p_decision = 'confirm' then
    update public.reservations
      set status = 'confirmed'
      where id = p_id;
  elsif p_decision = 'reject' then
    if p_reason is null
       or p_reason not in ('dates_unavailable', 'no_category', 'vehicle_withdrawn', 'other') then
      return query
        select 'invalid_reason'::text, null::text, null::text, null::text, null::uuid,
               null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
      return;
    end if;
    update public.reservations
      set status = 'rejected', rejection_reason = p_reason, rejection_note = p_note
      where id = p_id;
  else
    -- An unknown decision verb is a caller bug, not a domain outcome.
    return query
      select 'invalid_reason'::text, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
    return;
  end if;

  -- Success: return the new status + the email payload (qualified refs only, so
  -- no ambiguity with the OUT column names).
  return query
    select
      (case when p_decision = 'confirm' then 'confirmed' else 'rejected' end)::text,
      r.customer_name, r.customer_email, r.reference, r.access_token,
      r.pickup_date, r.return_date,
      v.make, v.model, v.production_year, v.daily_rate, v.deposit
    from public.reservations r
    join public.vehicles v on v.id = r.vehicle_id
    where r.id = p_id;
end;
$$;

-- Staff-only: anon never reaches this (no grant); the in-RPC role gate is the
-- authority regardless.
grant execute on function public.decide_reservation(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS tightening: writes now flow only through the definer RPC
-- ---------------------------------------------------------------------------

-- The blanket `using (true)` UPDATE/DELETE policies let any authenticated user
-- mutate any reservation. With decide_reservation as the sole write path (and it
-- runs as owner, bypassing RLS), these are dropped. SELECT stays so employees
-- can read the pending queue and the calendar.
drop policy reservations_update_authenticated on reservations;
drop policy reservations_delete_authenticated on reservations;
