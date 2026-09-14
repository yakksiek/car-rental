-- Demo dataset — a generator plus an hourly "the business kept running" tick.
--
-- Why this exists: the production deployment is a portfolio piece under review.
-- Its staff screens are built around TODAY (pickups whose pickup_date is today,
-- returns due today or overdue), so data loaded once looks alive for one day and
-- then rots: un-handed-over pickups vanish from every board and un-closed
-- returns pile up as overdue. This migration installs the machinery only. It
-- inserts NO rows. Nothing runs until someone calls it:
--
--   select demo.load();      -- once: fleet, team, customers, ~5 months of bookings
--   select demo.tick();      -- hourly via pg_cron (prod only, see
--                            -- context/changes/deployment/demo-dataset-runbook.md)
--   select demo.unload();    -- after the review: removes every generated row
--
-- Everything lives in a private `demo` schema. PostgREST exposes only `public`
-- and `graphql_public`, and USAGE on `demo` is revoked from anon/authenticated,
-- so no app client can reach these functions or tables. They run as the caller
-- (postgres in the SQL editor and in pg_cron) — none is SECURITY DEFINER.
--
-- Registries (`demo.vehicles`, `demo.reservations`, `demo.staff`) record which
-- rows the generator owns. The tick only ever touches registered rows, so a
-- reviewer's own booking or protocol is never completed or decided for them,
-- and `unload()` removes exactly what `load()` and `tick()` created.
--
-- Customer and staff emails are Resend test inboxes (delivered+<label>@resend.dev).
-- A reviewer clicking Approve / Reject / a handover sends real mail through
-- Resend; these addresses accept it without touching the sending domain's
-- reputation.
--
-- Decisions that must be stable across hourly runs (keep this pickup open for a
-- reviewer, let this return run late, reject this request) come from demo.h(),
-- a hash of the row id — never random() — so every run agrees with the last.
-- One-off choices at insert time (durations, customers, odometer drift) use
-- random().
--
-- "Today" is the UTC date, matching `current_date` in list_dispatch_today /
-- list_returns_today. Times of day are Warsaw wall-clock (pickup 14:00, return
-- 10:00), matching the booking window.

create schema if not exists demo;

revoke all on schema demo from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- §1 Tables
-- ---------------------------------------------------------------------------

create table demo.vehicles (
  id uuid primary key references public.vehicles (id) on delete cascade,
  slug text not null unique,
  -- odometer reading at the vehicle's first generated handover
  base_km int not null
);

create table demo.reservations (
  id uuid primary key references public.reservations (id) on delete cascade
);

create table demo.staff (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table demo.customers (
  id int generated always as identity primary key,
  name text not null,
  email text not null unique,
  phone text not null,
  company text,
  vat_id text,
  locale text not null check (locale in ('en', 'pl')),
  -- private | construction | food | auto | events | moving | retail
  segment text not null,
  -- relative booking frequency: a few regulars, many one-off customers
  weight double precision not null
);

create table demo.damage_catalog (
  id int generated always as identity primary key,
  type public.protocol_damage_type not null,
  location text not null,
  size text
);

-- Once-per-hour / once-per-day work keys, so a tick that runs twice in the same
-- hour does not add a second batch of requests or a second horizon top-up.
create table demo.tick_log (
  key text primary key,
  ran_at timestamptz not null default now()
);

alter table demo.vehicles enable row level security;
alter table demo.reservations enable row level security;
alter table demo.staff enable row level security;
alter table demo.customers enable row level security;
alter table demo.damage_catalog enable row level security;
alter table demo.tick_log enable row level security;

revoke all on all tables in schema demo from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- §2 Small helpers
-- ---------------------------------------------------------------------------

-- A stable pseudo-random number in [0, 1) derived from a text key.
create function demo.h(p_key text)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select ('x' || substr(md5(p_key), 1, 8))::bit(32)::bigint / 4294967296.0;
$$;

-- Warsaw wall-clock time on a given day, as a timestamptz.
create function demo.at_local(p_day date, p_hours double precision)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_day::timestamp + make_interval(secs => p_hours * 3600)) at time zone 'Europe/Warsaw';
$$;

-- Lower-case ASCII label for an email local part: "Łukasz Piątek" -> "lukasz.piatek".
create function demo.label(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '.' from regexp_replace(
    translate(lower(p_text), 'ąćęłńóśźżäöüéèáíñç', 'acelnoszzaoueeainc'),
    '[^a-z0-9]+', '.', 'g'
  ));
$$;

