# Return Protocol with Comparison (S-06) Implementation Plan

## Overview

Add a **return protocol** to the handover lifecycle. At vehicle return an employee opens the return
form — the issue protocol baseline is shown as read-only reference, all current values (odometer, fuel,
damage, photos, signature) are entered fresh — and the system auto-computes and displays **deltas**:
kilometres driven, fuel change, and a per-item `existing | new` damage diff against the baseline. On
submit the protocol commits and a client-generated PDF (carrying a comparison section) is emailed to the
customer, exactly as the issue protocol is.

S-06 rides on the shipped S-05 (issue-protocol) spine. The `protocols` table gains a `type` discriminator
so one reservation can hold both an issue and a return protocol; the media pipeline, PDF generator, email
adapter, storage bucket, and dispatch pattern are all reused. The genuinely new work is the **delta
computation** (the differentiating value over paper), the **baseline consumption**, and a **design-aligned
comparison UI**.

## Current State Analysis

- `protocols` is **issue-only**. `supabase/migrations/20260710120000_issue_protocol.sql:82-93` defines it
  with `unique (reservation_id)` (`:84`), which structurally forbids a second (return) protocol per
  reservation. There is **no `type`/discriminator column**. "Issued" = existence of a `protocols` row
  (`:9-13`); `reservation_status` (`'pending','confirmed','rejected','cancelled'`) is deliberately
  untouched and the no-overlap `EXCLUDE` constraint depends on it
  (`supabase/migrations/20260603155136_booking_integrity_data.sql:124-129`).
- **Access is RPC-only.** The five protocol tables have RLS enabled + **zero policies** + all grants
  revoked from `anon`/`authenticated` (`20260710120000_issue_protocol.sql:155-165`); every read/write goes
  through a `SECURITY DEFINER` RPC that self-gates on `current_app_role()`
  (`supabase/migrations/20260604153139_employee_admin_roles.sql:47-55`). No RPC maps
  `reservation_id → issue protocol` — the baseline lookup S-06 needs does not exist.
- **Storage is hardcoded to the `issue/` prefix.** Bucket `protocols` (private, 10 MiB, jpeg/png/pdf) at
  `20260710120000_issue_protocol.sql:191-199`; the three `storage.objects` policies are scoped to
  `(storage.foldername(name))[1] = 'issue'` (`:218-245`). The client path builders
  (`src/components/protocol/storage.ts`), the schema `superRefine` (`src/lib/protocol-schema.ts:94-116`),
  and the PDF-finalize route guard (`src/pages/api/protocols/[id]/pdf.ts:48-55`) all pin `issue/`.
- **The client pipeline is reusable.** `ProtocolForm.tsx` (RHF + `useFieldArray`),
  `src/components/hooks/useProtocolSubmit.ts` (the commit → build-PDF → finalize+send ordering,
  `:7-29`), the media pipeline (`src/lib/media/{compress,heic,protocol-pdf,fonts}.ts`), `SignaturePad`,
  `DamageEditor`, `FuelBar`, `PhotoSlot`, `Overlays`, `ProtocolView`, `DeliveryBadge`, and the leaf
  components under `src/components/protocol/` are all domain-shaped, not issue-specific — except the PDF
  title strings, hardcoded "Protokół wydania" (`src/lib/media/protocol-pdf.ts:121,143,370`).
- **The `existing | new` damage tag is already anticipated.** `src/types.ts:175-185` and the archived
  design audit (`context/archive/2026-07-09-issue-protocol/design-audit.md:127-130,149`) both record that
  it is derived at **return time** by diffing against the issue list — never stored at pickup. Structured
  damage items exist specifically so the return can auto-diff ("you cannot diff a prose blob").
- **Dispatch pattern is the clone target.** `src/pages/dashboard/pickups.astro` +
  `src/components/dashboard/PickupQueue.tsx` (action-vs-badge keyed off `protocol_id` truthiness) and the
  view screen `src/pages/dashboard/protocols/[id].astro` + `ProtocolView.tsx`. `list_dispatch_today`
  filters `pickup_date = current_date` (`20260710120000_issue_protocol.sql:456-457`); the returns analogue
  keys off `return_date`. The `/dashboard` catch-all in `src/lib/access.ts:46` already employee-gates any
  new dashboard page.
- **No design asset for the comparison surface.** Only one mobile screenshot
  (`context/foundation/design/screenshots/14-staff-mobile-return-protocol.png`) and stale removed JSX
  (`ScreenReturnProtocol`/`ScreenStaffReturn`, predating structured damage). No desktop return screen and
  no delta-view design exist.

### Key Discoveries:

- The whole S-05 design was built to be extended by S-06: the storage prefix comment "folder-per-protocol
  makes S-06 reuse and cleanup trivial" (`20260710120000_issue_protocol.sql:183`), the derived-at-return
  `existing | new` tag (`src/types.ts:175-178`), and six deliberate pickup-screen divergences handed off
  "so S-06 starts from the real shape" (`context/archive/2026-07-09-issue-protocol/design-deltas.md:9-11`).
- New `SECURITY DEFINER` RPCs must `revoke execute … from public, anon` **before** granting to
  `authenticated` — a grant alone restricts nothing (lessons.md; `known-issues.md:30-49`; precedent
  `supabase/migrations/20260714120000_rpc_execute_grant_hardening.sql`).
- pdf-lib **throws** on 8 of 9 Polish diacritics with a standard font; the return PDF inherits the
  embedded-TTF + fontkit requirement and the diacritic-fixture rule (lessons.md; `src/lib/media/fonts.ts`,
  `src/assets/fonts/NotoSans-*.subset.ttf`).
- A real hosted-attachment send **422s on localhost** signed URLs — the definition-of-done "real send" is a
  production exercise against the verified sender domain, matching S-05 (memory: `resend-send-gate-prod-only`).

## Desired End State

An employee opens `/dashboard/returns`, sees vehicles due (today) or overdue to return that were issued in
the system, taps one, and the return form opens with the issue baseline shown as reference. They enter the
current odometer, fuel, photos, damage (each damage row auto-tagged `existing`/`new` against the baseline,
correctable), and a signature. A live comparison block shows km driven, fuel change, and new damage —
adverse deltas flagged. On submit the return protocol commits and the customer receives a PDF whose
comparison section renders `ą ć ę ł ń ó ś ź ż` correctly. If the email or PDF fails, the return still
commits and the row carries a badge with a working resend. A role-null or anonymous caller reads nothing
from any protocol table or storage object. The `reservation_status` enum and the no-overlap constraint are
untouched.

