---
change_id: demo-dataset
title: Demo dataset — a production that looks like a live rental business during the portfolio review
status: in-progress
created: 2026-09-14
updated: 2026-09-14
archived_at: null
---

## Notes

**Why.** The production deployment is reviewed over the two weeks from 2026-09-14. It held 7
vehicles and 4 reservations dated July 2026. The staff screens are built around "today"
(`list_dispatch_today` matches `pickup_date = current_date`; `list_returns_today` lists returns due
today or overdue), so a one-off seed looks alive for a single day and then rots.

**What.** `supabase/migrations/20260914120000_demo_dataset.sql` installs a private `demo` schema with:

- `demo.load()` — 26 vehicles with real model photos, 7 extra team members, ~136 customers,
  ~700 bookings from 100 days ago to 45 days ahead, and a replay that gives every past handover
  and return its protocol (photos, signature, damages, email delivery).
- `demo.tick()` — run hourly by pg_cron in production. Decides old requests, files handovers and
  returns as their planned time passes, adds about six new requests a day, tops the order book up
  to 45 days, and re-activates generated vehicles a visitor retired.
- `demo.unload()` — removes everything the two functions created.

The migration inserts no rows, so local, CI and the integration suite are unaffected until someone
calls `demo.load()`.

**Decisions (owner, 2026-09-14).**

1. Keep the data current with an hourly job rather than a one-time load.
2. Customer and staff emails are Resend test inboxes (`delivered+<label>@resend.dev`). A reviewer's
   Approve / Reject / handover sends real mail; these addresses accept it without touching the
   `wujcar.com` sending reputation. The cost: reviewers see `resend.dev` addresses.
3. Replace the old `seed.prod.sql` rows (matched by their fixed ids), not add around them.
4. Extras: real vehicle photos, extra team members, and protocol photos plus signatures.

**Simulated before shipping (local, 2026-09-14).** Fourteen days of hourly ticks, snapshot at
noon each day: pickups per day 3–13, pending requests 6–18, new requests 2–11 a day, zero
confirmed bookings stranded without a handover, order book growing rather than draining.

**Residual risks.**

- Vehicle photos are hot-linked from Wikimedia Commons under CC BY / CC BY-SA. Attribution lives in
  `scripts/demo/photo-credits.md`, not on a page a visitor sees.
- Protocol PDFs are not generated. `pdf_path` is stamped so delivery badges read "delivered", and
  the protocol view hides its download button because no object exists.
- A reviewer can still edit or retire vehicles, decide requests, and file protocols. The tick heals
  the retired-vehicle case daily; the rest is the accepted risk in `known-issues.md` ("Demo visitors
  mutate live data").

**Rollout:** `runbook.md` in this folder.
