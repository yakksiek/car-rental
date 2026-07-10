---
change_id: issue-protocol
title: Issue protocol
status: plan_reviewed
created: 2026-07-09
updated: 2026-07-10
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- 2026-07-09 — `/10x-research` complete → `research.md`. Roadmap Open Question #1 (email provider) resolved
  with a recommendation: **Resend** (raw `fetch`, no SDK), runner-up **Brevo** if EU data residency is a hard
  requirement. Awaiting user sign-off.
- `infrastructure.md` RISK A ("3 MB bundle exceeded by signature/image libs") is **measured false**: Worker
  uploads at `gzip: 554.76 KiB`; client islands are separate static assets. Downgrade to low/low.
- 2026-07-09 — **all 8 open questions resolved** with the user (see `research.md` § Decisions). Summary:
  1. Form: **introduce `react-hook-form`** + `useFieldArray` for the dynamic photo rows. Repo will hold two
     form conventions; `VehicleForm` becomes the outlier. `lessons.md` is now honored — do not amend it.
  2. "Issued" = **existence of a `protocols` row**. No enum change, `EXCLUDE` predicate untouched, booking
     integrity cannot regress. Needs `unique (reservation_id)` + a `for update` status re-read.
  3. Email failure: commit-then-best-effort **stays**, but outcomes land in a new append-only
     `email_deliveries` table + dashboard badge + resend action. Tracks the two **staff-authenticated** sends
     only — tracking the anon creation email would require `grant execute … to anon` on an audit-log write.
  4. `EmailAdapter` exported; adapter selected from config (the Resend work delivers this anyway).
     5/7. Media: **client-generated PDF attachment; no signed URLs to the customer.** (Reverses the same-day
     signed-links decision.) Generated with pdf-lib in the phone island → 0 ms Worker CPU (server-side gen is
     non-viable on the free tier's 10 ms cap). Deletes the bearer-URL risk and the TTL question outright, and
     gives the customer a permanent artifact for a dispute months later. **⚠ Needs `@pdf-lib/fontkit` + an
     embedded TTF: 8 of 9 Polish diacritics throw on the WinAnsi standard fonts.** If PDF generation fails
     mid-handover, the protocol still commits and is badged for resend.
  5. Residency: **defer** — ship Resend, keep Brevo as a documented one-file swap.
  6. Fix the two stale `CLAUDE.md` claims in the S-05 PR.
- Carried into `/10x-plan`: HEIC decode (correctness, not size), F2 401-vs-403 (use the vehicles two-step),
  and the one knowingly-retained swallow on the creation email.
- 2026-07-09 — **design audit** → `design-audit.md`, ask list → `design-prompt.md`. Planning is paused for a
  Claude Design round-trip. Read the prototype source, not the PNGs: it overturned two screenshot-only claims —
  a **desktop pickup protocol already exists** (`ScreenStaffPickup`, never exported) with a real odometer input,
  damage textarea and drag-drop zone; and **all Polish copy already exists** in `shared.jsx` (the PNGs were
  captured with `T.lang = "EN"`). Open conflicts for design: mobile says 6 steps / desktop says 5; damage is
  free text on the pickup screens but structured items on the return screens (S-06 cannot diff a prose blob);
  no fuel selector or desktop signature anywhere; every failure path (email-failed badge, resend, PDF-gen
  failure, upload retry) is undesigned.
- 2026-07-09 — **`vehicles.plate` decided: add it** (user). The fleet will hold many identical models (e.g. ten
  Ford Transits), so the registration plate is the only practical differentiator on the dispatch list and the
  protocol PDF. Unique, not null. Note this is a **pre-existing S-04 divergence**: the add-vehicle _design_
  already has a `Rejestracja` field (`vPlate`) that the shipped form never implemented.
- 2026-07-09 — **redesign landed; audit v2** (`design-audit.md`). New: `protocol-parts.jsx`, `pickup-protocol.jsx`,
  `staff-protocol-desktop.jsx` + 17 PL exports. All Q1–Q11 answers implemented except Q7 (`W toku` chip still
  present). Mobile is one scrolling form, desktop two-column, no step rail. Photo model = 6 baseline slots
  (the old `damage` slot became **`slDash` / "Deska rozdz."**) + photos per damage item. Damage items carry
  type/location/size/photos, no severity, no cost. Plate is back on both add-vehicle forms, required.
  Fixed 14:00/10:00 confirmed, with a separate `signed_at`. PL dictionary verified: 82/82 EN↔PL parity,
  all 67 used keys present.
- **Data model settled** → `vehicles.plate` (unique, not null, backfill 7 seeds); `protocols`
  (`reservation_id` unique, `odometer_km`, `fuel_eighths` 0–8, `signed_at`, `signature`, `customer_ack`);
  `protocol_photos` (slot enum `front|rear|left|right|interior|dashboard`); `protocol_damages`
  (type enum `scratch|dent|crack|missing`, location, size) + per-item photos; `email_deliveries`.
  The `existing|new` damage tag is **derived at return time**, not stored at pickup.
- Residual design gaps (non-blocking): desktop lacks upload/validation/pdf-fail states; no delete on a damage
  item; delivery badge + resend live only in the post-submit overlay (no dashboard badge, no view-protocol
  screen, though the conflict screen links to one); `W toku` chip not dropped; superseded 6-step/5-step
  screens still in the project.
- 2026-07-09 — **`/10x-plan` complete** → `plan.md` + `plan-brief.md`, 7 phases. All four residual design gaps
  (A/B/C/D) are pulled **into** S-05 rather than deferred. New decisions taken at plan time:
  1. **Upload path** = browser → Supabase directly under `storage.objects` RLS. No service-role client; the
     Worker never sees image bytes (10 ms CPU cap). Storage RLS becomes a real trust boundary.
  2. **PDF → email** = client generates, uploads to the private bucket; the server mints a minutes-long signed
     URL and passes it as Resend's hosted `path`. A resend therefore never forces the employee to regenerate.
  3. **Entry point** = new `/dashboard/pickups` page (S-06/S-07 reuse it), not a tab on the pending queue.
  4. **`vehicles.plate`** = nullable → backfill 7 seeds → `not null unique`, all in one migration. ⚠ Will abort
     if prod gained a vehicle since the seed — check `count(*) where plate is null` first. The S-04 form + its
     zod schema must gain the field in the same PR.
  5. **Odometer** = compare to the last protocol on that vehicle, **soft warning, not a hard block** (a swapped
     cluster must not strand an employee). `list_pickups_today` returns `last_odometer_km` as the baseline.
  6. **HEIC** = sniff by magic bytes, then lazily `import('heic2any')`. Correctness, not size: Chrome/Firefox
     yield a _blank image_, not an error.
  7. **Risk #3 tests ship inside S-05** as Phase 7, closing test-plan Phase 4.
  8. **⚠ The verified sender domain now BLOCKS the slice** (user's call, 2026-07-09), superseding the earlier
     non-blocking call that rested on the `devLogAdapter` fallback. Rationale: a slice whose only exercised path
     is `console.log` has not proven the thing it exists to do. Definition of done = one real protocol emailed to
     a real inbox with `ą ć ę ł ń ó ś ź ż` rendering correctly in the PDF. `roadmap.md` reconciled to match.
- **Design contract distilled into `plan.md` Phase 5** (all 60+ `proto.*` PL strings verbatim, every component
  state, both viewport layouts). Per `lessons.md`, `/10x-implement` must build from that text and **not** re-open
  the JSX or the PNG exports. One correction to audit v2 §A: read from source, the desktop columns are
  **left `1.35fr` = condition + damage, right `1fr` = photos + signature** — the audit had them reversed.