**Verification:** `npm run lint`, `npm run build`, `npm test` (unit), `npm run test:integration` all pass;
a manual return filed on a phone against a seeded baseline shows correct deltas and (in production) emails a
diacritic-correct PDF; the UI matches the design contract finalized in Phase 1.

## What We're NOT Doing

- **No monetary/charge computation** — deltas only. No extra-km cost, fuel-shortfall pricing, deposit
  settlement, or late-fee calculation (PRD Non-Goal; FR-007 is comparison only).
- **No `reservation_status` change** — "returned" is return-protocol row existence, mirroring "issued". The
  enum and the `EXCLUDE` overlap constraint are not touched.
- **No editable pre-fill** of current values — the baseline is read-only reference; all current values are
  entered fresh (FR-007 rejects pre-filling).
- **No standalone return** without an issue baseline — a return requires an existing issue protocol.
- **No hard block** on impossible values (negative km) — soft warnings only.
- **No new subsystem** — no new storage bucket, no service-role client, no new email provider; the S-05
  bucket, adapter, and `sendTracked` are reused.
- **No signed URLs to the customer** — the PDF is a client-generated attachment, as in S-05.
- **No refactor of the issue form/flow** — leaves are shared and extended additively; the issue submit
  orchestration is not rewritten (hybrid reuse).
- **Not S-07** (overdue-returns dashboard) — the returns worklist includes overdue rows so nothing strands,
  but the standalone overdue _flag_ on the dashboard is S-07's job.

## Implementation Approach

Server-first, mirroring S-05: data → pure logic → service → API → UI. One `protocols` table gains a `type`
discriminator (`'issue' | 'return'`) and a `baseline_protocol_id` self-FK; return rows link to their issue
row. The delta computation is a **pure, unit-tested helper** (`src/lib/protocol-delta.ts`, mirroring
`availability.ts`) that both the UI and the PDF consume — the differentiating value lives in code that runs
without a database. Photos, signature, and PDF go **browser → Supabase directly** under `storage.objects`
RLS (never through the Worker), reusing the media pipeline; only the path prefix changes (`issue/` →
`return/`). The return commits **before** the email is attempted; the outcome lands in the existing
append-only `email_deliveries` table and surfaces as a dispatch badge with resend.

**Reuse strategy (hybrid):** leaf components (`SignaturePad`, `FuelBar`, `PhotoSlot`, `DamageEditor`,
`Overlays`) and the media pipeline are shared and extended additively; a new thin **return form shell**,
**return schema**, and **PDF comparison section** compose them. Phase 5 also lifts the shared
upload/blob/signature orchestration out of `ProtocolForm` into a `useProtocolMedia` hook that both forms
consume — a mechanical extraction (no behavior change), not a rewrite — so the ~150 lines of media
orchestration exist once and `ProtocolForm` shrinks. Extract by responsibility/reuse, not by raw line count.

**Design gate:** Phase 1 (design alignment via Claude Design) gates only the UI-surface phases (5–6). The
data, delta helper, service, PDF, email, and API phases (2–4) are design-independent and proceed in
parallel with the design review.

## Critical Implementation Details

- **The `issue`/`return` prefix must stay consistent across four places or bytes leak past RLS**: the client
  path builders (`src/components/protocol/storage.ts`), the return schema `superRefine`, the PDF-finalize
  route path guard, and the `storage.objects` RLS predicate
  (`(storage.foldername(name))[1] in ('issue','return')`). The **three TypeScript places must share one
  source**: a `ProtocolKind = 'issue' | 'return'` type in `src/types.ts` and a small
  `src/lib/protocol-storage-paths.ts` module (path builders + an `isValidObjectPath(kind, protocolId, path)`
  checker) that the client, the schema, and the route guard all import — not a global settings object, one
  domain-scoped module matching the `PHOTO_SLOTS`/`DAMAGE_TYPES` convention. The **SQL RLS policy cannot
  import TypeScript**, so it is the unavoidable second copy — pin the two together with an integration test
  that a `return/`-prefixed object is staff-writable and anon-invisible (Phase 7). Missing any place either
  blocks legitimate uploads or leaves the prefix ungoverned.
- **The manual damage override is persisted, not re-derived.** Auto-tag only _suggests_ a baseline match;
  the value the employee confirms is stored as `protocol_damages.baseline_damage_id` on the return rows
  (non-null ⇒ carried over/existing, null ⇒ new). The delta helper's matcher runs on the client to
  pre-select; the DB stores the decision.
- **Submit ordering is inherited and must not roll back after commit** (`useProtocolSubmit.ts:7-29`): photos
  and signature are already in storage → `POST` create (no email) → build PDF client-side (now with the
  comparison section) → upload PDF → `POST` finalize (stores `pdf_path`, signs URL, sends). Steps after
  commit never roll back; a PDF/email failure surfaces on the badge and is resendable.
- **`get_protocol` is type-agnostic** (keyed by protocol id) and works for return rows unchanged; the return
  view loads the baseline with a second `get_protocol(baseline_protocol_id)` call and computes deltas via
  the pure helper. No new read RPC is needed for the view.
- **The migration alters a live unique constraint.** Add `type` with `default 'issue'` (backfills existing
  rows), then `drop default`; drop `unique (reservation_id)`, add `unique (reservation_id, type)`. Today no
  reservation has two protocols, so the composite unique cannot conflict on apply. Check prod row counts
  before applying (see Migration Notes).
- **The form island must mount `client:only="react"`** to keep pdf-lib/heic2any out of the Worker bundle
  (matching `src/pages/dashboard/pickups/[reservationId].astro:18-22`).

---

## Phase 1: Design alignment (UI gate)

### Overview

Connect to Claude Design, review the ready return-protocol mockups, correct them where wrong, and distil the
result into a textual design contract. This phase gates the UI-surface phases (5–6) only; Phases 2–4 proceed
in parallel. **Human-in-the-loop:** connecting to Claude Design requires the claude.ai connector to be
authorized interactively; this phase is a design review the user drives, not an automated step.

