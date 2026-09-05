-- Booking-Integrity Data Layer (F-01) — seed
--
-- A small, realistic fleet spanning all five vehicle_category values with full
-- pricing/specs so the public catalog (S-01) can render detail cards, plus
-- reservations that exercise the no-double-booking rule BOTH ways:
--   * a same-day-turnover pair on one vehicle that MUST coexist (proves the
--     4-hour buffer: return D 10:00 is adjacent to next pickup D 14:00), and
--   * pending requests on other vehicles (pending is a blocking status too).
--
-- This file must apply cleanly under `supabase db reset` — it contains NO
-- actual overlap. The negative case (a true conflict that the EXCLUDE rejects)
-- lives in context/changes/booking-integrity-data/verify-overlap.sql, run on
-- demand so seed itself always succeeds.
--
-- Dates are fixed absolute calendar dates (no now()-relative drift) so resets
-- are reproducible.

-- ---------------------------------------------------------------------------
-- vehicles — one+ per category, full pricing, one retired (is_active = false)
--
-- *** `name` reads ENGLISH, with TWO rows deliberately left in Polish. ***
-- Seeded vehicle names are fixture data we control, not text a user typed, so
-- they follow the chrome (english-localization Phase 4 §5). The two exceptions —
-- `MAN TGL Chłodnia` and `Scania P280 Skrzyniowy` — are the change's standing
-- proof of frame decision 2: real user-entered text is NEVER machine-translated,
-- so English chrome around a Polish value is the CORRECT outcome, and one of the
-- two carries a diacritic so the encoding path is exercised with it. Do not
-- "finish the job" by translating them.
--
-- `protocol_damages.location` further down stays Polish for the same reason, and
-- because it is the diacritic fixture the PDF path is proved against.
-- ---------------------------------------------------------------------------

insert into vehicles (
  id, name, plate, category, make, model, production_year, fuel_type,
  payload_capacity_kg, cargo_length_cm, cargo_width_cm, cargo_height_cm,
  photos, daily_rate, monthly_rate, deposit, per_extra_km_rate, km_limit,
  seats, transmission, is_active
) values
  -- cargo_van
  (
    '11111111-1111-1111-1111-111111111111',
    'Mercedes Sprinter 315 CDI', 'WX 5519M', 'cargo_van', 'Mercedes-Benz', 'Sprinter', 2022, 'diesel',
    1350.00, 440.00, 178.00, 198.00,
    '{"https://picsum.photos/seed/sprinter-1/960/600","https://picsum.photos/seed/sprinter-2/960/600","https://picsum.photos/seed/sprinter-3/960/600","https://picsum.photos/seed/sprinter-4/960/600"}',
    249.00, 5900.00, 2000.00, 1.20, 300,
    3, 'automatic', true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Renault Master L3H2', 'WX 7284K', 'cargo_van', 'Renault', 'Master', 2021, 'diesel',
    1400.00, 380.00, 176.00, 190.00,
    '{"https://picsum.photos/seed/master-1/960/600","https://picsum.photos/seed/master-2/960/600","https://picsum.photos/seed/master-3/960/600"}',
    219.00, 5200.00, 1800.00, 1.10, 300,
    3, 'manual', true
  ),
  -- passenger_van
  (
    '33333333-3333-3333-3333-333333333333',
    'Volkswagen Crafter 9-seater', 'WX 3102P', 'passenger_van', 'Volkswagen', 'Crafter', 2023, 'diesel',
    900.00, null, null, null,
    '{"https://picsum.photos/seed/crafter-1/960/600","https://picsum.photos/seed/crafter-2/960/600","https://picsum.photos/seed/crafter-3/960/600","https://picsum.photos/seed/crafter-4/960/600"}',
    279.00, 6500.00, 2200.00, 1.30, 350,
    9, 'manual', true
  ),
  -- car_transporter
  (
    '44444444-4444-4444-4444-444444444444',
    'Iveco Daily Car Transporter', 'WX 8867L', 'car_transporter', 'Iveco', 'Daily', 2020, 'diesel',
    2800.00, 600.00, 210.00, null,
    '{"https://picsum.photos/seed/daily-1/960/600","https://picsum.photos/seed/daily-2/960/600","https://picsum.photos/seed/daily-3/960/600"}',
    349.00, 8200.00, 3000.00, 1.80, 250,
    3, 'manual', true
  ),
  -- refrigerated_truck
  (
    '55555555-5555-5555-5555-555555555555',
    -- RETAINED IN POLISH on purpose (see the block comment above).
    'MAN TGL Chłodnia', 'WX 4415R', 'refrigerated_truck', 'MAN', 'TGL', 2021, 'diesel',
    3500.00, 720.00, 245.00, 260.00,
    '{"https://picsum.photos/seed/tgl-1/960/600","https://picsum.photos/seed/tgl-2/960/600","https://picsum.photos/seed/tgl-3/960/600"}',
    459.00, 10800.00, 4000.00, 2.10, 200,
    3, 'manual', true
  ),
  -- flatbed_truck
  (
    '66666666-6666-6666-6666-666666666666',
    -- RETAINED IN POLISH on purpose (see the block comment above).
    'Scania P280 Skrzyniowy', 'WX 9038S', 'flatbed_truck', 'Scania', 'P280', 2019, 'diesel',
    8000.00, 760.00, 248.00, null,
    '{"https://picsum.photos/seed/scania-1/960/600","https://picsum.photos/seed/scania-2/960/600","https://picsum.photos/seed/scania-3/960/600"}',
    529.00, 12500.00, 5000.00, 2.40, 200,
    2, 'manual', true
  ),
  -- a second cargo_van that is retired (is_active = false) — proves catalog
  -- filtering later: it must NOT appear in `where is_active = true` queries.
  (
    '77777777-7777-7777-7777-777777777777',
    'Fiat Ducato (retired)', 'WX 2276D', 'cargo_van', 'Fiat', 'Ducato', 2016, 'diesel',
    1200.00, 320.00, 170.00, 185.00,
    '{}', 179.00, 4200.00, 1500.00, 1.00, 300,
    3, 'manual', false
  );

