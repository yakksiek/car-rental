# Manual reservation (staff-created confirmed booking) Implementation Plan

## Overview

Let a logged-in employee create a **confirmed** reservation by hand for a phone-in customer — pick
vehicle + pickup/return dates, enter customer name/email/phone, see a **live availability check** —
so the slot is atomically blocked and the customer receives the standard confirmation email. The
booking is tagged **"Ręczna"** (manual). This is roadmap slice **S-12** (`manual-reservation`),
part of the staff-console cohort (`context/changes/staff-ops-features/frame.md`).

The whole feature is heavy reuse over one net-new atomic write path: a new
`create_confirmed_reservation` SECURITY DEFINER RPC (the existing `create_reservation_request`
hardcodes `status='pending'`), a staff-gated endpoint, and a modal — but the confirmation email,
the overlap guarantee, the reference minting, and the modal overlay idiom all already exist.

## Current State Analysis

- **The public create RPC can't make a confirmed booking.** `create_reservation_request`
  (`20260613090000_reservation_b2b_fields.sql:34-98`) hardcodes `status='pending'` and is anon-callable;
  `decide_reservation` (`20260617120000_reservation_approval.sql:60-153`) only transitions an existing
  pending row. Neither creates a confirmed row directly → S-12 needs its own definer RPC.
- **The overlap guarantee is atomic and reusable.** `reservations_no_overlap` EXCLUDE on
  `(vehicle_id, reserved_period)` WHERE `status in ('pending','confirmed')`
  (`20260603155136_booking_integrity_data.sql:124-129`) makes the confirmed insert safe: a race yields
  `exclusion_violation` (23P01) → mapped to a typed `conflict`. Unlike `decide_reservation` (which flips
  a pending row already holding its slot), the manual RPC **inserts** a confirmed row and must handle the
  conflict itself.
- **Reference minting is reusable.** `base36_encode(nextval('reservation_reference_seq'))`
  (`20260611171737_public_reservation_request.sql:34-57`, seq `:34`) — `immutable`, `search_path=''`,
  schema-qualified — is directly callable inside a new definer RPC. Copy the 3× `unique_violation` retry loop
  **from the current 10-arg `create_reservation_request` (`20260613090000_reservation_b2b_fields.sql`)** — the
  b2b drop+recreate is the live definition, not the 7-arg original; the minting logic is identical.
- **The confirmed-email path is fully reusable.** `notifyCustomer` (`src/pages/api/reservations/[id].ts:68-104`)
  renders `reservationConfirmedEmail` (`src/lib/email/templates.ts:81-120`) and sends via
  `sendTracked(..., template:"reservation_confirmed")` (`src/lib/services/email-delivery.ts:48-86`, which
  also logs an `email_deliveries` row). It consumes `DecisionEmailPayload` = the 11 email columns
  `decide_reservation` RETURNS (`src/types.ts:96-99`). **If the new RPC RETURNS the same 11 columns, the
  email path reuses unchanged.**
- **No live availability endpoint is client-reachable.** `isVehicleAvailable`
  (`src/lib/services/reservations.ts:105-123`, over `available_vehicles`) is server-only; there is no
  `/api/availability` route. → add a thin staff-gated GET wrapper.
- **No shadcn Dialog.** Modals are hand-rolled `fixed inset-0 … bg-card shadow-overlay` overlays; the
  canonical is `src/components/dashboard/ReservationDecision.tsx` (desktop-centered / mobile bottom-sheet),
  which maps directly onto the mockup's modal/sheet.
- **No origin marker on `reservations`.** The full column set (`src/db/database.types.ts:254-327`) has no
  `source`/`channel`/`is_manual`. "Ręczna" is a net-new column, orthogonal to `status`.