### Changes Required:

#### 1. Pull and review the return-protocol designs

**Source**: Claude Design project `352d78a6-84fd-49a2-8b38-2fe289691fc3` (via `DesignSync`); offline
reference `context/foundation/design/screenshots/14-staff-mobile-return-protocol.png`.

**Intent**: Fetch the current return-protocol mockups (`ScreenReturnProtocol` / `ScreenStaffReturn`), assess
them against the settled decisions, and correct the design where it is wrong before any UI is built.

**Contract**: The review must resolve these known gaps against this plan's decisions: (a) the mockups use
the **old prose damage model** — they must consume the structured `existing | new` damage list; (b) there is
**no desktop return screen** — add one mirroring the issue form's two-column layout; (c) there is **no
comparison/delta block** designed — define the baseline-reference panel + the delta summary (neutral, with
adverse fuel/new-damage flagged using the `warning #B6790E` token); (d) the return **view** screen (read-only

- PDF download + comparison) is undesigned. Read `context/foundation/design-system.md` fully first; build
  against live tokens in `src/styles/global.css`.

#### 2. Write the design contract

**File**: `context/changes/return-protocol-comparison/design-contract.md`

**Intent**: Pay the image cost once (lessons.md) — distil the corrected mockups into a compact textual
contract so Phases 5–6 build from text and never re-open the PNGs.

**Contract**: The contract names, per surface (return form mobile + desktop, delta/comparison block, returns
dispatch list, return view): the layout structure, the section order and spacing/token intent, the component
breakdown (which S-05 leaves are reused where), and the **canonical Polish copy strings** (form section
titles, the delta labels e.g. "Przejechano", "Zmiana paliwa", "Nowe uszkodzenia", worklist empty state,
action labels e.g. "Przyjmij zwrot", badges). It names the exact corrected screenshot path(s).

### Success Criteria:

#### Automated Verification:

- Design contract file exists: `test -f context/changes/return-protocol-comparison/design-contract.md`

#### Manual Verification:

- The Claude Design return mockups are reviewed and corrected (structured damage, desktop screen, delta
  block, return view) — user confirms alignment.
- The design contract captures all four surfaces with canonical Polish copy and reuses S-05 tokens/leaves.
- Adverse-delta flagging uses the existing `warning` status token; layout matches the corrected mockups.

**Implementation Note**: This phase is the gate for Phases 5–6. Pause for the user's confirmation that the
design is aligned before building any UI surface. Phases 2–4 do not wait.

---

## Phase 2: Data layer

### Overview

The schema discriminator, the storage `return/` prefix RLS, the three new RPCs (baseline lookup, returns
worklist, create-return), and a seeded baseline — following the S-05 RLS-on + zero-policies + revoke-all
posture.

### Changes Required:

