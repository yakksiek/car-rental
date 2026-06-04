-- Conflict-rejection proof for the booking-integrity EXCLUDE constraint (F-01).
--
-- This is a DEV ARTIFACT, intentionally kept OUT of supabase/seed.sql (which
-- must always apply cleanly). It demonstrates the hard guarantee: the database
-- physically refuses a second blocking reservation whose window overlaps an
-- existing one on the same vehicle.
--
-- How to run (against a seeded local stack — `supabase db reset` first):
--   psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--     -f context/changes/booking-integrity-data/verify-overlap.sql
-- or paste into Supabase Studio's SQL editor.
--
-- EXPECTED RESULT: the INSERT fails with
--   ERROR:  23P01: conflicting key value violates exclusion constraint
--           "reservations_no_overlap"
--
-- Why it must fail: the seed has a CONFIRMED reservation on the Sprinter
-- (vehicle 1111…) spanning 2026-07-01 14:00 → 2026-07-10 10:00. The insert
-- below requests 2026-07-05 → 2026-07-08 on the same vehicle in a blocking
-- status (confirmed), so the windows genuinely overlap. The GiST EXCLUDE index
-- rejects it atomically (23P01) — no app-level check involved.

insert into reservations (
  vehicle_id, customer_name, customer_email, customer_phone,
  pickup_date, return_date, status
) values (
  '11111111-1111-1111-1111-111111111111',
  'Konflikt Testowy', 'konflikt@example.com', '+48600999000',
  '2026-07-05', '2026-07-08', 'confirmed'
);