-- A Polish NIP (VAT id) with a valid check digit.
create function demo.nip(p_key text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_weights int[] := array[6, 5, 7, 2, 3, 4, 5, 6, 7];
  v_digits int[];
  v_sum int;
  v_salt int := 0;
begin
  loop
    v_digits := array(
      select get_byte(decode(md5(p_key || ':' || v_salt), 'hex'), g) % 10
      from generate_series(0, 8) g
    );
    if v_digits[1] = 0 then
      v_digits[1] := 5;
    end if;
    v_sum := 0;
    for i in 1..9 loop
      v_sum := v_sum + v_digits[i] * v_weights[i];
    end loop;
    if v_sum % 11 <> 10 then
      return array_to_string(v_digits, '') || (v_sum % 11)::text;
    end if;
    v_salt := v_salt + 1;
  end loop;
end;
$$;

-- Rental length in days, by category. Returns >= 1, so return_date > pickup_date
-- always holds (an equal pair fails the generated reserved_period range).
create function demo.duration_days(p_category public.vehicle_category)
returns int
language plpgsql
volatile
set search_path = ''
as $$
declare
  r double precision := random();
begin
  return case p_category
    when 'cargo_van' then
      case when r < 0.32 then 1 when r < 0.60 then 2 when r < 0.82 then 3 + floor(random() * 2)
           when r < 0.96 then 5 + floor(random() * 3) else 14 + floor(random() * 8) end
    when 'passenger_van' then
      case when r < 0.30 then 2 when r < 0.75 then 3 + floor(random() * 2)
           when r < 0.95 then 5 + floor(random() * 3) else 10 + floor(random() * 4) end
    when 'car_transporter' then
      case when r < 0.50 then 1 when r < 0.80 then 2 else 3 + floor(random() * 3) end
    when 'refrigerated_truck' then
      case when r < 0.35 then 1 + floor(random() * 2) when r < 0.75 then 3 + floor(random() * 3)
           when r < 0.94 then 6 + floor(random() * 5) else 28 + floor(random() * 4) end
    else -- flatbed_truck
      case when r < 0.40 then 1 + floor(random() * 2) when r < 0.78 then 3 + floor(random() * 3)
           when r < 0.96 then 6 + floor(random() * 4) else 14 + floor(random() * 8) end
  end::int;
end;
$$;

-- A customer for a booking on this category: pick a segment the category serves,
-- then a customer in it, weighted so regulars come back often.
create function demo.pick_customer(p_category public.vehicle_category)
returns demo.customers
language plpgsql
volatile
set search_path = ''
as $$
declare
  r double precision := random();
  v_segment text;
  v_customer demo.customers;
begin
  v_segment := case p_category
    when 'cargo_van' then
      case when r < 0.40 then 'private' when r < 0.60 then 'moving' when r < 0.80 then 'retail'
           when r < 0.95 then 'construction' else 'events' end
    when 'passenger_van' then
      case when r < 0.45 then 'private' when r < 0.90 then 'events' else 'retail' end
    when 'car_transporter' then
      case when r < 0.70 then 'auto' else 'private' end
    when 'refrigerated_truck' then
      case when r < 0.90 then 'food' else 'events' end
    else
      case when r < 0.75 then 'construction' when r < 0.90 then 'retail' else 'private' end
  end;

  select c.* into v_customer
  from demo.customers c
  where c.segment = v_segment
  order by -ln(1 - random()) / c.weight
  limit 1;

  return v_customer;
end;
$$;

-- An active generated employee to sign a protocol.
create function demo.pick_staff()
returns uuid
language sql
volatile
set search_path = ''
as $$
  select s.user_id
  from demo.staff s
  join public.profiles p on p.user_id = s.user_id
  where p.password_set_at is not null and p.deactivated_at is null
  order by random()
  limit 1;
$$;

create function demo.note(p_segment text, p_locale text)
returns text
language sql
volatile
set search_path = ''
as $$
  select n from (
    select unnest(case
      when p_locale = 'pl' and p_segment = 'private' then array[
        'Przeprowadzka mieszkania 2-pokojowego, proszę o pasy transportowe.',
        'Czy odbiór jest możliwy wcześniej, około 12:00?',
        'Potrzebuję koców do zabezpieczenia mebli.',
        'Zwrot może być w sobotę rano?']
      when p_locale = 'pl' then array[
        'Proszę o fakturę VAT na firmę.',
        'Pojazd odbierze nasz kierowca, dane prześlę mailem.',
        'Faktura zbiorcza na koniec miesiąca, jak ostatnio.',
        'Potrzebny wózek paletowy, jeśli jest dostępny.',
        'Transport na budowę w Łomiankach.']
      when p_segment = 'private' then array[
        'Moving flat — could you add straps and blankets?',
        'Can I pick it up a bit earlier, around noon?',
        'First time renting a van this size, a short walkaround would help.']
      else array[
        'Please invoice the company.',
        'Our driver will collect the vehicle — details to follow by email.',
        'We may need to extend by a day, will confirm.']
    end) n
  ) notes
  order by random()
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- §3 Reference data: fleet, team, customers, damage catalog
-- ---------------------------------------------------------------------------

create function demo.seed_vehicles(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_count int;
begin
  with fleet (
    slug, name, plate, category, make, model, production_year,
    payload_capacity_kg, cargo_length_cm, cargo_width_cm, cargo_height_cm,
    daily_rate, monthly_rate, deposit, per_extra_km_rate, km_limit,
    seats, transmission, is_active, photos
  ) as (values
    -- cargo_van
    ('sprinter-317-l3h2', 'Mercedes-Benz Sprinter 317 CDI L3H2', 'WX 4821K', 'cargo_van', 'Mercedes-Benz', 'Sprinter', 2024,
      1250, 430, 178, 194, 289, 6400, 2500, 1.20, 300, 3, 'automatic', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Mercedes_Sprinter_Foto_2020_Free_image_%2849675960547%29.jpg/960px-Mercedes_Sprinter_Foto_2020_Free_image_%2849675960547%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Mercedes-Benz_Sprinter_%282018%29_IMG_3503.jpg/960px-Mercedes-Benz_Sprinter_%282018%29_IMG_3503.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Mercedes-Benz_Sprinter_VS30_LWB.jpg/960px-Mercedes-Benz_Sprinter_VS30_LWB.jpg'
      ]),
    ('sprinter-315-l2h2', 'Mercedes-Benz Sprinter 315 CDI L2H2', 'WX 6158M', 'cargo_van', 'Mercedes-Benz', 'Sprinter', 2022,
      1350, 360, 178, 194, 249, 5900, 2000, 1.20, 300, 3, 'automatic', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/2019_Mercedes-Benz_Sprinter_314_CDi_2.1.jpg/960px-2019_Mercedes-Benz_Sprinter_314_CDi_2.1.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/2018_Mercedes-Benz_Sprinter_314_CDi_2.1_Front.jpg/960px-2018_Mercedes-Benz_Sprinter_314_CDi_2.1_Front.jpg'
      ]),
    ('crafter-l3h3', 'Volkswagen Crafter 35 L3H3', 'WY 2376C', 'cargo_van', 'Volkswagen', 'Crafter', 2023,
      1180, 450, 175, 213, 269, 6200, 2200, 1.20, 300, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/2018_Volkswagen_Crafter_CR35_Startline_TD_2.0_Front.jpg/960px-2018_Volkswagen_Crafter_CR35_Startline_TD_2.0_Front.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/2017_Volkswagen_Crafter_CR35_Trendline_TD_2.0_Front.jpg/960px-2017_Volkswagen_Crafter_CR35_Trendline_TD_2.0_Front.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/VW_Crafter_IMG_0772.jpg/960px-VW_Crafter_IMG_0772.jpg'
      ]),
    ('transit-l3h2', 'Ford Transit 350 L3H2', 'WZ 71842', 'cargo_van', 'Ford', 'Transit', 2023,
      1270, 372, 178, 186, 239, 5600, 2000, 1.10, 300, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/2015_Ford_Transit_350_LWB_2.2.jpg/960px-2015_Ford_Transit_350_LWB_2.2.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/2018_Ford_Transit_350_2.0_Front.jpg/960px-2018_Ford_Transit_350_2.0_Front.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/2014_Ford_Transit_%28VO%29_350E_van_%282015-06-03%29_01.jpg/960px-2014_Ford_Transit_%28VO%29_350E_van_%282015-06-03%29_01.jpg'
      ]),
    ('transit-custom-van', 'Ford Transit Custom L2H1', 'WPI 52184', 'cargo_van', 'Ford', 'Transit Custom', 2024,
      1080, 292, 175, 140, 189, 4400, 1500, 0.90, 350, 3, 'automatic', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Ford_Transit_Custom_L2_2.0_EcoBlue_%28II%29_%E2%80%93_f_21042025.jpg/960px-Ford_Transit_Custom_L2_2.0_EcoBlue_%28II%29_%E2%80%93_f_21042025.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Ford_Transit_Custom_L1_2.0_EcoBlue_%28II%29_%E2%80%93_f_14022026.jpg/960px-Ford_Transit_Custom_L1_2.0_EcoBlue_%28II%29_%E2%80%93_f_14022026.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Ford_Transit_Custom_%282023%29_1X7A1645.jpg/960px-Ford_Transit_Custom_%282023%29_1X7A1645.jpg'
      ]),
    ('master-l3h2', 'Renault Master L3H2', 'WY 3847K', 'cargo_van', 'Renault', 'Master', 2022,
      1400, 370, 176, 189, 219, 5200, 1800, 1.10, 300, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/2022_Renault_Master_LWB_front.jpg/960px-2022_Renault_Master_LWB_front.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Renault_Master_III_%282019%29_IMG_4211.jpg/960px-Renault_Master_III_%282019%29_IMG_4211.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/2020_Renault_Master_LN35_Business%2B_facelift_2.3.jpg/960px-2020_Renault_Master_LN35_Business%2B_facelift_2.3.jpg'
      ]),
    ('daily-35s-van', 'Iveco Daily 35S16 L4H2', 'WW 9153E', 'cargo_van', 'Iveco', 'Daily', 2021,
      1300, 430, 176, 190, 229, 5400, 1800, 1.10, 300, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/2014_Iveco_Daily_35_S13_MWB_2.3.jpg/960px-2014_Iveco_Daily_35_S13_MWB_2.3.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Iveco_Daily_%282019%29_IMG_5686.jpg/960px-Iveco_Daily_%282019%29_IMG_5686.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Iveco_Daily_35S16A8V_IC371_Auto_Muz_Glatten.jpg/960px-Iveco_Daily_35S16A8V_IC371_Auto_Muz_Glatten.jpg'
      ]),
    ('ducato-maxi', 'Fiat Ducato Maxi L4H2', 'WI 38417', 'cargo_van', 'Fiat', 'Ducato', 2022,
      1500, 407, 187, 188, 209, 4900, 1600, 1.00, 300, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/2016_Fiat_Ducato_Long_Wheelbase_Multijet_van_%282018-11-27%29_01.jpg/960px-2016_Fiat_Ducato_Long_Wheelbase_Multijet_van_%282018-11-27%29_01.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/2017_Fiat_Ducato_35_Multijet_II_2.3.jpg/960px-2017_Fiat_Ducato_35_Multijet_II_2.3.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Fiat_Ducato_Kastenwagen_130_Multijet_%28III%2C_Facelift%29_%E2%80%93_Frontansicht%2C_13._Juli_2014%2C_D%C3%BCsseldorf.jpg/960px-Fiat_Ducato_Kastenwagen_130_Multijet_%28III%2C_Facelift%29_%E2%80%93_Frontansicht%2C_13._Juli_2014%2C_D%C3%BCsseldorf.jpg'
      ]),
    ('boxer-l3h2', 'Peugeot Boxer L3H2', 'WB 6620S', 'cargo_van', 'Peugeot', 'Boxer', 2023,
      1350, 370, 187, 186, 199, 4700, 1500, 1.00, 300, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Moscow%2C_Peugeot_Boxer_white_van%2C_May_2026_01.jpg/960px-Moscow%2C_Peugeot_Boxer_white_van%2C_May_2026_01.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/2014_Peugeot_Boxer_L2H2_-_Fr.jpg/960px-2014_Peugeot_Boxer_L2H2_-_Fr.jpg'
      ]),
    -- passenger_van
    ('transporter-kombi', 'Volkswagen Transporter T6.1 Kombi 9-seater', 'WX 3920P', 'passenger_van', 'Volkswagen', 'Transporter', 2023,
      900, null, null, null, 299, 6900, 2500, 1.30, 350, 9, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Colombier-Saugnieu_-_69124_-_2019.05.07_-_Philibert_-_Volkswagen_Caravelle_n%C2%B0313_%C2%A9_Anthony_Levrot.jpg/960px-Colombier-Saugnieu_-_69124_-_2019.05.07_-_Philibert_-_Volkswagen_Caravelle_n%C2%B0313_%C2%A9_Anthony_Levrot.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Moscow%2C_VW_Transporter_Caravelle_with_rack%2C_Apr_2026_04.jpg/960px-Moscow%2C_VW_Transporter_Caravelle_with_rack%2C_Apr_2026_04.jpg'
      ]),
    ('vito-tourer', 'Mercedes-Benz Vito Tourer 9-seater', 'WX 8840T', 'passenger_van', 'Mercedes-Benz', 'Vito Tourer', 2022,
      850, null, null, null, 319, 7400, 2800, 1.40, 350, 9, 'automatic', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/2022_Mercedes-Benz_Vito_Tourer_116_CDI_front.jpg/960px-2022_Mercedes-Benz_Vito_Tourer_116_CDI_front.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/2019_Mercedes-Benz_Vito_Tourer_SELECT_119_BlueTec_2.1.jpg/960px-2019_Mercedes-Benz_Vito_Tourer_SELECT_119_BlueTec_2.1.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Mercedes_Benz_Vito_Tourer_2017_%2854460388598%29.jpg/960px-Mercedes_Benz_Vito_Tourer_2017_%2854460388598%29.jpg'
      ]),
    ('transit-custom-kombi', 'Ford Transit Custom Kombi 9-seater', 'WZ 4H731', 'passenger_van', 'Ford', 'Transit Custom Kombi', 2023,
      880, null, null, null, 279, 6500, 2200, 1.30, 350, 9, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Ford_Tourneo_Custom_Kombi_2.2_TDCi_Trend_%28VII%29_%E2%80%93_Frontansicht%2C_28._Juli_2013%2C_M%C3%BCnster.jpg/960px-Ford_Tourneo_Custom_Kombi_2.2_TDCi_Trend_%28VII%29_%E2%80%93_Frontansicht%2C_28._Juli_2013%2C_M%C3%BCnster.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Ford_Tourneo_Custom_2.0_EcoBlue_AWD_Active_%28II%29_%E2%80%93_f_05072025.jpg/960px-Ford_Tourneo_Custom_2.0_EcoBlue_AWD_Active_%28II%29_%E2%80%93_f_05072025.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Ford_Tourneo_Custom_Active_1X7A6408.jpg/960px-Ford_Tourneo_Custom_Active_1X7A6408.jpg'
      ]),
    ('trafic-passenger', 'Renault Trafic Passenger 9-seater', 'WPR 26480', 'passenger_van', 'Renault', 'Trafic', 2021,
      870, null, null, null, 249, 5800, 2000, 1.20, 350, 9, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Renault_Trafic_III_buses_Facelift_IMG_7691_%28cropped%29.jpg/960px-Renault_Trafic_III_buses_Facelift_IMG_7691_%28cropped%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Renault_van_with_CoA%2C_2020_Balatonm%C3%A1riaf%C3%BCrd%C5%91_%28cropped%29.jpg/960px-Renault_van_with_CoA%2C_2020_Balatonm%C3%A1riaf%C3%BCrd%C5%91_%28cropped%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Renault_Trafic_III_buses_Facelift_1X7A7456_%28cropped%29.jpg/960px-Renault_Trafic_III_buses_Facelift_1X7A7456_%28cropped%29.jpg'
      ]),
    -- car_transporter
    ('daily-transporter', 'Iveco Daily 70C18 Car Transporter', 'WY 8061L', 'car_transporter', 'Iveco', 'Daily 70C18', 2021,
      3100, 600, 210, null, 369, 8600, 3000, 1.80, 250, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Iveco_Daily_70-170_H._Trautwein.jpg/960px-Iveco_Daily_70-170_H._Trautwein.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Iveco_Daily_70_C_17_Abschleppwagen_%2801%29.jpg/960px-Iveco_Daily_70_C_17_Abschleppwagen_%2801%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Iveco_Daily_Tevor_%281%29.jpg/960px-Iveco_Daily_Tevor_%281%29.jpg'
      ]),
    ('sprinter-transporter', 'Mercedes-Benz Sprinter 516 CDI Car Transporter', 'WY 5519L', 'car_transporter', 'Mercedes-Benz', 'Sprinter 516', 2017,
      2300, 550, 210, null, 349, 8200, 3000, 1.80, 250, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Mercedes-Benz_Sprinter_Doka_Algema_Blitzlader_R.jpg/960px-Mercedes-Benz_Sprinter_Doka_Algema_Blitzlader_R.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Transport_autoturism_electric_pe_platforma_auto_de_tip_%22flatbed%22.jpg/960px-Transport_autoturism_electric_pe_platforma_auto_de_tip_%22flatbed%22.jpg'
      ]),
    ('movano-transporter', 'Opel Movano Car Transporter', 'WN 1A447', 'car_transporter', 'Opel', 'Movano', 2020,
      1650, 510, 205, null, 329, 7600, 2500, 1.60, 250, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/2010_09_27_Hannover_110120_%288600658200%29.jpg/960px-2010_09_27_Hannover_110120_%288600658200%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/2010_09_27_Hannover_110012_%288599556781%29.jpg/960px-2010_09_27_Hannover_110012_%288599556781%29.jpg'
      ]),
    -- refrigerated_truck (two names stay Polish, as in seed.sql: user-entered
    -- text is never translated, so a Polish value in English chrome is correct)
    ('tgl-reefer', 'MAN TGL 12.250 Chłodnia', 'WX 4472R', 'refrigerated_truck', 'MAN', 'TGL 12.250', 2021,
      4800, 720, 245, 240, 469, 10900, 4000, 2.10, 250, 3, 'automatic', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/ATB_Truck_in_Dnipro.jpg/960px-ATB_Truck_in_Dnipro.jpg'
      ]),
    ('atego-reefer', 'Mercedes-Benz Atego 1224 Refrigerated', 'WX 6093A', 'refrigerated_truck', 'Mercedes-Benz', 'Atego 1224', 2020,
      5200, 740, 246, 235, 449, 10500, 4000, 2.00, 250, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Mercedes-Benz_Atego_1223_K%C3%BChltransporter_in_Blexen_%28Nordenham%2C_2025%29.jpg/960px-Mercedes-Benz_Atego_1223_K%C3%BChltransporter_in_Blexen_%28Nordenham%2C_2025%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Brakes_Y596UHR_%284405083344%29.jpg/960px-Brakes_Y596UHR_%284405083344%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Mercedes_Atego.jpg/960px-Mercedes_Atego.jpg'
      ]),
    ('daily-reefer', 'Iveco Daily 70C18 Refrigerated', 'WW 2271F', 'refrigerated_truck', 'Iveco', 'Daily 70C18', 2022,
      3000, 480, 220, 215, 389, 9200, 3500, 1.80, 250, 3, 'automatic', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Iveco_Daily_Knold%27s_Seafood.jpg/960px-Iveco_Daily_Knold%27s_Seafood.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Mathem_i_Huddinge_20221111.jpg/960px-Mathem_i_Huddinge_20221111.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Moscow%2C_Iveco_truck%2C_May_2026_01.jpg/960px-Moscow%2C_Iveco_truck%2C_May_2026_01.jpg'
      ]),
    ('master-reefer', 'Renault Master Refrigerated L3H2', 'WPI 8305M', 'refrigerated_truck', 'Renault', 'Master', 2023,
      1150, 340, 170, 175, 299, 7000, 2500, 1.40, 300, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/9/9b/Molokozavod_N1_truck_in_Dnipro.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Camion_de_livraison_Bouillet_%C3%A0_Bouillet_Miribel_%28Ain%29_en_d%C3%A9cembre_2023.jpg/960px-Camion_de_livraison_Bouillet_%C3%A0_Bouillet_Miribel_%28Ain%29_en_d%C3%A9cembre_2023.jpg'
      ]),
    -- flatbed_truck
    ('scania-p310-flatbed', 'Scania P310 Skrzyniowy z HDS', 'WX 9175S', 'flatbed_truck', 'Scania', 'P310', 2019,
      7400, 720, 248, null, 549, 12900, 5000, 2.40, 200, 2, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/VU97245_%2817.11.17%2C_Motorvej_501%2C_Viby_J%29DSC_0355_Balancer_%2841425218744%29.jpg/960px-VU97245_%2817.11.17%2C_Motorvej_501%2C_Viby_J%29DSC_0355_Balancer_%2841425218744%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/XD95576_%2818.07.03%2C_Motorvej_501%2C_Viby_J%29DSC_4217_Balancer_%2840182121073%29.jpg/960px-XD95576_%2818.07.03%2C_Motorvej_501%2C_Viby_J%29DSC_4217_Balancer_%2840182121073%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/The_Forfar_Roof_Truss_Company_-_geograph.org.uk_-_8111086.jpg/960px-The_Forfar_Roof_Truss_Company_-_geograph.org.uk_-_8111086.jpg'
      ]),
    ('volvo-fl-flatbed', 'Volvo FL 240 Dropside', 'WX 1257V', 'flatbed_truck', 'Volvo', 'FL 240', 2020,
      6500, 620, 248, null, 499, 11800, 5000, 2.30, 200, 3, 'automatic', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/VU88688_%2812.03.21%29_Balancer_%2836585554311%29.jpg/960px-VU88688_%2812.03.21%29_Balancer_%2836585554311%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/UZ92447_%2817.05.02%2C_Motorvej_501%2C_Viby%29DSC_5895_Balancer_%2838344004106%29.jpg/960px-UZ92447_%2817.05.02%2C_Motorvej_501%2C_Viby%29DSC_5895_Balancer_%2838344004106%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/XD95913_%2816.09.14%2C_Marselis_Boulevard%2C_Kongsvang_All%C3%A9%29DSC_5398_Balancer_%2838166127162%29.jpg/960px-XD95913_%2816.09.14%2C_Marselis_Boulevard%2C_Kongsvang_All%C3%A9%29DSC_5398_Balancer_%2838166127162%29.jpg'
      ]),
    ('daf-lf-flatbed', 'DAF LF 290 Dropside', 'WY 7704D', 'flatbed_truck', 'DAF', 'LF 290', 2021,
      7200, 720, 248, null, 509, 12000, 5000, 2.30, 200, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/132-365_DAF_LF_Dropside_truck.jpg/960px-132-365_DAF_LF_Dropside_truck.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/DAF_LF_Euro_6.jpg/960px-DAF_LF_Euro_6.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/VP91819_%2812.10.10%29_Optimizer_%2836433652884%29.jpg/960px-VP91819_%2812.10.10%29_Optimizer_%2836433652884%29.jpg'
      ]),
    ('daily-dropside', 'Iveco Daily 72C18 Dropside with Tarpaulin', 'WZ 6T913', 'flatbed_truck', 'Iveco', 'Daily 72C18', 2022,
      3900, 520, 220, 230, 349, 8200, 3000, 1.70, 250, 3, 'manual', true, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Iveco_truck_in_Belarus_6.jpg/960px-Iveco_truck_in_Belarus_6.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/IVECO_Daily_GSP_Beograd-7636.jpg/960px-IVECO_Daily_GSP_Beograd-7636.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Nufam_2023%2C_Rheinstetten_%28P1130517%29.jpg/960px-Nufam_2023%2C_Rheinstetten_%28P1130517%29.jpg'
      ]),
    -- retired
    ('ducato-retired', 'Fiat Ducato L2H2 (retired)', 'WE 2276D', 'cargo_van', 'Fiat', 'Ducato', 2016,
      1200, 320, 170, 185, 179, 4200, 1500, 1.00, 300, 3, 'manual', false, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/2008_Fiat_Ducato_33_120_Multijet_MWB_2.3_Front.jpg/960px-2008_Fiat_Ducato_33_120_Multijet_MWB_2.3_Front.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Fiat_Ducato_130_MultiJet_Cargo_2013_%2815567419710%29.jpg/960px-Fiat_Ducato_130_MultiJet_Cargo_2013_%2815567419710%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Fiat_Ducato-Maxi.jpg/960px-Fiat_Ducato-Maxi.jpg'
      ]),
    ('movano-retired', 'Opel Movano L2H2 (retired)', 'WE 90413', 'cargo_van', 'Opel', 'Movano', 2015,
      1250, 330, 176, 188, 169, 3900, 1500, 1.00, 300, 3, 'manual', false, array[
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/2015_Vauxhall_Movano_R3500_L4H3_CDTi_2.3_Front.jpg/960px-2015_Vauxhall_Movano_R3500_L4H3_CDTi_2.3_Front.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Opel_Movano_B_front_20100705.jpg/960px-Opel_Movano_B_front_20100705.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/2020_Vauxhall_Movano_L3H2_F3500_CDTi_facelift_2.3.jpg/960px-2020_Vauxhall_Movano_L3H2_F3500_CDTi_facelift_2.3.jpg'
      ])
  ),
  inserted as (
    insert into public.vehicles (
      name, plate, category, make, model, production_year, fuel_type,
      payload_capacity_kg, cargo_length_cm, cargo_width_cm, cargo_height_cm,
      photos, daily_rate, monthly_rate, deposit, per_extra_km_rate, km_limit,
      seats, transmission, is_active, created_at, updated_at
    )
    select
      f.name, f.plate, f.category::public.vehicle_category, f.make, f.model, f.production_year, 'diesel',
      f.payload_capacity_kg, f.cargo_length_cm, f.cargo_width_cm, f.cargo_height_cm,
      f.photos, f.daily_rate, f.monthly_rate, f.deposit, f.per_extra_km_rate, f.km_limit,
      f.seats, f.transmission::public.transmission_type, f.is_active,
      p_now - make_interval(days => 110 + (demo.h(f.slug) * 60)::int),
      p_now - make_interval(days => (demo.h(f.slug || ':u') * 30)::int)
    from fleet f
    returning id, plate
  )
  insert into demo.vehicles (id, slug, base_km)
  select i.id, f.slug,
    -- ~40,000 km a year of age, plus a per-vehicle offset
    greatest(3000, (2026 - f.production_year) * 40000 + (demo.h(f.slug || ':km') * 18000)::int)
  from inserted i
  join fleet f on f.plate = i.plate;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function demo.seed_staff(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  s record;
  v_id uuid;
  v_email text;
  v_count int := 0;
begin
  for s in
    select * from (values
      ('Magdalena Lewandowska', 'admin', true, 240, 0.2),
      ('Agata Zielińska', 'employee', true, 210, 0.1),
      ('Bartłomiej Nowicki', 'employee', true, 180, 1.0),
      ('Krzysztof Sadowski', 'employee', true, 150, 3.0),
      ('Paweł Kaczmarek', 'employee', true, 95, 0.4),
      ('Weronika Dąbrowska', 'employee', false, 3, null),
      ('Igor Kalinowski', 'employee', false, 1, null)
    ) t(full_name, role, active, joined_days_ago, last_seen_days_ago)
  loop
    v_email := 'delivered+' || demo.label(s.full_name) || '@resend.dev';
    continue when exists (select 1 from auth.users u where u.email = v_email);

    v_id := gen_random_uuid();

    -- Active: a random, never-disclosed password (nobody can sign in as them).
    -- Invited: no password and no identity, the shape of an unaccepted invite.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, invited_at, last_sign_in_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      case when s.active then extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')) else '' end,
      case when s.active then p_now - make_interval(days => s.joined_days_ago) end,
      p_now - make_interval(days => s.joined_days_ago),
      case when s.active then p_now - make_interval(secs => s.last_seen_days_ago * 86400) end,
      p_now - make_interval(days => s.joined_days_ago),
      p_now - make_interval(days => s.joined_days_ago),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', s.full_name),
      '', '', '', ''
    );

    insert into public.profiles (user_id, role, full_name, password_set_at, created_at, updated_at)
    values (
      v_id, s.role::public.app_role, s.full_name,
      case when s.active then p_now - make_interval(days => s.joined_days_ago) + interval '40 minutes' end,
      p_now - make_interval(days => s.joined_days_ago),
      p_now - make_interval(days => s.joined_days_ago)
    );

    insert into demo.staff (user_id) values (v_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create function demo.seed_customers()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_first_m text[] := array['Jan', 'Piotr', 'Tomasz', 'Krzysztof', 'Michał', 'Paweł', 'Marcin', 'Adam',
    'Łukasz', 'Grzegorz', 'Jakub', 'Mateusz', 'Rafał', 'Wojciech', 'Kamil', 'Bartosz', 'Dariusz',
    'Robert', 'Sebastian', 'Szymon'];
  v_first_f text[] := array['Anna', 'Katarzyna', 'Magdalena', 'Agnieszka', 'Monika', 'Joanna',
    'Aleksandra', 'Ewa', 'Natalia', 'Karolina', 'Marta', 'Dorota', 'Justyna', 'Paulina', 'Izabela'];
  -- male form, female form
  v_last text[][] := array[
    ['Nowak', 'Nowak'], ['Kowalski', 'Kowalska'], ['Wiśniewski', 'Wiśniewska'], ['Wójcik', 'Wójcik'],
    ['Kowalczyk', 'Kowalczyk'], ['Kamiński', 'Kamińska'], ['Lewandowski', 'Lewandowska'],
    ['Zieliński', 'Zielińska'], ['Szymański', 'Szymańska'], ['Woźniak', 'Woźniak'],
    ['Dąbrowski', 'Dąbrowska'], ['Kozłowski', 'Kozłowska'], ['Jankowski', 'Jankowska'],
    ['Kwiatkowski', 'Kwiatkowska'], ['Krawczyk', 'Krawczyk'], ['Piotrowski', 'Piotrowska'],
    ['Grabowski', 'Grabowska'], ['Pawłowski', 'Pawłowska'], ['Michalski', 'Michalska'],
    ['Adamczyk', 'Adamczyk'], ['Dudek', 'Dudek'], ['Zając', 'Zając'], ['Wieczorek', 'Wieczorek'],
    ['Król', 'Król'], ['Majewski', 'Majewska'], ['Olszewski', 'Olszewska'], ['Jaworski', 'Jaworska'],
    ['Malinowski', 'Malinowska'], ['Pawlak', 'Pawlak'], ['Witkowski', 'Witkowska'],
    ['Walczak', 'Walczak'], ['Stępień', 'Stępień'], ['Górski', 'Górska'], ['Rutkowski', 'Rutkowska'],
    ['Sikora', 'Sikora'], ['Ostrowski', 'Ostrowska'], ['Baran', 'Baran'], ['Szewczyk', 'Szewczyk'],
    ['Tomaszewski', 'Tomaszewska'], ['Pietrzak', 'Pietrzak'], ['Marciniak', 'Marciniak'],
    ['Zalewski', 'Zalewska'], ['Jakubowski', 'Jakubowska'], ['Czarnecki', 'Czarnecka']];
  v_i int;
  v_female boolean;
  v_last_idx int;
  v_name text;
  v_count int;
begin
  -- Polish private customers
  for v_i in 1..80 loop
    v_female := demo.h('pl-f:' || v_i) < 0.45;
    v_last_idx := 1 + floor(demo.h('pl-l:' || v_i) * array_length(v_last, 1))::int;
    v_name := case when v_female
      then v_first_f[1 + floor(demo.h('pl-n:' || v_i) * array_length(v_first_f, 1))::int] || ' ' || v_last[v_last_idx][2]
      else v_first_m[1 + floor(demo.h('pl-n:' || v_i) * array_length(v_first_m, 1))::int] || ' ' || v_last[v_last_idx][1]
    end;
    insert into demo.customers (name, email, phone, locale, segment, weight)
    values (
      v_name,
      'delivered+' || demo.label(v_name) || '@resend.dev',
      '+48' || (5 + floor(demo.h('pl-p:' || v_i) * 3))::int || lpad((floor(demo.h('pl-q:' || v_i) * 100000000))::int::text, 8, '0'),
      'pl', 'private', 0.3 + demo.h('pl-w:' || v_i) * 1.2
    )
    on conflict (email) do nothing;
  end loop;

  -- English-speaking private customers (expats and visitors in Warsaw)
  insert into demo.customers (name, email, phone, locale, segment, weight)
  select n, 'delivered+' || demo.label(n) || '@resend.dev',
    '+48' || (5 + floor(demo.h('en-p:' || n) * 3))::int || lpad((floor(demo.h('en-q:' || n) * 100000000))::int::text, 8, '0'),
    'en', 'private', 0.3 + demo.h('en-w:' || n)
  from unnest(array['James Mitchell', 'Sarah Thompson', 'Oliver Bennett', 'Emma Clarke', 'Lukas Schneider',
    'Julia Hoffmann', 'Olena Kovalenko', 'Dmytro Bondarenko', 'Iryna Melnyk', 'Marco Rossi',
    'Giulia Romano', 'Pierre Dubois', 'Camille Laurent', 'Daniel O''Connor', 'Hannah Weber',
    'Mateo García', 'Lucía Fernández', 'Tom Andersen', 'Sofia Lindqvist', 'Ethan Brooks',
    'Chloe Harris', 'Viktor Novák', 'Petra Horváth', 'Noah Fischer']) n
  on conflict (email) do nothing;

  -- Companies: a contact person, a company name, a valid NIP. Regulars weigh more.
  insert into demo.customers (name, email, phone, company, vat_id, locale, segment, weight)
  select c.contact, 'delivered+' || demo.label(c.mailbox) || '@resend.dev',
    '+48' || (5 + floor(demo.h('co-p:' || c.company) * 3))::int || lpad((floor(demo.h('co-q:' || c.company) * 100000000))::int::text, 8, '0'),
    c.company, demo.nip(c.company), c.locale, c.segment, c.weight
  from (values
    ('construction', 'Budmax Sp. z o.o.', 'Krzysztof Wieczorek', 'biuro.budmax', 'pl', 3.0),
    ('construction', 'Trans-Bud Sp. z o.o.', 'Rafał Kozłowski', 'kontakt.transbud', 'pl', 2.5),
    ('construction', 'Remonty Kowalczyk s.c.', 'Adam Kowalczyk', 'remonty.kowalczyk', 'pl', 1.2),
    ('construction', 'Dach-Pol Sp. z o.o.', 'Sebastian Górski', 'zamowienia.dachpol', 'pl', 1.5),
    ('construction', 'Instal-Serwis Wieczorek', 'Dariusz Wieczorek', 'instal.serwis', 'pl', 0.8),
    ('construction', 'Brukarstwo Zając', 'Wojciech Zając', 'brukarstwo.zajac', 'pl', 1.0),
    ('construction', 'Mazowieckie Konstrukcje Stalowe Sp. z o.o.', 'Grzegorz Ostrowski', 'logistyka.mks', 'pl', 2.0),
    ('food', 'Chłodnie Mazowsze Sp. z o.o.', 'Monika Pietrzak', 'dyspozytor.chlodniemazowsze', 'pl', 3.0),
    ('food', 'Piekarnia Pod Kłosem', 'Ewa Marciniak', 'piekarnia.podklosem', 'pl', 1.5),
    ('food', 'Catering Smakosz s.c.', 'Paulina Walczak', 'catering.smakosz', 'pl', 2.0),
    ('food', 'Świeże Warzywa Hurt Sp. z o.o.', 'Tomasz Baran', 'hurt.swiezewarzywa', 'pl', 2.5),
    ('food', 'Lody Artigiano', 'Marco Bellini', 'artigiano', 'en', 0.8),
    ('food', 'Mleczarnia Łowicka Dystrybucja', 'Justyna Sikora', 'dystrybucja.mleczarnia', 'pl', 1.8),
    ('food', 'Kwiaciarnia Floris', 'Izabela Król', 'floris', 'pl', 0.7),
    ('food', 'FreshBox Catering Sp. z o.o.', 'Emily Carter', 'ops.freshbox', 'en', 1.4),
    ('auto', 'Auto-Handel Piotrowski', 'Marcin Piotrowski', 'autohandel.piotrowski', 'pl', 2.5),
    ('auto', 'Serwis Aut Jaworski', 'Kamil Jaworski', 'serwis.jaworski', 'pl', 1.5),
    ('auto', 'Carmax Import Sp. z o.o.', 'Bartosz Malinowski', 'import.carmax', 'pl', 2.0),
    ('auto', 'Laweta24 Pomoc Drogowa', 'Robert Dudek', 'laweta24', 'pl', 1.2),
    ('auto', 'Klasyki Garage Warszawa', 'Michał Olszewski', 'klasyki.garage', 'pl', 0.6),
    ('events', 'EventPro Agencja Eventowa', 'Aleksandra Rutkowska', 'produkcja.eventpro', 'pl', 2.2),
    ('events', 'Scena Mobilna Sp. z o.o.', 'Szymon Tomaszewski', 'technika.scenamobilna', 'pl', 1.6),
    ('events', 'Wesela z Klasą', 'Karolina Zalewska', 'weselazklasa', 'pl', 0.8),
    ('events', 'Nordic Tours Polska', 'Erik Johansson', 'bookings.nordictours', 'en', 1.2),
    ('events', 'Team Up Integracje Firmowe', 'Marta Jakubowska', 'teamup', 'pl', 1.0),
    ('moving', 'Przeprowadzki Express Sp. z o.o.', 'Paweł Szewczyk', 'zlecenia.przeprowadzkiexpress', 'pl', 2.8),
    ('moving', 'Meble Nowak s.c.', 'Agnieszka Nowak', 'meble.nowak', 'pl', 1.5),
    ('moving', 'MovEasy Relocations', 'David Walsh', 'hello.moveasy', 'en', 1.3),
    ('moving', 'Archiwum Plus Sp. z o.o.', 'Dorota Czarnecka', 'archiwumplus', 'pl', 0.9),
    ('retail', 'Kurier Ekspres Mazowsze', 'Mateusz Pawlak', 'flota.kurierekspres', 'pl', 2.5),
    ('retail', 'Hurtownia Budowlana Wola', 'Jakub Stępień', 'hurtownia.wola', 'pl', 1.8),
    ('retail', 'E-Sklep Dom i Ogród', 'Natalia Kwiatkowska', 'esklep.domiogrod', 'pl', 1.2),
    ('retail', 'Baltic Supply Chain Sp. z o.o.', 'Anders Nilsson', 'transport.balticsupply', 'en', 1.6),
    ('retail', 'Green Office Solutions', 'Laura Schmidt', 'facilities.greenoffice', 'en', 0.9)
  ) c(segment, company, contact, mailbox, locale, weight)
  on conflict (email) do nothing;

  select count(*) into v_count from demo.customers;
  return v_count;
end;
$$;

create function demo.seed_damage_catalog()
returns void
language sql
set search_path = ''
as $$
  insert into demo.damage_catalog (type, location, size) values
    ('scratch', 'Lewe przednie drzwi — rysa na lakierze', '~6 cm'),
    ('scratch', 'Prawy tylny błotnik — zarysowanie', '~12 cm'),
    ('scratch', 'Tylny zderzak — otarcie przy stopniu', '~15 cm'),
    ('scratch', 'Prawe lusterko — rysa na obudowie', '~4 cm'),
    ('scratch', 'Drzwi przesuwne — zarysowanie przy klamce', '~8 cm'),
    ('scratch', 'Lewy bok przestrzeni ładunkowej — rysy', '~20 cm'),
    ('dent', 'Tylne drzwi — niewielkie wgniecenie', '~3 cm'),
    ('dent', 'Prawy próg — wgniecenie', '~5 cm'),
    ('dent', 'Lewy tylny narożnik — wgniecenie po słupku', '~7 cm'),
    ('crack', 'Szyba czołowa — odprysk od kamienia', '~1 cm'),
    ('crack', 'Lewa lampa tylna — pęknięty klosz', '~5 cm'),
    ('crack', 'Nakładka zderzaka przedniego — pęknięcie', '~6 cm'),
    ('missing', 'Kołpak prawego tylnego koła — brak', null),
    ('missing', 'Zaślepka haka holowniczego — brak', null);
$$;

-- ---------------------------------------------------------------------------
-- §4 Bookings
-- ---------------------------------------------------------------------------

-- Lay a back-to-back timeline of confirmed bookings on one vehicle between two
-- dates. Bookings thin out further in the future, like a real order book.
-- p_pending_share: the share of public bookings 2-30 days out that are turned
-- into fresh, still-undecided requests instead (load() only).
create function demo.fill_vehicle(
  p_vehicle uuid,
  p_from date,
  p_to date,
  p_now timestamptz,
  p_pending_share double precision default 0
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'UTC')::date;
  v_category public.vehicle_category;
  v_day date := p_from;
  v_gap int;
  v_pickup date;
  v_return date;
  v_customer demo.customers;
  v_manual boolean;
  v_pending boolean;
  v_created timestamptz;
  v_decided timestamptz;
  v_id uuid;
  v_r double precision;
  v_count int := 0;
begin
  select v.category into v_category from public.vehicles v where v.id = p_vehicle;

  loop
    v_r := random();
    v_gap := case when v_r < 0.38 then 0 when v_r < 0.70 then 1 when v_r < 0.88 then 2
                  when v_r < 0.96 then 3 + floor(random() * 2) else 5 + floor(random() * 3) end;
    if v_day > v_today + 14 then
      v_gap := v_gap + floor(random() * 3)::int;
    end if;
    if v_day > v_today + 28 then
      v_gap := v_gap + floor(random() * 6)::int;
    end if;

    v_pickup := v_day + v_gap;
    exit when v_pickup > p_to;
    v_return := v_pickup + demo.duration_days(v_category);

    v_customer := demo.pick_customer(v_category);
    -- Companies phone in more often; staff-entered bookings carry no company fields.
    v_manual := random() < case when v_customer.company is not null then 0.35 else 0.15 end;
    v_pending := not v_manual
      and v_pickup between v_today + 2 and v_today + 30
      and random() < p_pending_share;

    if v_pending then
      v_created := p_now - make_interval(secs => random() * 40 * 3600);
    else
      v_r := random();
      v_created := demo.at_local(
        v_pickup - case when v_r < 0.25 then 1 + floor(random() * 3) when v_r < 0.70 then 4 + floor(random() * 11)
                        else 15 + floor(random() * 26) end::int,
        7 + random() * 14
      );
      v_created := least(v_created, p_now - make_interval(secs => 3600 + random() * 5 * 86400));
    end if;

    begin
      insert into public.reservations (
        vehicle_id, customer_name, customer_email, customer_phone,
        pickup_date, return_date, status, source, locale,
        company, vat_id, notes,
        terms_accepted_at, terms_version, terms_locale,
        created_at, updated_at
      ) values (
        p_vehicle, v_customer.name, v_customer.email, v_customer.phone,
        v_pickup, v_return,
        case when v_pending then 'pending' else 'confirmed' end::public.reservation_status,
        case when v_manual then 'manual' else 'public' end::public.reservation_source,
        v_customer.locale,
        case when not v_manual then v_customer.company end,
        case when not v_manual then v_customer.vat_id end,
        case when not v_manual and random() < 0.18 then demo.note(v_customer.segment, v_customer.locale) end,
        case when not v_manual then v_created end,
        -- the /terms page (and its version stamp) shipped on 2026-09-03
        case when not v_manual and v_created >= '2026-09-03' then 'sample-1.0' end,
        case when not v_manual and v_created >= '2026-09-03' then v_customer.locale end,
        v_created, v_created
      )
      returning id into v_id;
    exception when exclusion_violation then
      -- Someone else (a reviewer, or an existing row) holds this slot: move on.
      v_day := v_pickup + 1;
      continue;
    end;

    insert into demo.reservations (id) values (v_id);

    if not v_pending then
      -- The confirmation email: instant for staff-entered bookings, within a
      -- working day for website requests.
      v_decided := case when v_manual then v_created + interval '1 minute'
                        else v_created + make_interval(secs => (0.3 + random() * 16) * 3600) end;
      v_decided := least(v_decided, p_now);
      insert into public.email_deliveries (entity_type, entity_id, template, recipient, status, created_at)
      values ('reservation', v_id, 'reservation_confirmed', v_customer.email, 'sent', v_decided);

      -- A few requests for the same slot arrived after it was taken and were declined.
      if not v_manual and random() < 0.07 then
        perform demo.add_declined(p_vehicle, v_pickup, v_return, v_created, p_now);
      end if;
    end if;

    v_count := v_count + 1;
    v_day := v_return;
  end loop;

  return v_count;
end;
$$;

-- A declined or cancelled request overlapping a taken slot. Non-blocking statuses
-- sit outside the no-overlap constraint, so these never collide.
create function demo.add_declined(
  p_vehicle uuid,
  p_pickup date,
  p_return date,
  p_after timestamptz,
  p_now timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_category public.vehicle_category;
  v_customer demo.customers;
  v_created timestamptz;
  v_decided timestamptz;
  v_reason text;
  v_cancelled boolean := random() < 0.25;
  v_id uuid;
  v_r double precision := random();
begin
  select v.category into v_category from public.vehicles v where v.id = p_vehicle;
  v_customer := demo.pick_customer(v_category);
  v_created := least(p_after + make_interval(secs => (2 + random() * 70) * 3600), p_now - interval '3 hours');
  v_decided := least(v_created + make_interval(secs => (1 + random() * 20) * 3600), p_now);
  v_reason := case when v_r < 0.55 then 'dates_unavailable' when v_r < 0.75 then 'no_category'
                   when v_r < 0.85 then 'vehicle_withdrawn' else 'other' end;

  insert into public.reservations (
    vehicle_id, customer_name, customer_email, customer_phone,
    pickup_date, return_date, status, source, locale,
    company, vat_id, rejection_reason, rejection_note,
    terms_accepted_at, terms_version, terms_locale, created_at, updated_at
  ) values (
    p_vehicle, v_customer.name, v_customer.email, v_customer.phone,
    p_pickup + floor(random() * 2)::int, p_return + 1 + floor(random() * 2)::int,
    case when v_cancelled then 'cancelled' else 'rejected' end::public.reservation_status,
    'public', v_customer.locale, v_customer.company, v_customer.vat_id,
    case when not v_cancelled then v_reason end,
    case when not v_cancelled and v_reason = 'other' then
      case when v_customer.locale = 'pl'
        then 'Pojazd wymaga prawa jazdy kat. C — prosimy o kontakt, zaproponujemy mniejsze auto.'
        else 'This vehicle needs a category C licence — call us and we will suggest a smaller one.' end
    end,
    v_created,
    case when v_created >= '2026-09-03' then 'sample-1.0' end,
    case when v_created >= '2026-09-03' then v_customer.locale end,
    v_created, v_decided
  )
  returning id into v_id;

  insert into demo.reservations (id) values (v_id);

  if not v_cancelled then
    insert into public.email_deliveries (entity_type, entity_id, template, recipient, status, created_at)
    values ('reservation', v_id, 'reservation_rejected', v_customer.email, 'sent', v_decided);
  end if;
end;
$$;

-- Stamp references on generated rows that have none, in created_at order, from
-- the same sequence the booking RPCs use — then move the sequence past them.
create function demo.assign_references()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_count int;
  v_base bigint;
begin
  select count(*) into v_count
  from public.reservations r
  join demo.reservations d on d.id = r.id
  where r.reference is null;

  if v_count = 0 then
    return 0;
  end if;

  v_base := nextval('public.reservation_reference_seq');

  update public.reservations r
  set reference = 'R-' || public.base36_encode(v_base + o.rn - 1)
  from (
    select r2.id, row_number() over (order by r2.created_at, r2.id) rn
    from public.reservations r2
    join demo.reservations d on d.id = r2.id
    where r2.reference is null
  ) o
  where r.id = o.id;

  perform setval('public.reservation_reference_seq', v_base + v_count - 1);
  return v_count;
end;
$$;

-- A new website request for a free slot 2-27 days out, submitted just now.
create function demo.add_request(p_now timestamptz)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'UTC')::date;
  v_vehicle record;
  v_customer demo.customers;
  v_pickup date;
  v_created timestamptz := p_now - make_interval(secs => random() * 50 * 60);
  v_id uuid;
begin
  for attempt in 1..15 loop
    select v.id, v.category into v_vehicle
    from public.vehicles v
    join demo.vehicles dv on dv.id = v.id
    where v.is_active
    order by random()
    limit 1;

    exit when not found;

    v_customer := demo.pick_customer(v_vehicle.category);
    v_pickup := v_today + 2 + floor(random() * 26)::int;

    begin
      insert into public.reservations (
        vehicle_id, customer_name, customer_email, customer_phone,
        pickup_date, return_date, status, source, reference, locale,
        company, vat_id, notes,
        terms_accepted_at, terms_version, terms_locale, created_at, updated_at
      ) values (
        v_vehicle.id, v_customer.name, v_customer.email, v_customer.phone,
        v_pickup, v_pickup + demo.duration_days(v_vehicle.category), 'pending', 'public',
        'R-' || public.base36_encode(nextval('public.reservation_reference_seq')),
        v_customer.locale, v_customer.company, v_customer.vat_id,
        case when random() < 0.25 then demo.note(v_customer.segment, v_customer.locale) end,
        v_created, 'sample-1.0', v_customer.locale, v_created, v_created
      )
      returning id into v_id;
    exception when exclusion_violation then
      continue;
    end;

    insert into demo.reservations (id) values (v_id);
    return v_id;
  end loop;

  return null;
end;
$$;

-- Staff answer a pending request: most are approved, some declined.
create function demo.decide(p_reservation uuid, p_at timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_reject boolean := demo.h(p_reservation::text || ':reject') < 0.15;
  v_r double precision := demo.h(p_reservation::text || ':reason');
  v_reason text;
  v_email text;
  v_locale text;
begin
  v_reason := case when v_r < 0.60 then 'dates_unavailable' when v_r < 0.85 then 'no_category'
                   else 'vehicle_withdrawn' end;

  update public.reservations r
  set status = case when v_reject then 'rejected' else 'confirmed' end::public.reservation_status,
      rejection_reason = case when v_reject then v_reason end
  where r.id = p_reservation and r.status = 'pending'
  returning r.customer_email, r.locale into v_email, v_locale;

  if not found then
    return;
  end if;

  insert into public.email_deliveries (entity_type, entity_id, template, recipient, status, created_at)
  values (
    'reservation', p_reservation,
    case when v_reject then 'reservation_rejected' else 'reservation_confirmed' end,
    v_email, 'sent', p_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- §5 Protocols
-- ---------------------------------------------------------------------------
--
-- Storage: photos and signatures point at a SHARED set of objects under
-- `issue/demo/` in the private `protocols` bucket (the staff select policy
-- admits the `issue/` prefix). scripts/demo/upload-protocol-assets.mjs puts them
-- there: four exterior shots per vehicle, three generic interior and dashboard
-- shots, twelve signatures. Until it runs, the protocol view shows its
-- "no photo" / "signature missing" placeholders — it never errors.
--
-- pdf_path is stamped (a finished protocol has one, and it is what makes the
-- delivery badge read "delivered") but no PDF object exists, so the protocol
-- view hides its download button.

create function demo.add_photos(p_protocol uuid, p_vehicle uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.protocol_photos (protocol_id, slot, path) values
    (p_protocol, 'front', 'issue/demo/vehicles/' || p_vehicle || '/front.jpg'),
    (p_protocol, 'rear', 'issue/demo/vehicles/' || p_vehicle || '/rear.jpg'),
    (p_protocol, 'left', 'issue/demo/vehicles/' || p_vehicle || '/left.jpg'),
    (p_protocol, 'right', 'issue/demo/vehicles/' || p_vehicle || '/right.jpg'),
    (p_protocol, 'interior', 'issue/demo/generic/interior-' || (1 + floor(demo.h(p_vehicle || ':interior') * 3))::int || '.jpg'),
    (p_protocol, 'dashboard', 'issue/demo/generic/dashboard-' || (1 + floor(demo.h(p_vehicle || ':dashboard') * 3))::int || '.jpg');
$$;

create function demo.signature_path()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'issue/demo/signatures/sig-' || lpad((1 + floor(random() * 12))::int::text, 2, '0') || '.png';
$$;

-- The protocol email: almost always delivered first time, occasionally after a retry.
create function demo.add_protocol_email(p_protocol uuid, p_template text, p_recipient text, p_at timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if random() < 0.03 then
    insert into public.email_deliveries (entity_type, entity_id, template, recipient, status, error, created_at)
    values ('protocol', p_protocol, p_template, p_recipient, 'failed', 'Resend API timeout', p_at);
    p_at := p_at + interval '6 minutes';
  end if;
  insert into public.email_deliveries (entity_type, entity_id, template, recipient, status, created_at)
  values ('protocol', p_protocol, p_template, p_recipient, 'sent', p_at);
end;
$$;

create function demo.issue(p_reservation uuid, p_at timestamptz)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_pid uuid := gen_random_uuid();
  v_odometer int;
  v_previous_return uuid;
begin
  select res.id, res.vehicle_id, res.locale, res.customer_email, dv.base_km, dv.slug
  into r
  from public.reservations res
  join demo.vehicles dv on dv.id = res.vehicle_id
  where res.id = p_reservation and res.status = 'confirmed';

  if not found
     or exists (select 1 from public.protocols p where p.reservation_id = p_reservation and p.type = 'issue') then
    return null;
  end if;

  -- The odometer carries on from the vehicle's last protocol, plus a short drive
  -- to the wash bay.
  select max(p.odometer_km) into v_odometer
  from public.protocols p
  join public.reservations x on x.id = p.reservation_id
  where x.vehicle_id = r.vehicle_id;
  v_odometer := coalesce(v_odometer, r.base_km) + floor(random() * 25)::int;

  insert into public.protocols (
    id, reservation_id, type, odometer_km, fuel_eighths, signed_at, signature,
    customer_ack, pdf_path, created_at, created_by, locale
  ) values (
    v_pid, p_reservation, 'issue', v_odometer, case when random() < 0.85 then 8 else 7 end,
    p_at, demo.signature_path(), true, 'issue/' || v_pid || '/protocol.pdf',
    p_at + interval '90 seconds', demo.pick_staff(), r.locale
  );

  perform demo.add_photos(v_pid, r.vehicle_id);

  -- Damages: whatever the last return recorded, minus the odd repair; a first
  -- handover starts from a vehicle-specific scratch or two.
  select p.id into v_previous_return
  from public.protocols p
  join public.reservations x on x.id = p.reservation_id
  where x.vehicle_id = r.vehicle_id and p.type = 'return'
  order by p.signed_at desc
  limit 1;

  if v_previous_return is not null then
    insert into public.protocol_damages (id, protocol_id, type, location, size)
    select gen_random_uuid(), v_pid, d.type, d.location, d.size
    from public.protocol_damages d
    where d.protocol_id = v_previous_return
      and random() >= 0.06;
  elsif demo.h(r.slug || ':initial-damage') < 0.55 then
    insert into public.protocol_damages (id, protocol_id, type, location, size)
    select gen_random_uuid(), v_pid, c.type, c.location, c.size
    from demo.damage_catalog c
    order by demo.h(r.slug || ':damage:' || c.id)
    limit 1 + floor(demo.h(r.slug || ':damage-count') * 2)::int;
  end if;

  perform demo.add_protocol_email(v_pid, 'protocol_issued', r.customer_email, p_at + interval '2 minutes');
  return v_pid;
end;
$$;

create function demo.return_vehicle(p_reservation uuid, p_at timestamptz)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  r record;
  ip record;
  v_pid uuid := gen_random_uuid();
  v_days int;
  v_fuel double precision := random();
begin
  select res.id, res.vehicle_id, res.locale, res.customer_email, res.pickup_date, res.return_date, v.category
  into r
  from public.reservations res
  join demo.vehicles dv on dv.id = res.vehicle_id
  join public.vehicles v on v.id = res.vehicle_id
  where res.id = p_reservation and res.status = 'confirmed';

  if not found
     or exists (select 1 from public.protocols p where p.reservation_id = p_reservation and p.type = 'return') then
    return null;
  end if;

  select p.id, p.odometer_km, p.signed_at into ip
  from public.protocols p
  where p.reservation_id = p_reservation and p.type = 'issue';

  if not found or ip.signed_at >= p_at then
    return null;
  end if;

  v_days := greatest(1, r.return_date - r.pickup_date);

  insert into public.protocols (
    id, reservation_id, type, baseline_protocol_id, odometer_km, fuel_eighths, signed_at,
    signature, customer_ack, pdf_path, created_at, created_by, locale
  ) values (
    v_pid, p_reservation, 'return', ip.id,
    ip.odometer_km + (v_days * (case when r.category = 'car_transporter' then 180 else 40 end
                                + random() * 220))::int,
    case when v_fuel < 0.35 then 8 when v_fuel < 0.55 then 7 when v_fuel < 0.70 then 6
         when v_fuel < 0.82 then 5 when v_fuel < 0.90 then 4 when v_fuel < 0.96 then 3 else 2 end,
    p_at, demo.signature_path(), true, 'return/' || v_pid || '/protocol.pdf',
    p_at + interval '90 seconds', demo.pick_staff(), r.locale
  );

  perform demo.add_photos(v_pid, r.vehicle_id);

  -- Every handover damage is confirmed as still there...
  insert into public.protocol_damages (id, protocol_id, type, location, size, baseline_damage_id)
  select gen_random_uuid(), v_pid, d.type, d.location, d.size, d.id
  from public.protocol_damages d
  where d.protocol_id = ip.id;

  -- ...and roughly one rental in eleven comes back with something new.
  if random() < 0.09 then
    insert into public.protocol_damages (id, protocol_id, type, location, size)
    select gen_random_uuid(), v_pid, c.type, c.location, c.size
    from demo.damage_catalog c
    where not exists (
      select 1 from public.protocol_damages d
      where d.protocol_id = ip.id and d.location = c.location
    )
    order by random()
    limit 1;
  end if;

  perform demo.add_protocol_email(v_pid, 'protocol_returned', r.customer_email, p_at + interval '2 minutes');
  return v_pid;
end;
$$;

-- ---------------------------------------------------------------------------
-- §6 tick — the hourly heartbeat (also used by load() to catch up history)
-- ---------------------------------------------------------------------------
--
-- Each run brings every generated booking up to "now":
--   1. Requests older than 30-48 hours (or picking up tomorrow) get a decision.
--   2. Handovers and returns whose planned time has passed get their protocol.
--      Planned times, all Warsaw wall-clock:
--        - handover 13:45-18:15 on the pickup day; ~30% are kept open until
--          19:30-21:00 so a reviewer finds pickups still to hand over;
--        - return 07:30-12:30 on the return day; ~30% come back only in the
--          evening (18:00-20:30), so the returns board shows due rows by day;
--        - half of the returns whose vehicle is not booked again straight away
--          run 1-2 days late (about one overdue return on a typical day, never
--          a growing pile);
--        - ~1.5% of handovers are no-shows and get cancelled instead.
--   3. Once per hour between 07:00 and 21:59, a new request may arrive
--      (about 6 a day).
--   4. Once per day, generated vehicles a visitor retired are put back, and every
--      active vehicle's order book is topped up to 45 days.
create function demo.tick(p_now timestamptz default now())
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'UTC')::date;
  v_local timestamp := p_now at time zone 'Europe/Warsaw';
  v_key text;
  v_rows int;
  v_decided int := 0;
  v_issued int := 0;
  v_returned int := 0;
  v_cancelled int := 0;
  v_requests int := 0;
  v_filled int := 0;
  rec record;
  v_at timestamptz;
  v_last date;
begin
  -- 1. decisions
  for rec in
    select r.id, r.created_at, r.pickup_date
    from public.reservations r
    join demo.reservations d on d.id = r.id
    where r.status = 'pending'
    order by r.created_at
  loop
    v_at := rec.created_at + make_interval(secs => (30 + demo.h(rec.id || ':decide') * 18) * 3600);
    if rec.pickup_date <= v_today + 1 then
      v_at := least(v_at, p_now);
    end if;
    if v_at <= p_now then
      perform demo.decide(rec.id, v_at);
      v_decided := v_decided + 1;
    end if;
  end loop;

  -- 2. handovers and returns, in time order so odometers chain correctly
  for rec in
    with base as (
      select r.id, r.vehicle_id, r.pickup_date, r.return_date,
        exists (select 1 from public.protocols p where p.reservation_id = r.id and p.type = 'issue') as has_issue,
        exists (select 1 from public.protocols p where p.reservation_id = r.id and p.type = 'return') as has_return,
        1 + floor(demo.h(r.id || ':late-days') * 2)::int as late_days
      from public.reservations r
      join demo.reservations d on d.id = r.id
      where r.status = 'confirmed' and r.pickup_date <= v_today
    )
    select b.id, 'issue' as kind,
      case when demo.h(b.id || ':keep-pickup') < 0.30
        then demo.at_local(b.pickup_date, 19.5 + demo.h(b.id || ':t-issue') * 1.5)
        else demo.at_local(b.pickup_date, 13.75 + demo.h(b.id || ':t-issue') * 4.5)
      end as planned_at
    from base b
    where not b.has_issue
    union all
    select b.id, 'return' as kind,
      case
        when demo.h(b.id || ':late') < 0.50 and not exists (
          select 1 from public.reservations n
          where n.vehicle_id = b.vehicle_id and n.id <> b.id
            and n.status in ('pending', 'confirmed')
            and n.pickup_date between b.return_date and b.return_date + b.late_days
        )
          then demo.at_local(b.return_date + b.late_days, 10 + demo.h(b.id || ':t-return') * 6)
        when demo.h(b.id || ':keep-return') < 0.30
          then demo.at_local(b.return_date, 18 + demo.h(b.id || ':t-return') * 2.5)
        else demo.at_local(b.return_date, 7.5 + demo.h(b.id || ':t-return') * 5)
      end as planned_at
    from base b
    where not b.has_return and b.return_date <= v_today
    order by planned_at
  loop
    continue when rec.planned_at > p_now;

    if rec.kind = 'issue' then
      if demo.h(rec.id || ':no-show') < 0.015 then
        update public.reservations set status = 'cancelled' where id = rec.id and status = 'confirmed';
        v_cancelled := v_cancelled + 1;
      elsif demo.issue(rec.id, rec.planned_at) is not null then
        v_issued := v_issued + 1;
      end if;
    elsif demo.return_vehicle(rec.id, rec.planned_at) is not null then
      v_returned := v_returned + 1;
    end if;
  end loop;

  -- 3. new requests, at most one batch per hour
  if extract(hour from v_local) between 7 and 21 then
    v_key := 'request:' || to_char(v_local, 'YYYY-MM-DD"T"HH24');
    insert into demo.tick_log (key) values (v_key) on conflict (key) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      if demo.h(v_key) < 0.40 and demo.add_request(p_now) is not null then
        v_requests := v_requests + 1;
      end if;
      if demo.h(v_key || ':second') < 0.08 and demo.add_request(p_now) is not null then
        v_requests := v_requests + 1;
      end if;
    end if;
  end if;

  -- 4. order-book top-up, once per day
  v_key := 'fill:' || v_today;
  insert into demo.tick_log (key) values (v_key) on conflict (key) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    -- A demo visitor can retire any vehicle, and a retired vehicle leaves the
    -- public catalog (known-issues.md, "Demo visitors mutate live data"). Put
    -- the generated fleet back once a day; the two retired-by-design vans stay out.
    update public.vehicles v
    set is_active = true
    from demo.vehicles dv
    where dv.id = v.id and not v.is_active and dv.slug not like '%-retired';

    for rec in
      select v.id
      from public.vehicles v
      join demo.vehicles dv on dv.id = v.id
      where v.is_active
    loop
      select max(r.return_date) into v_last
      from public.reservations r
      where r.vehicle_id = rec.id and r.status in ('pending', 'confirmed');

      v_last := greatest(coalesce(v_last, v_today), v_today + 3);
      if v_last < v_today + 45 then
        v_filled := v_filled + demo.fill_vehicle(rec.id, v_last, v_today + 45, p_now);
      end if;
    end loop;
    perform demo.assign_references();
  end if;

  return jsonb_build_object(
    'decided', v_decided, 'issued', v_issued, 'returned', v_returned,
    'no_shows', v_cancelled, 'new_requests', v_requests, 'booked_ahead', v_filled
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- §7 load / unload
-- ---------------------------------------------------------------------------

-- Remove the rows supabase/seed.prod.sql put in production (and the matching
-- demo rows supabase/seed.sql adds locally), matched by their fixed ids. A
-- legacy vehicle that still has a booking nobody generated — a real visitor's
-- request, say — is retired instead of deleted, because reservations restrict
-- vehicle deletion.
create function demo.remove_legacy_seed()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_reservations uuid[] := array[
    'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000004',
    'a6000000-0000-0000-0000-000000000010', 'a6000000-0000-0000-0000-000000000011',
    'a6000000-0000-0000-0000-000000000012'
  ]::uuid[];
  v_vehicles uuid[] := array[
    '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666',
    '77777777-7777-7777-7777-777777777777'
  ]::uuid[];
  v_deleted_reservations int;
  v_deleted_vehicles int;
  v_retired_vehicles int;
begin
  delete from public.email_deliveries e
  where (e.entity_type = 'reservation' and e.entity_id = any (v_reservations))
     or (e.entity_type = 'protocol' and e.entity_id in (
          select p.id from public.protocols p where p.reservation_id = any (v_reservations)));

  -- one statement, so a return protocol and its issue baseline go together
  delete from public.protocols p where p.reservation_id = any (v_reservations);

  delete from public.reservations r where r.id = any (v_reservations);
  get diagnostics v_deleted_reservations = row_count;

  delete from public.vehicles v
  where v.id = any (v_vehicles)
    and not exists (select 1 from public.reservations r where r.vehicle_id = v.id);
  get diagnostics v_deleted_vehicles = row_count;

  update public.vehicles v set is_active = false
  where v.id = any (v_vehicles) and v.is_active;
  get diagnostics v_retired_vehicles = row_count;

  return jsonb_build_object(
    'reservations_deleted', v_deleted_reservations,
    'vehicles_deleted', v_deleted_vehicles,
    'vehicles_retired_because_still_booked', v_retired_vehicles
  );
end;
$$;

create function demo.load(p_now timestamptz default now())
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'UTC')::date;
  v_legacy jsonb;
  v_vehicles int;
  v_staff int;
  v_customers int;
  v_bookings int := 0;
  v_tick jsonb;
  rec record;
begin
  if exists (select 1 from demo.vehicles) then
    raise exception 'demo data is already loaded — run select demo.unload() first';
  end if;

  v_legacy := demo.remove_legacy_seed();
  v_vehicles := demo.seed_vehicles(p_now);
  v_staff := demo.seed_staff(p_now);
  v_customers := demo.seed_customers();
  if not exists (select 1 from demo.damage_catalog) then
    perform demo.seed_damage_catalog();
  end if;

  for rec in
    select v.id, v.is_active
    from public.vehicles v
    join demo.vehicles dv on dv.id = v.id
    order by dv.slug
  loop
    if rec.is_active then
      v_bookings := v_bookings + demo.fill_vehicle(rec.id, v_today - 100, v_today + 45, p_now, 0.15);
    else
      -- retired vehicles only have history from before they left the fleet
      v_bookings := v_bookings + demo.fill_vehicle(rec.id, v_today - 100, v_today - 55, p_now);
    end if;
  end loop;

  perform demo.assign_references();

  -- Replay the business up to now: every past handover and return gets its
  -- protocol, old requests get decided. Mark today's top-up as done, since the
  -- order book was just laid out to +45 days.
  insert into demo.tick_log (key) values ('fill:' || v_today) on conflict (key) do nothing;
  v_tick := demo.tick(p_now);

  return jsonb_build_object(
    'legacy_seed', v_legacy,
    'vehicles', v_vehicles,
    'staff', v_staff,
    'customers', v_customers,
    'bookings', v_bookings,
    'catch_up', v_tick
  );
end;
$$;

-- Removes every row the generator created. Protocols a reviewer filed on a
-- generated booking go with it; bookings a reviewer created on a generated
-- vehicle keep that vehicle alive (retired) rather than failing.
create function demo.unload()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_reservations int;
  v_vehicles int;
  v_staff int;
begin
  delete from public.email_deliveries e
  where (e.entity_type = 'reservation' and e.entity_id in (select id from demo.reservations))
     or (e.entity_type = 'protocol' and e.entity_id in (
          select p.id from public.protocols p where p.reservation_id in (select id from demo.reservations)));

  delete from public.protocols p where p.reservation_id in (select id from demo.reservations);

  delete from public.reservations r where r.id in (select id from demo.reservations);
  get diagnostics v_reservations = row_count;

  update public.vehicles v set is_active = false
  where v.id in (select id from demo.vehicles)
    and exists (select 1 from public.reservations r where r.vehicle_id = v.id);

  delete from public.vehicles v
  where v.id in (select id from demo.vehicles)
    and not exists (select 1 from public.reservations r where r.vehicle_id = v.id);
  get diagnostics v_vehicles = row_count;

  -- profiles cascade from auth.users
  delete from auth.users u where u.id in (select user_id from demo.staff);
  get diagnostics v_staff = row_count;

  delete from demo.vehicles;
  delete from demo.customers;
  delete from demo.tick_log;

  return jsonb_build_object(
    'reservations_deleted', v_reservations,
    'vehicles_deleted', v_vehicles,
    'staff_deleted', v_staff
  );
end;
$$;

revoke all on all functions in schema demo from public, anon, authenticated;