#### 1. Migration: discriminator + baseline links

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_return_protocol.sql` (timestamp after `20260714120000`)

**Intent**: Let one reservation hold both an issue and a return protocol, and record the return→issue
linkage and per-damage baseline linkage.

**Contract**: Create enum `protocol_type` as `('issue','return')`. On `protocols`: add
`type protocol_type not null default 'issue'` then `alter column type drop default` (backfill-then-tighten,
mirroring the `vehicles.plate` pattern); drop `unique (reservation_id)`, add `unique (reservation_id, type)`;
add `baseline_protocol_id uuid references protocols (id)`; add
`check ((type = 'issue' and baseline_protocol_id is null) or (type = 'return' and baseline_protocol_id is not null))`.
On `protocol_damages`: add `baseline_damage_id uuid references protocol_damages (id)` (non-null ⇒ carried
over from that baseline item; null ⇒ new; always null on issue rows). Keep RLS enabled + no policies; the new
columns inherit the existing revoke-all posture (access stays RPC-only).

#### 2. Storage RLS: cover the `return/` prefix

**File**: same migration

**Intent**: Extend the three `storage.objects` policies so `return/`-prefixed objects are governed exactly
like `issue/` ones.

**Contract**: Alter (drop + recreate) the SELECT / INSERT / UPDATE policies from
`20260710120000_issue_protocol.sql:218-245` so the folder predicate reads
`(storage.foldername(name))[1] in ('issue','return')`. Keep the `(select public.current_app_role()) in ('employee','admin')`
scalar-subquery form (lessons.md — one-time InitPlan). No DELETE policy (append-only durability preserved).

#### 3. RPC: `get_return_baseline(p_reservation_id uuid)`

**File**: same migration

**Intent**: Load the issue baseline for the return screen — the one lookup S-05 never exposed.

**Contract**: `SECURITY DEFINER`, `set search_path = ''`, `stable`; gate on
`current_app_role() in ('employee','admin')` (else no rows / unauthorized tag). Returns the issue protocol
(`type = 'issue'`) for the reservation: its `id` (the baseline id the form submits), odometer, fuel, and its
damages (`id, type, location, size`) as jsonb, plus reservation + vehicle fields (reference, customer name/
email, dates, make/model/plate) and a `return_protocol_id` (the existing return row if any). Returns a
`not_found` signal when no issue protocol exists. `revoke execute … from public, anon; grant execute … to authenticated;`

#### 4. RPC: `list_returns_today()`

**File**: same migration

**Intent**: The returns worklist — due-or-overdue, still open, plus today's just-filed returns for email
recovery.

**Contract**: `SECURITY DEFINER`, `stable`, role-gated. `reservations r join vehicles v` join the issue
protocol (`type='issue'`) `left join` the return protocol (`type='return'`) `left join lateral` the newest
`email_deliveries` for the return protocol. Filter: `r.status = 'confirmed'` AND an issue protocol exists
AND `r.return_date <= current_date` AND `(return protocol is null OR return.created_at::date = current_date)`
— so overdue-open rows stay until processed, a just-filed return stays today for resend, and older-filed
returns drop off. Columns mirror `list_dispatch_today` (reservation/vehicle/reference/customer/dates,
`return_protocol_id`, `pdf_path`, `delivery_status`, `delivery_created_at`) plus the baseline summary
(`baseline_protocol_id`, `baseline_odometer_km`, `baseline_fuel_eighths`). `revoke`/`grant` per convention.

#### 5. RPC: `create_return_protocol(...)`

**File**: same migration

**Intent**: Commit a return protocol with its photos and (baseline-linked) damages, enforcing the
issue-baseline precondition and one-return-per-reservation.

**Contract**: `SECURITY DEFINER`, plpgsql, role-gated. Args mirror `create_protocol` plus
`p_baseline_protocol_id uuid`; damages jsonb carries an optional `baseline_damage_id` per item. Logic:
`select … for update` the reservation → `not_found` if missing; assert an issue protocol exists for the
reservation → `no_baseline` if not; assert `p_baseline_protocol_id` equals that issue protocol's id; insert
the `type='return'` row with `baseline_protocol_id` and `created_by = auth.uid()`; on
`unique_violation (reservation_id, 'return')` return `conflict` + the existing return id; bulk-insert
`protocol_photos`, `protocol_damages` (with `baseline_damage_id`), and `protocol_damage_photos`. Result tags:
`unauthorized | not_found | no_baseline | conflict | ok`. `revoke`/`grant` per convention. **Do not touch
`reservation_status`.** `set_protocol_pdf` and `record_email_delivery` are reused unchanged.

#### 6. Seed a baseline issue protocol

**File**: `supabase/seed.sql`

**Intent**: Make the returns worklist and deltas demoable after `db reset`.

**Contract**: Insert one issue `protocols` row (`type='issue'`, no `pdf_path`) + a couple of
`protocol_damages` against an existing seeded **confirmed** reservation whose `return_date <= current_date`,
with realistic odometer/fuel. **No storage objects** (no photo/signature bytes) — `protocol_photos` left
empty; the demo shows numeric + damage deltas. Every seeded name/location carries the full diacritic set
`ą ć ę ł ń ó ś ź ż` (lessons.md). If no seeded confirmed reservation has a past/today `return_date`, adjust
one reservation's dates in the seed.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Types regenerate without error (project's type-gen path); `npm run build` passes.
- `npm run test:integration` passes the new `returns-rls` suite (Phase 7 authors it; the RPCs must exist).

#### Manual Verification:

- After `db reset`, `select type, count(*) from protocols group by type` shows the seeded issue row; the
  seeded reservation appears in `list_returns_today()` as an open return.
- A `return/`-prefixed object can be inserted by a staff client and is invisible to anon (spot-check).
- `create_return_protocol` returns `no_baseline` for a reservation with no issue protocol and `conflict` on
  a second return.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Delta helper + return schema + service

### Overview

The pure delta computation (the differentiating value), the return input schema (pinning the `return/`
prefix), generalized storage path helpers, and the service functions wrapping the new RPCs. All
design-independent.

### Changes Required:

#### 1. Pure delta helper

**File**: `src/lib/protocol-delta.ts` (+ colocated `protocol-delta.test.ts`)

**Intent**: Compute the comparison from baseline + current values, with no I/O — consumed by both the form
and the PDF.

**Contract**: `computeReturnDeltas(baseline, current)` → `{ kmDriven, fuelDelta, newDamageCount,
flags: { fuelAdverse, damageAdverse, odometerSuspect } }` where `kmDriven = current.odometerKm −
baseline.odometerKm`, `fuelDelta = current.fuelEighths − baseline.fuelEighths`, `fuelAdverse = fuelDelta < 0`,
`damageAdverse = newDamageCount > 0`, `odometerSuspect = kmDriven <= 0` (soft-warning signal, km stays
neutral in display). `autoTagDamages(baselineDamages, currentDamages)` → for each current damage, suggest a
`baseline_damage_id` by matching `type` + normalized `location` (lowercased, whitespace-collapsed) + `size`;
returns suggestions only (persisted value comes from the form). Pure, exported, no React.

#### 2. Return input schema

**File**: `src/lib/return-protocol-schema.ts` (+ colocated test)

**Intent**: Validate the return submission on both client and API, pinning storage paths to `return/`.

**Contract**: Mirror `protocolInputSchema` (`src/lib/protocol-schema.ts:80-117`) with the return additions:
`baselineProtocolId` (`z.guid()`); each damage item gains optional `baselineDamageId` (`z.guid().nullable()`).
The `superRefine` validates every path via `isValidObjectPath('return', protocolId, …)` imported from the
shared `protocol-storage-paths` module (change #3) — **no inline `return/` literal** (the return analogue of
the `issue/` check at `:94-116`). Reuse `PHOTO_SLOTS`, `DAMAGE_TYPES`, and `firstIssuePerField` from the
existing schema so error-body shape cannot drift. Export `type ReturnProtocolInput`.

#### 3. Shared storage-path module + `ProtocolKind` type

**Files**: `src/types.ts`, `src/lib/protocol-storage-paths.ts`, `src/components/protocol/storage.ts`

**Intent**: Give the `issue`/`return` prefix a single TypeScript source of truth instead of four hand-copied
literals, so the client, schema, and route guard cannot drift.

**Contract**: Add `export type ProtocolKind = 'issue' | 'return'` to `src/types.ts` (beside
`ProtocolPhotoSlot`/`ProtocolDamageType`), mirroring the DB `protocol_type` enum. Create
`src/lib/protocol-storage-paths.ts` exporting the path builders keyed by `kind` (`photoPath`,
`damagePhotoPath`, `signaturePath`, `pdfPath` — currently raw `issue/…` literals in
`src/components/protocol/storage.ts:32-36`) plus a single `isValidObjectPath(kind, protocolId, path)`
predicate. Re-point `storage.ts` to consume/re-export these, defaulting `kind` to `'issue'` so existing issue
call sites are unchanged. This is the module the return schema (change #2) and the PDF route guard (Phase 4)
import — **do not reintroduce the literal `return/` string in those files**. Domain-scoped, not a global
settings object (matches the `PHOTO_SLOTS`/`DAMAGE_TYPES` convention). Colocated unit test asserts the
builders/checker agree for both kinds.

#### 4. Service functions

**File**: `src/lib/services/protocols.ts` (+ types in `src/types.ts`)

**Intent**: Wrap the three new RPCs and make the email path type-aware.

**Contract**: Add `getReturnBaseline(client, reservationId)`, `listReturnsToday(client)`, and
`createReturnProtocol(client, input: ReturnProtocolInput)` mirroring the existing wrappers
(`:59-158` patterns: client-first, `UUID_RE`-guarded, null-client degrades, unexpected DB error rethrows;
map object-shaped photos/damages back to array shape for the RPC). Generalize `resendProtocolEmail`
(`:215-258`) to read the protocol's `type` (via `get_protocol`) and select the template
(`protocolIssuedEmail` vs `protocolReturnedEmail`) — `ENTITY_TYPE` stays `'protocol'`; the signed-URL path is
prefix-agnostic. Add `DispatchReturnRow` / result-union types to `src/types.ts` alongside the existing
protocol block (`:137-198`).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` — `protocol-delta.test.ts` (km/fuel/damage diff, auto-tag matching, adverse
  flags, negative-km `odometerSuspect`, diacritic fixtures) and `return-protocol-schema.test.ts` (valid
  input, `return/` path enforcement, rejects `issue/` paths).
