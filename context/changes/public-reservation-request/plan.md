# Public Reservation Request (S-02 — North Star) Implementation Plan

## Overview

Build FleetRent's public reservation funnel — the validation milestone of the product. A visitor with no account opens `/reserve` (the destination S-01's "Zarezerwuj" CTA already links to), confirms a date range and enters name/email/phone, accepts the terms, and submits. The submit goes through a `SECURITY DEFINER` RPC that **atomically** inserts a `pending` reservation under the existing no-double-booking `EXCLUDE` constraint and maps an overlap collision (`23P01`) to a friendly Polish "the vehicle was just taken" result — so overlapping dates are blocked at submission, never as a post-hoc surprise. Each request is stamped with a human reference (`R-XXXX`) and a secret `access_token`; the customer lands on, and is emailed a link to, a live status page at `/r/<token>` rendering a "what happens next" stepper (Pending → Confirmed/Rejected, future steps greyed). `reservations` stays fully `anon`-denied: both the write and the status read cross the RLS boundary only through definer RPCs, exactly like S-01's `available_vehicles`.

Transactional email is absent in the baseline (the roadmap stands it up in S-05). This slice builds the **email seam** — a `sendEmail` abstraction with a dev/log adapter plus the Polish submit-confirmation template — and defers the real provider. S-05 swaps the adapter; S-03 reuses the same helper + status page to send the confirm/reject emails when an employee decides.

## Current State Analysis

- **`reservations` denies `anon` entirely, by design — S-02 must open the funnel.** RLS has per-operation policies `to authenticated` only and **no `anon` policy** (migration `20260603155136`, lines 150–172). F-01 explicitly deferred "the public reservation funnel (anon INSERT) ... to S-02." The chosen path keeps the table anon-denied and routes the insert through a definer RPC (no anon write policy on a PII table).
- **The no-double-booking guarantee already exists and is the backstop.** `reservations_no_overlap` is an `EXCLUDE USING gist (vehicle_id WITH =, reserved_period WITH &&) WHERE status IN ('pending','confirmed')` over the generated `reserved_period tsrange(pickup+14:00, return+10:00, '[)')`. A colliding insert raises SQLSTATE `23P01` atomically (first insert wins). Pending **and** confirmed both block.
- **The overlap rule is mirrored in TS and reusable.** `src/lib/availability.ts` (`bookingWindow`/`windowsOverlap`/`hasConflict`) and `validateDateRange` in `src/lib/catalog-filters.ts:116` both apply the identical half-open `[pickup 14:00, return 10:00)` window. The validator is already unit-tested and rejects `return < pickup`, same-day, and past pickups with Polish messages.
- **The availability RPC is anon-callable and PII-safe — reuse it for the pre-check.** `available_vehicles(p_pickup date, p_return date) returns setof vehicles`, `security definer set search_path = ''`, `grant execute ... to anon, authenticated` (migration `20260605132958`). Calling it for the chosen range and checking the target vehicle is still present is the friendly pre-submit availability check.
- **The per-request Supabase client is on `locals`.** `context.locals.supabase` (`SupabaseClient<Database> | null`) is set in `src/middleware.ts:11` for an `anon` visitor; the catalog service consumes it. S-02 reuses the same client.
- **Service + formatting + filter patterns are established (S-01).** `src/lib/services/vehicles.ts` (client-taking, null-graceful, throws on query error), `src/lib/format.ts` (PLN money parses the numeric-as-string quirk), `src/lib/catalog-filters.ts` (URL params + date validation). S-02 adds a sibling reservation service and extends `format.ts`.
- **API-route convention.** `src/pages/api/auth/*` export uppercase methods; CLAUDE.md mandates zod validation. Dev runs on **:4321**; POSTs need a same-origin `Origin` header (CSRF) — both the route's Origin check and manual testing depend on this.
- **Money is `string` at runtime.** `numeric(10,2)` deserializes to `string` in supabase-js despite the generated `number` type — the estimated-total helper must parse defensively (S-01 lesson, `src/types.ts:11`).
- **Design is specified for every S-02 screen** (`context/foundation/design-system.md` + the hi-fi `s-02-reservation-flow/` set). The critical divergence is already resolved: **the date picker does NOT gray out booked/requested dates** — it is a plain range calendar disabling only past dates (reuse `src/components/ui/calendar.tsx` as in `HeroSearch.tsx`/`FilterBar.tsx`). No-double-booking is enforced by availability filtering + the pre-submit check + the DB constraint, never by disabling calendar cells. Polish copy is canonical.
- **Testing:** Vitest on pure-function suites only (`src/lib/*.test.ts`); no UI/E2E runner, by S-01 decision none is added here.

## Desired End State

