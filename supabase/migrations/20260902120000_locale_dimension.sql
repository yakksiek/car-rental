-- English localization — Phase 1: the locale dimension and its five write paths.
--
-- Adds the columns that store WHICH LANGUAGE a thing is in, plus the consent
-- attribution the /terms slice needs, and opens every write path that would
-- otherwise leave them unfillable. Columns are the easy half: all five sit
-- behind SECURITY DEFINER RPCs or an admin-only RLS policy, so none of them is
-- writable from the app without the SQL below.
--
--   profiles.locale          — a staffer's stored preference. NULL = "no
--                              preference", which resolves to the app default,
--                              NOT to Polish.
--   reservations.locale      — the CUSTOMER's language, captured at submission.
--                              Drives every outbound email, so an employee
--                              working in an English cockpit still mails a
--                              Polish customer in Polish.
--   protocols.locale         — what language the stored PDF bytes were rendered
--                              in. Stamped at render time; an issued document is
--                              never regenerated.
--   reservations.terms_version / .terms_locale
--                            — which terms, in which language, the customer
--                              accepted. Sits beside the existing
--                              terms_accepted_at.
--
-- BACKFILL IS DELIBERATELY ASYMMETRIC. Existing `reservations` and `protocols`
-- rows are stamped 'pl' — they were created by a Polish-only app, and for
-- protocols the stored PDF bytes are provably Polish. The COLUMN DEFAULTS
-- differ from the backfill on purpose: `reservations` defaults 'en' for new
-- rows (English is the app default), `protocols` defaults 'pl' and is always
-- written explicitly at render time.
--
-- No RLS policy changes: the columns ride existing row grants, and
-- `set_profile_locale` (§2) is the seam that makes `profiles` writable without
-- widening the admin-only policy.
--
-- Rollback is additive-reversible: drop the five columns and
-- `set_profile_locale`, then recreate the four RPCs without their locale
-- parameters — re-stating BOTH the revoke and the grant on each, since a DROP
-- resets the ACL to Supabase's default (EXECUTE to PUBLIC + anon).
--
-- See context/changes/english-localization/plan.md (Phase 1 §6).

-- ---------------------------------------------------------------------------
-- §1 Columns
-- ---------------------------------------------------------------------------

-- Nullable with no default: null means "this person has expressed no
-- preference", which the resolver answers with the app default. A NOT NULL
-- default would make every existing staffer look like they had chosen English.
alter table public.profiles
  add column locale text,
  add constraint profiles_locale_valid check (locale is null or locale in ('en', 'pl'));

comment on column public.profiles.locale is
  'This staffer''s stored language preference. NULL = no preference (resolve to the app default, never to Polish). Written only by set_profile_locale(); read by src/middleware.ts, which SKIPS it for the demo account (see the function comment).';

-- Added `default 'pl'` so every EXISTING row is stamped Polish in the same
-- statement (no table-rewriting UPDATE), then the default is moved to 'en' for
-- rows created from here on. The two values differ on purpose — see the header.
alter table public.reservations
  add column locale text not null default 'pl',
  add column terms_version text,
  add column terms_locale text,
  add constraint reservations_locale_valid check (locale in ('en', 'pl')),
  add constraint reservations_terms_locale_valid check (terms_locale is null or terms_locale in ('en', 'pl'));

alter table public.reservations
  alter column locale set default 'en';

comment on column public.reservations.locale is
  'The CUSTOMER''s language, captured at submission. Every outbound email for this reservation renders from THIS value, never from the sending employee''s session locale. Existing rows backfilled to ''pl''; new rows default ''en''.';

comment on column public.reservations.terms_version is
  'Which version of the rental terms the customer accepted, beside terms_accepted_at. NULL for every row created before the /terms page existed.';

comment on column public.reservations.terms_locale is
  'Which LANGUAGE of the terms the customer read when they accepted. NULL = unrecorded (pre-/terms rows).';

-- Backfill and default coincide here: every stored PDF's bytes are provably
-- Polish, and the renderer always passes this explicitly from here on.
alter table public.protocols
  add column locale text not null default 'pl',
  add constraint protocols_locale_valid check (locale in ('en', 'pl'));

