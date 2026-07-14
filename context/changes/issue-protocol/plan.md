# S-05 Issue Protocol — Implementation Plan

## Overview

At vehicle pickup an employee records the odometer, fuel level, structured damage items, six baseline
photos and the customer's signature — on a phone at the vehicle or on the depot desktop. On submit the
protocol commits, a client-generated PDF is uploaded to private storage, and the customer receives it as
an email attachment. The customer has no account and no portal: **email is their only channel, and that
PDF is their only copy of the evidence**, possibly needed in a dispute months later.

This is the roadmap's heaviest slice. It stands up **file storage**, **transactional email**, and a
**client-side PDF pipeline** for the first time, and it invents both the "issued" state concept and the
dispatch entry point, neither of which exists anywhere in the codebase today.

## Current State Analysis

**What exists and is directly reusable:**

- A provider-agnostic email seam — `EmailContent` / `EmailMessage` / `sendEmail` at `src/lib/email/index.ts:11-44`,
  with a module-local `adapter` const at `:39` and a comment at `:37-38` reserving S-05 for exactly one job:
  select a real adapter from configuration. Templates (`src/lib/email/templates.ts`) are pure functions
  returning `EmailContent`, already unit-tested.
- The canonical API gate sequence at `src/pages/api/vehicles.ts:30-63` — CSRF → 401 → 403 → body → zod → service.
- The service discriminated-union convention (`src/lib/services/vehicles.ts:173-180`): client-first, null client
  degrades rather than throws, `UUID_RE` guard, typed result tags, unexpected DB errors rethrow.
- The `SECURITY DEFINER` RPC pattern with an in-RPC role gate and `select … for update` re-read —
  `decide_reservation` at `supabase/migrations/20260617120000_reservation_approval.sql:60-157`.
- The Vitest harness: two projects (`unit`, `integration`), `tests/helpers/clients.ts` (`anonClient`, `as(role)`,
  `serviceClient`), `tests/helpers/context.ts` (`buildApiContext` — calls route handlers directly, necessary
  because `/api/*` bypasses middleware).

**What is missing:**

- **No "issued / picked up" state.** The enum is `pending|confirmed|rejected|cancelled`
  (`20260603155136_booking_integrity_data.sql:23-28`) and `decide_reservation` is its only transition path.
- **No surface lists confirmed reservations.** `PendingQueue` handles only pending → confirm/reject. A `grep`
  for `protocol|protokół|wydani|handover` across `src/` returns zero matches.
- **No storage buckets.** `supabase/config.toml:109-118` enables storage but every bucket is commented out.
- **No `vehicles.plate` column**, though the design has always assumed one (`vPlate: 'Rejestracja'`).
- **No mocking primitives anywhere** (`vi.mock`, `vi.fn`, `msw` → zero hits), and `EmailAdapter` is not exported.
- **No file uploads.** Every mutation is `await request.json()`; photos today are `https?` URL strings.

**The dominant correctness risk is grants, not the bundle.** `context/archive/2026-06-27-testing-data-layer-integrity/finding-rls-pii-leak.md`
records a confirmed leak of exactly the shape S-05 could repeat: Supabase applies an implicit default ALL grant
to `anon`/`authenticated` on every new `public` table, and combined with a `using(true)` policy any authenticated
caller — including a role-null user with no `profiles` row — could read all customer PII. The fix needed **both**
a `revoke` and a policy drop. `protocols` carries customer PII _and_ damage photos.

**`infrastructure.md` RISK A is measured false.** The Worker uploads at `gzip: 554.76 KiB` against a 3 MB limit,
and on `@astrojs/cloudflare` v13 client island JS is a separate static asset (`dist/client/`, 283 KiB gzip) served
without invoking the Worker. Signature, compression and PDF libraries are browser-only and add **0 bytes to the
Worker bundle**. The one guardrail: never import them at SSR module scope.

## Desired End State

An employee opens `/dashboard/pickups`, sees today's confirmed reservations — those still awaiting handover offering
`Wydaj`, those already issued carrying a delivery badge — and taps one. They fill odometer + fuel + damage + six
photos + signature, submit, and the customer receives a PDF by email. If the email or the PDF fails, the protocol still commits and the failure is visible on the dispatch row
with a working resend action. A wrong-role or anonymous caller can read nothing.

**Verification**: `npm run lint && npm run build && npm test && npm run test:integration` all pass; an integration
test proves a role-null authenticated client reads zero rows from `protocols`; a real Resend send lands a PDF
containing `ą ć ę ł ń ó ś ź ż` in a real inbox.

### Key Discoveries:

- `src/lib/email/index.ts:22` — `type EmailAdapter` exists but is **not exported**, and `adapter` is a module-level
  const at `:39`. Neither is swappable from a test today. Exporting it is what makes risk #3 testable.
- `src/pages/api/reservations/[id].ts:64-98,148-150` — the closest sibling: gate → definer RPC → **best-effort
  email after commit**, with `catch` swallowing into `console.error`. Crucially, **this catch has never fired**:
  `devLogAdapter` cannot throw. It becomes live code the moment a real provider lands.
- `src/lib/access.ts:62-74` — `isRoleSufficient(null, …)` is `false`, so a role-null user fails closed. But
  `[id].ts:118` returns **403** for anon while `vehicles.ts:38-43` returns **401** (finding F2). S-05 must pick.
- `20260603155136_booking_integrity_data.sql:124-129` — the `EXCLUDE` predicate is `where status in ('pending','confirmed')`.
  Treating "issued" as a `protocols` row (not an enum value) means a rented-out vehicle keeps holding its slot and
  the no-double-booking guarantee **cannot regress**.
- `src/types.ts:12-16` — `numeric(10,2)` columns deserialize as `string` in supabase-js despite the generated
  `number` type. `odometer_km` is `int` and `fuel_eighths` is `smallint`, so both are safe; do not add a numeric.
- **Desktop columns, read from source** (`staff-protocol-desktop.jsx`): left `1.35fr` = condition + damage;
  right `1fr` = photos + signature. Design audit v2 §A guessed this backwards — trust the source.
- `e2e/e2e-rules.md:87-88` — flags that `page.route()` cannot stub a server-side send. The email fake must be
  injected at the adapter, not the browser.

## What We're NOT Doing

- **No `reservation_status` enum change.** "Issued" = the existence of a `protocols` row. The `EXCLUDE` predicate
  is untouched.
- **No signed URLs to the customer, ever.** The customer receives a PDF attachment. The only signed URL minted is
  a minutes-long link that Resend fetches server-side.
- **No draft / `W toku` protocol state.** A protocol is binary. A half-signed legal document must not persist.
- **No severity or cost field on a damage item.** Severity duplicates type + size; cost is a PRD non-goal, and a
  złoty figure on a document the customer signs is a number we can't stand behind.
- **No offline support.** True offline is local persistence plus a sync queue — a subsystem, not a screen. Weak
  signal degrades into upload-failed-and-retry.
- **No send-to-device signature handoff.** Pairing tokens and a realtime channel are v2. The customer is standing there.
- **No service-role client.** Every RLS-crossing operation goes through a self-gating `SECURITY DEFINER` RPC.
- **No tracking of the anonymous reservation-creation email.** That would need `grant execute … to anon` on an
  audit-log write. Its swallow stays live, knowingly, because that path has a second channel (the `/r/<token>` redirect).
- **No `VehicleForm` migration to react-hook-form.** A worthwhile follow-up, not a prerequisite.
- **No S-06 return-protocol work.** The schema must serve it; the screens are out of scope.

## Implementation Approach

Server-first, in the order the last two slices used: data layer → service → API → UI, with the pure media helpers
isolated in their own phase so pdf-lib's diacritic trap is caught by a unit test rather than by a customer named
_Wąsik_.

Three decisions shape everything downstream:

1. **Photos and the PDF go browser → Supabase directly**, never through the Worker. The Worker's 10 ms CPU cap and
   body limits are then never in play, and no image bytes are charged against them. The trust boundary moves to
   `storage.objects` RLS, which must therefore be written with the same care as a table policy.
2. **The protocol commits before the email is attempted.** The vehicle has physically changed hands; rolling that
   back because a provider returned 503 is strictly worse. Instead the outcome is _recorded_ in an append-only
   `email_deliveries` table and surfaced with a resend action. Silent → visible → recoverable.
3. **The PDF is generated client-side** and uploaded to storage. Server-side generation is not viable on the free
   tier (tens-to-hundreds of ms against a 10 ms cap). Storing it means a resend never requires the employee to
   regenerate, and the view-protocol screen has something to download.

