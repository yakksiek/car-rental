-- PROD-SAFE seed (derived from supabase/seed.sql).
-- Contains ONLY the public fleet + demo reservations.
-- The dev-only staff/auth credentials block is intentionally EXCLUDED.
-- Apply once to an EMPTY prod DB (fixed UUIDs -> re-running conflicts on PK).
-- ---------------------------------------------------------------------------

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