comment on column public.protocols.locale is
  'What language this protocol''s stored PDF bytes were rendered in. Stamped at creation and never re-derived — an issued document is re-signed, never regenerated, so the signature always sits beneath the declaration the customer actually read.';

-- ---------------------------------------------------------------------------
-- §2 set_profile_locale() — the seam that makes profiles.locale writable
-- ---------------------------------------------------------------------------
--
-- There is exactly ONE update policy on profiles — profiles_update_authenticated
-- (20260604153139_employee_admin_roles.sql:80-84, tightened at
-- 20260828140000_demo_account_write_gate.sql:86-94) — and it reads
-- `current_app_role() = 'admin' and not current_is_demo()`. There is no "update
-- your own row" clause, so an EMPLOYEE matches nothing; and an RLS-denied UPDATE
-- is not an error, it is a successful update of ZERO rows. A direct
-- `.from("profiles").update(…)` from the app would therefore fail SILENTLY for
-- every non-admin. This definer RPC is the seam, exactly as mark_password_set()
-- (20260821100000) is for password_set_at.
--
-- It takes NO target parameter, deliberately: one would let any authenticated
-- caller set anyone's language. The row is chosen by auth.uid() alone, wrapped
-- as a scalar subquery so it is evaluated once per statement rather than once
-- per row (lessons.md -> "Wrap auth calls and role helpers in (select …)").
-- A caller with no profiles row updates zero rows — a silent no-op, not an error.
--
-- An unrecognised locale is normalised away rather than raising: the caller is
-- a preference switch, and a bad value should leave the stored preference
-- untouched, not 500. The route zod-validates first; this is the backstop.
--
-- ***PAIRED WITH THE READ-SIDE DEMO SKIP IN src/middleware.ts.*** This function
-- writes for the demo account like any other, so the demo behaves identically to
-- a real account for anyone inspecting it. The ONLY thing preventing one
-- recruiter's language choice from leaking to every recruiter who signs in
-- afterwards is the `is_demo` skip on the READ side in src/middleware.ts. Do not
-- "clean up" either half without the other — removing the read-side skip
-- re-opens the leak silently. tests/integration/locale.test.ts pins it.
create function public.set_profile_locale(p_locale text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set locale = p_locale
   where user_id = (select auth.uid())
     and p_locale in ('en', 'pl');
$$;

-- ---------------------------------------------------------------------------
-- §3 create_reservation_request — the public funnel's atomic write
-- ---------------------------------------------------------------------------
--
-- Three new params, so drop + recreate rather than `create or replace` (which
-- would leave the 10-arg overload in place and make PostgREST ambiguous). All
-- three carry defaults so the existing 10-arg call shape still resolves. Body is
-- verbatim from 20260810140000_reservation_date_order_guard.sql:140-208 except
-- for the three columns added to the insert.
--
-- p_locale is NORMALISED rather than passed through: this function is granted to
-- ANON — it is the public funnel's write path — so an unrecognised value from an
-- untrusted caller would hit reservations_locale_valid and raise a raw
-- check_violation that none of the exception arms below catches. Same reasoning
-- as the date-order guard that migration added: answer with a sane value, never
-- a raw error.
drop function public.create_reservation_request(uuid, date, date, text, text, text, boolean, text, text, text);

create function public.create_reservation_request(
  p_vehicle_id uuid,
  p_pickup date,
  p_return date,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_terms_accepted boolean,
  p_company text default null,
  p_vat_id text default null,
  p_notes text default null,
  p_locale text default 'en',
  p_terms_version text default null,
  p_terms_locale text default null
)
returns table (result text, reference text, access_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
  v_token uuid;
begin
  -- Date-order guard (20260810140000). Anon-reachable, so this is the arm that
  -- actually closes a raw-error path for untrusted callers.
  if p_return <= p_pickup then
    return query select 'unavailable'::text, null::text, null::uuid;
    return;
  end if;

  -- Vehicle must exist and be active (RLS is bypassed here, so re-check
  -- is_active explicitly — same care as available_vehicles).
  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.is_active
  ) then
    return query select 'unavailable'::text, null::text, null::uuid;
    return;
  end if;

  -- Up to 3 attempts: a unique_violation can only mean a reference clash
  -- (e.g. against a backfilled code), so retry with a fresh one. The
  -- exclusion_violation path is terminal — the range is genuinely taken.
  for attempt in 1..3 loop
    v_reference := 'R-' || public.base36_encode(nextval('public.reservation_reference_seq'));
    begin
      insert into public.reservations (
        vehicle_id, customer_name, customer_email, customer_phone,
        pickup_date, return_date, status, reference, terms_accepted_at,
        company, vat_id, notes,
        locale, terms_version, terms_locale
      ) values (
        p_vehicle_id, p_customer_name, p_customer_email, p_customer_phone,
        p_pickup, p_return, 'pending', v_reference,
        case when p_terms_accepted then now() end,
        -- Normalize blank strings to null so empty optionals don't store ''.
        nullif(btrim(p_company), ''), nullif(btrim(p_vat_id), ''), nullif(btrim(p_notes), ''),
        -- Unrecognised locale -> the column default rather than a check_violation
        -- (see header). terms_locale is nullable, so unrecognised -> null.
        case when p_locale in ('en', 'pl') then p_locale else 'en' end,
        nullif(btrim(p_terms_version), ''),
        case when p_terms_locale in ('en', 'pl') then p_terms_locale end
      )
      returning reservations.access_token into v_token;

      return query select 'created'::text, v_reference, v_token;
      return;
    exception
      when exclusion_violation then
        -- 23P01 from reservations_no_overlap: the vehicle was just taken.
        return query select 'conflict'::text, null::text, null::uuid;
        return;
      when unique_violation then
        if attempt = 3 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

-- INTENTIONALLY PUBLIC (lessons.md -> "Revoke EXECUTE before granting it",
-- carve-out (a)): this is the anon-reachable booking funnel write. The DROP above
-- reset the ACL to Supabase's default, so BOTH halves are re-stated — revoke the
-- implicit grants first, then grant anon back EXPLICITLY so the intent is
-- readable at the grant layer rather than inherited from a default.
revoke execute on function public.create_reservation_request(
  uuid, date, date, text, text, text, boolean, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_reservation_request(
  uuid, date, date, text, text, text, boolean, text, text, text, text, text, text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- §4 create_confirmed_reservation — the staff manual-booking sibling
-- ---------------------------------------------------------------------------
--
-- Body verbatim from 20260810140000:32-133 plus the locale column. It returns an
-- email payload and mails the customer immediately, so it needs a language as
-- much as the public funnel does. The parameter defaults to 'en' to match the
-- column default; the manual-booking modal will always pass it explicitly (and
-- defaults ITS field to 'pl', since a walk-in at a Polish depot is the common
-- case) once that UI lands.
drop function public.create_confirmed_reservation(uuid, date, date, text, text, text);

create function public.create_confirmed_reservation(
  p_vehicle_id uuid,
  p_pickup date,
  p_return date,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_locale text default 'en'
)
returns table (
  result text,
  id uuid,
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
  v_reference text;
  v_id uuid;
begin
  -- Role gate: staff only. Kept alongside the EXECUTE revoke below — defense in
  -- depth, not either/or (lessons.md -> "Revoke EXECUTE before granting it").
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query
      select 'unauthorized'::text, null::uuid, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
    return;
  end if;

  -- Date-order guard (20260810140000): a same-day range makes reserved_period's
  -- lower bound exceed its upper and raises a data_exception no arm below catches.
  if p_return <= p_pickup then
    return query
      select 'unavailable'::text, null::uuid, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
    return;
  end if;

  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.is_active
  ) then
    return query
      select 'unavailable'::text, null::uuid, null::text, null::text, null::text, null::uuid,
             null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
    return;
  end if;

  for attempt in 1..3 loop
    v_reference := 'R-' || public.base36_encode(nextval('public.reservation_reference_seq'));
    begin
      insert into public.reservations (
        vehicle_id, customer_name, customer_email, customer_phone,
        pickup_date, return_date, status, source, reference, locale
      ) values (
        p_vehicle_id, p_customer_name, p_customer_email, p_customer_phone,
        p_pickup, p_return, 'confirmed', 'manual', v_reference,
        case when p_locale in ('en', 'pl') then p_locale else 'en' end
      )
      returning reservations.id into v_id;

      -- Success: the result tag + the id + the email payload, read back from the
      -- committed row joined to its vehicle (qualified refs only, so no
      -- ambiguity with the OUT column names).
      return query
        select
          'created'::text, r.id,
          r.customer_name, r.customer_email, r.reference, r.access_token,
          r.pickup_date, r.return_date,
          v.make, v.model, v.production_year, v.daily_rate, v.deposit
        from public.reservations r
        join public.vehicles v on v.id = r.vehicle_id
        where r.id = v_id;
      return;
    exception
      when exclusion_violation then
        -- 23P01 from reservations_no_overlap: the slot is already taken by a
        -- pending or confirmed booking.
        return query
          select 'conflict'::text, null::uuid, null::text, null::text, null::text, null::uuid,
                 null::date, null::date, null::text, null::text, null::int, null::numeric, null::numeric;
        return;
      when unique_violation then
        if attempt = 3 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

revoke execute on function public.create_confirmed_reservation(uuid, date, date, text, text, text, text)
  from public, anon;
grant execute on function public.create_confirmed_reservation(uuid, date, date, text, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- §5 create_protocol — issue protocol
-- ---------------------------------------------------------------------------
--
-- Body verbatim from 20260716120000_return_protocol.sql:81-165 plus the locale
-- column. Defaults to 'pl' to match the column default, so a caller that has not
-- yet been threaded (the renderer lands in a later phase) keeps today's behaviour.
drop function public.create_protocol(uuid, uuid, int, smallint, timestamptz, boolean, text, jsonb, jsonb);

create function public.create_protocol(
  p_id uuid,
  p_reservation_id uuid,
  p_odometer_km int,
  p_fuel_eighths smallint,
  p_signed_at timestamptz,
  p_customer_ack boolean,
  p_signature text,
  p_photos jsonb,
  p_damages jsonb,
  p_locale text default 'pl'
)
returns table (
  result text,
  protocol_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_status public.reservation_status;
  v_existing uuid;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query select 'unauthorized'::text, null::uuid;
    return;
  end if;

  -- Lock and re-read the reservation status inside the transaction. A second
  -- concurrent call blocks here until the first commits.
  select r.status into v_status
  from public.reservations r
  where r.id = p_reservation_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  if v_status <> 'confirmed' then
    return query select 'not_confirmed'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.protocols (
      id, reservation_id, type, odometer_km, fuel_eighths,
      signed_at, signature, customer_ack, created_by, locale
    )
    values (
      p_id, p_reservation_id, 'issue', p_odometer_km, p_fuel_eighths,
      p_signed_at, p_signature, p_customer_ack, auth.uid(),
      case when p_locale in ('en', 'pl') then p_locale else 'pl' end
    );
  exception when unique_violation then
    -- Either (reservation_id, 'issue') (a second submit) or id (a replayed
    -- request). Both mean: an issue protocol for this reservation already exists.
    select pr.id into v_existing
    from public.protocols pr
    where pr.reservation_id = p_reservation_id and pr.type = 'issue';

    return query select 'conflict'::text, v_existing;
    return;
  end;

  insert into public.protocol_photos (protocol_id, slot, path)
  select p_id, (e ->> 'slot')::public.protocol_photo_slot, e ->> 'path'
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) e;

  insert into public.protocol_damages (id, protocol_id, type, location, size)
  select
    (e ->> 'id')::uuid,
    p_id,
    (e ->> 'type')::public.protocol_damage_type,
    e ->> 'location',
    nullif(e ->> 'size', '')
  from jsonb_array_elements(coalesce(p_damages, '[]'::jsonb)) e;

  insert into public.protocol_damage_photos (damage_id, path)
  select (e ->> 'id')::uuid, ph
  from jsonb_array_elements(coalesce(p_damages, '[]'::jsonb)) e,
       lateral jsonb_array_elements_text(coalesce(e -> 'photos', '[]'::jsonb)) ph;

  return query select 'ok'::text, p_id;
end;
$$;

revoke execute on function public.create_protocol(
  uuid, uuid, int, smallint, timestamptz, boolean, text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.create_protocol(
  uuid, uuid, int, smallint, timestamptz, boolean, text, jsonb, jsonb, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- §6 create_return_protocol — return protocol
-- ---------------------------------------------------------------------------
--
-- Body verbatim from 20260716120000_return_protocol.sql:400-497 plus the locale
-- column. Same 'pl' default and same reasoning as §5.
drop function public.create_return_protocol(uuid, uuid, uuid, int, smallint, timestamptz, boolean, text, jsonb, jsonb);

create function public.create_return_protocol(
  p_id uuid,
  p_reservation_id uuid,
  p_baseline_protocol_id uuid,
  p_odometer_km int,
  p_fuel_eighths smallint,
  p_signed_at timestamptz,
  p_customer_ack boolean,
  p_signature text,
  p_photos jsonb,
  p_damages jsonb,
  p_locale text default 'pl'
)
returns table (
  result text,
  protocol_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_issue_id uuid;
  v_existing uuid;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('employee', 'admin') then
    return query select 'unauthorized'::text, null::uuid;
    return;
  end if;

  -- Lock the reservation for the duration of the transaction (concurrency guard;
  -- status is not re-asserted — a return is filed against an already-issued,
  -- confirmed reservation and reservation_status never changes here).
  perform 1
  from public.reservations r
  where r.id = p_reservation_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  -- Precondition: an issue protocol must exist, and the client-submitted baseline
  -- id must be that issue protocol's id.
  select ip.id into v_issue_id
  from public.protocols ip
  where ip.reservation_id = p_reservation_id and ip.type = 'issue';

  if not found or v_issue_id is distinct from p_baseline_protocol_id then
    return query select 'no_baseline'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.protocols (
      id, reservation_id, type, baseline_protocol_id,
      odometer_km, fuel_eighths, signed_at, signature, customer_ack, created_by, locale
    )
    values (
      p_id, p_reservation_id, 'return', p_baseline_protocol_id,
      p_odometer_km, p_fuel_eighths, p_signed_at, p_signature, p_customer_ack, auth.uid(),
      case when p_locale in ('en', 'pl') then p_locale else 'pl' end
    );
  exception when unique_violation then
    -- Either (reservation_id, 'return') (a second submit) or id (a replay). Both
    -- mean: a return protocol for this reservation already exists.
    select pr.id into v_existing
    from public.protocols pr
    where pr.reservation_id = p_reservation_id and pr.type = 'return';

    return query select 'conflict'::text, v_existing;
    return;
  end;

  insert into public.protocol_photos (protocol_id, slot, path)
  select p_id, (e ->> 'slot')::public.protocol_photo_slot, e ->> 'path'
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) e;

  -- baseline_damage_id: non-null => carried over from that baseline item
  -- (existing), null/absent => new. The value the employee confirmed on the
  -- client is persisted verbatim; the auto-tag only pre-selected it.
  insert into public.protocol_damages (id, protocol_id, type, location, size, baseline_damage_id)
  select
    (e ->> 'id')::uuid,
    p_id,
    (e ->> 'type')::public.protocol_damage_type,
    e ->> 'location',
    nullif(e ->> 'size', ''),
    nullif(e ->> 'baseline_damage_id', '')::uuid
  from jsonb_array_elements(coalesce(p_damages, '[]'::jsonb)) e;

  insert into public.protocol_damage_photos (damage_id, path)
  select (e ->> 'id')::uuid, ph
  from jsonb_array_elements(coalesce(p_damages, '[]'::jsonb)) e,
       lateral jsonb_array_elements_text(coalesce(e -> 'photos', '[]'::jsonb)) ph;

  return query select 'ok'::text, p_id;
end;
$$;

revoke execute on function public.create_return_protocol(
  uuid, uuid, uuid, int, smallint, timestamptz, boolean, text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.create_return_protocol(
  uuid, uuid, uuid, int, smallint, timestamptz, boolean, text, jsonb, jsonb, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- §7 set_profile_locale grants — revoke BEFORE grant, per function, every time
-- ---------------------------------------------------------------------------
revoke execute on function public.set_profile_locale(text) from public, anon;
grant execute on function public.set_profile_locale(text) to authenticated;