## Critical Implementation Details

**Polish diacritics will crash pdf-lib unless fontkit is wired first.** The 14 standard PDF fonts are
WinAnsi (Windows-1252) encoded and `drawText` **throws** — it does not substitute — on any character outside that
encoding. Of `ą ć ę ł ń ó ś ź ż`, **only `ó` exists in Windows-1252; the other eight throw.** A prototype built
with `StandardFonts.Helvetica` and fixture data like `"Jan Kowalski"` passes every test and dies in production on
the first real customer name or damage note. Wire `pdfDoc.registerFontkit(fontkit)` + `embedFont(ttfBytes, { subset: true })`
from the very first commit, and make the full diacritic set a test fixture, not an afterthought.

**Client-side compression is load-bearing twice over.** It protects the upload path _and_ pdf-lib's peak memory on
the employee's phone (8 × 2 MB photos + a PDF copy ≈ 35–50 MB peak; iOS Safari's per-tab ceiling is undocumented).
It is not an optimization. Resize to ~1600px, JPEG q0.8, before pdf-lib ever sees the bytes.

**HEIC decodes to a blank image, not an error.** iPhones capture HEIC by default; Safari can draw it to canvas,
Chrome/Firefox/Edge generally cannot, so `createImageBitmap` → `toBlob` silently produces a blank JPEG. Sniff the
file (magic bytes, or attempt `createImageBitmap` and catch) before compressing. Also keep `image/heic` **out** of
the `accept` attribute — Safari has been observed converting uploads _to_ HEIC when it is present. Use `accept="image/*"`.

**Ordering inside `create_protocol` matters.** Take `select … for update` on the reservation, assert it is still
`'confirmed'`, then insert. The `unique (reservation_id)` constraint is the backstop, not the check — two employees
tapping simultaneously must produce one protocol and one clean `conflict` tag, not a race and a 500.

**Never import pdf-lib, fontkit, heic2any or the signature canvas at SSR module scope.** They compile into
`dist/client` as free static assets only if they are reachable exclusively from island code. A stray top-level
import in a `.astro` file pulls them into the Worker bundle. Load `heic2any` via dynamic `import()` on detection.

## Phase 1: Data layer — schema, storage bucket, grants, RPCs

### Overview

Every table, the first storage bucket, and the RPCs that are the only way in. Grants closed from the start.

**Do §4 first.** Nothing in this repo has ever created a storage bucket or a `storage.objects` policy — zero hits
across all 14 migrations, and every `[storage.buckets.*]` block in `supabase/config.toml:109-118` is commented out.
Because uploads go browser → Supabase directly, that policy _is_ the trust boundary for every photo byte, and
whether a plain migration may even write it is unverified. Settle it with a twenty-line spike and one
`npx supabase db reset` **before** the tables, grants and RPCs are built on top of it. The rest of this phase is
written in reading order, not implementation order.

### Changes Required:

#### 1. Registration plate

**File**: `supabase/migrations/<ts>_issue_protocol.sql`, `supabase/seed.sql`, `supabase/seed.prod.sql`,
`tests/integration/reservations-overlap.test.ts`

**Intent**: The fleet will hold many identical models (ten Ford Transits); `make + model + year` cannot
distinguish them on the dispatch list, the calendar, or the PDF. Add the column the design always assumed.

**Contract**: `vehicles.plate text`. Add nullable → `UPDATE` the seven seeded vehicles with real plates →
`SET NOT NULL` + `unique`, all in one migration so prod and local converge atomically. Note this is a
**pre-existing S-04 divergence**: `add-vehicle.jsx` has always rendered a required `Rejestracja` field
(`ph="WX 0000A"`) that the shipped form never implemented. The S-04 form and its zod schema must gain the field.

**The migration alone breaks `npx supabase db reset`.** `supabase/config.toml` runs migrations _before_ `seed.sql`,
so on a fresh reset the `UPDATE` matches **zero rows** (the table is empty) and then `seed.sql:22` inserts seven
vehicles with an explicit column list that omits `plate` — a NOT NULL violation. Three files must change alongside
the migration:

- `supabase/seed.sql:22` and `supabase/seed.prod.sql:11` — add `plate` to the column list and a plausible Polish
  plate to each of the seven rows.
- `tests/integration/reservations-overlap.test.ts:56` — `svc.from("vehicles").insert({…})` omits `plate` and would
  fail the constraint, taking the **whole integration suite** down with it, including every test this slice adds.

Keep the in-migration `UPDATE` regardless: it is a no-op locally but is exactly what converges the seven rows
already live in production.

#### 2. Protocol tables

**File**: same migration

**Intent**: Persist the handover as the authoritative record. The emailed PDF is a _rendering_; this is the truth.

**Contract**:

- `protocols` — `id uuid pk`, `reservation_id uuid not null references reservations(id)` **`unique`**,
  `odometer_km int not null check (odometer_km >= 0)`, `fuel_eighths smallint not null check (fuel_eighths between 0 and 8)`,
  `signed_at timestamptz not null`, `signature text not null` (storage object path), `customer_ack boolean not null`,
  `pdf_path text`, `created_at`, `created_by uuid references auth.users(id)`.
- `protocol_photos` — `protocol_id`, `slot protocol_photo_slot not null`, `path text not null`,
  `unique (protocol_id, slot)`. Enum `protocol_photo_slot = ('front','rear','left','right','interior','dashboard')`.
- `protocol_damages` — `protocol_id`, `type protocol_damage_type not null`, `location text not null`, `size text`.
  Enum `protocol_damage_type = ('scratch','dent','crack','missing')`. **No severity, no cost.**
- `protocol_damage_photos` — `damage_id`, `path text not null`.
- `email_deliveries` — append-only: `entity_type text`, `entity_id uuid`, `template text`, `recipient text`,
  `status text check (status in ('sent','failed'))`, `error text`, `created_at`. Index on
  `(entity_type, entity_id, created_at desc)`.

The `existing | new` damage tag is **derived at return time** by comparing against the issue baseline — never
stored at pickup.

#### 3. Grants and RLS — the load-bearing part

**File**: same migration

**Intent**: Prospectively apply the `reservations` PII-leak lesson. The leak needed both a revoke and a policy
drop; a new PII table closes all four verbs from the start so a future re-grant cannot silently re-open it.

**Contract**: For each of the five new tables: `revoke all on <table> from anon, authenticated;`
`alter table <table> enable row level security;` and **no policies at all**. All access flows through definer RPCs
that run as table owner. Any caller check in any policy written later must be a scalar subquery —
`(select public.current_app_role()) in ('employee','admin')` — per `lessons.md`; `STABLE` + `SECURITY DEFINER` is
necessary but not sufficient to get the InitPlan hoist.

#### 4. Storage bucket + `storage.objects` RLS

**File**: same migration

**Intent**: The first bucket in the project. Because uploads go browser → Supabase directly, these policies _are_
the trust boundary for photo bytes.

**Implement this section first, as a spike.** Only a table's owner may `create policy` on it, and `storage.objects`
is owned by `supabase_storage_admin` while the migration runs as `postgres`. It normally succeeds — `postgres` is a
member of that role and inherits its rights — but nothing in this repo has ever exercised it, and a non-owner gets
`ERROR: must be owner of table objects`. Write the bucket insert plus one policy, run `npx supabase db reset`, and
confirm an employee can upload and `anon` cannot, before any other Phase 1 work lands on top. **Fallbacks if the
migration cannot write the policy**: `alter table storage.objects owner to postgres` inside the migration, or create
the bucket declaratively via a `[storage.buckets.protocols]` block in `config.toml` (local) plus the storage API for
prod. Both change how this migration is structured, which is exactly why the answer is needed first.

**Contract**: A **private** bucket `protocols` created via `storage.buckets` insert, with `allowed_mime_types`
(`image/jpeg`, `image/png`, `application/pdf`) and a `file_size_limit` as first defense. Objects keyed
`issue/<protocol_id>/photo-<slot>.jpg`, `issue/<protocol_id>/damage-<damage_id>-<n>.jpg`,
`issue/<protocol_id>/signature.png`, `issue/<protocol_id>/protocol.pdf` — folder-per-protocol makes S-06 reuse and
cleanup trivial. Per-operation, per-role policies on `storage.objects` gated on
`(select public.current_app_role()) in ('employee','admin')` and scoped by `(storage.foldername(name))[1] = 'issue'`.
Grant nothing to `anon`.