-- ---------------------------------------------------------------------------
-- reservations — exercise the rule both ways (no actual conflict here)
-- ---------------------------------------------------------------------------

-- reference: zero-padded backfill codes (R-0001…) — base36_encode never emits
-- leading zeros, so these can never clash with RPC-generated references.
-- access_token: fixed (not defaulted) so /r/<token> manual checks survive
-- `supabase db reset` — e.g. /r/cccccccc-0000-0000-0000-000000000003 is the
-- canonical seeded PENDING status page (S-02).
-- locale: the CUSTOMER's language, stamped at submission (english-localization
-- Phase 1). Written EXPLICITLY on every seeded row rather than left to the
-- column default, because the demo data is what the two cross-locale cases are
-- walked against: an employee reading an English cockpit accepting R-0003 must
-- see a POLISH mail leave, and R-0004 an English one. Each of the four is
-- deliberately half of a pair with its sibling, and the two confirmed rows carry
-- the languages the protocol suites assert on (R-0001 -> `pl`,
-- tests/integration/protocol-email.test.ts; R-0002 -> `en`,
-- tests/integration/return-protocol-email.test.ts).
insert into reservations (
  id, vehicle_id, customer_name, customer_email, customer_phone,
  pickup_date, return_date, status, reference, access_token, locale
) values
  -- Same-day-turnover pair on the Sprinter (vehicle 1111...). The first
  -- reservation returns 2026-07-10 (window ends 07-10 10:00); the second picks
  -- up the SAME day 2026-07-10 (window starts 07-10 14:00). Adjacent, not
  -- overlapping -> both confirmed rows coexist, proving the 4-hour buffer.
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Jan Kowalski', 'jan.kowalski@example.com', '+48600100200',
    '2026-07-01', '2026-07-10', 'confirmed',
    'R-0001', 'cccccccc-0000-0000-0000-000000000001', 'pl'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Anna Nowak', 'anna.nowak@example.com', '+48600300400',
    '2026-07-10', '2026-07-15', 'confirmed',
    'R-0002', 'cccccccc-0000-0000-0000-000000000002', 'en'
  ),
  -- Pending requests on other vehicles (pending is a blocking status too).
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    '33333333-3333-3333-3333-333333333333',
    'Piotr Wiśniewski', 'piotr.wisniewski@example.com', '+48600500600',
    '2026-07-05', '2026-07-08', 'pending',
    'R-0003', 'cccccccc-0000-0000-0000-000000000003', 'pl'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000004',
    '55555555-5555-5555-5555-555555555555',
    'Katarzyna Wójcik', 'katarzyna.wojcik@example.com', '+48600700800',
    '2026-07-12', '2026-07-20', 'pending',
    'R-0004', 'cccccccc-0000-0000-0000-000000000004', 'en'
  );