- Type checking / lint passes: `npm run lint`.
- Existing issue-flow unit tests stay green (path-helper default preserves issue behavior).

#### Manual Verification:

- `computeReturnDeltas` matches hand-computed values on the seeded baseline (e.g. odometer 42 000 → 42 850
  ⇒ 850 km; fuel 8/8 → 4/8 ⇒ −4 flagged).
- `autoTagDamages` correctly pre-selects an unchanged baseline scratch as `existing` and a fresh dent as
  `new`.

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: PDF comparison + email + API routes

### Overview

The return PDF variant (title + comparison section), the return email template, and the three API routes —
reusing the commit-then-finalize spine. Design-independent.

### Changes Required:

#### 1. Parameterize the PDF + add the comparison section

**File**: `src/lib/media/protocol-pdf.ts` (+ `protocol-pdf.test.ts`)

**Intent**: Produce a return document ("Protokół zwrotu") that includes the baseline-vs-current comparison,
without duplicating the A4 layout engine.

**Contract**: Add a document-type/title parameter (issue title "Protokół wydania" stays default; return
title "Protokół zwrotu") to `buildProtocolPdf` (`:110-136`) and thread it through the hardcoded strings at
`:121,143,370`. Add an optional `comparison` block to `ProtocolPdfData` and a `drawComparison` section
(baseline vs current odometer/fuel + km driven, fuel change, and the `existing | new` damage list) rendered
for return documents. Reuse the embedded-TTF + fontkit path unchanged; every comparison fixture carries the
diacritic set.

#### 2. Return email template

**File**: `src/lib/email/templates.ts` (+ `templates.test.ts`)

**Intent**: A return-specific customer email carrying the comparison summary.

**Contract**: Add `protocolReturnedEmail(params): EmailContent` mirroring `protocolIssuedEmail`
(`:220-258`): subject "Protokół zwrotu — <reference>", Polish body with vehicle, dates, and the deltas (km
driven, fuel change, new-damage count) using the existing plural helpers (`fuelLabel`/`damageLabel`,
`:191-217`). The PDF is attached via the reused signed-URL `sendTracked` path.

#### 3. API routes

**Files**: `src/pages/api/return-protocols.ts`, `src/pages/api/return-protocols/[id]/pdf.ts`,
`src/pages/api/return-protocols/[id]/resend-email.ts`

**Intent**: The create / finalize+send / resend routes for returns, self-gating exactly like the issue
routes and leaving the issue routes untouched.