**`protocol_id` and every `damage_id` are minted on the client** with `crypto.randomUUID()` before the first upload,
and passed into `create_protocol` — the bytes must already sit at their final key by the time the RPC records the
path, and an id generated inside the RPC would arrive too late. The trust consequence is bounded and worth stating:
storage policies scope only to the `issue/` prefix, so any employee may write under any protocol's folder, and a
client-supplied primary key means a caller can choose its own `protocol_id`. Both are acceptable for trusted staff;
the `unique (reservation_id)` constraint, not the id, is what makes a double submit a `conflict`.

#### 5. RPCs

**File**: same migration

**Intent**: The only way in. Each self-gates on `current_app_role()` and fails closed on a null role.

**Contract**: All five are `security definer set search_path = ''`, schema-qualified, `grant execute … to authenticated`
(never `anon`). Reads are `stable`; writes are `plpgsql`. Result tags map to HTTP codes at the route.

- `create_protocol(p_id uuid, p_reservation_id uuid, p_odometer_km int, p_fuel_eighths smallint, p_signed_at timestamptz, p_customer_ack boolean, p_signature text, p_photos jsonb, p_damages jsonb)` →
  tags `ok | not_found | not_confirmed | conflict | unauthorized`. `p_id` and each element's `id` inside `p_damages`
  are **client-minted** (see §4) so the storage paths already carried in `p_signature` / `p_photos` /
  `p_damages[].photos` resolve. Takes `select … for update` on the reservation, asserts `status = 'confirmed'`,
  inserts protocol + photos + damages + damage photos in one transaction. A `unique_violation` on `reservation_id`
  maps to `conflict`, and the tag carries the **existing** protocol's id so the conflict screen can link to it.