- **Confirmed bookings surface only on the calendar.** `list_reservations_for_calendar`
  (`20260617122000_list_reservations_for_calendar.sql:10-37`, `WHERE status in ('pending','confirmed')`) feeds
  `ReservationCalendar.tsx`; bars are **color-only** (pending amber / confirmed green — `src/lib/calendar/map.ts:18-21`),
  no text badge, legend has 2 swatches.
- **Entry-point host.** `dashboard/reservations.astro:39-46` renders a page-owned `<main>` above the
  `PendingQueue` island — the clean, nav-free injection point for a "Nowa rezerwacja" button + modal (the
  frame's constraint: **stay off the shell nav**, which S-11 owns).

## Desired End State

An employee on `/dashboard/reservations` clicks **Nowa rezerwacja**, a modal opens (desktop-centered /
mobile sheet), they pick a vehicle + dates and enter the customer's name/email/phone; the availability
panel resolves live (idle → checking → "Termin wolny" / "Termin zajęty"); on **Utwórz rezerwację** a
confirmed booking is created (atomically overlap-checked), tagged **Ręczna**, the customer is emailed the
standard confirmation, and the done panel shows the reference + "Ręczna" badge. The booking appears on the
calendar (green/confirmed) with a "Ręczna" chip in its read-only detail.

**Verification:** the RPC creates a confirmed `source='manual'` row (conflict on overlap, unauthorized for
non-staff); the endpoint creates + emails (delivery logged) and is CSRF/role-gated; the modal matches the
design contract on a vision-diff; the calendar shows the Ręczna chip.

### Key Discoveries:

- Confirmed-email send is fully reusable if the RPC RETURNS the 11 `DecisionEmailPayload` columns — `[id].ts:68-104`, `types.ts:96-99`.
- `decide_reservation` is the RPC template (role gate, RETURNS shape, definer hygiene) — `20260617120000_reservation_approval.sql:60-153`.
- Reference minting + retry loop — `20260611171737_public_reservation_request.sql:34-57,107-135`.
- Modal overlay idiom — `ReservationDecision.tsx` (`fixed inset-0 … bg-card shadow-overlay … md:max-w-md`); hook pattern — `useReservationDecision.ts:17-74`.
- Every `/api` route self-gates; POST order = Origin → auth → role → zod → RPC (lesson); GET reads skip Origin — `[id].ts:116-167`, `reservations/calendar.ts:10-12`.
- Grant hygiene: `revoke execute … from public, anon` then `grant … to authenticated` per new RPC (lesson).

## What We're NOT Doing

- **No calendar-cell entry point** (the mockup's "Dodać rezerwację ręczną?" confirm step) — follow-up; only the reservations-page button ships.
- **No quick-action menu** — the mockup's launcher lists **Nowy klient / Dodaj pojazd / Szybkie wydanie**; those are out of scope ("Nowy klient" implies a customer DB v1 lacks). The entry point is a **single** "Nowa rezerwacja" button, not the multi-item menu.
- **No rich conflict card.** The conflict state is a plain "Termin zajęty" message (no clashing-booking PII card, no "next free" hint) — the boolean check + the atomic EXCLUDE map are the authority.
- **No B2B/company/VAT/notes** on the staff form (the mockup omits them; columns stay null).
- **No new bar color / 3rd legend swatch** on the calendar — Ręczna shows as a chip in the read-only detail only; the pending/confirmed color scheme is unchanged.
- **Not touching the shell nav** (`StaffShell.astro` NAV) — S-11 owns that; S-12 stays off it.
- **No payment processing** — the footer total is display-only (payment at pickup), per PRD.

## Implementation Approach

Bottom-up: the atomic data path first (RPC + `source` column + calendar RPC), then the server seam
(service wrapper + shared email helper + two endpoints), then the modal UI, then the calendar tag. Each
phase is independently verifiable — the RPC and endpoints via integration tests against local Supabase, the
UI via a vision-diff.

## Critical Implementation Details

- **Atomic conflict on insert (not transition).** The RPC inserts `status='confirmed'` and must catch
  `exclusion_violation` → return `'conflict'`, and retry up to 3× on `unique_violation` (reference clash).
  The live GET availability check is advisory UX; the EXCLUDE inside the RPC is the TOCTOU-safe authority.
- **Email reuse hinges on the RETURN shape.** The RPC must RETURN `result` + the reservation `id` (for the
  `email_deliveries` entityId) + the exact 11 columns `decide_reservation` returns
  (`customer_name, customer_email, reference, access_token, pickup_date, return_date, vehicle_make,
vehicle_model, vehicle_production_year, vehicle_daily_rate, vehicle_deposit`). The endpoint strips `result`
  and `id` to get a `DecisionEmailPayload` and passes it to the shared confirmed-email helper.
- **Required fields diverge from the mockup.** The mockup enables create with a name only; we require
  **name + email + phone** (email drives the confirmation; both are DB `NOT NULL`). Recorded design deviation.
- **Grant + self-gate hygiene (lessons).** New RPC: `revoke execute … from public, anon` then `grant … to
authenticated`, keep the in-RPC `current_app_role()` gate. **The recreated `list_reservations_for_calendar`
  needs the SAME revoke re-issued** — a DROP+CREATE re-grants PUBLIC/anon by default (see Phase 1). POST endpoint self-gates Origin → auth → role →
  zod → RPC; the GET availability endpoint gates auth → role → params (no Origin check — it's a read).

## Phase 1: Data layer — `source` column + `create_confirmed_reservation` RPC + calendar RPC

### Overview

Add the origin marker and the atomic confirmed-insert RPC, and extend the calendar RPC to carry `source`.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260810120000_manual_reservation.sql` (new)

**Intent**: (a) add a `reservation_source` enum + a `source` column on `reservations` (default `'public'`,
so existing rows and the public funnel stay `'public'`); (b) create `create_confirmed_reservation` — a
SECURITY DEFINER RPC that role-gates, mints the reference, inserts `status='confirmed', source='manual'`
under the EXCLUDE constraint, and RETURNS the email-shaped columns; (c) drop+recreate
`list_reservations_for_calendar` to add `source` to its RETURNS + select.

**Contract**:

- `create type reservation_source as enum ('public','manual');`
- `alter table public.reservations add column source public.reservation_source not null default 'public';`
- `public.create_confirmed_reservation(p_vehicle_id uuid, p_pickup date, p_return date, p_customer_name text, p_customer_email text, p_customer_phone text)` → `returns table (result text, id uuid, customer_name text, customer_email text, reference text, access_token uuid, pickup_date date, return_date date, vehicle_make text, vehicle_model text, vehicle_production_year int, vehicle_daily_rate numeric, vehicle_deposit numeric)`; `language plpgsql security definer set search_path = ''`.
  - Role gate: `v_role := public.current_app_role(); if v_role is null or v_role not in ('employee','admin') then return 'unauthorized'`.
  - Vehicle active check → else `'unavailable'` (mirror the current b2b `create_reservation_request`, `20260613090000_reservation_b2b_fields.sql`).
  - 1..3 loop: `v_reference := 'R-' || public.base36_encode(nextval('public.reservation_reference_seq'))`; insert `(vehicle_id, customer_name, customer_email, customer_phone, pickup_date, return_date, status='confirmed', source='manual', reference)`; on `exclusion_violation` → `'conflict'`; on `unique_violation` retry (raise on 3rd). On success RETURN `'created'` + `id` + the 11 email columns joined from `vehicles`.
  - `revoke execute on function public.create_confirmed_reservation(uuid, date, date, text, text, text) from public, anon;` then `grant … to authenticated;`
- `list_reservations_for_calendar`: drop + recreate adding `source public.reservation_source` to the `returns table (…)` and `r.source` to the select; keep the role gate + `where status in ('pending','confirmed')`. **Re-apply BOTH the `grant execute … to authenticated` AND the `revoke execute … from public, anon`** — a freshly recreated function re-receives the built-in PUBLIC grant (+ Supabase's anon grant), and the revoke that closes that hole lives in a **separate** migration (`20260714120000_rpc_execute_grant_hardening.sql:38`), **not** in `20260617122000`. Dropping the revoke silently re-opens anon/public execute on the calendar RPC.

#### 2. Regenerated DB types

**File**: `src/db/database.types.ts`

**Intent**: Regenerate so the new RPC, the `source` column/enum, and the extended calendar RPC are typed.

**Contract**: `npx supabase gen types typescript --local > src/db/database.types.ts` (or the project's
gen script). `reservations` Row/Insert/Update gain `source`; `create_confirmed_reservation` Args/Returns
appear; `list_reservations_for_calendar` Returns gains `source`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase: `npx supabase db reset` (or `db push`)
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Integration test passes (`npm run test:integration`): `create_confirmed_reservation` as staff creates a `confirmed`, `source='manual'` row with a minted `R-…` reference and returns the 11 email columns; a second overlapping call returns `conflict`; a non-staff caller returns `unauthorized`; an inactive vehicle returns `unavailable`. **Anon cannot execute the recreated `list_reservations_for_calendar`** (execute revoked from public/anon after the DROP+CREATE).

#### Manual Verification:

- `select source, status from reservations` shows existing rows `public`; a hand-run RPC yields `manual`/`confirmed`.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Service wrapper + shared email helper + endpoints

### Overview

The TS seam: a service wrapper over the RPC, the confirmed-email send extracted for reuse, a staff-gated
create endpoint, and a staff-gated availability GET.

### Changes Required:

#### 1. Service wrapper

**File**: `src/lib/services/reservations.ts`

**Intent**: Add `createConfirmedReservation(client, input)` mirroring `createReservationRequest` +
`decideReservation` — calls the RPC, maps `result` to a typed union, and on `created` splits out the email
payload.

**Contract**: `createConfirmedReservation(client: ReservationClient | null, input: ManualReservationInput):
Promise<ManualReservationResult>`. Returns `{status:'created', reference, token, id, email: DecisionEmailPayload}
| {status:'conflict'} | {status:'unavailable'} | {status:'unauthorized'}`. `null` client / bad uuid →
`unauthorized`. New types in `src/types.ts`: `ManualReservationInput` (`vehicle_id, pickup, return,
customer_name, customer_email, customer_phone`) and `ManualReservationResult`.

#### 2. Shared confirmed-email helper

**File**: `src/lib/services/reservation-email.ts` (new) + refactor `src/pages/api/reservations/[id].ts`

**Intent**: Extract the confirmed-email send from `[id].ts`'s `notifyCustomer` into a reusable
`notifyReservationConfirmed(client, payload, origin, reservationId)` so both the decision endpoint's
confirmed branch and the new manual endpoint use one code path. Behavior-preserving for `[id].ts`. **Move the
module-local `vehicleLabel` helper (`[id].ts:52-60`) into the new module (or a shared util)** — the extracted
send calls it, so it must travel with the extraction rather than stay behind in `[id].ts`.

**Contract**: `notifyReservationConfirmed(client, payload: DecisionEmailPayload, origin: string,
reservationId: string): Promise<void>` — builds `statusUrl = /r/${access_token}`, `vehicle = vehicleLabel(payload)`,
renders `reservationConfirmedEmail`, and `sendTracked(client, payload.customer_email, content, {entityType:"reservation",
entityId: reservationId, template:"reservation_confirmed"})`. Never throws. `[id].ts` calls it in its
`confirmed` branch (its `rejected` branch stays as-is).

#### 3. Create-manual endpoint

**File**: `src/pages/api/reservations/manual.ts` (new)

**Intent**: Staff-gated POST that validates, creates the confirmed booking, sends the confirmation, and
returns the reference/token.

**Contract**: `POST APIRoute`. Self-gate order: Origin (`!== url.origin` → `403 {error: badOrigin}`); auth
(`!locals.user` → `401`); role (`!isRoleSufficient(locals.role,'employee')` → `403`); zod
(`manualReservationSchema` — a staff branch of `reservation-schema.ts` **without** `terms_accepted`;
`customer_email z.email()`, `customer_phone` regex, date-range via `validateDateRange`) → `400 {errors}`;
then `createConfirmedReservation` → map `unauthorized`→403, `unavailable`→409 `{reason:"unavailable"}`,
`conflict`→409 `{reason:"conflict"}`, `created`→ `notifyReservationConfirmed(client, email, origin, id)`
(best-effort) then `201 {reference, token}`. Replicate the local `json()` / `MSG` convention every sibling
`/api` route uses (both are module-local per route — there is no shared helper to import).

#### 4. Availability GET endpoint

**File**: `src/pages/api/availability.ts` (new)

**Intent**: A thin staff-gated GET the modal polls for the live check.

**Contract**: `GET APIRoute`. Gate: auth (`!locals.user` → 401), role (`!isRoleSufficient(locals.role,'employee')`
→ 403); no Origin check (read). Query params `vehicle_id`, `pickup`, `return`; validate (uuid regex + ISO
date regex) → `400` on bad input; call `isVehicleAvailable(locals.supabase, vehicle_id, pickup, return)` →
`200 {available: boolean}`. Note `isVehicleAvailable` **throws** on RPC error (unlike the advisory reads), so
wrap the call in try/catch → `500` (or `{available:false}`) rather than an unhandled throw.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Integration tests pass (`npm run test:integration`): `POST /api/reservations/manual` as staff creates a confirmed booking, returns `201 {reference, token}`, and writes an `email_deliveries` row (`template:"reservation_confirmed"`) via the test email adapter; an overlapping range → `409 {reason:"conflict"}`; cross-origin → `403`; unauthenticated/non-staff → `401`/`403`; missing email/phone → `400`. `GET /api/availability` returns `{available}` for staff and `403` for anon. `[id].ts` confirmed-decision email still sends (regression).

#### Manual Verification:

- Hitting the endpoints from the app (same-origin) creates a booking and the dev email adapter logs the confirmation.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Manual-reservation modal + entry point

### Overview

The staff-facing modal (desktop-centered / mobile sheet) reusing the `ReservationDecision` overlay idiom,
with the live availability panel, footer summary, and done panel — mounted above `<PendingQueue>` on the
reservations page.

### Changes Required:

#### 1. Manual-reservation modal + trigger island

**File**: `src/components/dashboard/ManualReservationModal.tsx` (new) + `NewReservationButton.tsx` (new, or one island)

**Intent**: A "Nowa rezerwacja" button that opens the modal. The modal has: a vehicle select (from SSR'd
fleet), pickup/return `<input type="date">` (min today) + the "Odbiór od 14:00 · zwrot do 10:00" note, the
live **availability panel** (idle / checking / "Termin wolny" / "Termin zajęty" / invalid), customer
name/email/phone inputs, a footer rate/deposit summary, and a **Utwórz rezerwację** button enabled only when
availability is `available` and name+email+phone are valid. On success, swap to the **done** panel (reference

- "Ręczna" badge + summary + "Zobacz w kalendarzu" / "Gotowe").

**Contract**: Reuse the overlay markup from `ReservationDecision.tsx` (`fixed inset-0 z-[60] … bg-card
shadow-overlay w-full rounded-t-[28px] … md:max-w-md md:rounded-xl`, click-outside + `stopPropagation`,
mobile drag-handle). A `useManualReservation` hook (mirror `useReservationDecision.ts`) owns: a **debounced
(~400ms)** GET to `/api/availability` on vehicle/pickup/return change (→ av state), and the POST to
`/api/reservations/manual` with a `busy` flag + outcome classification. Client validation via the staff
schema (name min 1, `z.email()`, phone regex, date-range). Footer math via `format.ts` (`rentalDays`,
`estimatedTotal`, `formatPln`, `formatDailyRate`, deposit). Vehicle select via `ui/select.tsx`. Copy per the
design contract; verbatim Polish (see contract). Pending state on the submit button (spinner) per the async-button rule.

#### 2. Reservations page wiring

**File**: `src/pages/dashboard/reservations.astro`

**Intent**: Load the active fleet and mount the trigger island above `<PendingQueue>` in the page-owned
`<main>` (not the shell nav).

**Contract**: Add `listFleet(supabase)` (active vehicles) to the existing `Promise.all`; render
`<NewReservationButton client:load vehicles={fleet} />` as a sibling above `<PendingQueue>`. No change to
`StaffShell` props or the nav.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- The "Nowa rezerwacja" button on `/dashboard/reservations` opens the modal (desktop-centered / mobile sheet).
- Availability panel resolves live: idle → checking → "Termin wolny" for a free slot, "Termin zajęty" for an overlapping one; the submit button enables only when available + name/email/phone valid.
- Creating a booking shows the done panel (reference + "Ręczna" badge); "Zobacz w kalendarzu" navigates to the calendar and the booking is there (confirmed/green).
- The customer receives the confirmation email (dev log / real inbox).
- Vision-diff of the form / available / conflict / done states (desktop + mobile) against the design contract is clean apart from recorded deviations.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 4.

---

## Phase 4: "Ręczna" on the calendar

### Overview

Surface the persisted `source` where confirmed bookings live: a "Ręczna" chip in the calendar's read-only
booking detail.

### Changes Required:

#### 1. Thread `source` through the calendar type + mapping

**File**: `src/types.ts` (`CalendarReservation`) + `src/lib/calendar/map.ts`

**Intent**: Add `source` to `CalendarReservation` and carry it into the calendar event so the detail can
read it. No new bar color / legend swatch.

**Contract**: `CalendarReservation` gains `source: "public" | "manual"`. `reservationsToEvents` passes
`source` through (e.g. on the event's extended props). Colors/legend unchanged.

#### 2. Ręczna chip in the read-only detail

**File**: `src/components/dashboard/ReservationCalendar.tsx`

**Intent**: In the read-only detail shown when a **confirmed** booking is clicked, render a "Ręczna" chip
when `source === 'manual'`.

**Contract**: A `Badge` (`ui/badge.tsx`) with a token className matching the confirmed-green house style
(e.g. `text-success bg-[var(--flota-success-soft)]`), label **Ręczna**, shown only for manual bookings.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Clicking a manually-created confirmed booking on the calendar shows a "Ręczna" chip in its detail; a public booking shows none.
- No change to the calendar's pending/confirmed colors or the 2-item legend.

**Implementation Note**: Final build phase before the Design Alignment Audit closes planning-fidelity.

---

## Testing Strategy

### Unit Tests:

- The availability-state reducer (idle/checking/available/conflict/invalid) as a pure function, if extracted from `useManualReservation`. Date-range + schema validation reuse existing tested helpers (`validateDateRange`, `reservation-schema`).

### Integration Tests:

- `create_confirmed_reservation` RPC: confirmed + `source='manual'` + reference; conflict on overlap; unauthorized for non-staff; unavailable for inactive vehicle.
- `POST /api/reservations/manual`: create + `email_deliveries` row via test adapter; conflict; CSRF (cross-origin); auth/role; validation (missing email/phone).
- `GET /api/availability`: staff `{available}`; anon 403.
- Regression: `[id].ts` confirmed-decision email still sends via the extracted helper.

### Manual Testing Steps:

1. Open the modal from `/dashboard/reservations`; pick a free vehicle+range → "Termin wolny" → create → done panel (Ręczna).
2. Re-open, pick an overlapping range → "Termin zajęty"; submit disabled.
3. Confirm the customer email arrives (dev log) and the booking is green on the calendar with a Ręczna chip.
4. Vision-diff modal states (desktop + mobile).

## Performance Considerations

Negligible — one debounced availability GET per field change and one insert per create. The availability GET
reuses the indexed `available_vehicles` RPC.

## Migration Notes

Additive: the `source` column defaults `'public'` (existing rows + the public funnel unaffected); the new
RPC and the calendar-RPC signature change are additive. No data backfill.

**Cohort coordination (types regen).** S-12 and S-13 both regenerate `src/db/database.types.ts` on sibling
branches that merge separately. The **second slice to merge** must reset the local DB with **both** migrations
applied and re-run `supabase gen types` — regenerate against the **combined** schema; **never text-merge the
generated file** (a stale regen would drop the other slice's `source` column / RPC additions).

## References

- Frame brief: `context/changes/staff-ops-features/frame.md`
- Roadmap slice: `context/foundation/roadmap.md` → S-12
- Design source: `manual-reservation.jsx` (live in Claude Design `352d78a6-…`); contract at `context/changes/manual-reservation/design-contract.md`
- RPC template: `supabase/migrations/20260617120000_reservation_approval.sql:60-153`; reference minting: `20260611171737_public_reservation_request.sql:34-57`; EXCLUDE: `20260603155136_booking_integrity_data.sql:124-129`
- Email path: `src/pages/api/reservations/[id].ts:68-104`, `src/lib/email/templates.ts:81-120`, `src/lib/services/email-delivery.ts:48-86`
- Endpoint + modal patterns: `src/pages/api/reservations/[id].ts:116-167`, `src/components/dashboard/ReservationDecision.tsx`, `src/components/hooks/useReservationDecision.ts:17-74`
- Calendar: `20260617122000_list_reservations_for_calendar.sql`, `src/lib/calendar/map.ts:18-21`, `src/components/dashboard/ReservationCalendar.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data layer — source column + create_confirmed_reservation RPC + calendar RPC

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase
- [x] 1.2 Type checking passes: `npx astro check`
- [x] 1.3 Linting passes: `npm run lint`
- [x] 1.4 Integration: RPC creates confirmed/manual + reference + email cols; conflict on overlap; unauthorized non-staff; unavailable inactive vehicle; anon cannot execute recreated calendar RPC

#### Manual

- [ ] 1.5 Existing rows read `source='public'`; a hand-run RPC yields `manual`/`confirmed`

### Phase 2: Service wrapper + shared email helper + endpoints

#### Automated

- [ ] 2.1 Type checking passes: `npx astro check`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Build passes: `npm run build`
- [ ] 2.4 Integration: POST creates + logs email_deliveries; conflict 409; CSRF 403; auth/role 401/403; validation 400; GET availability staff/anon; [id].ts email regression

#### Manual

- [ ] 2.5 Same-origin calls create a booking; dev adapter logs the confirmation

### Phase 3: Manual-reservation modal + entry point

#### Automated

- [ ] 3.1 Type checking passes: `npx astro check`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build passes: `npm run build`

#### Manual

- [ ] 3.4 Button opens the modal (desktop-centered / mobile sheet)
- [ ] 3.5 Availability resolves live; submit enables only when available + name/email/phone valid
- [ ] 3.6 Create → done panel (reference + Ręczna); booking appears confirmed on the calendar
- [ ] 3.7 Customer receives the confirmation email
- [ ] 3.8 Vision-diff of form/available/conflict/done (desktop + mobile) clean apart from deviations

### Phase 4: "Ręczna" on the calendar

#### Automated

- [ ] 4.1 Type checking passes: `npx astro check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Build passes: `npm run build`

#### Manual

- [ ] 4.4 A manual confirmed booking shows a Ręczna chip in its calendar detail; a public one shows none
- [ ] 4.5 No change to calendar colors or the 2-item legend