A visitor with no account can:

1. Arrive at `/reserve?vehicle_id=<id>&pickup=<…>&return=<…>` from the catalog, see the chosen vehicle, adjust the date range, enter name/email/phone, accept the terms, and review a summary — with a live estimated total (`daily_rate × dni`) and deposit shown throughout.
2. Submit and have an overlapping range **blocked before the request is created** — caught early by the availability pre-check, and atomically by the RPC's `23P01` mapping as the authority — surfaced inline in Polish.
3. On success, land on `/r/<token>` (the "Request received" screen): reference `R-XXXX`, a `PENDING` status pill, the booking summary, and a "co dalej" stepper.
4. Receive (via the dev/log email adapter for now) a confirmation email containing the `/r/<token>` link; revisiting that link any time shows the current status (which becomes `Confirmed`/`Rejected` after S-03).

**Verification:** `supabase db reset` applies cleanly; `npm test` green (zod schema + estimated-total/duration + stepper-state suites); `npx astro check` + `npm run lint` + `npm run build` clean; manual walk-through of `/reserve` → review → `/r/<token>` against screens 04/05/06 + desktop set; submitting an overlapping range is blocked (pre-check message; and a forced race yields the conflict result, not a 500); the RPCs are anon-executable and leak no extra PII; a direct `anon` select on `reservations` is still denied.

### Key Discoveries:

- **The write crosses RLS via a definer RPC, mirroring `available_vehicles`.** `create_reservation_request(...)` runs the insert inside Postgres as definer, so `reservations` needs **no** anon policy. It owns reference + token generation and the `23P01`→typed-conflict mapping in one atomic place. `set search_path = ''`, every name schema-qualified, `grant execute ... to anon, authenticated`.
- **The conflict mapping is the north-star guarantee.** A naive check-then-insert would reintroduce the very race the `EXCLUDE` eliminates (F-01 "What We're NOT Doing"). The RPC instead *attempts the insert* and catches `23P01` (and `unique_violation` on a token/reference clash) — `exception when exclusion_violation then return (...'conflict'...)`. The availability pre-check is UX sugar; the constraint is truth.
- **The pre-check reuses `available_vehicles`, not a new query.** No anon-readable reservation list exists for `hasConflict` to consume client-side, so the pre-submit "is it still free?" check calls the existing RPC for the range and confirms the vehicle id is in the result. (The design-system note's "re-check with `hasConflict`" is realized through the RPC, which embeds the same window.)
- **The status read is a second PII-scoped definer RPC.** `get_reservation_status(p_token uuid)` returns one row of *display* fields (reference, status, dates, the vehicle's make/model/year/category/daily_rate/deposit, customer_name, created_at) for the matching token only — the token holder is the customer, so their own name is theirs to see; no other reservation is reachable without its token. Returns zero rows on a bad token → the page 404s.
- **`reference` + `access_token` are new columns, generated server-side.** `access_token uuid not null default gen_random_uuid()` (unguessable bearer secret for the link). `reference text` is a short human code `R-XXXX` minted in the RPC (e.g. from a sequence, base36-encoded) with a `unique` constraint — never client-supplied.
- **Estimated total = `daily_rate × dni`, `dni` = calendar-day span.** Screens show `24 – 27 marca · 3 dni` → `3 × 320 zł = 960 zł`; deposit (`kaucja`) shown separately, never summed in. `dni = returnDate − pickupDate` in whole days. Money parses from `string` defensively.
- **Received screen == status page.** The post-submit landing and the emailed status link are the same component at `/r/<token>` — built once, viewed first-time and on return.

## What We're NOT Doing

- **No `anon` INSERT/SELECT policy on `reservations`** — the table stays anon-denied; the funnel and status read go through definer RPCs only. No new PII exposure.
- **No real transactional email provider / verified sender** — the email seam ships with a dev/log adapter; the provider pick (roadmap Open Question #1) lands in S-05, which swaps the adapter. Emails are *composed and "sent" to the log*, not delivered, in this slice — flagged explicitly.
- **No employee confirm/reject email or action** — that is S-03. S-02 builds the reusable status page + `sendEmail` helper + status-link template so S-03 only wires the trigger. No `reservations` UPDATE/approval path here.
- **No B2B fields (Company / VAT-NIP / Notes)** — the desktop "your details" optionals are dropped per the field-set decision (FR-004 names name/email/phone). The columns can be added later without rework.
- **No registration plate, no branch/location** — the design's `WX 4827K` and `Warszawa · Mokotów` are fleet/location data absent from the schema; dropped (plate is S-04 territory; v1 is single-location). The summary shows make/model · year only.
- **No Daily/Monthly pricing toggle** — ship the **Daily** estimate only (`daily_rate × dni`). The Monthly mode (which would need a months/duration model) is deferred; the toggle is omitted, not faked.
- **No disabled/greyed booked dates in the calendar** — plain range picker, past dates disabled only (per the resolved design divergence). Availability is enforced by the RPC pre-check + the constraint.
- **No customer account, login, or "my reservations" list** — screen 15 is v2 (PRD §Non-Goals). Status is reachable only by the tokenized link.
- **No payments / cost engine** — "no payment now"; the estimate is indicative. Out of v1.
- **No alternative-date proposal flow** — the stepper copy mentions "or alternative dates," but proposing them is an employee action (S-03), not built here.
- **No UI/E2E test runner** — Vitest covers the new pure logic; UI is verified manually (S-01 decision).
- **No English copy** — Polish is canonical; EN prototype strings are reference only.

## Implementation Approach

Bottom-up, matching S-01's proven shape. Phase 1 lays the data + both definer RPCs (the write and the status read) and regenerates types. Phase 2 wraps all reservation data access, the zod submit contract, pure pricing/stepper helpers, and the email seam into a tested domain layer the UI consumes. Phase 3 builds the status page `/r/<token>` first — it is the funnel's redirect and email-link target, so it must exist before the funnel points at it and is independently verifiable against a seeded reservation. Phase 4 builds the funnel: the `/reserve` page, the `ReservationForm` island (the only meaningful interactivity — multi-step, range picker, pre-check, sticky total), and the `POST /api/reservations` route that validates, calls the RPC, sends the confirmation email, and redirects to the status page. Each phase is independently verifiable.

## Critical Implementation Details

- **RPC definer hygiene (load-bearing).** Both `create_reservation_request` and `get_reservation_status` must be `security definer set search_path = ''` with every name schema-qualified (`public.reservations`, `public.vehicles`), and `grant execute ... to anon, authenticated`. `create_reservation_request` must insert with `status = 'pending'` hard-coded (never from input), set `reference`/`access_token` itself, and **must not** return customer PII of *other* reservations — it returns only the new row's reference + token + a result tag. Omitting `search_path = ''` or schema-qualification is the standard definer-function footgun.
- **Conflict handling is exception-based, not check-then-insert.** Wrap the insert in `begin ... exception when exclusion_violation then return jsonb/record with result='conflict'`. This preserves the atomic guarantee. Also validate the vehicle exists and `is_active` (return `result='unavailable'` otherwise) before/at insert. A genuine unexpected error must propagate (don't swallow all exceptions).
- **The booking window must match the generated column byte-for-byte.** Any availability logic the RPC adds must reuse `tsrange(p_pickup + time '14:00', p_return + time '10:00', '[)')` exactly as `reserved_period` and `available_vehicles` do — no inclusive bound, no different hours — or the three enforcement points silently diverge.
- **Origin/CSRF on the POST.** `POST /api/reservations` must reject requests whose `Origin` header isn't same-origin before doing any work (dev origin is `http://localhost:4321`). This is both the CSRF guard and the reason manual `curl` tests must send `-H "Origin: http://localhost:4321"`.
- **Date semantics agree across the three mirrors.** The island's inline validation reuses `validateDateRange`/`bookingWindow` semantics (pickup today allowed, same-day return rejected, return 10:00 / pickup 14:00); the zod schema re-validates server-side; the RPC + constraint are the backstop. Reuse `src/lib/availability.ts` rather than re-deriving hours.
- **Money is a string at runtime.** The estimated-total helper parses `string | number` defensively; never `toFixed` a raw `daily_rate`.

## Phase 1: Schema Extension & Reservation RPCs

### Overview

Add the status-plumbing columns to `reservations` and stand up the two definer RPCs (write + status read) that let the public create and track a reservation without `reservations` ever being anon-readable. Regenerate types; seed a sample for status-page testing.

### Changes Required:

#### 1. Migration — columns + RPCs

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_public_reservation_request.sql`

**Intent**: Extend `reservations` with the reference/token/terms columns, and add the `create_reservation_request` (write) and `get_reservation_status` (read) definer RPCs. Additive over F-01; `reservations` RLS is **unchanged** (stays anon-denied).

**Contract**:
- `alter table reservations add column reference text, add column access_token uuid not null default gen_random_uuid(), add column terms_accepted_at timestamptz;` plus `add constraint reservations_reference_unique unique (reference)`. `reference` is nullable at the column level but always set by the RPC (existing seed rows backfilled — see item 2).
- `create_reservation_request(p_vehicle_id uuid, p_pickup date, p_return date, p_customer_name text, p_customer_email text, p_customer_phone text, p_terms_accepted boolean) returns <record/jsonb>` — `language plpgsql security definer set search_path = ''`. Body: verify `public.vehicles` row exists and `is_active` (else result `unavailable`); generate `reference` (short `R-XXXX`, e.g. base36 of a `bigint` sequence) and rely on the column default for `access_token`; `insert into public.reservations (...) values (..., 'pending', now() where p_terms_accepted)` ; wrap in `begin ... exception when exclusion_violation then return (result 'conflict')`. On success return `result 'created'`, the new `reference` and `access_token`. Never returns other rows' PII.
- `get_reservation_status(p_token uuid) returns <record>` — `language sql stable security definer set search_path = ''`. Selects one row joined to `public.vehicles` exposing display fields only: `reference, status, pickup_date, return_date, customer_name, created_at, vehicle make/model/production_year/category/daily_rate/deposit`. Zero rows on unknown token.
- `grant execute on function public.create_reservation_request(...) , public.get_reservation_status(uuid) to anon, authenticated;`
- Mirror `available_vehicles` / `current_app_role()` style exactly (schema-qualified, empty search_path). Snippet warranted only for the `exception when exclusion_violation` block and the `tsrange(... '[)')` reuse if the RPC re-checks availability.

#### 2. Seed — backfill + a sample reservation for status testing

**File**: `supabase/seed.sql` (edit)

**Intent**: Backfill `reference` for existing seeded reservations (so the unique/not-effectively-null invariant holds) and ensure at least one `pending` reservation with a known `access_token` exists to exercise `/r/<token>` and `get_reservation_status` manually.

**Contract**: Add `reference` (and optionally fixed `access_token`) values to the existing `reservations` inserts; keep deterministic, no `now()`-relative drift; must still apply cleanly under `supabase db reset` without tripping `reservations_no_overlap`.

#### 3. Regenerate types

**File**: `src/db/database.types.ts` (regen)

**Intent**: Sync row types + the two new function signatures.

**Contract**: Run `supabase gen types typescript --local > src/db/database.types.ts`. `Reservation` picks up the new columns; the RPCs appear under `Database['public']['Functions']`. No hand-edits.

### Success Criteria:

#### Automated Verification:
- Migration + seed apply cleanly: `supabase db reset`
- Types regenerate without error: `supabase gen types typescript --local > src/db/database.types.ts`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:
- With the **anon** key, `create_reservation_request(...)` for a free range returns `result = created` with a `reference` + `access_token`, and the row appears as `pending`; a direct `anon` select on `reservations` is still denied.
- Calling it again for an **overlapping** range on the same vehicle returns `result = conflict` (not a 500), and no second row is created.
- Calling it for an inactive/unknown vehicle returns `result = unavailable`.
- `get_reservation_status(<token>)` returns the reservation's display fields (no other reservation's data); an unknown token returns zero rows.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Domain Layer — Service, Schema, Helpers, Email Seam

### Overview

Centralize reservation data access, the submit contract, pure pricing/stepper logic, and the email seam into a tested layer the UI consumes — and make the email helper reusable by S-03.

### Changes Required:

#### 1. Reservation service

**File**: `src/lib/services/reservations.ts` (new)

**Intent**: One home for the reservation write, the status read, and the availability pre-check — each takes the per-request client and degrades gracefully on a `null` client.

**Contract**: `createReservationRequest(client, input): Promise<CreateReservationResult>` wrapping the `create_reservation_request` RPC, normalizing the result tag into a typed union (`{ status: 'created'; reference; token } | { status: 'conflict' } | { status: 'unavailable' }`). `getReservationStatus(client, token): Promise<ReservationStatusView | null>` wrapping `get_reservation_status`. `isVehicleAvailable(client, vehicleId, pickup, return): Promise<boolean>` reusing `available_vehicles` (vehicle present in the result for the range). Returns safe defaults on `null` client. Add `CreateReservationInput`, `CreateReservationResult`, `ReservationStatusView` to `src/types.ts`.

#### 2. Zod submit schema (+ honeypot)

**File**: `src/lib/reservation-schema.ts` (new)

**Intent**: The single server-side contract for the POST body; the island mirrors it client-side.

**Contract**: `reservationRequestSchema` validating `vehicle_id` (uuid), `pickup`/`return` (ISO date, reusing `validateDateRange` semantics — past/same-day/inverted rejected), `customer_name` (non-empty), `customer_email` (email), `customer_phone` (PL-friendly pattern), `terms_accepted` (must be `true`), and a honeypot field (e.g. `company_url`) that **must be empty**. Polish error messages. Export the inferred input type.

#### 3. Pricing / duration + reference + stepper helpers

**Files**: `src/lib/format.ts` (edit), `src/lib/reservation-status.ts` (new)

**Intent**: Pure presentation logic for the estimate, the duration label, and the status stepper model.

**Contract**: In `format.ts`: `rentalDays(pickup, return): number` (whole-day span), `estimatedTotal(dailyRate: string | number, days): number` (defensive parse), `formatDuration(days): string` (`"3 dni"`, Polish plural-aware), reusing `formatPln`. In `reservation-status.ts`: a canonical ordered step model (`pending` → `confirmed`/`rejected`; placeholder `pickup`/`return` steps greyed for later slices) and `stepperFor(status): Step[]` marking done/current/upcoming, with Polish labels + the `rejected` terminal branch. Pure, no I/O — this is the model S-03/S-05/S-06 extend.

#### 4. Email seam

**Files**: `src/lib/email/index.ts` (new), `src/lib/email/templates.ts` (new)

**Intent**: A provider-agnostic `sendEmail` with a dev/log adapter, plus the Polish submit-confirmation template — reusable by S-03 for confirm/reject mails.

**Contract**: `sendEmail({ to, subject, html, text }): Promise<void>` selecting an adapter; the only adapter now is a dev/log one that logs the composed message (no network). `reservationReceivedEmail({ reference, statusUrl, vehicle, pickup, return }): EmailContent` returning Polish subject + body containing the `/r/<token>` link. Structure so S-05 adds a real adapter and S-03 adds confirm/reject templates without touching callers.

#### 5. Unit tests

**Files**: `src/lib/reservation-schema.test.ts` (new), `src/lib/reservation-status.test.ts` (new), `src/lib/format.test.ts` (edit)

**Intent**: Guard the breakable pure logic.

**Contract**: schema cases (valid payload; bad email/phone; terms false; non-empty honeypot rejected; past/same-day/inverted dates rejected). stepper cases (pending/confirmed/rejected → correct done/current/upcoming + rejected branch). format cases (`rentalDays` span incl. same-month/cross-month; `estimatedTotal` from `string` and `number`; `formatDuration` plural forms).

### Success Criteria:

#### Automated Verification:
- Tests pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:
- A REPL/Studio spot-check that `createReservationRequest` returns `conflict` for a booked range and `created` for a free one, and `getReservationStatus` returns the seeded reservation by token.
- The dev/log email adapter logs a composed Polish confirmation containing a `/r/<token>` URL.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Status Page (`/r/<token>`)

### Overview

The customer-facing status screen — both the post-submit "Request received" landing and the emailed status link. Built before the funnel because it is the funnel's redirect + email target. Design: screens `06-customer-mobile-request-received.png`, `s-02-reservation-flow/mobile-4-request-received.png`, `.../desktop-3-request-received.png`.

**Design contract (distilled from the screenshots — build from this text, do not re-open the PNGs):**
- Centered crimson check badge (`--primary`), Instrument Serif headline **"Zgłoszenie przyjęte"**, sub "Bez konta — wszystko potwierdzimy e-mailem."
- A chip row: `Reference · R-XXXX` (mono) + a status pill — `PENDING` → amber `bg-warning` ("Oczekuje"); later `Confirmed` → `bg-success` ("Potwierdzone"), `Rejected` → crimson ("Odrzucone").
- A vehicle/booking summary card: silhouette (reuse `VehicleSilhouette`), make/model, `<rok>` (no plate), then rows — **Dane** (`24 – 27 marca · 3 dni`), **Szacunkowa cena** (`960 zł`), **Kaucja** (`2500 zł`).
- **"CO DALEJ"** stepper (the live one from Phase 2): step 1 *Oczekuje na akceptację* (current when pending), step 2 *Potwierdzenie e-mailem*, step 3 *Odbiór* (greyed/upcoming). Current step uses the crimson numbered node; upcoming are hollow/greyed.
- Primary navy CTA **"Wróć do floty" →** linking to `/fleet`.

### Changes Required:

#### 1. Status route

**File**: `src/pages/r/[token].astro` (new)

**Intent**: Resolve a reservation by its `access_token` and render the status screen; this is the durable link.

**Contract**: Read `Astro.params.token`; call `getReservationStatus(locals.supabase, token)`; if `null` (unknown/malformed token) return Astro 404. Otherwise render the summary + live stepper from the `ReservationStatusView`. No PII beyond the token holder's own request. Set `Layout` title + Polish `lang`.

#### 2. Status components

**Files**: `src/components/reservation/ReservationStatusCard.astro` (new), `src/components/reservation/StatusStepper.astro` (new)

**Intent**: The summary card and the "co dalej" stepper, driven by `stepperFor(status)`.

**Contract**: `ReservationStatusCard` renders the check badge, headline, reference chip + status pill (reuse `StatusPill` semantics / `bg-success`/`bg-warning` tokens), and the vehicle/dates/estimate/deposit summary via `format.ts` (`formatPln`, `formatDuration`, dates with the 14:00/10:00 hours where shown). `StatusStepper` maps the Phase-2 step model to the numbered crimson/greyed nodes. Astro-only (no interactivity). Polish copy.

### Success Criteria:

#### Automated Verification:
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Tests still pass: `npm test`

#### Manual Verification:
- `/r/<seeded-token>` renders the status screen matching screens 06 / mobile-4 / desktop-3 closely, with `PENDING`/"Oczekuje", the booking summary, and the stepper highlighting "Oczekuje na akceptację".
- An unknown/malformed token returns 404.
- All money renders correctly formatted (`960 zł`, `2500 zł`) and `dni` is correct for the range.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 4.

---

## Phase 4: Reservation Funnel (`/reserve` + island + API route)

### Overview

The interactive funnel: `/reserve` SSR-renders the chosen vehicle and hosts the multi-step `ReservationForm` island; `POST /api/reservations` validates, calls the RPC, sends the confirmation email, and redirects to `/r/<token>`. Design: screens `04-...-reservation-form.png` / `s-02-reservation-flow/mobile-2-reservation-form.png` (form), `05-...-request-summary.png` / `mobile-3-request-summary.png` (review), `desktop-1-vehicle-detail-dates.png` / `desktop-2-your-details.png` (desktop 3-step).

**Design contract (distilled — build from this text):**
- **Form step (04 / mobile-2):** header "Rezerwacja" with back chevron; vehicle card (silhouette, make/model, `<rok>`, no plate); calendar card — Polish month label (`MARZEC 2026`), selected-range headline (`24 – 27 marca · 3 dni`), weekday headers `Pn Wt Śr Cz Pt So Nd`, range selection with past dates disabled (reuse `calendar.tsx` `mode="range"`; **no booked-date greying**); customer fields **Imię i nazwisko**, **Email**, **Telefon**; a terms checkbox **"Akceptuję regulamin wynajmu."**; a sticky bottom crimson bar showing **SZACUNKOWA CENA · 960 zł** with `3 dni × 320 zł` and `+ kaucja 2500 zł`, and the primary button **"Podsumowanie" →**. (Desktop shows the same as a 3-step `Daty · Twoje dane · Potwierdzenie` with an ORDER SUMMARY side card and a "No payment now" note — **"Bez płatności teraz — potwierdzimy dostępność e-mailem, zwykle w godzinę."**)
- **Review step (05 / mobile-3):** "Przegląd zgłoszenia"; vehicle card + **"Zmień"** link; **DANE REZERWACJI** card — Odbiór `24 mar · 14:00`, Zwrot `27 mar · 10:00`, Czas trwania `3 dni`, Stawka `320 zł/doba`; **DANE KLIENTA** card — name/email/phone (edit affordances); sticky **SZACUNKOWA CENA 960 zł** + deposit; primary **"Wyślij zgłoszenie" →**.
- A hidden honeypot input (visually hidden, `autocomplete="off"`) named `company_url`.

### Changes Required:

#### 1. shadcn primitives

**Files**: `src/components/ui/{input,label,checkbox}.tsx` (new, via `npx shadcn@latest add`)

**Intent**: Form primitives the island needs (calendar/popover/select/card already exist from S-01).

**Contract**: Add `input`, `label`, `checkbox`. **Rewrite every generated `@/` import to a relative path** (ESLint bans `@/`). "new-york" style, against existing tokens.

#### 2. Reserve page

**File**: `src/pages/reserve.astro` (new)

**Intent**: SSR-resolve the vehicle for the funnel and host the island.

**Contract**: Parse `Astro.url.searchParams` (`vehicle_id`, optional `pickup`/`return`); `getVehicleById(locals.supabase, vehicle_id)` → Astro 404 if `null`/inactive (RLS hides inactive). Render the vehicle summary + `<ReservationForm client:load vehicle={...} initialPickup initialReturn />` passing the vehicle's pricing (`daily_rate`, `deposit`) for the live estimate. Polish `lang` + title.

#### 3. Reservation form island

**File**: `src/components/reservation/ReservationForm.tsx` (new, React island)

**Intent**: The only interactive piece — multi-step (dates → details → review), live estimate, pre-submit availability check, submit.

**Contract**: Local step state (`form` → `review`); reuse the `calendar.tsx` range picker (past disabled, no booked-date greying); customer inputs + terms + hidden honeypot; recompute the sticky estimate (`estimatedTotal`/`formatDuration`) on date change; inline Polish validation mirroring `reservationRequestSchema` + `validateDateRange`. On "Podsumowanie" go to review; on "Wyślij zgłoszenie": call `isVehicleAvailable` (pre-check → inline "pojazd właśnie został zarezerwowany" on false) then `POST /api/reservations` (JSON, same-origin). On `201` `{ token }` → `window.location = '/r/'+token`; on `409` show the Polish conflict message; on validation `400` show field errors. Hydrate `client:load`; reads initial vehicle + dates from props.

#### 4. API route

**File**: `src/pages/api/reservations.ts` (new)

**Intent**: Server-side submit endpoint — the trust boundary.

**Contract**: `export const POST`. (a) Reject if `Origin` isn't same-origin (CSRF; dev `http://localhost:4321`). (b) Parse JSON, validate with `reservationRequestSchema` (honeypot must be empty, terms true) → `400` + Polish field errors on failure. (c) `createReservationRequest(locals.supabase, input)`; map `conflict`/`unavailable` → `409` with a Polish message, `created` → continue. (d) `sendEmail(reservationReceivedEmail(...))` with the `/r/<token>` link (dev/log adapter; failure must not fail the request — log and proceed). (e) Return `201 { reference, token }`. Honeypot hits return a benign success-shaped response without inserting.

### Success Criteria:

#### Automated Verification:
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint` (no `@/` imports remain)
- Build succeeds: `npm run build`
- Tests still pass: `npm test`

#### Manual Verification:
- From a catalog detail page, "Zarezerwuj" lands on `/reserve?vehicle_id=…&pickup=…&return=…`; the vehicle + carried dates are shown; an unknown/inactive `vehicle_id` 404s.
- `/reserve` matches screens 04 (mobile) / desktop set; the estimate updates live with the date range; past dates are disabled and booked dates are **not** greyed.
- The review step matches screen 05 (Odbiór 14:00 / Zwrot 10:00, czas trwania, stawka, customer details); "Zmień" returns to the form.
- Submitting a free range creates a `pending` reservation, redirects to `/r/<token>` showing the new reference, and the dev/log adapter shows the confirmation email with the link.
- Submitting an overlapping range is blocked: the pre-check shows the Polish message; forcing a true race (two near-simultaneous submits) yields a `409` conflict, **not** a 500, and only one row is created.
- A cross-site POST (wrong `Origin`) and a non-empty honeypot are both rejected without inserting; a `curl` with `-H "Origin: http://localhost:4321"` and a valid body succeeds.

**Implementation Note**: After this phase and all automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

### Unit Tests (Vitest):
- `reservation-schema.ts` — valid/invalid payloads, honeypot, terms, date-rule agreement.
- `reservation-status.ts` — stepper state per status incl. rejected branch.
- `format.ts` — `rentalDays`, `estimatedTotal` (string vs number), `formatDuration` plurals.

### Integration Tests:
- None automated (no UI/E2E runner, by decision). DB-level integration is the two RPCs exercised manually against seed (created/conflict/unavailable, anon-executable, token read PII-safe).

### Manual Testing Steps:
1. `supabase db reset` → clean apply; RPC spot-checks (created/conflict/unavailable, anon key, `get_reservation_status` by token, `reservations` anon-denied).
2. `/r/<seeded-token>` → status screen vs 06 / mobile-4 / desktop-3; 404 on bad token.
3. `/reserve?vehicle_id=…&pickup=…&return=…` → form vs 04 + desktop; live estimate; past disabled; no booked-date greying; review vs 05; submit → redirect to `/r/<token>` + logged email.
4. Overlap: pre-check message; forced race → `409` not 500, single row.
5. CSRF/honeypot rejections; valid `curl` with `Origin` header succeeds.
6. `npm test`, `npx astro check`, `npm run lint`, `npm run build` all green.

## Performance Considerations

Negligible at v1 scale. The write is one RPC; the conflict check rides the existing GiST `EXCLUDE` index on `reserved_period`; the status read is a single token-keyed lookup (`access_token` is unique-defaulted — add an index if status reads grow). SSR + one form island keeps the funnel within the <2s NFR.

## Migration Notes

Phase 1's migration is additive (three columns + one unique constraint + two functions) and reversible (drop the functions, constraint, columns). `reservations` RLS is untouched — the table stays anon-denied; all public access is via the granted definer RPCs. Regenerate `src/db/database.types.ts` after applying. Seed is reset-reproducible; existing reservation rows get a backfilled `reference`.

## References

- Roadmap item: `context/foundation/roadmap.md` → S-02 (lines 111–121), north star (lines 24–26)
- PRD: FR-004, FR-005, US-01 (per roadmap refs)
- Prereq slice (the CTA + handoff): `context/changes/public-fleet-catalog/plan.md` (Reserve CTA → `/reserve?vehicle_id=…&pickup=…&return=…`)
- Data layer + constraint: `context/archive/2026-06-03-booking-integrity-data/plan.md`; migration `supabase/migrations/20260603155136_booking_integrity_data.sql`
- Overlap predicate (reuse): `src/lib/availability.ts`; date validation: `src/lib/catalog-filters.ts:116`
- Definer-RPC + availability precedent: `available_vehicles` in `supabase/migrations/20260605132958_public_fleet_catalog.sql`; `current_app_role()` in `20260604153139_employee_admin_roles.sql`
- Service / format / client-on-locals patterns: `src/lib/services/vehicles.ts`, `src/lib/format.ts`, `src/middleware.ts:11`
- API-route + zod convention: `src/pages/api/auth/signin.ts`; CLAUDE.md (Key conventions); dev :4321 + Origin/CSRF (project memory)
- Design: `context/foundation/design-system.md` (S-02 rows + the date-picker divergence note); screens `04,05,06` + `s-02-reservation-flow/{mobile-1..4,desktop-1..3}.png`; tokens `src/styles/global.css`
- Lessons: `context/foundation/lessons.md` (read design system first; distill screenshots to text at plan time — done above)
- Change identity: `context/changes/public-reservation-request/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema Extension & Reservation RPCs

#### Automated
- [x] 1.1 Migration + seed apply cleanly: `supabase db reset` — 895fb2d
- [x] 1.2 Types regenerate without error: `supabase gen types typescript --local > src/db/database.types.ts` — 895fb2d
- [x] 1.3 Type checking passes: `npx astro check` — 895fb2d
- [x] 1.4 Linting passes: `npm run lint` — 895fb2d

#### Manual
- [x] 1.5 anon `create_reservation_request` for a free range → `created` + reference + token; row is `pending`; anon `reservations` select still denied — 895fb2d
- [x] 1.6 Overlapping range → `result = conflict` (not 500); no second row — 895fb2d
- [x] 1.7 Inactive/unknown vehicle → `result = unavailable` — 895fb2d
- [x] 1.8 `get_reservation_status(<token>)` returns display fields only; unknown token → zero rows — 895fb2d

### Phase 2: Domain Layer — Service, Schema, Helpers, Email Seam

#### Automated
- [x] 2.1 Tests pass: `npm test` — 4e2e365
- [x] 2.2 Type checking passes: `npx astro check` — 4e2e365
- [x] 2.3 Linting passes: `npm run lint` — 4e2e365

#### Manual
- [x] 2.4 Spot-check: `createReservationRequest` → conflict/created; `getReservationStatus` returns seeded reservation by token — 4e2e365
- [x] 2.5 Dev/log email adapter logs a Polish confirmation containing a `/r/<token>` URL — 4e2e365

### Phase 3: Status Page (`/r/<token>`)

#### Automated
- [x] 3.1 Type checking passes: `npx astro check` — 154bd34
- [x] 3.2 Linting passes: `npm run lint` — 154bd34
- [x] 3.3 Build succeeds: `npm run build` — 154bd34
- [x] 3.4 Tests still pass: `npm test` — 154bd34

#### Manual
- [x] 3.5 `/r/<seeded-token>` matches screens 06 / mobile-4 / desktop-3; PENDING/"Oczekuje"; stepper highlights current step — 154bd34
- [x] 3.6 Unknown/malformed token → 404 — 154bd34
- [x] 3.7 Money + `dni` render correctly (`960 zł`, `2500 zł`, `3 dni`) — 154bd34

### Phase 4: Reservation Funnel (`/reserve` + island + API route)

#### Automated
- [x] 4.1 Type checking passes: `npx astro check`
- [x] 4.2 Linting passes (no `@/` imports remain): `npm run lint`
- [x] 4.3 Build succeeds: `npm run build`
- [x] 4.4 Tests still pass: `npm test`

#### Manual
- [ ] 4.5 "Zarezerwuj" → `/reserve?vehicle_id=…&pickup=…&return=…`; vehicle + carried dates shown; bad/inactive id 404s
- [ ] 4.6 `/reserve` matches screens 04 + desktop; estimate updates live; past disabled; booked dates NOT greyed
- [ ] 4.7 Review step matches screen 05 (14:00/10:00, czas trwania, stawka, customer details); "Zmień" returns to form
- [ ] 4.8 Free-range submit → `pending` row, redirect to `/r/<token>` with new reference, logged confirmation email
- [ ] 4.9 Overlapping submit blocked: pre-check message; forced race → 409 not 500; single row
- [ ] 4.10 Wrong-Origin POST + non-empty honeypot rejected without insert; valid `curl` with Origin header succeeds