- `list_dispatch_today()` → today's `confirmed` reservations **with their protocol state**, via `left join protocols`
  (kept, not filtered out), plus vehicle make/model/**plate** and the customer name. Each row carries
  `protocol_id` (null ⇒ still to be issued), `pdf_path`, and the newest `email_deliveries` row for that protocol
  folded in via a `lateral` join. Also returns `last_odometer_km` — the newest `odometer_km` across any protocol for
  that vehicle — as the soft-warning baseline. **It must not filter on `p.id is null`**: a protocol whose email
  failed is exactly the row the employee needs to find, and filtering it out would make `email_deliveries`
  unreachable and the recovery action undeliverable.
- `get_protocol(p_id uuid)` → the full protocol with photos, damages, and the newest `email_deliveries` row folded
  in via a `lateral` join (no extra round-trip).
- `set_protocol_pdf(p_id uuid, p_path text)` → tags `ok | not_found | unauthorized`. Stores `pdf_path`. It exists as a
  separate call because the PDF is built client-side _after_ the protocol commits — `create_protocol` cannot know the
  path. Idempotent: re-running it overwrites `pdf_path` with the same value.
- `record_email_delivery(p_entity_type text, p_entity_id uuid, p_template text, p_recipient text, p_status text, p_error text)` → `void`.

#### 6. Type regeneration

**File**: `src/db/database.types.ts`, `src/types.ts`

**Intent**: `database.types.ts` is generated and never hand-edited.

**Contract**: Run `supabase gen types typescript --linked`. Then add derived aliases in `src/types.ts` following the
existing convention — `Protocol = Database["public"]["Tables"]["protocols"]["Row"]`, enum aliases
`ProtocolPhotoSlot` / `ProtocolDamageType`, and RPC-shaped aliases from
`Database["public"]["Functions"]["list_dispatch_today"]["Returns"][number]`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly from scratch: `npx supabase db reset`
- Type regeneration produces no diff beyond the new tables: `npx supabase gen types typescript --linked`
- Type checking passes: `npx astro sync && npm run build`
- Linting passes: `npm run lint`
- An integration test proves a role-null authenticated client (`norole@fleetrent.test`) reads **zero rows** from all five new tables: `protocols`, `protocol_photos`, `protocol_damages`, `protocol_damage_photos`, `email_deliveries`
- An integration test proves `anon` cannot execute any of the five RPCs
- An integration test proves a second `create_protocol` on the same reservation returns `conflict`, not a 500
- An integration test proves `create_protocol` on a `pending` reservation returns `not_confirmed`
- The pre-existing integration suite still passes with `plate` NOT NULL: `npm run test:integration`

#### Manual Verification:

- **First, before anything else in this phase**: uploading an object to `protocols/issue/<id>/` succeeds as employee
  and fails as anon, verified in Supabase Studio — proving a plain migration can create the bucket and its policies
- The seven seeded vehicles have plausible Polish plates after `db reset`
- The `EXCLUDE` constraint still rejects an overlapping confirmed reservation (no regression)

**Implementation Note**: Pause here for manual confirmation before proceeding.

---

## Phase 2: Service layer + Resend adapter + delivery tracking

### Overview

The shared zod schema, the two service modules, and the ~15-line adapter that turns the seam into a real sender.

### Changes Required:

#### 1. Shared validation schema

**File**: `src/lib/protocol-schema.ts`

**Intent**: One zod schema across the trust boundary — `safeParse`d client-side and enforced server-side, so
"the client and the trust boundary cannot disagree" (`VehicleForm.tsx:22-23`).

**Contract**: `protocolInputSchema` covering `protocolId` (uuid, client-minted), `reservationId` (uuid),
`odometerKm` (coerced int ≥ 0), `fuelEighths` (int 0–8), `customerAck` (literal `true`), `signaturePath`, six
required photo slots, and a `damages` array of `{ id (uuid, client-minted), type, location, size?, photos: string[] }`.
Re-export `firstIssuePerField` from `src/lib/vehicle-schema.ts`
or lift it to a shared module — the 400 body shape must stay `{ errors: Record<field, message> }`.

#### 2. Resend adapter

**File**: `src/lib/email/resend.ts`

**Intent**: `workerd` has no arbitrary TCP sockets, so SMTP is impossible. Every candidate had to be a
`fetch()`-callable HTTP API, which is also why this ships **no SDK and no Node deps** — directly retiring the
pre-mortem's fear of a Node stream API in the email path that throws only in production.

**Contract**: A single Bearer-authenticated JSON `POST` to `https://api.resend.com/emails` via bare `fetch`.
Non-2xx **throws** (the caller decides what to do). Forwards `message.attachments` in Resend's hosted-URL form:
`attachments: [{ path: <signed url>, filename }]`, which Resend fetches server-side at send time. Note the 40 MB
cap is **after** base64 encoding (≈28 MB of real file), and attachment emails cannot use the batch endpoint.

#### 3. Adapter selection + export the seam

**File**: `src/lib/email/index.ts`

**Intent**: This is the one job the file's own comment (`:37-38`) reserves for S-05. It is also exactly the
injectability the risk #3 tests need — one change, two payoffs.

**Contract**: `export type EmailAdapter`. Select from config as the **default**:
`let adapter: EmailAdapter = RESEND_API_KEY && EMAIL_FROM ? resendAdapter : devLogAdapter`.

Also `export function setEmailAdapter(next: EmailAdapter): void` — the injection point Phase 7's fakes need.
Configuration _selects_ between the two production adapters; it cannot _inject_ a third, and `sendEmail`'s callers
reach the adapter only through this module-local binding. Without a setter, the capturing and throwing adapters have
no way in, and the only alternative is `vi.mock` of module internals — which the repo has zero precedent for and
Phase 7 explicitly rejects. Mark it test-only in a comment; integration tests run serially (`vitest.config.ts`), so
a mutable module binding is safe, and each test restores the default in `afterEach`.

`EmailMessage` gains **`attachments?: { path: string; filename: string }[]`**. The adapter is the only code that
talks to Resend and the message is its only argument, so an attachment that is not on the type cannot reach the
wire. It goes on `EmailMessage`, not `EmailContent`: `EmailContent` is _what the message says_ and its templates are
pure functions of domain data that must not know a PDF lives behind an expiring signed URL; `EmailMessage` is _what
this send does_, which is already why `to` lives there. The field is **optional**, so the two existing callers
(`api/reservations.ts:122`, `api/reservations/[id].ts:93`, both spreading `{ to, ...content }`) compile and behave
unchanged — that invariance is what "callers never change" was protecting, not the literal field list.
`devLogAdapter` logs the filenames.

Delivery **recording** still lives in the service layer, not the adapter: an adapter sees only a message and cannot
know which row it belongs to.

#### 4. Delivery-tracking service

**File**: `src/lib/services/email-delivery.ts`

**Intent**: Make the failure visible instead of silent. Append-only gives retry history for free; two columns on
`protocols` would give none, and no place to hang the reservation-decision email.

**Contract**: `sendTracked(client, to, content, ctx): Promise<{ status: "sent" | "failed" }>` — client-first,
**never throws**, calls `sendEmail` then `record_email_delivery`. `notifyCustomer`'s `try/catch` in
`src/pages/api/reservations/[id].ts:64-98` collapses into a call to this. Only the **two staff-authenticated
sends** are tracked (decision + protocol); the anonymous creation email keeps its swallow.

#### 5. Protocol service

**File**: `src/lib/services/protocols.ts`

**Intent**: Follow the discriminated-union convention exactly.

**Contract**: `createProtocol`, `listDispatchToday`, `getProtocol`, `setProtocolPdf`, `resendProtocolEmail`. Client-first; a null
client degrades (`[]`, `null`, `{status:"unauthorized"}`) rather than throwing; `UUID_RE` guards every id param so
a malformed id is a typed miss, not a Postgres 500; unexpected DB errors rethrow. Result tags mirror the RPC tags.

#### 6. Email template + config status

**File**: `src/lib/email/templates.ts`, `src/lib/config-status.ts`, `astro.config.mjs`

**Intent**: The protocol email joins three existing pure templates; the new secrets join the missing-config banner.

**Contract**: `protocolIssuedEmail(params): EmailContent` — pure, Polish, unit-tested alongside its siblings, with
a fixture name carrying the full diacritic set. `RESEND_API_KEY` / `EMAIL_FROM` as
`envField.string({ context: "server", access: "secret", optional: true })`; a `configStatuses` entry with Polish
copy; `npx astro sync` to regenerate the `astro:env/server` virtual types.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new template with a diacritic-bearing fixture: `npm test`
- Type checking passes: `npx astro sync && npm run build`
- Linting passes: `npm run lint`
- A unit test proves `resendAdapter` throws on a non-2xx response
- A unit test proves `sendTracked` returns `{status:"failed"}` and does **not** throw when the adapter throws

#### Manual Verification:

- With no `RESEND_API_KEY`, the app boots, the banner renders, and `devLogAdapter` logs the composed message
- With a key set, a send lands in local `inbucket` (`http://localhost:54324`)

**Implementation Note**: Pause here for manual confirmation before proceeding.

---

## Phase 3: API routes

### Overview

Three routes, each self-gating. `/api` is outside middleware's gate — `ROUTE_ROLES` contains only `/dashboard*`
prefixes, so `resolveRequiredRole("/api/...")` returns `null` and middleware calls `next()` with no check.

### Changes Required:

#### 1. Submit a protocol

**File**: `src/pages/api/protocols.ts`

**Intent**: Commit the handover. **Nothing is emailed here.**

**Contract**: `POST`. Gate in order: CSRF (`origin !== context.url.origin` → 403) → **auth (`!context.locals.user`
→ 401)** → role (`!requireRole(context.locals, "employee")` → 403) → body parse → zod → service. On `ok`, return
201 with the `protocol_id`. The PDF does not exist at this moment — the client builds and uploads it _after_ this
call — so a send attempted here would attach a signed URL to an object that is not there, and Resend, which fetches
`path` server-side at send time, would deliver an empty mail while `email_deliveries` recorded `sent`. **The send
belongs to the finalize route below.** Map tags: `conflict` → 409 (with the existing `protocol_id` in the body),
`not_found` → 404, `not_confirmed` → 409, `unauthorized` → 403.

#### 2. Finalize the PDF, then send

**File**: `src/pages/api/protocols/[id]/pdf.ts`

**Intent**: Record where the PDF landed and mail it. This is the only place `pdf_path` is ever written, and the only
place the protocol email is sent for the first time.

**Contract**: `POST`, same gate sequence, body `{ path: string }` via zod. Follows the repo's single-scalar-update
convention — a dedicated POST action sub-route through a definer RPC, exactly like
`src/pages/api/vehicles/[id]/active.ts` → `set_vehicle_active`; **not** a `PATCH`. Calls `set_protocol_pdf`, then
mints a short-TTL signed URL for that path, calls `sendTracked`, and returns 200 **regardless of the email outcome**,
with the delivery status in the body so the island picks its overlay variant (`sent` / `email`). If the client never
reaches this route because PDF generation threw, the protocol stands with `pdf_path` null and no delivery row — the
`pdf` overlay, recoverable from the dispatch list.

#### 3. Resend a protocol email

**File**: `src/pages/api/protocols/[id]/resend-email.ts`

**Intent**: The recovery path that makes `email_deliveries` worth having. Append-only means a retry shows up as a
second row, not an overwrite.

**Contract**: `POST`, same gate sequence. Re-mints the signed PDF URL, calls `sendTracked`, returns the new status.
Returns 409 if `pdf_path` is null (PDF generation failed — the employee must regenerate, not resend).

#### 4. Resolve F2 deliberately

**File**: all three new routes

**Intent**: `context/archive/2026-06-30-testing-api-boundary-authz/finding-anon-status-inconsistency.md` records
that vehicle routes return 401 for anon while reservation routes return 403. Protection is identical; only the
status differs, and `tests/integration/api-authz.test.ts` pins the current split.

**Contract**: Use the **vehicles two-step** — explicit `!user` → 401, then role → 403. This is the shape
`lessons.md` cites as reference. Extend `api-authz.test.ts` with all three new routes at 401, and leave the existing
reservation-route assertions untouched: this plan does not retrofit F2 repo-wide.

### Success Criteria:

#### Automated Verification:

- Integration tests pass: `npm run test:integration`
- An integration test proves anon → **401** and role-null authed → **403** on all three new routes
- An integration test proves a cross-origin POST → 403 before any DB work
- An integration test proves a malformed body → 400 with `{errors: {...}}`
- An integration test proves a second submit → 409 `conflict`, and that the 409 body carries the existing `protocol_id`
- An integration test proves `POST /api/protocols` sends **no** email and writes **no** delivery row
- An integration test proves a finalize call whose email throws still returns **200** and writes a `failed` delivery row

#### Manual Verification:

- `curl` with a stale session cookie is rejected at the role gate, not at the DB

**Implementation Note**: Pause here for manual confirmation before proceeding.

---

## Phase 4: Client media pipeline (pure helpers)

### Overview

Compression, HEIC conversion, and PDF generation — extracted as pure, unit-testable functions before any UI
touches them. This is where the two field bugs live, and the phase exists so a test catches them, not a customer.

### Changes Required:

#### 1. Image compression

**File**: `src/lib/media/compress.ts`

**Intent**: Protects the upload path _and_ pdf-lib's peak memory on the phone. Not an optimization.

**Contract**: `compressImage(file: File): Promise<Blob>` — native `createImageBitmap` + `OffscreenCanvas` +
`canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })`, resized to ~1600px on the long edge. Note the API:
`OffscreenCanvas` has **no `toBlob`** — that is `HTMLCanvasElement`'s callback-style method. `convertToBlob` takes an
options object and returns a Promise. **0 KB of dependencies**; EXIF orientation is applied by the browser default.

#### 2. HEIC detection and conversion

**File**: `src/lib/media/heic.ts`

**Intent**: Chrome/Firefox/Edge cannot draw HEIC to canvas, so compression silently yields a **blank image** —
a correctness bug that produces empty dispute evidence, not a visible error.

**Contract**: `isHeic(file): Promise<boolean>` by magic bytes (`ftypheic` / `ftypheix` / `ftypmif1` at offset 4),
with an attempted-`createImageBitmap`-and-catch fallback. On detection, `await import('heic2any')` **lazily** —
it is megabytes of wasm and must never enter the initial bundle. Add `heic2any` as a dependency. The file input
must use `accept="image/*"` and **not** list `image/heic`.

#### 3. PDF generation

**File**: `src/lib/media/protocol-pdf.ts`

**Intent**: A self-contained artifact the customer keeps forever. Disputes surface months later, by which time a
signed link would be dead and the customer would have to ask the operator — their counterparty in the dispute — to
re-issue their own evidence.

**Contract**: `buildProtocolPdf(data): Promise<Uint8Array>` using `pdf-lib`. **Must** call
`pdfDoc.registerFontkit(fontkit)` and `embedFont(ttfBytes, { subset: true })` with an embedded Unicode TTF
(Noto/DejaVu Sans) checked into `src/assets/`. Draw with that font only — never `StandardFonts.*`. `embedJpg`
copies JPEG bytes verbatim (`DCTDecode`) rather than re-decoding, so pass the compressed blobs straight through.
Render the plate prominently. Add `pdf-lib` and `@pdf-lib/fontkit` as dependencies (+342 KB gzip for fontkit —
all free static-asset weight on the client path).

**Guardrail**: none of these three modules may be imported from `.astro` frontmatter or any SSR-reachable module
scope. They are island-only.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- **A unit test renders a PDF whose customer name and damage note contain every one of `ą ć ę ł ń ó ś ź ż` and `Ą Ć Ę Ł Ń Ó Ś Ź Ż`, and asserts it does not throw** — the single most important test in this slice
- A unit test proves `isHeic` returns true for a HEIC magic-byte fixture and false for JPEG/PNG
- A unit test proves the PDF byte output is a valid PDF header (`%PDF-`) and non-trivial in length
- `npm run build` shows **no increase** in the Worker bundle (`npx wrangler deploy --dry-run`), proving these
  modules landed in `dist/client` and not `dist/server`

#### Manual Verification:

- A generated PDF opens in a real viewer with correct Polish glyphs, not tofu boxes
- A HEIC photo from an actual iPhone converts and compresses to a visible (non-blank) JPEG in Chrome

**Implementation Note**: Pause here for manual confirmation before proceeding.

---

## Phase 5: Protocol form island

### Overview

The form itself, on both viewports. First adopter of `react-hook-form` in the repo.

**`VehicleForm` is a known exception, not a precedent.** `lessons.md` landed at `5d13d95` (2026-06-26 14:05);
`VehicleForm.tsx` at `14db20a` (15:39). The lesson is an _ancestor_ of the form commit — the rule existed and the
form did not adopt it. Do not cite `VehicleForm` as evidence that "the codebase convention is `useState`", and do
not let a match-the-surrounding-code instinct override the rule. The repo will hold two form conventions until
`VehicleForm` is migrated; that is accepted knowingly.

### Design Contract

Distilled from `protocol-parts.jsx`, `pickup-protocol.jsx`, `staff-protocol-desktop.jsx` (Claude Design project
`352d78a6-84fd-49a2-8b38-2fe289691fc3`). **Build from this text. Do not open the PNG exports.**

**Tokens** (live in `src/styles/global.css`; never import from `context/foundation/design/`): brand crimson
`--primary #B43638`, app bg `#F1F3F6`, card `#FFFFFF`, ink `#0F172A`, ink-2 `#334155`, muted `#94A3B8`, hairline
`rgba(15,23,42,0.08)`; success `#1B9E5A` / soft `#E3F5EC`; warning `#B6790E` / soft `#FBF1DA`; danger = crimson /
soft `#FBE4E1`. Radius: sections 18px, cards 14–16px, inputs 11px, chips 10px, overlay sheet 28px top corners.
`shadow-card` on surfaces. Section number badge: 24×24, radius 8, ink bg, white mono 12px/700.

**Layout.** Mobile: one scrolling form, **no step rail, no pagination** — an employee in the rain must not
paginate. Header (back / title `Protokół wydania` / close), then a `PpContext` strip, then four numbered sections,
then a sticky bottom submit bar (`position: absolute; bottom: 0`, ink border-top, 30px bottom padding for the home
indicator). Desktop: `gridTemplateColumns: '1.35fr 1fr'`, gap 28, padding 32 — **left column = condition + damage,
right column = photos + signature**; topbar subtitle is `R-2401 · Anna Nowak · Ford Transit · WX 5519M · Odbiór 14:00`;
footer buttons right-aligned. **Drop the vestigial `Wstecz` button** — a single-page form has no step to go back to.

**Section 1 — `Stan techniczny`** (sub: `Licznik, paliwo i istniejące uszkodzenia. Zdjęcia można zrobić telefonem lub wgrać tutaj.`).
Two-column grid inside. Odometer: label `Licznik`, `inputMode="numeric"`, 27px/700 value, unit `km`, thousands
grouping; error state paints the container border crimson and shows a warning icon + message. Fuel: label
`Poziom paliwa`, big `{v}/8` readout with ` · pełny` at 8 and ` · pusty` at 0; **eight `<button>` segments**,
`flex: 1`, height 22, radius 4, gap 3, filled = ink / empty = `hair2`, `aria-label={`${i}/8`}`; mono `E` / `F` end
labels beneath.

**Section 2 — `Zdjęcia pojazdu`** (sub: `Sześć bazowych ujęć pojazdu.`). Right-aligned mono counter `{done}/6`,
green when 6. 3-column grid, gap 8, `aspectRatio: 1`. Six slots in order with exact labels: `Przód` (front),
`Tył` (rear), `Lewy bok` (left), `Prawy bok` (right), `Wnętrze` (interior), `Deska rozdz.` (dashboard — captures
the odometer). Four states: **empty** = dashed hairline border, camera icon, uppercase muted label;
**uploading** = dark tile, 26px spinner, `{pct}%`, 3px bottom progress bar; **failed** = crimson border +
`redSoft` bg, warning icon, `Ponów` (retry) — the whole tile is the retry button; **done** = dark hatched tile,
check icon, uppercase label. Mobile opens the rear camera via `<input type="file" accept="image/*" capture="environment">`;
desktop adds a dashed dropzone card above the grid (`{t.dragDrop}` / `{t.photosFromPhone}`) with multi-select —
**add the drag-hover state the prototype lacks**.

**Section 3 — `Uszkodzenia`** (sub: `Zapisz każdy ślad osobno — zwrot porówna się z tą listą.`). Header-right
button `+ Dodaj uszkodzenie`. Rows: 42px thumbnail (hatched if photos, else warning icon), title
`{typeLabel} — {location} ({size})`, subline `{n} zdjęcie|zdjęć`, a right-side tag pill (`istniejące` muted /
`nowe` crimson — at pickup everything is `istniejące`; the tag is derived at return), chevron. Empty state:
`Brak uszkodzeń` / `Dodaj każdą rysę, wgniecenie lub pęknięcie, aby zwrot mógł porównać.` Editor opens as a
bottom sheet on mobile (radius 28 top, grab handle) and a 480px centered modal on desktop, titled
`Dodaj uszkodzenie` (or `Szczegóły uszkodzenia` when editing). Fields: `Rodzaj` as four chips —
`Rysa` (scratch) · `Wgniecenie` (dent) · `Pęknięcie` (crack) · `Brak części` (missing), selected = ink bg/white
text; `Lokalizacja` free text, placeholder `np. lewy tylny zderzak`; `Rozmiar` free text (160px),
placeholder `np. 15 cm`; `Zdjęcia` — a 62px photo strip with a dashed `+` tile. Buttons: `Anuluj` (flex 1) /
`Zapisz` (flex 2, ink, check icon). **Add a `Usuń` action** — the PL key `proto.delete` (`Usuń`) already exists,
and a mistyped entry on a signed legal document must be removable before submit.

**Section 4 — `Podpis`** (sub: `Klient potwierdza powyższy stan i składa podpis.`, `card={false}`). First a
full-width checkbox row: `Klient potwierdza stan pojazdu i warunki najmu.` (→ `customer_ack`). Then the pad:
label `Podpis` + a crimson `Wyczyść` text button (only once signed). Canvas `width={520} height={h*2}` rendered
at `h=140` mobile / `150` desktop, `touchAction: 'none'`, mouse **and** touch handlers, stroke `#0F172A`,
`lineWidth 2.4`, round caps/joins. Empty: dashed border, pen icon, `Poproś klienta o podpis` +
`Rysuj myszką lub gładzikiem`. Signed: green check + `Podpisał(a) {name}` · `o {14:08}` — that timestamp is
`signed_at`, a **separate fact** from the booking's fixed 14:00. Error state: `Wymagany podpis`.

**Validation mode.** On failed submit, show a crimson banner `Sprawdź podświetlone pola` above section 1, paint
per-field errors (`Podaj stan licznika`, `Wymagany podpis`) with `aria-invalid`, disable the submit button, and
scroll to + focus the first error in visual order via double-`requestAnimationFrame` (`VehicleForm.tsx:331-346`).

**Submit bar.** `Potwierdź wydanie i wyślij` with a message icon; pending label `Wysyłanie…`. Per CLAUDE.md, any
async button shows a pending state: `disabled` + `aria-busy`, content swaps to the `animate-spin` ring from
`src/components/auth/SubmitButton.tsx:30`, driven by an explicit flag — the form posts to a URL, so `useFormStatus`
never reports pending. **Keep the pending state through the success overlay; reset only on error.**
Disable submit while any photo is still uploading.

**Overlays** (bottom sheet on mobile, centered 460px modal on desktop). 64px circular icon, 21px/700 title, muted
sub, then badge pills:

| Variant | Icon / tone       | Title                           | Sub                                                                             | Badges                                               | Primary            | Secondary |
| ------- | ----------------- | ------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------ | --------- |
| `sent`  | check / green     | `Protokół wysłany`              | `Wysłany do klienta i zapisany jako PDF.`                                       | `Protokół zapisany` (ok) · `Dostarczono` (ok)        | `Gotowe` (ink)     | —         |
| `email` | warning / crimson | `Nie udało się wysłać e-maila`  | `Protokół jest zapisany i podpisany. Możesz wysłać ponownie teraz lub później.` | `Protokół zapisany` (ok) · `E-mail niewysłany` (bad) | `Wyślij ponownie`  | `Później` |
| `pdf`   | warning / amber   | `Nie udało się wygenerować PDF` | `Protokół został zapisany. Wygeneruj PDF ponownie, aby wysłać klientowi.`       | `Protokół zapisany` (ok) · `Błąd PDF` (warn)         | `Spróbuj ponownie` | `Później` |

Non-`sent` variants also show `Wysłano do <email>`. **Desktop must render all three**, plus the uploads and
validation modes — `DeskPickupBody` currently takes an `uploads` prop no screen passes and has no `errors` mode.
Sharing the section components across viewports makes this nearly free.

**Conflict screen** — `Protokół już istnieje` / `Dla tej rezerwacji wydano już protokół — każde wydanie może mieć
tylko jeden.`, a vehicle card showing `R-2401 · WX 5519M` and a `Protokół zapisany` badge, buttons `Otwórz protokół`
(→ the view-protocol screen from Phase 6) and `Wróć do pulpitu`.

**Empty screen** — `Brak wydań na dziś` / `Gdy rezerwacja będzie gotowa do wydania, pojawi się tutaj.` Title the
page from `proto.emptyTitle`, **not** the `t.pickupsToday || 'Wydania'` fallback the prototype uses.

### Changes Required:

#### 1. Dependencies

**File**: `package.json`

**Contract**: Add `react-hook-form`, `@hookform/resolvers`. All client-side → `dist/client` → **0 bytes to the Worker**.

#### 2. The form island

**File**: `src/components/protocol/ProtocolForm.tsx` (+ `PhotoSlot.tsx`, `FuelBar.tsx`, `DamageEditor.tsx`, `SignaturePad.tsx`)

**Intent**: One component tree, two layouts. `useFieldArray` drives the dynamic damage list and the per-damage
photo strips — the one requirement `VehicleForm` never had, and the strongest argument for RHF beyond the lesson.

**Contract**: `zodResolver(protocolInputSchema)` over the same schema the API enforces. Numeric fields held as
strings so the payload drops straight onto the schema's coerce step. On 400 with `body.errors`, re-map server
errors onto fields. Mount `client:load`. Each photo row carries its own upload state (`empty|uploading|failed|done`)
and possible HEIC conversion. Signature is a hand-rolled canvas (~40–60 LOC, matching the prototype's own
implementation) — no `signature_pad` dependency is needed.

#### 3. Submit orchestration

**File**: `src/components/hooks/useProtocolSubmit.ts`

**Intent**: The ordering here is the whole slice. Get it wrong and an employee is stranded at a vehicle with a
customer waiting.

**Contract**: A bare async service function + a thin hook exposing a `submitting` flag, matching
`useReservationDecision.ts:55-74`. Order:

0. On mount, mint `protocolId = crypto.randomUUID()`; mint a `damageId` for each damage row as it is added. These
   ids key every storage object, so they must exist before the first byte is uploaded.
1. All photos already uploaded to storage during the form session, under `issue/<protocolId>/`.
2. Upload the signature PNG.
3. `POST /api/protocols` (carrying `protocolId` and the damage ids) → **the protocol now exists**. No email is sent.
4. Build the PDF client-side.
5. Upload the PDF to storage.
6. `POST /api/protocols/[id]/pdf` with the path → the server stores `pdf_path`, mints the signed URL, and **sends the
   mail**. Its response carries the delivery status.

The send is step 6, not step 3, because until step 5 completes there is no object for Resend to fetch. If step 4, 5
or 6 throws outright, **do not roll back** — show the `pdf` overlay; the handover physically happened and the row must
reflect it. If step 6 returns with a `failed` delivery status, show the `email` overlay. Blocking submission on PDF
generation would strand the employee at the vehicle, which is why the commit is step 3 and everything after it is
best-effort and recoverable from the dispatch list.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npm run build`
- Linting passes, including `jsx-a11y` on the fuel buttons and photo inputs: `npm run lint`
- `npx wrangler deploy --dry-run` shows the Worker bundle unchanged (island code stayed client-side)
- A unit test on the extracted `fuelEighths` ↔ label mapping and the photo-slot completeness check

#### Manual Verification:

- On a real phone: all six slots capture from the rear camera; the signature draws smoothly under a thumb; the fuel bar is tappable without mis-taps
- On desktop: drag-and-drop multi-select fills slots; the signature pad works with a mouse
- Submitting with an empty odometer scrolls to and focuses that field, with the crimson banner visible
- All three overlays render correctly on both viewports
- A protocol whose email fails shows the `email` overlay with a working `Wyślij ponownie`
- Killing PDF generation (throw in `buildProtocolPdf`) still commits the protocol and shows the `pdf` overlay

**Implementation Note**: Pause here for manual confirmation before proceeding.

---

## Phase 6: Dispatch list + recovery surfaces

### Overview

Where the employee starts, and where a failed protocol gets recovered. Without this, dismissing the overlay
strands the protocol forever — which would defeat the entire point of `email_deliveries`.

### Changes Required:

#### 1. Dispatch page

**File**: `src/pages/dashboard/pickups.astro`, `src/components/dashboard/PickupQueue.tsx`

**Intent**: The entry point that does not exist today. S-06 and S-07 reuse this surface.

**Contract**: SSR `listDispatchToday(supabase)`, mount `PickupQueue client:load`. Each row shows vehicle
make/model + **plate** (mono pill, `greySoft` bg), customer name and reservation reference. Rows split on
`protocol_id`: **null** ⇒ a `Wydaj` action linking to `/dashboard/pickups/[reservationId]`; **non-null** ⇒ the
delivery badge, an `Otwórz protokół` link to `/dashboard/protocols/[protocolId]`, and — when the badge is not `ok` —
`Wyślij ponownie`. The issued rows are what make a dismissed overlay recoverable, and they are the only discoverable
entry point to the protocol view screen. Empty state per the design contract. Add the route to
`ROUTE_ROLES` in `src/lib/access.ts` with `role: "employee"` — the `/dashboard` prefix already covers it, but the
nav entry and `StaffShell active` state must be added.

#### 2. Delivery badge

**File**: `src/components/dashboard/PickupQueue.tsx`, `src/components/protocol/DeliveryBadge.tsx`

**Intent**: `email_deliveries` exists so an employee who dismissed the overlay can recover from the dashboard later.

**Contract**: Badge tones per the prototype's `PpBadge` — `ok` (green/greenSoft), `warn` (amber/amberSoft),
`bad` (crimson/redSoft), 24px pill, radius 7, 11.5px/700. Rendered **only on rows that have a `protocol_id`** — a
reservation not yet issued has no delivery to report and must show `Wydaj`, not a red badge. Derive from the newest
`email_deliveries` row folded in by `list_dispatch_today`'s `lateral` join, in this order: missing `pdf_path` →
`Błąd PDF` (warn, and the PDF never generated so no send was attempted); else `failed` or no delivery row →
`E-mail niewysłany` (bad); else `sent` → `Dostarczono` (ok).

#### 3. View an issued protocol

**File**: `src/pages/dashboard/protocols/[id].astro`, `src/components/protocol/ProtocolView.tsx`

**Intent**: Read-only, with a PDF download, so a protocol can be reopened months later during a dispute. The
conflict screen's `Otwórz protokół` button already points here.

**Contract**: SSR `getProtocol(supabase, id)`. Render the same sections read-only. Photos and the PDF are served
via short-TTL signed URLs minted server-side in the page frontmatter — the customer never receives a bucket URL,
but staff read under RLS with their JWT. A `Wyślij ponownie` button posts to the resend route.

#### 4. Drop the `W toku` chip

**File**: the staff dashboard component rendering `t.inProgress`

**Intent**: A protocol is binary. A chip implying a draft state contradicts the `unique (reservation_id)` invariant.

**Contract**: Remove it, or derive it from "pickup due today + no protocol row". Do not store it.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npm run build`
- Linting passes: `npm run lint`
- An integration test proves `/dashboard/pickups` redirects an anonymous caller to `/auth/signin`
- An integration test proves `list_dispatch_today` returns a reservation that already has a protocol, with its
  `protocol_id` and newest delivery status folded in — and that an un-issued one comes back with `protocol_id` null
- An integration test proves a role-null user gets zero rows from `get_protocol`

#### Manual Verification:

- A confirmed reservation for today appears in the dispatch list and disappears after its protocol is filed
- The conflict screen's `Otwórz protokół` navigates to a real, populated protocol view
- The PDF downloads from the protocol view and opens with correct Polish glyphs
- A failed delivery shows the badge on the dispatch row, and `Wyślij ponownie` clears it
- The `W toku` chip is gone

**Implementation Note**: Pause here for manual confirmation before proceeding.

---

## Phase 7: Risk #3 tests, corrections, and the send gate

### Overview

Closes test-plan Phase 4 ("Protocol email & photo integrity"), which `test-plan.md:287` records as
"untestable at any layer until S-05 ships".

### Changes Required:

#### 1. Email transport fake

**File**: `tests/helpers/email.ts`

**Intent**: `e2e/e2e-rules.md:87-88` flags that `page.route()` cannot stub this — the send happens server-side.
The fake must be injected at the adapter. There are zero mocking primitives in the repo today.

**Contract**: A capturing adapter (records `EmailMessage[]`) and a throwing adapter, both plain `EmailAdapter`
functions. Installed with `setEmailAdapter()` from Phase 2 §3 and restored in `afterEach` — no `vi.mock` of module
internals. Config selection alone cannot do this: it chooses between `resendAdapter` and `devLogAdapter`, and a test
double is neither.

#### 2. Risk #3 contract tests

**File**: `tests/integration/protocol-email.test.ts`

**Intent**: `test-plan.md:56` wants three things proven: send is _attempted_, failures _surface_, and the payload
carries the _correct photos_. The anti-pattern to avoid is "mocking the transport so deeply nothing real is asserted".

**Contract**: Three assertions, each driving `POST /api/protocols` then the finalize route. _Attempted_ → an
`email_deliveries` row exists after finalize (zero mocking). _Failures surface_ → install the throwing adapter;
assert `status='failed'`, the row carries the error, the route still returns 200, and the badge derivation reports
`bad`. _Correct payload_ → the capturing adapter's message carries the right recipient and an `attachments[0].path`
pointing at that protocol's `pdf_path`, with a subject bearing Polish diacritics intact.

#### 3. Stale `CLAUDE.md` claims

**File**: `CLAUDE.md`

**Intent**: Both verified false this session. Since S-05 adds tests, the correction rides along.

**Contract**: `:14` "No test runner is configured" → describe the two Vitest projects and the four test scripts.
`:65` CI runs on `master` → `.github/workflows/ci.yml:5-7` targets `main`.

#### 4. Sender domain gate

**File**: `context/changes/issue-protocol/change.md`, deployment notes

**Intent**: **Decided 2026-07-09: S-05 does not merge until real mail sends.** This diverges from
`roadmap.md:172`, which marks the domain non-blocking on the grounds that the `devLogAdapter` fallback keeps the
slice shippable. The plan honors the stricter call: a handover protocol is the customer's only copy of the
evidence, and a slice whose only exercised path is `console.log` has not proven the thing it exists to do.

**Contract**: Provision a Polish sender domain with SPF + DKIM (2 records; DMARC optional), verify it in Resend,
set `RESEND_API_KEY` / `EMAIL_FROM` via `wrangler secret put` for prod and `.dev.vars` locally. **Definition of
done for the slice**: one real protocol emailed to a real inbox, with a customer name and a damage note containing
`ą ć ę ł ń ó ś ź ż`, and the attached PDF renders those glyphs correctly.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`
- The three risk #3 assertions pass
- Linting and build pass: `npm run lint && npm run build`
- `test-plan.md` §3 Phase 4 status updated to `complete` with this change folder

#### Manual Verification:

- A real Resend send lands a PDF attachment in a real inbox
- The PDF renders every Polish diacritic correctly in a real viewer
- Deliberately revoking the Resend API key makes the delivery row go `failed` and the badge appear — the failure is loud, not silent
- The sender domain passes SPF + DKIM checks (the mail is not junked)

---

## Testing Strategy

### Unit Tests:

- `buildProtocolPdf` with the **full diacritic set** in the customer name and damage note (`ą ć ę ł ń ó ś ź ż` and uppercase) — the single most important test in this slice
- `isHeic` magic-byte detection: HEIC true, JPEG/PNG false
- `protocolIssuedEmail` template, with a diacritic-bearing fixture
- `resendAdapter` throws on non-2xx
- `sendTracked` returns `{status:"failed"}` and never throws when the adapter throws
- `protocolInputSchema` boundaries: `fuel_eighths` 0 and 8 pass, −1 and 9 fail; `customerAck` must be `true`

### Integration Tests:

- **RLS/grants**: a role-null authed client reads zero rows from all five new tables — `protocols`, `protocol_photos`, `protocol_damages`, `protocol_damage_photos`, `email_deliveries` (the `reservations` leak, prospectively closed)
- **RPC authz**: `anon` cannot execute any of the five RPCs
- **Idempotency**: a second `create_protocol` on one reservation returns `conflict`, not a 500
- **State guard**: `create_protocol` on a `pending` reservation returns `not_confirmed`
- **API authz matrix**: anon → 401, role-null → 403, cross-origin → 403, on all three new routes
- **Commit-then-email**: `POST /api/protocols` writes no delivery row, and a finalize call whose adapter throws still
  returns 200 and writes a `failed` one
- **Risk #3 payload contract**: the captured message's attachment path points at that protocol's `pdf_path`
- **Dispatch derivation**: `list_dispatch_today` folds `protocol_id` and the newest delivery status into issued rows,
  and returns `protocol_id` null for reservations still awaiting handover

### Manual Testing Steps:

1. On a real phone, fill a protocol end-to-end at a vehicle: capture six photos with the rear camera, add a damage item with its own photo, sign with a thumb, submit.
2. Confirm the customer's inbox receives a PDF whose plate, odometer, fuel, damage list and signature are all correct and whose Polish glyphs render.
3. Take a photo on an iPhone (HEIC) and upload it in **Chrome** — confirm the stored image is not blank.
4. Revoke the Resend key mid-session; submit; confirm the protocol commits, the `email` overlay appears, the dispatch badge shows `E-mail niewysłany`, and `Wyślij ponownie` recovers once the key is restored.
5. Force `buildProtocolPdf` to throw; confirm the protocol still commits and the `pdf` overlay appears.
6. Open the same reservation in two tabs and submit both; confirm one succeeds and the other shows the conflict screen.
7. Sign in as `norole@fleetrent.test` and attempt to reach `/dashboard/pickups` and `POST /api/protocols`.

## Performance Considerations

- **Worker bundle is a non-issue** — headroom is ~2,517 KiB gzip (~5.5× the current 554.76 KiB), and every new
  library is browser-only. The guardrail is architectural, not budgetary: nothing may be reachable from SSR module scope.
- **Worker CPU is the real constraint** (10 ms/invocation on the free tier). No image bytes and no PDF bytes transit
  the Worker. The only added server work is minting a signed URL and one `fetch` to Resend.
- **Mobile memory is the unverified bit**: 8 × 2 MB photos + a PDF copy ≈ 35–50 MB peak. Compression before pdf-lib
  is what keeps this safe; iOS Safari's per-tab ceiling is undocumented.
- **`list_dispatch_today` fold** uses a `lateral` join for the newest delivery row rather than an N+1 round-trip.

## Migration Notes

- `vehicles.plate` lands nullable, is backfilled for the seven seeded vehicles, then tightened to `not null unique`
  **within the same migration**. If production has gained a vehicle since the seed, the `SET NOT NULL` will abort —
  check `select count(*) from vehicles where plate is null` against prod before applying.
- The S-04 add/edit vehicle form and `vehicleInputSchema` must gain the `plate` field in the same PR, or creating a
  vehicle will fail the new constraint.
- Rollback: dropping the five new tables and the bucket is clean (no other table references them). Dropping
  `vehicles.plate` is clean but loses the backfilled values.
- `supabase gen types typescript --linked` must run after the migration; `src/db/database.types.ts` is never hand-edited.

## References

- Research: `context/changes/issue-protocol/research.md`
- Design audit v2: `context/changes/issue-protocol/design-audit.md`
- Design source: Claude Design project `352d78a6-84fd-49a2-8b38-2fe289691fc3` — `protocol-parts.jsx`,
  `pickup-protocol.jsx`, `staff-protocol-desktop.jsx`, `shared.jsx` (read via DesignSync). **The Phase 5 design
  contract above supersedes these; do not re-open the source or the PNG exports during implementation.**
- The PII leak this slice must not repeat: `context/archive/2026-06-27-testing-data-layer-integrity/finding-rls-pii-leak.md`
- The 401/403 split this slice resolves: `context/archive/2026-06-30-testing-api-boundary-authz/finding-anon-status-inconsistency.md`
- Canonical API gate: `src/pages/api/vehicles.ts:30-63`
- Canonical definer RPC: `supabase/migrations/20260617120000_reservation_approval.sql:60-157`
- Best-effort post-commit email: `src/pages/api/reservations/[id].ts:64-98,148-150`
- Pending-button pattern: `src/components/fleet/VehicleForm.tsx:239-278`, `src/components/auth/SubmitButton.tsx:9-14,30`
- Test-plan Phase 4 / risk #3: `context/foundation/test-plan.md:45,56,72,287`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data layer — schema, storage bucket, grants, RPCs

#### Automated

- [x] 1.1 Migration applies cleanly from scratch: `npx supabase db reset` — 9597797
- [x] 1.2 Type regeneration produces no diff beyond the new tables — 9597797
- [x] 1.3 Type checking passes: `npx astro sync && npm run build` — 9597797
- [x] 1.4 Linting passes: `npm run lint` — 9597797
- [x] 1.5 Role-null authed client reads zero rows from all five new tables — 9597797
- [x] 1.6 `anon` cannot execute any of the five RPCs — 9597797
- [x] 1.7 A second `create_protocol` on the same reservation returns `conflict` — 9597797
- [x] 1.8 `create_protocol` on a `pending` reservation returns `not_confirmed` — 9597797
- [x] 1.9 The pre-existing integration suite still passes with `plate` NOT NULL (seeds + overlap test updated) — 9597797

#### Manual

- [x] 1.10 Object upload to `protocols/issue/<id>/` succeeds as employee, fails as anon — **do this first** — 9597797
- [x] 1.11 The seven seeded vehicles have plausible Polish plates after `db reset` — 9597797
- [x] 1.12 The `EXCLUDE` constraint still rejects an overlapping confirmed reservation — 9597797

### Phase 2: Service layer + Resend adapter + delivery tracking

#### Automated

- [x] 2.1 Unit tests pass, including the template with a diacritic-bearing fixture — edc07e0
- [x] 2.2 Type checking passes: `npx astro sync && npm run build` — edc07e0
- [x] 2.3 Linting passes: `npm run lint` — edc07e0
- [x] 2.4 `resendAdapter` throws on a non-2xx response — edc07e0
- [x] 2.5 `sendTracked` returns `{status:"failed"}` and does not throw when the adapter throws — edc07e0

#### Manual

- [x] 2.6 With no `RESEND_API_KEY`, the app boots, the banner renders, `devLogAdapter` logs — edc07e0
- [ ] 2.7 With a key set, a send lands in local `inbucket`

### Phase 3: API routes

#### Automated

- [x] 3.1 Integration tests pass: `npm run test:integration` — cceb653
- [x] 3.2 Anon → 401 and role-null authed → 403 on all three new routes — cceb653
- [x] 3.3 Cross-origin POST → 403 before any DB work — cceb653
- [x] 3.4 Malformed body → 400 with `{errors: {...}}` — cceb653
- [x] 3.5 A second submit → 409 `conflict`, and the 409 body carries the existing `protocol_id` — cceb653
- [x] 3.6 `POST /api/protocols` sends no email and writes no delivery row — cceb653
- [x] 3.7 A finalize call whose email throws still returns 200 and writes a `failed` delivery row — cceb653

#### Manual

- [x] 3.8 A stale session cookie is rejected at the role gate, not at the DB — cceb653

### Phase 4: Client media pipeline (pure helpers)

#### Automated

- [x] 4.1 Unit tests pass: `npm test` — 75b3a9f
- [x] 4.2 A PDF renders with every Polish diacritic and does not throw — 75b3a9f
- [x] 4.3 `isHeic` returns true for HEIC, false for JPEG/PNG — 75b3a9f
- [x] 4.4 PDF output has a valid `%PDF-` header and non-trivial length — 75b3a9f
- [x] 4.5 `npx wrangler deploy --dry-run` shows no Worker bundle increase — 75b3a9f

#### Manual

- [x] 4.6 A generated PDF opens with correct Polish glyphs, not tofu boxes — 75b3a9f
- [x] 4.7 A real iPhone HEIC photo converts to a visible JPEG in Chrome — 75b3a9f

### Phase 5: Protocol form island

#### Automated

- [x] 5.1 Type checking passes: `npx astro sync && npm run build` — b8d6acd
- [x] 5.2 Linting passes, including `jsx-a11y` on the fuel buttons and photo inputs — b8d6acd
- [x] 5.3 `npx wrangler deploy --dry-run` shows the Worker bundle unchanged — b8d6acd
- [x] 5.4 Unit test on the fuel-eighths mapping and photo-slot completeness check — b8d6acd

#### Manual

- [x] 5.5 On a real phone: six rear-camera captures, thumb signature, tappable fuel bar — b8d6acd
- [x] 5.6 On desktop: drag-and-drop multi-select and a mouse signature — b8d6acd
- [x] 5.7 Empty odometer scrolls to and focuses that field with the crimson banner — b8d6acd
- [x] 5.8 All three overlays render correctly on both viewports — b8d6acd
- [x] 5.9 A failed email shows the `email` overlay with a working `Wyślij ponownie` — b8d6acd
- [x] 5.10 A thrown `buildProtocolPdf` still commits the protocol and shows the `pdf` overlay — b8d6acd

### Phase 6: Dispatch list + recovery surfaces

#### Automated

- [x] 6.1 Type checking passes: `npx astro sync && npm run build` — 54b41fe
- [x] 6.2 Linting passes: `npm run lint` — 54b41fe
- [x] 6.3 `/dashboard/pickups` redirects an anonymous caller to `/auth/signin` — 54b41fe
- [x] 6.4 `list_dispatch_today` folds `protocol_id` + newest delivery status into issued rows, null into un-issued ones — 54b41fe
- [x] 6.5 A role-null user gets zero rows from `get_protocol` — 54b41fe

#### Manual

- [x] 6.6 A confirmed reservation appears with `Wydaj`, and after filing stays on the list as an issued row with a badge — 54b41fe
- [x] 6.7 `Otwórz protokół` navigates to a real, populated protocol view — 54b41fe
- [x] 6.8 The PDF downloads from the protocol view with correct Polish glyphs — 54b41fe
- [ ] 6.9 A failed delivery shows the badge; `Wyślij ponownie` clears it — deferred to Phase 7 send gate (7.8)
- [x] 6.10 The `W toku` chip is gone — 54b41fe

### Phase 7: Risk #3 tests, corrections, and the send gate

#### Automated

- [x] 7.1 Unit tests pass: `npm test`
- [x] 7.2 Integration tests pass: `npm run test:integration`
- [x] 7.3 The three risk #3 assertions pass (attempted / surfaced / correct payload)
- [x] 7.4 Linting and build pass: `npm run lint && npm run build`
- [x] 7.5 `test-plan.md` §3 Phase 4 status updated to `complete`

#### Manual

- [ ] 7.6 A real Resend send lands a PDF attachment in a real inbox
- [ ] 7.7 The PDF renders every Polish diacritic correctly in a real viewer
- [x] 7.8 Revoking the API key makes the delivery row go `failed` and the badge appear
- [ ] 7.9 The sender domain passes SPF + DKIM checks