**Contract**: Follow the same self-gate order in each (`src/pages/api/protocols.ts:40-85`): (a) same-origin
Origin CSRF → 403; (b) `!user` → 401, `requireRole(locals,'employee')` → 403; (c) zod
(`returnProtocolSchema` / a return `pdfPathSchema` whose refine calls `isValidObjectPath('return', id, …)`
from the shared `protocol-storage-paths` module — no inline `return/` literal) → 400 `{ errors }`; (d) service
call. Create → 201 `{ protocol_id }` / 409 `{ status:'conflict', protocol_id }` / 409
`{ status:'no_baseline' }` / 404 / 403, **no email**. PDF-finalize → `setProtocolPdf` then
`resendProtocolEmail` → 200 `{ status:'ok', delivery }` regardless of email outcome. Resend → 200
`{ status:'ok', delivery }` / 409 `{ status:'no_pdf' }`. Register `/api/return-protocols` as an intentionally
staff-only route (self-gated; middleware does not cover `/api` — lessons.md).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` — return-PDF test (comparison section renders, diacritics intact),
  `templates.test.ts` return-email case.
- Integration tests pass: `npm run test:integration` — `return-protocols-api` (commit-then-email,
  idempotency 409, failure-visible-not-fatal, attachment realness).
- `npm run build` and `npm run lint` pass.

#### Manual Verification:

- `POST /api/return-protocols` against the seeded baseline commits a return and returns 201; a second
  submit returns 409 with the existing id.
- The generated return PDF opens with a correct comparison section and Polish characters intact.
- Anon / wrong-role callers get 401 / 403 from all three routes.

**Implementation Note**: Pause for manual confirmation before the UI phases.

---

## Phase 5: Return form island (design-gated)

### Overview

First lift the shared upload/blob/signature orchestration into a `useProtocolMedia` hook (re-pointing the
existing issue form at it), then build the return form shell on it — the baseline-reference panel, fresh
entry, the baseline-linked damage editor, the live delta display, and the inherited submit ordering.
**Requires the Phase 1 design contract.**

### Changes Required:

#### 1. Extract shared media orchestration + section primitives

**Files**: `src/components/hooks/useProtocolMedia.ts`, `src/components/protocol/FormSection.tsx`,
`src/components/protocol/ProtocolForm.tsx`

**Intent**: Give both forms one copy of the upload/blob/signature orchestration and the numbered-section
layout, keyed by storage `kind` — shrinking `ProtocolForm` and preventing drift between the two forms.

**Contract**: Extract into `useProtocolMedia({ supabaseUrl, supabaseKey, kind })`: `protocolId` minting, the
storage client, the blob cache (`blobs` ref + `registerBlob` + `bytesOf`), previews, tiles state, `capture`,
`fillFreeSlots`, `uploadDamagePhoto`, `handleSigned`/`signSeq`, and the `uploading`/`done` derived flags
(currently `ProtocolForm.tsx:149-330`). `kind` selects the storage prefix via the `protocol-storage-paths`
module (Phase 3). Move `Section`/`SectionHead` (`ProtocolForm.tsx:95-137`) to `FormSection.tsx`. Re-point the
existing `ProtocolForm.tsx` at both — a **pure mechanical extraction, no behavior change**. The PDF build
(`uploadPdf`) stays in each shell (issue vs return differ) but consumes `bytesOf` from the hook. This edits
shipped S-05 code; the existing integration tests + a manual issue-flow re-verify are the regression guard.

#### 2. Return form shell + submit hook

**Files**: `src/components/protocol/ReturnProtocolForm.tsx`,
`src/components/hooks/useReturnProtocolSubmit.ts`

**Intent**: A return-specific shell composing the shared hook + leaves, adding the baseline reference +
deltas.

**Contract**: RHF + `zodResolver(returnProtocolSchema)`, mounted `client:only="react"`, driven by
`useProtocolMedia({ kind: 'return' })`. Reuse `SignaturePad`, `FuelBar`, `PhotoSlot`, `Overlays`,
`FormSection`, and the media pipeline. Fields mirror the issue form plus `baselineProtocolId` and per-damage
`baselineDamageId`. A read-only **baseline reference panel** shows the issue odometer/fuel/damage list. A
**live comparison block** (built via `computeReturnDeltas`) renders neutral summary + adverse flags per the
design contract. The submit hook reuses the commit → build-PDF (with comparison) → upload → finalize+send
ordering (`useProtocolSubmit.ts:7-29`), targeting the `/api/return-protocols*` routes and the `return/`
storage prefix.

#### 3. Baseline-linked damage editor

**File**: `src/components/protocol/DamageEditor.tsx`

**Intent**: Let each entered return damage be tagged `existing` (linked to a baseline item) or `new`,
additively — issue mode is unchanged.

**Contract**: Add optional `baselineDamages` + per-row baseline-link control (`Nowe` / a baseline item),
auto-preselected from `autoTagDamages`, writing `baselineDamageId`. When the prop is absent the component
renders exactly as today (issue mode). Copy from the design contract.

#### 4. Return form entry page

**File**: `src/pages/dashboard/returns/[reservationId].astro`

**Intent**: The per-reservation return page that loads the baseline and mounts the form.

**Contract**: Mirror `src/pages/dashboard/pickups/[reservationId].astro`: load the baseline via
`getReturnBaseline(supabase, reservationId)` in frontmatter (404 if none), build the form `ctx` from it, and
mount `ReturnProtocolForm client:only="react"` inside `StaffShell`, injecting `SUPABASE_URL`/`SUPABASE_KEY`.

### Success Criteria:

#### Automated Verification:

- Existing S-05 unit + integration suites stay green after the `useProtocolMedia` extraction (no issue-flow
  regression): `npm test` + `npm run test:integration`.
- Unit tests pass: `npm test` — return-form pure helpers (delta display formatting, damage-tag defaulting).
- `npm run build` and `npm run lint` pass; the island stays out of the Worker bundle (`client:only`).

#### Manual Verification:

- The **issue** form is re-verified end-to-end after the extraction — photos, signature, submit, PDF, email
  all behave exactly as before.
- On a phone, the return form opens with the baseline shown read-only; entering current values updates the
  live comparison; a fresh damage defaults to `new`, an unchanged one to `existing`, and the toggle overrides.
- Submitting commits the return and shows the success overlay; a negative-km entry shows a soft warning but
  still submits.
- The layout matches the Phase 1 design contract on mobile and desktop.

**Implementation Note**: Gated on Phase 1. Pause for manual confirmation before Phase 6.

---

## Phase 6: Returns dispatch + view + nav (design-gated)

### Overview

The `/dashboard/returns` worklist, the return view screen with comparison, and the navigation entry.
**Requires the Phase 1 design contract.**

### Changes Required:

#### 1. Returns worklist page + queue

**Files**: `src/pages/dashboard/returns.astro`, `src/components/dashboard/ReturnQueue.tsx`

**Intent**: The dispatch surface, cloned from pickups, keyed on the returns worklist.

**Contract**: Mirror `src/pages/dashboard/pickups.astro` calling `listReturnsToday(supabase)`. `ReturnQueue`
mirrors `PickupQueue.tsx`: key the action-vs-badge decision off `return_protocol_id` truthiness — open rows
show "Przyjmij zwrot" → `/dashboard/returns/<reservation_id>`; returned rows show `DeliveryBadge` + "Otwórz
protokół" → `/dashboard/protocols/<return_protocol_id>` + conditional resend (reuse `useResendEmail`,
pointing at the return resend route). Empty-state and copy per the design contract.

#### 2. Return view with comparison

**Files**: `src/pages/dashboard/protocols/[id].astro`, `src/components/protocol/ProtocolView.tsx`

**Intent**: Reuse the existing protocol view for return rows and add the comparison block.

**Contract**: `get_protocol` already serves return rows. In the page, when the loaded protocol is a return,
also load the baseline via `getProtocol(supabase, baseline_protocol_id)` and pass it to `ProtocolView`.
`ProtocolView` renders the comparison block (via `computeReturnDeltas`) and a "Protokół zwrotu" PDF download
label when `type='return'`; issue rendering is unchanged. Signed URLs are minted server-side as today.

#### 3. Navigation + route intent

**Files**: `src/components/shell/StaffShell.astro`, `src/lib/access.ts` (+ `access.test.ts`)

**Intent**: Surface the returns tab and document the route's role intent.

**Contract**: Add a `{ id:'returns', href:'/dashboard/returns', label:'Zwroty', icon:… }` entry to `NAV`
(`StaffShell.astro:32-38`) and extend the `active` and `IconName` unions (`:17,:31`). Add
`{ prefix:'/dashboard/returns', role:'employee' }` to `ROUTE_ROLES` (`access.ts:27-46`) — optional
(the `/dashboard` catch-all already gates it) but documents intent, matching the pickups/protocols entries.

### Success Criteria:

#### Automated Verification:

- `npm test` — `access.test.ts` asserts `/dashboard/returns` resolves to `employee`.
- `npm run build` and `npm run lint` pass.

#### Manual Verification:

- `/dashboard/returns` lists the seeded open return and any overdue open returns; a returned row shows the
  delivery badge and opens the view.
- The return view shows the comparison and downloads a return PDF; the resend action works on an
  email-failed row.
- The "Zwroty" tab is present and active-highlighted; the surface matches the design contract.

**Implementation Note**: Gated on Phase 1. Pause for manual confirmation before Phase 7.

---

## Phase 7: Tests + send verification

### Overview

The data-layer and API contract tests, the return-email Risk #3 contract, the worklist fold test, and the
production real-send verification (definition of done).

### Changes Required:

#### 1. Data-layer / RLS tests

**File**: `tests/integration/returns-rls.test.ts`

**Intent**: Pin the grants, RPC authz, precondition, and idempotency for the return tables/RPCs.

**Contract**: Mirror `tests/integration/protocols-rls.test.ts` and `dispatch-list.test.ts`: role-null reads
0 rows from the protocol tables; anon cannot execute `create_return_protocol` / `list_returns_today` /
`get_return_baseline`; `no_baseline` when no issue protocol; `conflict` on a second return; **completing a
return does not change `reservation_status`**; `list_returns_today` fold — overdue-open included,
filed-today kept, older-filed dropped, open rows have null `return_protocol_id`. **Storage-prefix parity**:
a `return/`-prefixed object is writable/readable by a staff client and invisible to anon — this is the test
that pins the SQL RLS policy to the TypeScript `protocol-storage-paths` module (the prefix's one boundary
that cannot be shared by import).

#### 2. API contract tests

**File**: `tests/integration/return-protocols-api.test.ts`

**Intent**: The three routes' behavior, using the existing harness.

**Contract**: Mirror `tests/integration/protocols-api.test.ts` via `buildApiContext`/`asContext`
(`tests/helpers/context.ts`): commit-then-email (no send / no delivery row on create), idempotency (409 +
existing id), failure-visible-not-fatal (adapter throws → 200 + `failed` row), attachment realness. Extend
`api-authz`/`api-validation` matrices to include the return routes.

#### 3. Return-email contract test

**File**: `tests/integration/return-protocol-email.test.ts`

**Intent**: The Risk #3 contract for the return template (test-plan Phase 4 covers S-05/S-06).

**Contract**: Mirror `protocol-email.test.ts` using `tests/helpers/email.ts` (`captureEmails`/`failEmails`):
ATTEMPTED (a real `email_deliveries` row), SURFACED (`failed` → 200 + `deliveryBadge` reads `bad`), CORRECT
PAYLOAD (recipient, this return's `pdf_path` attachment, subject "protokół zwrotu" with diacritics intact).

#### 4. Real send verification (definition of done)

**Intent**: Prove the thing the slice exists to do — a real return protocol emailed to a real inbox with
diacritics intact.

**Contract**: A production exercise (hosted-attachment sends 422 on localhost signed URLs — memory
`resend-send-gate-prod-only`), against the verified sender domain. Not an automated test; a manual
production step recorded in `change.md`.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes all new return suites.
- `npm test` (unit) and `npm run lint` and `npm run build` all pass.
- The full existing suite stays green (no issue-flow regression).

#### Manual Verification:

- In production, one real return protocol is emailed to a real inbox and the PDF renders
  `ą ć ę ł ń ó ś ź ż` correctly in the comparison section.
- A role-null authenticated user and an anonymous one can read nothing from any protocol table or return
  storage object.

**Implementation Note**: The real-send step is the definition of done; record its outcome in `change.md`.

---

## Testing Strategy

### Unit Tests:

- `protocol-delta.ts` — km/fuel diff, `autoTagDamages` matching (including near-miss free-text locations),
  adverse flags, `odometerSuspect` on non-positive km. Every fixture carries the full diacritic set.
- `return-protocol-schema.ts` — valid input; `return/` path enforcement; rejects `issue/` paths and missing
  `baselineProtocolId`.
- `protocol-pdf.ts` — return comparison section renders with diacritics (the single most important test).
- `templates.ts` — `protocolReturnedEmail` subject/body/plurals.
- `access.ts` — `/dashboard/returns` → `employee`.

### Integration Tests:

- `returns-rls` — grants, RPC authz, precondition, conflict, status-untouched, worklist fold.
- `return-protocols-api` — create/pdf/resend behavior, idempotency, failure-visible-not-fatal.
- `return-protocol-email` — Risk #3 contract for the return template.

### Manual Testing Steps:

1. `db reset`; open `/dashboard/returns` — the seeded open return is listed.
2. On a phone, tap it; verify the baseline shows read-only and current values are empty.
3. Enter odometer/fuel/photos, add one fresh damage (defaults `new`) and confirm one baseline damage as
   `existing`; verify the live comparison and adverse flags.
4. Enter a return odometer below the baseline; verify a soft warning appears but submit still succeeds.
5. Submit; verify the success overlay, then open the return view and download the PDF (comparison section,
   diacritics).
6. (Production) verify the customer receives the return email with the PDF attached.
7. Force an email failure; verify the row badge + working resend.

## Performance Considerations

- Mobile memory: baseline reference is metadata-only (no baseline photos loaded in v1), so the return form's
  peak footprint matches the issue form's (8 × ~2 MB photos + a PDF copy ≈ 35–50 MB). Client-side compression
  remains the safeguard, not an optimization.
- All caller checks in RLS/RPCs use the scalar-subquery form for one-time InitPlan (lessons.md).
- The Worker never handles PDF/photo bytes (browser → Supabase direct), so the 10 ms CPU cap is not in play.

## Migration Notes

- The migration adds `type` with `default 'issue'` (backfills existing rows) then drops the default, and
  swaps `unique (reservation_id)` for `unique (reservation_id, type)`. Today no reservation holds two
  protocols, so the composite unique cannot conflict on apply. **Before applying to prod**, sanity-check
  `select reservation_id, count(*) from protocols group by 1 having count(*) > 1` returns no rows (memory:
  `db push ≠ seed`; prod ref `fmgbyfpilgzvhkziigsj`).
- The storage-policy change is drop + recreate of the three `storage.objects` policies; reversible by
  re-scoping the predicate back to `= 'issue'`.
- Seed changes are dev/demo-only and do not run against prod.

## References

- Change identity: `context/changes/return-protocol-comparison/change.md`
- Roadmap slice: `context/foundation/roadmap.md` S-06 (`:178-188`)
- PRD: US-02 (`:65-76`), FR-007 (`:97-98`), FR-008 (`:99`), domain logic (`:129-137`)
- S-05 (issue-protocol) archive — the reuse baseline:
  - Data layer: `supabase/migrations/20260710120000_issue_protocol.sql`
  - Plan/brief/research: `context/archive/2026-07-09-issue-protocol/{plan,plan-brief,research}.md`
  - Design handoff: `context/archive/2026-07-09-issue-protocol/{design-audit,design-deltas}.md`
- Client pipeline: `src/components/protocol/*`, `src/components/hooks/useProtocolSubmit.ts`,
  `src/lib/media/*`, `src/lib/protocol-schema.ts`, `src/lib/services/protocols.ts`,
  `src/lib/email/*`, `src/lib/services/email-delivery.ts`
- Dispatch pattern: `src/pages/dashboard/pickups.astro`, `src/components/dashboard/PickupQueue.tsx`,
  `src/pages/dashboard/protocols/[id].astro`
- Design: `context/foundation/design-system.md`,
  `context/foundation/design/screenshots/14-staff-mobile-return-protocol.png`, Claude Design project
  `352d78a6-84fd-49a2-8b38-2fe289691fc3`
- Lessons/known-issues: `context/foundation/lessons.md`, `context/foundation/known-issues.md`
- Test plan Phase 4 (S-05/S-06 email/photo integrity): `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Design alignment (UI gate)

#### Automated

- [x] 1.1 Design contract file exists — `design-contract.md`

#### Manual

- [x] 1.2 Claude Design return mockups reviewed and corrected (structured damage, desktop screen, delta block, return view) — via `design-alignment-brief.md` + `-addendum.md`; audited against source
- [x] 1.3 Design contract captures all four surfaces with canonical Polish copy and reused S-05 tokens/leaves
- [x] 1.4 Adverse-delta flagging uses the warning status token; layout matches corrected mockups

### Phase 2: Data layer

#### Automated

- [x] 2.1 Migration applies cleanly (`npx supabase db reset`) — 818360e
- [x] 2.2 Types regenerate and `npm run build` passes — 818360e
- [x] 2.3 `npm run test:integration` passes the new `returns-rls` suite — 818360e

#### Manual

- [x] 2.4 Seeded issue row present; seeded reservation appears in `list_returns_today()` as an open return — 818360e
- [x] 2.5 A `return/`-prefixed object is insertable by staff and invisible to anon — 818360e
- [x] 2.6 `create_return_protocol` returns `no_baseline` (no issue) and `conflict` (second return) — 818360e

### Phase 3: Delta helper + return schema + service

#### Automated

- [x] 3.1 Unit tests pass (`protocol-delta.test.ts`, `return-protocol-schema.test.ts`) — 523f1e4
- [x] 3.2 `npm run lint` passes — 523f1e4
- [x] 3.3 Existing issue-flow unit tests stay green — 523f1e4

#### Manual

- [x] 3.4 `computeReturnDeltas` matches hand-computed values on the seeded baseline — 523f1e4
- [x] 3.5 `autoTagDamages` pre-selects unchanged baseline damage as `existing`, fresh damage as `new` — 523f1e4

### Phase 4: PDF comparison + email + API routes

#### Automated

- [x] 4.1 Unit tests pass (return-PDF comparison + diacritics, `protocolReturnedEmail`) — 61eaa23
- [x] 4.2 Integration tests pass (`return-protocols-api`) — 61eaa23
- [x] 4.3 `npm run build` and `npm run lint` pass — 61eaa23

#### Manual

- [x] 4.4 `POST /api/return-protocols` commits a return (201); second submit returns 409 — 61eaa23
- [x] 4.5 Return PDF opens with a correct comparison section and Polish characters intact — 61eaa23
- [x] 4.6 Anon / wrong-role callers get 401 / 403 from all three routes — 61eaa23

### Phase 5: Return form island (design-gated)

#### Automated

- [x] 5.1 Existing S-05 unit + integration suites stay green after the `useProtocolMedia` extraction — c0bce0e
- [x] 5.2 Unit tests pass (return-form pure helpers) — c0bce0e
- [x] 5.3 `npm run build` and `npm run lint` pass; island stays out of the Worker bundle — c0bce0e

#### Manual

- [x] 5.4 Issue form re-verified end-to-end after the extraction (unchanged behavior) — c0bce0e
- [x] 5.5 Return form opens with read-only baseline; live comparison updates; damage defaults + override work — c0bce0e
- [x] 5.6 Submit commits; negative-km entry shows a soft warning but still submits — c0bce0e
- [x] 5.7 Layout matches the Phase 1 design contract on mobile and desktop — c0bce0e

### Phase 6: Returns dispatch + view + nav (design-gated)

#### Automated

- [x] 6.1 `access.test.ts` asserts `/dashboard/returns` → `employee` — 5dc814e
- [x] 6.2 `npm run build` and `npm run lint` pass — 5dc814e

#### Manual

- [x] 6.3 `/dashboard/returns` lists open and overdue-open returns; returned rows show badge + view — 5dc814e
- [x] 6.4 Return view shows the comparison and downloads a return PDF; resend works on an email-failed row — 5dc814e, e91a5c1 (view + comparison verified; PDF-download 404s locally as bytes aren't seeded, and a real resend is prod-only — both deferred to Phase 7/production)
- [x] 6.5 "Zwroty" tab present and active-highlighted; surface matches the design contract — 5dc814e

### Phase 7: Tests + send verification

#### Automated

- [x] 7.1 `npm run test:integration` passes all new return suites
- [x] 7.2 `npm test`, `npm run lint`, `npm run build` all pass
- [x] 7.3 Full existing suite stays green (no issue-flow regression)

#### Manual

- [ ] 7.4 In production, one real return protocol is emailed with diacritics correct in the comparison section
- [ ] 7.5 Role-null and anonymous users can read nothing from any protocol table or return storage object
