# Demo dataset — production runbook

Production Supabase project: `fmgbyfpilgzvhkziigsj`. Live app:
`https://fleetrent.marcin-kulbicki.workers.dev`.

Merging to `main` deploys the Worker but pushes **no** migrations. Every database step below is
manual.

## 1. Apply the migration

```sh
npx supabase migration list --linked   # 20260914120000 should show as local-only
npx supabase db push                   # creates the `demo` schema and its functions; inserts nothing
npx supabase migration list --linked   # 20260914120000 now on both sides
```

## 2. Load the data

Supabase Studio → SQL editor, on the production project:

```sql
select jsonb_pretty(demo.load());
```

It takes a few seconds. Expect roughly:

- `legacy_seed`: `reservations_deleted` 4, `vehicles_deleted` 7. If
  `vehicles_retired_because_still_booked` is above 0, an old vehicle still carries a booking
  somebody made through the site. It was retired rather than deleted.
- `vehicles` 26, `staff` 7, `customers` ~136, `bookings` ~650–750.
- `catch_up.issued` and `catch_up.returned` ~500 each.

`demo.load()` refuses to run a second time. To start over: `select demo.unload();` then load again.

## 3. Upload protocol photos and signatures

The service-role key is in the Supabase dashboard → Project Settings → API Keys. Do not commit it.

```sh
SUPABASE_URL=https://fmgbyfpilgzvhkziigsj.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service role key> \
node scripts/demo/upload-protocol-assets.mjs
```

It ends with `done: 26 vehicles, 6 generic shots, 12 signatures`. It is safe to re-run.

## 4. Schedule the hourly tick

SQL editor:

```sql
create extension if not exists pg_cron;
select cron.schedule('demo-tick', '7 * * * *', $$select demo.tick()$$);
```

Minute 7 is arbitrary. It only keeps the job off the top of the hour.

## 5. Verify

1. Sign in with the demo account and open the dashboard. Expected:
   - pickups for today;
   - returns due or overdue, depending on the hour;
   - several pending requests.
2. Open any past reservation's protocol. It should show vehicle photos and a signature.
3. After the next run at minute 7:

   ```sql
   select start_time, status, return_message
   from cron.job_run_details
   order by start_time desc
   limit 5;
   ```

   `status` should be `succeeded`. The tick's JSON summary (`decided`, `issued`, `returned`,
   `new_requests`, …) appears only if you run `select demo.tick();` by hand.

## 6. After the review

```sql
select cron.unschedule('demo-tick');   -- stop the heartbeat; the data stays, frozen
select demo.unload();                  -- optional: remove every generated row
```

`demo.unload()` does not bring back the old `seed.prod.sql` rows. The storage objects under
`issue/demo/` stay in the bucket, because storage objects can only be deleted through the Storage
API. Remove the folder in Studio → Storage if you want them gone.
