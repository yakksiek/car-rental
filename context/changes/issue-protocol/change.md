---
change_id: issue-protocol
title: Issue protocol
status: implementing
created: 2026-07-09
updated: 2026-07-14
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
- 2026-07-10 — **Phase 1 implemented.** The §4 storage spike passed on the first `db reset`: a plain migration
  _can_ create the bucket and its `storage.objects` policies (postgres inherits `supabase_storage_admin`), so
  neither documented fallback was needed. Employee upload/download OK; anon and role-null denied at both verbs;
  the MIME allowlist and the `issue/` prefix scope both bite. Three deviations from the plan, all found by tests:
  1. **`grant execute … to authenticated` is decorative.** Postgres grants EXECUTE to `PUBLIC` by default and
     Supabase's default privileges add an explicit `anon` grant, so all five RPCs were anon-callable (their
     in-RPC role gates held, so nothing leaked — but criterion 1.6 failed). Fixed with an explicit
     `revoke execute … from public, anon` per function. **This is the same default-grant shape as the
     `reservations` PII leak, one layer up** — though NOT exploitable, unlike that one: verified by probing all
     four staff RPCs as `anon` (including `decide_reservation` confirm + `set_vehicle_active` retire), each
     returned `unauthorized`/`[]` and changed no state. Tables have no in-function guard; RPCs do. Captured as
     `lessons.md` → "Revoke EXECUTE before granting it".
     **FOLLOW-UP CHANGE (agreed 2026-07-10, to run AFTER S-05 ships):** harden repo-wide —
     (a) `alter default privileges in schema public revoke execute on functions from public, anon, authenticated;`
     so future functions start closed; (b) explicit `revoke execute … from public, anon` on the four pre-existing
     staff RPCs (`decide_reservation`, `set_vehicle_active`, `list_pending_reservations`,
     `list_reservations_for_calendar`); (c) an integration test pinning anon-uncallability. Carve-outs: the four
     intentionally-public RPCs (`available_vehicles`, `get_vehicle_busy_ranges`, `get_reservation_status`,
     `create_reservation_request`) already carry an explicit `grant … to anon` and survive untouched; a helper
     called from inside an RLS policy (`current_app_role()`) runs as the querying role and needs its own explicit
     grant to `authenticated`. Run `/10x-new rpc-execute-grant-hardening`.
  2. **Two more test files needed `plate`**, not just the `reservations-overlap.test.ts` the plan named:
     `api-authz.test.ts` and `api-validation.test.ts` both upsert a harness vehicle, and `api-authz`'s request
     body fixture also had to gain the field (the shared schema now requires it). Plates must be distinct — the
     column is unique.
  3. **No DELETE policy on `storage.objects`** (decided 2026-07-10, surfaced by the 1.10 manual check when the
     employee's cleanup `DELETE` returned 403). Intentional: the protocol is the customer's dispute evidence, so
     it is append-only at the storage layer and no role may delete through the app. Orphaned bytes from abandoned
     form sessions are accepted (service-role cleanup only); photo retry is unaffected (upsert = UPDATE). Also
     learned: Supabase blocks direct SQL `delete from storage.objects` via a `storage.protect_delete()` trigger.
  4. **A duplicate plate would have 500'd.** The new unique constraint makes `23505` reachable from the S-04
     create/edit routes, which rethrow unexpected DB errors. Added a `duplicate_plate` tag to
     `createVehicle`/`updateVehicle` and mapped it to the existing `400 {errors: {plate}}` contract the form
     already re-maps onto inputs. Not in the plan; the constraint made it necessary.
- 2026-07-10 — **Phase 2 implemented.** Schema, Resend adapter, adapter selection + `setEmailAdapter`,
  `sendTracked`, the protocols service, the `protocolIssuedEmail` template, and the config banner. Five
  deviations / findings, none contradicting the plan's intent:
  1. **`resendAdapter` is a factory, `createResendAdapter({apiKey, from, fetchImpl})`,** not a module-level const.
     Configuration is read once in `email/index.ts`; `resend.ts` never imports `astro:env/server` and so stays
     unit-testable with a fake `fetch`. Criterion 2.4 depends on this.
  2. **Vitest could not resolve `astro:env/server`** (an `astro sync` virtual module) once a unit test reached the
     email seam. Added `tests/stubs/astro-env-server.ts` (every value `undefined` = an unconfigured deployment) and
     aliased it in `vitest.config.ts`. Also found that **projects do NOT inherit the root `resolve` block** — the
     config's own header comment claimed they share it, but the `@` alias it named had simply never been exercised
     by a test. The alias is now applied per project.
  3. **`z.uuid()` is stricter than the database.** Zod 4's `uuid()` asserts the RFC 9562 version + variant nibbles,
     so it rejects ids the `uuid` column and the repo's `UUID_RE` guard both accept (e.g. the `1111…` seed ids).
     The schema uses `z.guid()`, which matches `UUID_RE`. A `crypto.randomUUID()` value satisfies either.
  4. **The schema pins every storage path to `issue/<protocolId>/`** (a `superRefine`). Not in the plan, but
     `storage.objects` RLS only scopes to the `issue/` prefix and the RPC records whatever path it is handed, so
     without this a caller could record a path pointing at another protocol's evidence. Bounded either way for
     trusted staff — but the schema is the cheapest place to close it.
  5. **⚠ Plan criterion 2.7 ("with a key set, a send lands in local `inbucket`") is not achievable as written.**
     `inbucket` (`:54324`) only catches mail Supabase Auth sends through its own SMTP; the Resend adapter POSTs to
     `https://api.resend.com/emails` over HTTPS and never touches it. With a key set, a send lands in the _Resend
     dashboard_ and the real inbox. Verifying it is therefore the same act as Phase 7's send gate (7.6), and the
     honest local check is 2.6: no key ⇒ banner + `devLogAdapter` logs the composed message.
     **Decided 2026-07-10: 2.7 is deferred, not dropped** — it is subsumed by 7.6/7.7 (a real Resend send landing a
     PDF in a real inbox, diacritics intact). Its Progress row stays `- [ ]` and `/10x-archive` will surface it as
     an informational warning; that is the correct signal, because the thing it asks for has genuinely not been
     proven yet at this phase.
- 2026-07-10 — **Phase 3 implemented.** Three self-gating routes: `POST /api/protocols` (commit, no email),
  `POST /api/protocols/[id]/pdf` (store `pdf_path` → sign → send, 200 either way), and
  `POST /api/protocols/[id]/resend-email` (recovery, 409 when `pdf_path` is null). F2 resolved for new routes
  only: all three use the vehicles two-step (`!user` → 401, then role → 403); the reservation routes' 403-for-anon
  assertions in `api-authz.test.ts` stay untouched. Four notes:
  1. **`tests/helpers/email.ts` landed here, not in Phase 7.** Criterion 3.7 ("a finalize call whose email throws
     still returns 200") cannot be proven without a throwing adapter — `devLogAdapter` never throws. The capturing
     and throwing doubles are the ones Phase 7 §1 specifies, injected via `setEmailAdapter`; Phase 7 consumes them
     rather than creating them.
  2. **The finalize route pins `path` to `issue/<id>/…​.pdf`** via its own zod refine, mirroring
     `protocolInputSchema`'s `superRefine`. Not in the plan. `set_protocol_pdf` records whatever path it is handed
     and `storage.objects` RLS scopes only to the `issue/` prefix, so without it one protocol's `pdf_path` could
     point at another protocol's evidence.
  3. **The bucket's `allowed_mime_types` reads the Blob's `type`, not storage-js's `contentType` option.** An
     upload of a bare `new Blob([bytes])` is rejected as `application/octet-stream`. The test fixture sets
     `new Blob([bytes], { type: "application/pdf" })`; the Phase 5 island must do the same for photos and the PDF.
  4. **Both send routes return `{ status: "ok", delivery: "sent" | "failed" }`.** The delivery status is a body
     field, never an HTTP status — that separation is what lets the island pick its `sent` / `email` overlay while
     the handover itself reads as succeeded.

  Reproducing 3.8 by hand: `POST /api/auth/signin` needs an `Origin` header too — Astro's _built-in_ CSRF check
  rejects form POSTs without one (`Cross-site POST form submissions are forbidden`), so a curl sign-in that omits
  it silently yields an empty cookie jar and the next request 401s for the wrong reason. With a real `norole`
  session the route answers 403 `Brak uprawnień.`, while `employee` on the _same_ malformed body answers 400 with
  zod's field errors — and zod runs after the role gate and before the RPC, which is what proves the 403 never
  reached Postgres. Separately: `api-authz.test.ts`'s decide allow-path leaves its `email_deliveries` rows behind
  (harmless — `protocols-api.test.ts` scopes cleanup to `entity_type = 'protocol'` — but they accumulate).

- 2026-07-10 — **Phase 4 implemented.** `compressImage`, `isHeic` + lazy `heic2any`, `buildProtocolPdf`
  (+ `fonts.ts`, `protocol-labels.ts`). Seven findings, one of which **changes Phase 5**:
  1. **⚠ `client:load` puts the island's whole module graph into the Worker bundle.** Measured with a throwaway
     probe island: an island that imports `protocol-pdf` builds a Worker of **6,002 KiB raw / 1,506 KiB gzip**, vs.
     a **2,704 KiB / 559 KiB** baseline. pdf-lib and heic2any land in `dist/server/chunks/` _as well as_
     `dist/client/`, because Astro server-renders a `client:load` island to produce its initial HTML, so the server
     build must be able to execute the component — and emits everything reachable from it.
     **Converting the imports to `await import(...)` does not help**: Vite's SSR build follows the dynamic-import
     edge and still emits the chunks (6,003 KiB). _Reachability_ is the criterion, not whether the code could ever
     run on the server. The only lever that works is **`client:only="react"`**, which keeps the component out of the
     server build's entry graph entirely and restores a byte-identical 2,703.55 KiB / 74-module Worker — with plain
     static imports, no dynamic-import gymnastics.
     **This is a budget finding, not a hard-limit one.** Cloudflare's 3 MB cap applies to the _gzipped_ bundle, and
     1,506 KiB gzip still fits. Correcting an earlier overstatement in this log: `client:load` would not have failed
     the deploy. It would have spent ~950 KiB gzip — about half the remaining headroom — on code the Worker can never
     execute, and would quietly invalidate the plan's "headroom is ~2,517 KiB gzip (~5.5×)" premise. S-06's return
     protocol reuses this same pipeline, so the waste compounds.
     Consequence for the plan: **Phase 5 §2's "Mount `client:load`" is wrong for `ProtocolForm` and must become
     `client:only="react"`.** The stated guardrail ("never import them at SSR module scope") is necessary but not
     sufficient — an island's own module scope _is_ SSR-reachable whenever the island is server-rendered. The cost of
     `client:only` is nil here: the form is staff-only behind auth, so no SEO or no-JS story is being protected.
     Confirmed `heic2any` splits into its own 1,324 KiB chunk (333 KiB gzip) that the initial island load never pulls.
  2. **Fonts are a subset, embedded as a `?inline` data URI.** Noto Sans Regular + Bold (OFL), `pyftsubset`-ed to
     ASCII + Latin-1 + Latin Extended-A + the punctuation the copy uses: **393 KB → 23 KB each**. `?inline` (not
     `?url`) because it resolves to a `data:font/ttf;base64,…` URI that `fetch` reads identically in the browser
     and under vitest's node environment — so the diacritic test exercises the _exact bytes the phone ships_.
     `?url` yields `/src/assets/…`, which node cannot fetch. Regeneration command + the unicode ranges are in
     `src/assets/fonts/README.md`; widening the copy beyond those ranges needs a re-subset.
  3. **"It does not throw" is NOT a sufficient diacritic test.** Unlike a standard WinAnsi font, an _embedded_ font
     renders a character it lacks a glyph for as `.notdef` (a tofu box) and returns quietly. A subset regenerated
     with too narrow a range would pass the plan's criterion 4.2 while shipping the customer a name full of boxes.
     Added a direct `fontkit.layout(...)` glyph-coverage assertion over `ą ć ę ł ń ó ś ź ż` + uppercase, per weight.
     The upside of the same fact: a stray Cyrillic character in a damage note costs a tofu box, not the protocol.
  4. **pdf-lib's `embedJpg` reads `bytes.buffer` and ignores `byteOffset`.** Any `Uint8Array` that is a _view_ into
     a larger buffer — every node `Buffer`, anything from `.subarray()` — is read from the wrong offset, throwing
     `SOI not found in JPEG` if you are lucky and embedding garbage if you are not. `buildProtocolPdf` now
     `tighten()`s every image before embedding. The browser path (`new Uint8Array(await blob.arrayBuffer())`) is
     already tight, so this is pure insurance against a future caller.
  5. **`buildProtocolPdf` returns a `Blob` typed `application/pdf`, not the plan's `Uint8Array`** — and
     `compressImage` returns a Blob typed `image/jpeg`. Direct consequence of the Phase 3 §3 finding: the bucket's
     `allowed_mime_types` reads the Blob's own `type`, so an untyped blob uploads as `application/octet-stream` and
     is rejected. Both are normalized defensively rather than trusting the canvas/`heic2any` to set it.
  6. **`isHeic` sniffs ten ISO-BMFF brands, not two.** `mif1`/`msf1` are _generic_ HEIF brands an iPhone also
     emits, so a sniff that only looks for `heic`/`heix` waves them through and Chrome renders a blank. The plan's
     "attempted-`createImageBitmap`-and-catch fallback" was dropped: magic bytes are authoritative, and the residual
     case (a format the browser cannot decode) is better served by letting `compressImage` **throw loudly** into the
     tile's `failed` / `Ponów` state than by silently uploading a blank rectangle. The fallback is now the MIME type,
     used only when the file is too short to sniff.
  7. **`compressImage` falls back to `HTMLCanvasElement.toBlob`** when `OffscreenCanvas` is absent — iOS Safari only
     gained it in 16.4, and an employee's phone is exactly the device that lags. Also added `src/lib/protocol-labels.ts`
     (slot + damage-type Polish labels, `fuelLabelPl`) since the PDF and the Phase 5 form must not name a slot
     differently on screen and in the customer's only copy of the evidence.
- 2026-07-10 — **Phase 5 implemented.** `ProtocolForm` + `FuelBar` / `PhotoSlot` / `DamageEditor` / `SignaturePad` /
  `Overlays`, `useProtocolSubmit`, a browser storage client, and the host page
  `/dashboard/pickups/[reservationId].astro`. First `react-hook-form` adopter, per `lessons.md`. Findings:
  1. **`client:only="react"` confirmed on the built bundle**, per the Phase 4 finding. `dist/server` contains no
     pdf-lib, fontkit or heic2any module — the sole `heic2any` string in `worker-entry` is its client-asset URL in
     the manifest. Worker: **2,709.93 KiB / 560.02 KiB gzip** vs. the 2,703.55 / 559 baseline. The ~6 KiB is the new
     `.astro` page and its manifest entries, not the island. `heic2any` splits into its own 1,353 KB client chunk.
  2. **A top-level `return` in `.astro` frontmatter crashes ESLint.** `@typescript-eslint/no-misused-promises`
     throws `Non-null Assertion Failed: Expected node to have a parent` under `astro-eslint-parser` — reproduced on a
     two-line probe, for both `return new Response(...)` and `return Astro.redirect(...)`. No page in this repo has
     one, which is why it had never surfaced. The page uses the catalog detail page's `Astro.response.status = 404`
     pattern instead, and the "already issued" case renders a static twin of the conflict screen rather than
     redirecting. (The React `ConflictScreen` stays — it serves the 409 race, which is a different event.)
  3. **The island talks to Storage with `createBrowserClient`, not a token prop.** `@supabase/ssr` writes its session
     cookies with `httpOnly: false` (its `DEFAULT_COOKIE_OPTIONS`), so the browser client picks up the employee's JWT
     from the same cookies the SSR client wrote. `SUPABASE_KEY` (the publishable anon key) is passed as a prop.
  4. **The signature canvas is the one blob the island mints itself** — `canvas.toBlob(cb, "image/png")` — and
     `uploadObject` passes `blob.type` through as `contentType` for every upload. `compressImage` already types
     `image/jpeg` and `buildProtocolPdf` `application/pdf`; an untyped blob is rejected as `application/octet-stream`
     by the bucket's `allowed_mime_types` (Phase 3 finding #3).
  5. **`useFieldArray` needs `keyName: "_key"`.** Its default key field is `id`, which collides with the damage row's
     own client-minted `id` — the very value that keys that item's storage objects.
  6. **The resolver is asserted once, across the schema's input/output boundary.** `protocolInputSchema` sees the
     odometer as a string and yields `ProtocolInput` with a number; `z.preprocess` widens its input type to `unknown`,
     so a single `as unknown as Resolver<FormValues, unknown, ProtocolInput>` beats scattering casts at every field.
  7. **The React Compiler skips memoizing `ProtocolForm`** (`react-hooks/incompatible-library`, a warning, not an
     error): RHF's `watch()` returns a function it cannot memoize safely. Expected, and preferable to stale fields.
  8. Two deliberate departures from the design contract, both to avoid a worse failure:
     **(a)** submit is disabled while an upload is in flight and while submitting, but **not** merely because
     validation errors exist — the contract's "disable the submit button" on a failed submit would strand an employee
     whose only way out is to resubmit. **(b)** a `done` photo tile shows the compressed thumbnail under a dark scrim
     instead of the contract's flat hatch, and re-opens the picker on tap, so a mis-aimed shot is retakeable.
     Also: `Rozmiar`-less damage rows render without the `({size})` suffix, and Polish photo counts take all three
     plural forms (`1 zdjęcie` / `2 zdjęcia` / `5 zdjęć`) rather than the contract's two.
  9. **`5.3` reads "unchanged", measured as +1 KiB gzip.** Recorded rather than rounded away: the island contributed
     zero, the page contributed the rest.
- 2026-07-14 — **Phase 5 manual verification (5.5–5.10) done on real iOS + Android + desktop.** The session surfaced
  a set of deliberate deviations beyond those above, each a UX/correctness call taken with the user. All are captured
  for the mocks in `design-deltas.md` (hand-off to the Claude Design project); summary here:
  1. **`crypto.randomUUID` needs a secure context.** Blank island on a phone over LAN (`http://<ip>:4321`, insecure):
     the `useState` initializer threw. Added `randomUuid()` in `protocol-form.ts` — `crypto.randomUUID` when present,
     else a v4 built from `crypto.getRandomValues` (available in insecure contexts). Unit-tested both paths.
  2. **`createImageBitmap(_, {imageOrientation:"from-image"})` throws on older iOS Safari.** Photos hung at 20% then
     `Ponów`. `compress.ts` now decodes in three tiers: with the option → without it → `<img>` fallback.
  3. **Signature became a full-screen modal**, replacing the inline pad (`SignaturePad.tsx` → `SignatureField` +
     `SignatureModal`). Scroll-locked, big canvas, `Zatwierdź podpis` commits+uploads then closes; the inline field
     collapses to a signed summary with `Zmień`. This also dissolved a clear-vs-async-upload race seen only on slower
     Android (the inline pad had needed a generation guard; the modal removes the race by construction).
  4. **Photo pickers offer the gallery, not only the camera** — dropped `capture="environment"` from `PhotoSlot` and
     the damage picker so the native chooser lists library + camera. `accept="image/*"`, still no `image/heic`.
  5. **In-session `Pobierz PDF`** on the `sent` / `email` overlays (object URL of the just-built blob, revoked on
     unmount). Not on `pdf` (no blob). Durable retrieval stays an S-06 concern.
  6. **Desktop layout is now two independent-height columns** (left §1+§3, right §2+§4) via `display:contents`
     wrappers that collapse to the single mobile column with `order-*`. Fixes a large void under §1 caused by CSS
     grid's shared row heights (the tall photos section set the row).
  7. **Section-1 fixes:** the odometer input box grows so its bottom aligns with the fuel bar's E/F line; both field
     errors are bottom-pinned, horizontally aligned, with matching ⚠ icon+text.
  8. **Overlay recipient copy corrected:** the contract's `Wysłano do <email>` was false on failures. Now `sent` shows
     no recipient line, `email` shows `Nie wysłano do <email>`, `pdf` shows none (no send was attempted).
  9. **Test-only injections used then reverted:** a bogus `RESEND_API_KEY`/`EMAIL_FROM` in `.dev.vars` (forces the
     `email` overlay) and a `?failPdf=1` URL hook (forces the `pdf` overlay). Both removed before this commit; the
     `photoError` on-screen diagnostic added mid-debug was also removed. `5.9`'s `Wyślij ponownie` was proven to
     re-post and re-fail with the fake key; proving it flips to `sent` needs a real key (Phase 7 send gate).
  10. **`vehicles.plate` note for testers:** the dispatch RPC filters `pickup_date = current_date`, so manual test
      reservations must be re-seeded for "today" — they are local-only fixtures, wiped by `db reset`, not committed.
- **Design contract distilled into `plan.md` Phase 5** (all 60+ `proto.*` PL strings verbatim, every component
  state, both viewport layouts). Per `lessons.md`, `/10x-implement` must build from that text and **not** re-open
  the JSX or the PNG exports. One correction to audit v2 §A: read from source, the desktop columns are
  **left `1.35fr` = condition + damage, right `1fr` = photos + signature** — the audit had them reversed.
