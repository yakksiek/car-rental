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
  id, name, category, make, model, production_year, fuel_type,
  payload_capacity_kg, cargo_length_cm, cargo_width_cm, cargo_height_cm,
  photos, daily_rate, monthly_rate, deposit, per_extra_km_rate, km_limit,
  is_active
) values
  -- cargo_van
  (
    '11111111-1111-1111-1111-111111111111',
    'Mercedes Sprinter 315 CDI', 'cargo_van', 'Mercedes-Benz', 'Sprinter', 2022, 'diesel',
    1350.00, 440.00, 178.00, 198.00,
    '{}', 249.00, 5900.00, 2000.00, 1.20, 300,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Renault Master L3H2', 'cargo_van', 'Renault', 'Master', 2021, 'diesel',
    1400.00, 380.00, 176.00, 190.00,
    '{}', 219.00, 5200.00, 1800.00, 1.10, 300,
    true
  ),
  -- passenger_van
  (
    '33333333-3333-3333-3333-333333333333',
    'Volkswagen Crafter 9-osobowy', 'passenger_van', 'Volkswagen', 'Crafter', 2023, 'diesel',
    900.00, null, null, null,
    '{}', 279.00, 6500.00, 2200.00, 1.30, 350,
    true
  ),
  -- car_transporter
  (
    '44444444-4444-4444-4444-444444444444',
    'Iveco Daily Autolaweta', 'car_transporter', 'Iveco', 'Daily', 2020, 'diesel',
    2800.00, 600.00, 210.00, null,
    '{}', 349.00, 8200.00, 3000.00, 1.80, 250,
    true
  ),
  -- refrigerated_truck
  (
    '55555555-5555-5555-5555-555555555555',
    'MAN TGL Chłodnia', 'refrigerated_truck', 'MAN', 'TGL', 2021, 'diesel',
    3500.00, 720.00, 245.00, 260.00,
    '{}', 459.00, 10800.00, 4000.00, 2.10, 200,
    true
  ),
  -- flatbed_truck
  (
    '66666666-6666-6666-6666-666666666666',
    'Scania P280 Skrzyniowy', 'flatbed_truck', 'Scania', 'P280', 2019, 'diesel',
    8000.00, 760.00, 248.00, null,
    '{}', 529.00, 12500.00, 5000.00, 2.40, 200,
    true
  ),
  -- a second cargo_van that is retired (is_active = false) — proves catalog
  -- filtering later: it must NOT appear in `where is_active = true` queries.
  (
    '77777777-7777-7777-7777-777777777777',
    'Fiat Ducato (wycofany)', 'cargo_van', 'Fiat', 'Ducato', 2016, 'diesel',
    1200.00, 320.00, 170.00, 185.00,
    '{}', 179.00, 4200.00, 1500.00, 1.00, 300,
    false
  );

-- ---------------------------------------------------------------------------
-- reservations — exercise the rule both ways (no actual conflict here)
-- ---------------------------------------------------------------------------

insert into reservations (
  id, vehicle_id, customer_name, customer_email, customer_phone,
  pickup_date, return_date, status
) values
  -- Same-day-turnover pair on the Sprinter (vehicle 1111...). The first
  -- reservation returns 2026-07-10 (window ends 07-10 10:00); the second picks
  -- up the SAME day 2026-07-10 (window starts 07-10 14:00). Adjacent, not
  -- overlapping -> both confirmed rows coexist, proving the 4-hour buffer.
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Jan Kowalski', 'jan.kowalski@example.com', '+48600100200',
    '2026-07-01', '2026-07-10', 'confirmed'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Anna Nowak', 'anna.nowak@example.com', '+48600300400',
    '2026-07-10', '2026-07-15', 'confirmed'
  ),
  -- Pending requests on other vehicles (pending is a blocking status too).
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    '33333333-3333-3333-3333-333333333333',
    'Piotr Wiśniewski', 'piotr.wisniewski@example.com', '+48600500600',
    '2026-07-05', '2026-07-08', 'pending'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000004',
    '55555555-5555-5555-5555-555555555555',
    'Katarzyna Wójcik', 'katarzyna.wojcik@example.com', '+48600700800',
    '2026-07-12', '2026-07-20', 'pending'
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
  );

insert into profiles (user_id, role) values
  ('a0000000-0000-0000-0000-0000000000ad', 'admin'),
  ('e0000000-0000-0000-0000-0000000000e0', 'employee');
