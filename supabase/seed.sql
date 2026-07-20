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
    'Volkswagen Crafter 9-osobowy', 'WX 3102P', 'passenger_van', 'Volkswagen', 'Crafter', 2023, 'diesel',
    900.00, null, null, null,
    '{"https://picsum.photos/seed/crafter-1/960/600","https://picsum.photos/seed/crafter-2/960/600","https://picsum.photos/seed/crafter-3/960/600","https://picsum.photos/seed/crafter-4/960/600"}',
    279.00, 6500.00, 2200.00, 1.30, 350,
    9, 'manual', true
  ),
  -- car_transporter
  (
    '44444444-4444-4444-4444-444444444444',
    'Iveco Daily Autolaweta', 'WX 8867L', 'car_transporter', 'Iveco', 'Daily', 2020, 'diesel',
    2800.00, 600.00, 210.00, null,
    '{"https://picsum.photos/seed/daily-1/960/600","https://picsum.photos/seed/daily-2/960/600","https://picsum.photos/seed/daily-3/960/600"}',
    349.00, 8200.00, 3000.00, 1.80, 250,
    3, 'manual', true
  ),
  -- refrigerated_truck
  (
    '55555555-5555-5555-5555-555555555555',
    'MAN TGL Chłodnia', 'WX 4415R', 'refrigerated_truck', 'MAN', 'TGL', 2021, 'diesel',
    3500.00, 720.00, 245.00, 260.00,
    '{"https://picsum.photos/seed/tgl-1/960/600","https://picsum.photos/seed/tgl-2/960/600","https://picsum.photos/seed/tgl-3/960/600"}',
    459.00, 10800.00, 4000.00, 2.10, 200,
    3, 'manual', true
  ),
  -- flatbed_truck
  (
    '66666666-6666-6666-6666-666666666666',
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
    'Fiat Ducato (wycofany)', 'WX 2276D', 'cargo_van', 'Fiat', 'Ducato', 2016, 'diesel',
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
insert into reservations (
  id, vehicle_id, customer_name, customer_email, customer_phone,
  pickup_date, return_date, status, reference, access_token
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
    'R-0001', 'cccccccc-0000-0000-0000-000000000001'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Anna Nowak', 'anna.nowak@example.com', '+48600300400',
    '2026-07-10', '2026-07-15', 'confirmed',
    'R-0002', 'cccccccc-0000-0000-0000-000000000002'
  ),
  -- Pending requests on other vehicles (pending is a blocking status too).
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    '33333333-3333-3333-3333-333333333333',
    'Piotr Wiśniewski', 'piotr.wisniewski@example.com', '+48600500600',
    '2026-07-05', '2026-07-08', 'pending',
    'R-0003', 'cccccccc-0000-0000-0000-000000000003'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000004',
    '55555555-5555-5555-5555-555555555555',
    'Katarzyna Wójcik', 'katarzyna.wojcik@example.com', '+48600700800',
    '2026-07-12', '2026-07-20', 'pending',
    'R-0004', 'cccccccc-0000-0000-0000-000000000004'
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
  );

-- NOTE: norole@fleetrent.test (b0…b0) intentionally has NO profiles row below,
-- so current_app_role() resolves to NULL (fail-closed). Do not add it here.
insert into profiles (user_id, role) values
  ('a0000000-0000-0000-0000-0000000000ad', 'admin'),
  ('e0000000-0000-0000-0000-0000000000e0', 'employee');

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
insert into protocols (
  id, reservation_id, type, odometer_km, fuel_eighths,
  signed_at, signature, customer_ack, pdf_path, created_by
) values (
  'd6000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'issue', 42000, 8,
  '2026-07-10 14:20:00+02',
  'issue/d6000000-0000-0000-0000-000000000001/signature.png',
  true, null,
  'e0000000-0000-0000-0000-0000000000e0'
);

insert into protocol_damages (id, protocol_id, type, location, size) values
  (
    'dd000000-0000-0000-0000-0000000000d1',
    'd6000000-0000-0000-0000-000000000001',
    'scratch',
    'Lewe przednie błotnik — rysa przy klamce (kontrola znaków PL: ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ)',
    '~5 cm'
  ),
  (
    'dd000000-0000-0000-0000-0000000000d2',
    'd6000000-0000-0000-0000-000000000001',
    'dent',
    'Tylny zderzak po prawej — niewielkie wgniecenie (kontrola znaków PL: ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ)',
    '~3 cm'
  );