-- ---------------------------------------------------------------------------
-- staff accounts (F-02) — a role-complete, signable-in system after reset
-- ---------------------------------------------------------------------------
--
-- DEV-ONLY credentials. NEVER reuse these in production — production gets its
-- first admin via context/changes/employee-admin-roles/runbook-first-admin.md.
-- Public self-service signup is disabled (config + route), so seeding directly
-- into auth.users is the only path to a signable-in dev account.
--
--   admin@fleetrent.test    / Fl33tRent-Admin_2026!      -> role admin
--   employee@fleetrent.test / Fl33tRent-Employee_2026!   -> role employee
--   norole@fleetrent.test   / Fl33tRent-NoRole_2026!     -> role NULL (no profile)
--   demo@fleetrent.test     / Fl33tRent-Demo_2026!       -> role admin, is_demo
-- (Long/mixed dev-only passwords so Chrome's breached-password check stays quiet.)
--
-- Each account needs THREE things to sign in via email/password:
--   1. an auth.users row with a bcrypt-hashed password (crypt + gen_salt('bf'))
--      and email_confirmed_at set (enable_confirmations is off, but a confirmed
--      timestamp keeps the row unambiguous);
--   2. a matching auth.identities row for the 'email' provider (GoTrue requires
--      it to resolve the identity on login);
--   3. a public.profiles row granting the app_role (seed runs as the table
--      owner and bypasses RLS, so the admin-only insert policy does not apply).
-- Fixed UUIDs keep resets reproducible. The token columns are set to '' (not
-- null) because GoTrue scans them as non-nullable strings.
--
-- norole@fleetrent.test is the integration-test fail-closed fixture: a fully
-- signable authenticated user that DELIBERATELY has steps 1-2 but NOT step 3
-- (no profiles row), so public.current_app_role() resolves to NULL. It is the
-- sharpest probe for a stray direct-table grant (see the data-layer integrity
-- harness). Do not give it a profiles row.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-0000000000ad',
    'authenticated', 'authenticated',
    'admin@fleetrent.test', crypt('Fl33tRent-Admin_2026!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e0000000-0000-0000-0000-0000000000e0',
    'authenticated', 'authenticated',
    'employee@fleetrent.test', crypt('Fl33tRent-Employee_2026!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b0000000-0000-0000-0000-0000000000b0',
    'authenticated', 'authenticated',
    'norole@fleetrent.test', crypt('Fl33tRent-NoRole_2026!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-0000-0000-0000000000de',
    'authenticated', 'authenticated',
    'demo@fleetrent.test', crypt('Fl33tRent-Demo_2026!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  );

insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values
  (
    'a0000000-0000-0000-0000-0000000000ad',
    'a0000000-0000-0000-0000-0000000000ad',
    '{"sub":"a0000000-0000-0000-0000-0000000000ad","email":"admin@fleetrent.test","email_verified":true,"phone_verified":false}',
    'email', now(), now(), now()
  ),
  (
    'e0000000-0000-0000-0000-0000000000e0',
    'e0000000-0000-0000-0000-0000000000e0',
    '{"sub":"e0000000-0000-0000-0000-0000000000e0","email":"employee@fleetrent.test","email_verified":true,"phone_verified":false}',
    'email', now(), now(), now()
  ),
  (
    'b0000000-0000-0000-0000-0000000000b0',
    'b0000000-0000-0000-0000-0000000000b0',
    '{"sub":"b0000000-0000-0000-0000-0000000000b0","email":"norole@fleetrent.test","email_verified":true,"phone_verified":false}',
    'email', now(), now(), now()
  ),
  (
    'd0000000-0000-0000-0000-0000000000de',
    'd0000000-0000-0000-0000-0000000000de',
    '{"sub":"d0000000-0000-0000-0000-0000000000de","email":"demo@fleetrent.test","email_verified":true,"phone_verified":false}',
    'email', now(), now(), now()
  );

-- NOTE: norole@fleetrent.test (b0…b0) intentionally has NO profiles row below,
-- so current_app_role() resolves to NULL (fail-closed). Do not add it here.
-- password_set_at is stamped for every account whose auth.users row carries a
-- real crypt() password above. These accounts never pass through
-- api/auth/{reset,change}-password.ts, which is the only writer in the app, so
-- without this they would read as password-less (ZAPROSZONY) on the roster.
--
-- demo@fleetrent.test is the published portfolio account: a real admin whose
-- profiles.is_demo is true, so the three outward-reaching / lockout-capable
-- staff mutations refuse it while everything else in the cockpit stays live. It
-- is a NEW account on purpose — the integration suite and e2e/auth.setup.ts sign
-- in as admin@/employee@, so neither of those passwords may be rotated to make
-- room for it.
insert into profiles (user_id, role, full_name, password_set_at, is_demo) values
  ('a0000000-0000-0000-0000-0000000000ad', 'admin', 'Tomasz Wójcik', now() - interval '2 hours', false),
  ('e0000000-0000-0000-0000-0000000000e0', 'employee', 'Karolina Mazur', now() - interval '2 hours', false),
  ('d0000000-0000-0000-0000-0000000000de', 'admin', 'Konto Demo', now() - interval '2 hours', true);

-- ---------------------------------------------------------------------------
-- staff roster (S-08) — extra employees so /dashboard/staff renders both the
-- ACTIVE and INVITED states with Polish-diacritic names. DEV-ONLY credentials.
-- ---------------------------------------------------------------------------
--
-- Status derivation (plan.md): ACTIVE = last_sign_in_at is not null; INVITED =
-- invited_at is not null AND last_sign_in_at is null. The two F-02 accounts
-- above have no last_sign_in_at, so backfill it here to render them ACTIVE.
update auth.users
  set last_sign_in_at = now() - interval '2 hours'
  where id in ('a0000000-0000-0000-0000-0000000000ad', 'e0000000-0000-0000-0000-0000000000e0');

-- Two more ACTIVE employees (signable-in: users + identities + profiles + a
-- set last_sign_in_at) and one INVITED employee (invited_at set, last_sign_in_at
-- null, no password/identity — mirrors an unaccepted GoTrue invite).
--   grzegorz@fleetrent.test / Fl33tRent-Employee_2026!  -> ACTIVE  employee
--   zofia@fleetrent.test    / Fl33tRent-Employee_2026!  -> ACTIVE  employee
--   lukasz@fleetrent.test   (invite pending, no password) -> INVITED employee
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at, invited_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'e1000000-0000-0000-0000-0000000000e1',
    'authenticated', 'authenticated',
    'grzegorz@fleetrent.test', crypt('Fl33tRent-Employee_2026!', gen_salt('bf')),
    now(), now() - interval '1 day', now() - interval '20 days', now(), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Grzegorz Jabłoński"}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e2000000-0000-0000-0000-0000000000e2',
    'authenticated', 'authenticated',
    'zofia@fleetrent.test', crypt('Fl33tRent-Employee_2026!', gen_salt('bf')),
    now(), now() - interval '3 days', now() - interval '45 days', now(), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Zofia Wróbel"}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e3000000-0000-0000-0000-0000000000e3',
    'authenticated', 'authenticated',
    'lukasz@fleetrent.test', '',
    null, null, now() - interval '2 days', now(), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Łukasz Piątek"}',
    '', '', '', ''
  );

insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values
  (
    'e1000000-0000-0000-0000-0000000000e1',
    'e1000000-0000-0000-0000-0000000000e1',
    '{"sub":"e1000000-0000-0000-0000-0000000000e1","email":"grzegorz@fleetrent.test","email_verified":true,"phone_verified":false}',
    'email', now(), now(), now()
  ),
  (
    'e2000000-0000-0000-0000-0000000000e2',
    'e2000000-0000-0000-0000-0000000000e2',
    '{"sub":"e2000000-0000-0000-0000-0000000000e2","email":"zofia@fleetrent.test","email_verified":true,"phone_verified":false}',
    'email', now(), now(), now()
  );

-- Łukasz is the invited-never-accepted shape (empty encrypted_password, no
-- identity) — his password_set_at stays NULL deliberately; he is the fixture the
-- ZAPROSZONY badge and the activation-mail path are read from.
insert into profiles (user_id, role, full_name, password_set_at) values
  ('e1000000-0000-0000-0000-0000000000e1', 'employee', 'Grzegorz Jabłoński', now() - interval '1 day'),
  ('e2000000-0000-0000-0000-0000000000e2', 'employee', 'Zofia Wróbel', now() - interval '3 days'),
  ('e3000000-0000-0000-0000-0000000000e3', 'employee', 'Łukasz Piątek', null);

-- ---------------------------------------------------------------------------
-- issue protocol baseline (S-06) — makes the returns worklist + deltas demoable
-- ---------------------------------------------------------------------------
--
-- One issue protocol (type='issue', no pdf) against reservation R-0002 (Anna
-- Nowak / Sprinter), which is confirmed with return_date 2026-07-15 (past), so it
-- surfaces in list_returns_today() as an OVERDUE-open return. No storage objects
-- (protocol_photos left empty; `signature` holds a path string whose bytes are
-- never seeded) — the demo shows the numeric + damage deltas, not photos.
-- Odometer 42000 / fuel 8/8 are the baseline the hand-worked example in the plan
-- diffs against (42000 -> 42850 = 850 km; 8/8 -> 4/8 = -4, flagged).
--
-- NOT R-0001: that reservation is the fixture the S-05 integration suites
-- (protocols-api / protocol-email) submit their OWN issue protocol against, and a
-- seeded issue row there collides on unique (reservation_id, 'issue'). R-0002 is
-- confirmed, past-return, and used by no test — the decoupled home for the demo.
--
-- The protocol id lives in the `d6…` namespace (S-06), disjoint from every test's
-- `dddddddd…` fixtures — notably protocols-rls, which reuses `dddddddd…001` and
-- would otherwise delete this demo row in its own cleanup, leaving nothing to
-- demo after `npm run test:integration`. Keep seed ids and test-fixture ids apart.
--
-- Every seeded damage note carries the full Polish diacritic set
-- `ą ć ę ł ń ó ś ź ż` / `Ą Ć Ę Ł Ń Ó Ś Ź Ż` (lessons.md) so the pdf-lib encoding
-- boundary is exercised the moment a return PDF is built against this baseline.
--
-- locale: what language this protocol's PDF bytes were rendered in. Written
-- explicitly (the column defaults 'pl') and always MATCHING its reservation —
-- R-0002 is the `en` half of the seeded pair, so its baseline is `en` too.
insert into protocols (
  id, reservation_id, type, odometer_km, fuel_eighths,
  signed_at, signature, customer_ack, pdf_path, created_by, locale
) values (
  'd6000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'issue', 42000, 8,
  '2026-07-10 14:20:00+02',
  'issue/d6000000-0000-0000-0000-000000000001/signature.png',
  true, null,
  'e0000000-0000-0000-0000-0000000000e0', 'en'
);

insert into protocol_damages (id, protocol_id, type, location, size) values
  (
    'dd000000-0000-0000-0000-0000000000d1',
    'd6000000-0000-0000-0000-000000000001',
    'scratch',
    'Lewe przednie błotnik — rysa przy klamce',
    '~5 cm'
  ),
  (
    'dd000000-0000-0000-0000-0000000000d2',
    'd6000000-0000-0000-0000-000000000001',
    'dent',
    'Tylny zderzak — niewielkie wgniecenie',
    '~3 cm'
  );

-- ---------------------------------------------------------------------------
-- Returns worklist demo rows (S-06) — one of each queue state so
-- list_returns_today() always shows variety after a `supabase db reset`.
-- RELATIVE dates (current_date / now()) keep the rows due / overdue /
-- returned-today whenever the seed runs. Three otherwise-unused vehicles
-- (Master / Iveco / Scania) so no confirmed-reservation overlap check can trip.
-- ids live in the a6… / d7… namespaces, disjoint from every test fixture and
-- the R-0001…4 / d6… demo rows above.
-- ---------------------------------------------------------------------------
--
-- locale, again explicit: R-0010 is the row a recruiter walks the return flow on,
-- so it is `en` and its PDF renders English end to end; R-0011 is `pl`, the
-- walk-in-at-a-Polish-depot case the whole reservations.locale design exists for.
insert into reservations (
  id, vehicle_id, customer_name, customer_email, customer_phone,
  pickup_date, return_date, status, reference, access_token, locale
) values
  -- DUE today (no return protocol yet) -> primary "Przyjmij zwrot".
  (
    'a6000000-0000-0000-0000-000000000010',
    '22222222-2222-2222-2222-222222222222',
    'Maria Zielińska', 'maria.zielinska@example.com', '+48600910110',
    current_date - 4, current_date, 'confirmed',
    'R-0010', 'cccccccc-0000-0000-0000-000000000010', 'en'
  ),
  -- OVERDUE (return_date in the past, no return protocol) -> red bar + "Po terminie".
  (
    'a6000000-0000-0000-0000-000000000011',
    '44444444-4444-4444-4444-444444444444',
    'Firma Trans-Bud', 'kontakt@trans-bud.example.com', '+48600920120',
    current_date - 9, current_date - 3, 'confirmed',
    'R-0011', 'cccccccc-0000-0000-0000-000000000011', 'pl'
  ),
  -- RETURNED today, email SENT -> "Dostarczono" + "Otwórz protokół" (no resend).
  (
    'a6000000-0000-0000-0000-000000000012',
    '66666666-6666-6666-6666-666666666666',
    'Tomasz Wójcik', 'tomasz.wojcik@example.com', '+48600930130',
    current_date - 5, current_date - 1, 'confirmed',
    'R-0012', 'cccccccc-0000-0000-0000-000000000012', 'pl'
  );

-- Issue baselines (required: list_returns_today INNER-joins the issue protocol).
insert into protocols (
  id, reservation_id, type, odometer_km, fuel_eighths,
  signed_at, signature, customer_ack, pdf_path, created_by, locale
) values
  (
    'd7000000-0000-0000-0000-000000000010',
    'a6000000-0000-0000-0000-000000000010',
    'issue', 51000, 8,
    now() - interval '4 days',
    'issue/d7000000-0000-0000-0000-000000000010/signature.png',
    true, null, 'e0000000-0000-0000-0000-0000000000e0', 'en'
  ),
  (
    'd7000000-0000-0000-0000-000000000011',
    'a6000000-0000-0000-0000-000000000011',
    'issue', 128400, 6,
    now() - interval '9 days',
    'issue/d7000000-0000-0000-0000-000000000011/signature.png',
    true, null, 'e0000000-0000-0000-0000-0000000000e0', 'pl'
  ),
  (
    'd7000000-0000-0000-0000-000000000012',
    'a6000000-0000-0000-0000-000000000012',
    'issue', 87200, 4,
    now() - interval '5 days',
    'issue/d7000000-0000-0000-0000-000000000012/signature.png',
    true, null, 'e0000000-0000-0000-0000-0000000000e0', 'pl'
  );

-- The SENT row's return protocol, created TODAY (so it stays on the list), linked
-- to its issue baseline. pdf_path is set (a delivered return has a stored PDF); the
-- object bytes are never seeded, so the view's PDF link 404s while the deltas render.
insert into protocols (
  id, reservation_id, type, odometer_km, fuel_eighths,
  signed_at, signature, customer_ack, pdf_path, baseline_protocol_id, created_by, created_at, locale
) values (
  'd7000000-0000-0000-0000-0000000000f2',
  'a6000000-0000-0000-0000-000000000012',
  'return', 88950, 3,
  now(),
  'return/d7000000-0000-0000-0000-0000000000f2/signature.png',
  true,
  'return/d7000000-0000-0000-0000-0000000000f2/protocol.pdf',
  'd7000000-0000-0000-0000-000000000012',
  'e0000000-0000-0000-0000-0000000000e0',
  now(), 'pl'
);

-- Delivery row status 'sent' -> the queue shows "Dostarczono", no resend button.
insert into email_deliveries (entity_type, entity_id, template, recipient, status, created_at) values
  (
    'protocol', 'd7000000-0000-0000-0000-0000000000f2',
    'return_protocol', 'tomasz.wojcik@example.com', 'sent', now()
  );
