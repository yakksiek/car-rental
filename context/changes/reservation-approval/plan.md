# Reservation Approval (S-03) Implementation Plan

## Overview

Build the employee-facing decision step that turns a `pending` reservation request into a `confirmed` or `rejected` one and notifies the customer. A logged-in employee opens `/dashboard/reservations`, sees the queue of pending requests, reviews one (dates, vehicle, customer, pricing), and either **accepts** it (status → `confirmed`) or **rejects** it with a canned reason (status → `rejected`, reason stored). The write crosses the RLS boundary through a `SECURITY DEFINER` RPC — `decide_reservation(...)` — that validates the caller's role, guards that the request is still `pending`, flips the status atomically, and returns the customer fields needed to email them. The customer's existing `/r/<token>` status page (built in S-02) then reflects the new state, and a confirm/reject email is composed through the same `sendEmail` seam S-02 stood up.

This slice consumes the rails S-02 deliberately left: the status enum (`pending`/`confirmed`/`rejected`/`cancelled`), the stepper model (which already has `confirmed`/`rejected` terminal branches), and the dev-log email seam. It adds the first authenticated **write** to `reservations` done the right way (definer RPC + tightened RLS), and the first employee-facing screen beyond the dashboard placeholder.

## Current State Analysis

- **The accept path cannot conflict — a key simplification.** `reservations_no_overlap` is `EXCLUDE USING gist (vehicle_id WITH =, reserved_period WITH &&) WHERE status IN ('pending','confirmed')` (`supabase/migrations/20260603155136_booking_integrity_data.sql:124-129`). Because **pending already participates** in the constraint, two overlapping pending requests can never coexist (the second was rejected with `23P01` at submission). So `pending → confirmed` never introduces a conflict — the row already holds its slot. Accept is a pure status flip; no overlap re-check is needed.
- **No status-transition write path exists.** No `decide_reservation`/`confirm`/`reject` RPC; the stepper (`src/lib/reservation-status.ts`) is read-only and explicitly does not encode transition validity ("this is the model S-03/S-05/S-06 extend", S-02 `plan.md:156`).
- **Authenticated RLS on `reservations` is wide open.** Policies are `to authenticated` with `using (true)` / `with check (true)` for SELECT/INSERT/UPDATE/DELETE (`20260603155136_booking_integrity_data.sql:155-174`) — any logged-in user can update any reservation, with no role or transition check. `anon` has no policy (fully denied). There is no employee/admin distinction in the reservations policies yet (F-02 added `profiles.role` + `current_app_role()`).
- **Writes-via-definer-RPC is the established convention.** Every `reservations` write/read in S-02 crosses RLS through a `SECURITY DEFINER ... set search_path = ''` RPC (`create_reservation_request`, `get_reservation_status`, `get_vehicle_busy_ranges`). S-03 follows the same shape for the decision write.
- **Role gating is centralized and ready.** `src/middleware.ts` resolves `context.locals.user` + `context.locals.role` (from `profiles`), and `src/lib/access.ts` (`ROUTE_ROLES`, `resolveRequiredRole`, `isRoleSufficient`) gates `/dashboard*` to `employee` (admin ⊇ employee). `current_app_role()` exists in SQL for in-RPC checks.
- **The API-route pattern is fixed by S-02.** `src/pages/api/reservations.ts` shows the canonical shape: a `json(status, body)` helper, an `Origin` CSRF check, zod `safeParse` + a `fieldErrors` map, typed result handling, and **best-effort awaited** `sendEmail` inside a swallowing `try/catch` ("request still succeeds"). Dev runs on **:4321**; POST/PATCH need a same-origin `Origin` header.
- **The email seam is built and delivers nothing yet.** `sendEmail(message)` (`src/lib/email/index.ts`) routes through a module-level `devLogAdapter` that `console.log`s "composed (no provider configured — NOT delivered)" and never throws. `src/lib/email/templates.ts` has exactly one template (`reservationReceivedEmail`) and a comment: "S-03 adds the confirm/reject templates alongside this one." The real provider (Resend-leaning, still an open decision) lands in S-05 by swapping the single `adapter` const.
- **The design is fully drawn for both mobile and desktop.** Mobile: `09-staff-mobile-dashboard`, `10-staff-mobile-pending-queue`, `11-staff-mobile-request-detail` (+ `staff-screens.jsx:558-851`). Desktop (provided 2026-06-17): `20-staff-desktop-dashboard.jpg` (the "Need a decision" panel) and `21-staff-desktop-requests.jpg` (the **master-detail** Pending-requests screen). Desktop differs structurally from mobile — see the Phase 5 design contract. Canonical Polish copy and tokens are specified; build against `src/styles/global.css`, never the prototype JSX.
- **The data model has no driver-license or plate fields.** The prototype detail shows "Prawo jazdy Kat. B" and a plate; neither exists in `reservations`/`vehicles`. The detail screen renders only data we actually have (customer name/email/phone, vehicle make/model/year, dates, reference, daily rate, deposit, optional company/VAT/notes).
- **No UI/E2E test runner.** Vitest covers pure functions only; UI is verified manually (S-01/S-02 decision). S-03 adds Vitest coverage for any new pure logic (transition validity, reason validation).

## Desired End State

A logged-in employee can:

1. Open `/dashboard/reservations` and see a queue of **pending** requests (newest first), each card showing reference, customer, vehicle, date range, duration, and estimated total — matching the drawn queue.
2. Accept or reject directly from a queue card (quick path) **or** open a request's detail for the full context (dates with 14:00/10:00 times, customer contact, pricing + deposit), then decide there.
3. On **reject**, pick a canned reason (`Daty już niedostępne` / `Brak wymaganej kategorii` / `Pojazd wycofany` / `Inny`) in a bottom sheet; `Inny` accepts a short free-text note. The reason is stored.
4. See a **full result overlay** on success (`Rezerwacja potwierdzona` / `Wniosek odrzucony`, "Klient powiadomiony e-mailem"), after which the decided request leaves the pending queue.
5. Be safely blocked if the request was already decided (by another employee or a stale tab): the action returns "already handled" and the queue re-syncs — no silent overwrite.
6. Open `/dashboard/calendar` and see a **resource-timeline calendar** (vehicles as rows, `pending` + `confirmed` reservations as bars positioned at the real 14:00→10:00 window) on both mobile (horizontally-scrollable timeline + Month toggle) and desktop — matching screens 16/22. Clicking a **pending** bar opens the same accept/reject flow as the queue (one decision mechanism); clicking a **confirmed** bar shows a read-only detail.

The customer's `/r/<token>` page now shows `Confirmed`/`Rejected`, and a Polish confirm/reject email is composed through the dev-log seam (real delivery arrives with S-05).

**Verification:** `supabase db reset` applies cleanly; `npx supabase gen types` leaves `src/db/database.types.ts` in sync; `npm test` green (transition-validity + reason-validation suites); `npx astro check` + `npm run lint` + `npm run build` clean; manual walk-through on a mobile viewport against screens 09/10/11 — accept → overlay → `/r/<token>` shows `Confirmed`; reject → reason sheet → overlay → `/r/<token>` shows `Rejected` with stored reason; a second decision on the same request returns the friendly already-handled path; a non-employee (no profile role) is 403'd from the page and the API.

### Key Discoveries:

- **Accept is conflict-free by construction** — pending participates in the `EXCLUDE` set, so confirming cannot collide (`20260603155136_booking_integrity_data.sql:124-129`). The decision RPC needs a *status guard* (still `pending`?), not an overlap re-check.
- **The decision RPC returns the email payload** so the endpoint can notify without a second query: `result`, `customer_email`, `customer_name`, `reference`, `access_token`, plus the vehicle/date fields the templates need.
- **Tightening RLS is safe because writes go through the definer RPC** — the RPC runs as owner and bypasses RLS, so the blanket authenticated UPDATE/DELETE policies can be dropped (or narrowed) without breaking the decision path. SELECT stays for authenticated employees (the queue reads through the per-request client).
- **The stepper already models the end states** (`src/lib/reservation-status.ts` — `confirmed`/`rejected` branches), so `/r/<token>` reflects the new status with no status-page changes.
- **Email is reuse-only**: two new pure templates in `src/lib/email/templates.ts` + a best-effort `sendEmail` call in the endpoint, mirroring `reservationReceivedEmail` and the S-02 route's swallowing `try/catch`. The adapter is not touched.

## What We're NOT Doing

- **No cancellation of confirmed bookings** — S-03 only does `pending → confirmed/rejected`. The `cancelled` status stays in the enum, unused by any UI/endpoint here (a later slice drives it).
- **No real email delivery / provider wiring** — the confirm/reject templates send through the dev-log seam (composed, not delivered). The provider pick + sender-domain verification stays in S-05. Flagged explicitly.
- **No desktop layout in Phases 1–4** — Phases 1–3 are layout-agnostic; Phase 4 ships the **mobile** layout (separate queue → detail navigation); **Phase 5** adds the **desktop master-detail** layout from the now-provided designs (`20-staff-desktop-dashboard.jpg`, `21-staff-desktop-requests.jpg`). The two layouts share components, endpoint, and decision logic.
- **No alternative-date proposal flow** — rejecting frees the dates; proposing new ones is out of scope (the stepper copy mentions it only as text).
- **No driver-license / plate / location fields** — absent from the schema; the detail screen shows only data we have.
- **No general reservations admin view** — the queue is pending-only. Reviewing/altering past decisions (and any "undo") is out of scope.
- **No "recently decided" list or undo** — once decided, a request leaves the queue; the record is visible only on the customer's `/r/<token>` page.
- **No click-empty-slot manual reservation creation** (Phases 6–7) — the calendar's `+`/empty-cell create affordance is **deferred future work**, not in the roadmap. `onCellClick` is disabled; the `+` button is omitted. (Researched in `calendar-component-research.md`; explicitly parked by the user.)
- **No drag/resize rescheduling on the calendar** — `reserved_period` is generated from the dates and there is no reschedule write path; the calendar is read-only except for the accept/reject decision. `disableDragAndDrop` is set.
- **No status filter chips / future-state legend on the calendar** — only `pending` + `confirmed` render, with a two-item legend. The mockup's `Filtry` control and the `Active`/`Overdue`/`Completed` states (S-05/06/07) are out of scope.
- **No UI/E2E runner** — Vitest covers the new pure logic; the UI is verified manually.
- **No English copy** — Polish is canonical.

## Implementation Approach

Bottom-up, mirroring S-02's proven shape. Phase 1 lays the data layer: the `rejection_reason`/`rejection_note` columns, the `decide_reservation` definer RPC (role check + pending-guard + atomic flip + email payload return), and the RLS tightening, then regenerates types. Phase 2 wraps the read (list pending) and the write (decide) in the reservation service and exposes the decision through `PATCH /api/reservations/[id]`, with the already-decided path mapped to a friendly 409. Phase 3 adds the two Polish email templates and wires the best-effort send into the endpoint. Phase 4 builds the mobile approval UI — the `/dashboard/reservations` page, the queue/detail/reason-sheet/result-overlay island — against the live tokens and canonical copy, wired to the endpoint. Phase 5 layers the desktop layout once the design assets land. Phases 6–7 then add the reservation **calendar** surface: Phase 6 stands up the `@ilamy/calendar` dependency, a range read (`listReservationsForCalendar`), and pure, Vitest-tested mapping helpers (no UI); Phase 7 builds the `/dashboard/calendar` resource-timeline island and makes pending-event clicks reuse the decision flow (extracted from Phase 4 into a shared `ReservationDecision` + `useReservationDecision`). Each phase is independently verifiable; Phases 1–3 carry the whole decision behavior and can be verified via SQL + curl before any UI exists, and Phase 6 is verifiable via tests before the calendar island exists.

## Critical Implementation Details

- **State sequencing in the decision RPC**: lock and re-read the row's status inside the RPC (`select ... for update`), then branch — `not found` → `not_found`; status `<> 'pending'` → `already_decided`; else apply. This is what makes two employees deciding the same request safe; the guard, not the UI, is the source of truth. The `updated_at` trigger fires on the flip.
- **Decision endpoint is best-effort on email**: the status transition must be committed before the email is attempted, and a send failure must never roll it back — reuse the S-02 route's awaited-inside-`try/catch` pattern (`src/pages/api/reservations.ts` defense (f)).

## Phase 1: Data layer — decision RPC, reason columns, RLS tightening

### Overview

Add the columns to record a rejection reason, the `SECURITY DEFINER` RPC that performs the guarded status transition and returns the email payload, and tighten the over-permissive authenticated write policies. Regenerate the generated DB types.

### Changes Required:

#### 1. Migration — reason columns + decision RPC + RLS

**File**: `supabase/migrations/<timestamp>_reservation_approval.sql`

**Intent**: Persist a rejection reason, provide the single atomic decision path, and close the blanket-update RLS hole now that writes go through the RPC.

**Contract**:
- Columns on `reservations`: `rejection_reason text` with a `check` constraint over `('dates_unavailable','no_category','vehicle_withdrawn','other')` (nullable; set only on reject), and `rejection_note text` (nullable; free text, used when reason is `other`). A `check` that `rejection_reason is not null` whenever `status = 'rejected'` (and null otherwise) keeps the column honest.
- Function `public.decide_reservation(p_id uuid, p_decision text, p_reason text default null, p_note text default null) returns table (result text, customer_name text, customer_email text, reference text, access_token uuid, pickup_date date, return_date date, vehicle_make text, vehicle_model text, vehicle_production_year int, vehicle_daily_rate numeric, vehicle_deposit numeric)`, `language plpgsql security definer set search_path = ''`. Behavior: reject if `current_app_role()` not in (`employee`,`admin`) → `result='unauthorized'`; `select ... for update`; no row → `not_found`; `status <> 'pending'` → `already_decided`; `p_decision='confirm'` → set `confirmed`; `p_decision='reject'` → require a valid `p_reason` (else `invalid_reason`), set `rejected` + reason/note; return `result` = the new status (`confirmed`/`rejected`) plus the customer/vehicle fields for the email. `grant execute ... to authenticated` (not `anon`).
- RLS: drop (or narrow to a no-op) the blanket `reservations_update_authenticated` and `reservations_delete_authenticated` policies; keep `reservations_select_authenticated` so employees can read the queue. (Writes now occur only inside the definer RPC.)

#### 2. Regenerate generated types

**File**: `src/db/database.types.ts`

**Intent**: Reflect the new columns + RPC so the service layer is typed.

**Contract**: Regenerate via the project's Supabase type-gen command against the local DB. No hand edits. (Note: this file is a shared-merge surface if S-04 fleet-management is developed in a parallel worktree — regenerate after both migrations are applied.)

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `supabase db reset`
- Generated types are in sync (no diff after re-running type-gen): `npx supabase gen types typescript --local`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- Calling `decide_reservation` on a pending row as an employee flips it to `confirmed`/`rejected` and returns the customer payload (verified via SQL editor / `supabase` shell).
- Calling it again on the same row returns `already_decided` (no change).
- Calling it with a non-employee role (or no profile) returns `unauthorized`.
- A direct authenticated `update reservations set status=...` is now denied by RLS (writes only via the RPC).

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Service + decision API

### Overview

Expose the queue read and the decision write through the reservation service, and add the authenticated `PATCH /api/reservations/[id]` endpoint that validates input, gates by role, calls the RPC, and maps results to status codes — including the friendly already-decided path.

### Changes Required:

#### 1. Reservation service functions

**File**: `src/lib/services/reservations.ts`

**Intent**: Add a client-taking, null-graceful list of pending requests for the queue, and a typed wrapper over `decide_reservation`.

**Contract**:
- `listPendingReservations(client): Promise<PendingReservation[]>` — selects `status = 'pending'` joined with the vehicle display fields, newest first; returns `[]` when client is null. `PendingReservation` is a new type in `src/types.ts` (customer fields + vehicle summary + dates + reference + created_at).
- `decideReservation(client, id, decision, reason?, note?): Promise<DecideReservationResult>` — calls the RPC; returns a typed union `{ status: 'confirmed' | 'rejected'; email: {...payload} } | { status: 'already_decided' } | { status: 'not_found' } | { status: 'unauthorized' } | { status: 'invalid_reason' }`. Mirrors `createReservationRequest`'s tagged-union style.

#### 2. Decision API route

**File**: `src/pages/api/reservations/[id].ts`

**Intent**: The single mutation endpoint employees call to accept/reject.

**Contract**: `PATCH` handler following `src/pages/api/reservations.ts` conventions — `Origin` CSRF check (403 on mismatch); role gate via `context.locals.role` / `isRoleSufficient(..., 'employee')` (403); zod body `{ decision: 'confirm' | 'reject', reason?: <enum>, note?: string }` where `reject` requires a valid `reason` (400 + `fieldErrors`); call `decideReservation`; map `confirmed`/`rejected` → 200 `{ status }`, `already_decided` → 409 `{ error, reason: 'already_decided' }`, `not_found` → 404, `unauthorized` → 403, `invalid_reason` → 400. Best-effort email send happens here in Phase 3.

#### 3. Pending-reservation + decision types

**File**: `src/types.ts`

**Intent**: Shared types for the queue rows and the decision result/reason enum.

**Contract**: `PendingReservation`, `RejectionReason` (the 4-value union), `DecideReservationResult`. (Shared-merge surface with S-04 if parallel — additions only, low collision risk.)

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `PATCH /api/reservations/<pending-id>` with `{decision:'confirm'}` (same-origin) returns 200 and the row is `confirmed`; `/r/<token>` shows Confirmed.
- `{decision:'reject', reason:'vehicle_withdrawn'}` returns 200, row `rejected`, reason stored; `reject` with no reason returns 400.
- A repeat decision returns 409 with `reason: 'already_decided'`.
- A request from a signed-out / non-employee session is 403; a cross-origin request is 403.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Confirm / reject notification emails

### Overview

Add the two Polish email templates and wire a best-effort send into the decision endpoint, reusing the S-02 email seam untouched.

### Changes Required:

#### 1. Email templates

**File**: `src/lib/email/templates.ts`

**Intent**: Compose the customer-facing confirmation and rejection emails, matching `reservationReceivedEmail`'s register and structure.

**Contract**: `reservationConfirmedEmail(params): EmailContent` and `reservationRejectedEmail(params): EmailContent` — Polish subject + `text` + hand-rolled `html`, reusing `format.ts` helpers (`formatPln`, `formatDuration`, `rentalDays`, `estimatedTotal`) and including the `/r/<token>` status link. The rejection copy may reference the canned reason and "lub alternatywne daty" as text only (no flow).

#### 2. Wire send into the decision endpoint

**File**: `src/pages/api/reservations/[id].ts`

**Intent**: Notify the customer after a committed decision, without ever failing the request on a send error.

**Contract**: After a `confirmed`/`rejected` result, build the matching template from the RPC's returned payload and `await sendEmail({ to: customer_email, ...content })` inside a swallowing `try/catch` that logs and continues (S-02 route's best-effort pattern).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass (if template helpers get pure-function coverage): `npm test`

#### Manual Verification:

- Accepting a request logs a composed Polish confirmation email (correct reference, dates with 14:00/10:00, estimated total, `/r/<token>` link) via the dev-log adapter.
- Rejecting logs a composed Polish rejection email referencing the chosen reason.
- Forcing a send error (e.g. throw in the adapter) still returns 200 and leaves the status changed (best-effort confirmed).

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Mobile approval UI

### Overview

Build the employee approval experience for mobile: the `/dashboard/reservations` page (SSR-fetches the pending queue) and the React island(s) for the queue, request detail, reject-reason bottom sheet, and full result overlay — wired to the decision endpoint, built against `src/styles/global.css` tokens with canonical Polish copy.

### Changes Required:

#### 1. Route registration

**File**: `src/lib/access.ts`

**Intent**: Make the new page explicitly employee-gated.

**Contract**: Add `{ prefix: "/dashboard/reservations", role: "employee" }` to `ROUTE_ROLES` (the existing `/dashboard` rule already covers it; the explicit entry documents intent). Longest-prefix match keeps `/dashboard/staff` admin-only.

#### 2. Approval page

**File**: `src/pages/dashboard/reservations.astro`

**Intent**: Server-render the queue data and mount the interactive island.

**Contract**: Read `Astro.locals.{supabase,user,role}`; call `listPendingReservations`; render the island with the list as a prop inside `Layout`. Polish page title.

#### 3. Approval island(s)

**File**: `src/components/dashboard/PendingQueue.tsx` (+ any extracted subcomponents/hook under `src/components/dashboard/` and `src/components/hooks/`)

**Intent**: The queue → detail → reason-sheet → result-overlay flow, with quick accept/reject on cards and full-context decisions in detail.

**Contract**: `client:load` island taking `reservations: PendingReservation[]`. Manages view state (queue / detail / reason-sheet / result-overlay) over the SSR-loaded list (no refetch for detail). Card actions: `Odrzuć` (opens reason sheet) and `Sprawdź` (opens detail); detail has `Zatwierdź` + `Odrzuć`. Calls `PATCH /api/reservations/[id]`; on 200 shows the result overlay then removes the card; on 409 `already_decided` shows the friendly message and removes/refreshes the stale card. Canonical Polish copy (`Oczekujące`, `Zatwierdź`, `Odrzuć`, `Sprawdź`, `Powód odrzucenia`, the 4 reasons, `Potwierdź odrzucenie`, `Rezerwacja potwierdzona`, `Wniosek odrzucony`, `Gotowe`). Build with shadcn primitives + `cn()`; bottom sheet + overlay per the design tokens (radii, shadows, amber/green/crimson semantics). Empty state: centered muted card, `Brak oczekujących wniosków`.

#### 4. Dashboard link

**File**: `src/pages/dashboard.astro`

**Intent**: Give employees a way into the queue (with a pending count if cheap).

**Contract**: Add a link/section to `/dashboard/reservations`. (Shared-merge surface with S-04 if parallel.)

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- On a mobile viewport, `/dashboard/reservations` shows pending requests matching screen 10; empty state shows when none.
- `Sprawdź` opens the detail (screen 11) with dates (14:00/10:00), customer, pricing, deposit; no license/plate shown.
- Accept → result overlay → card leaves the queue → `/r/<token>` shows Confirmed.
- Reject → reason sheet (4 options, `Inny` reveals a note field) → confirm → overlay → `/r/<token>` shows Rejected.
- Deciding a request already handled in another tab shows the friendly already-handled re-sync.
- Layout/spacing/copy match the design system tokens; Polish copy is correct.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding to Phase 5 (desktop). The desktop designs are already provided and distilled into the Phase 5 contract.

---

## Phase 5: Desktop layout (master-detail)

### Overview

Layer the desktop layout onto the Phase 4 components. No data/API/email changes — purely responsive presentation, reusing the same island state, endpoint, and decision logic. The desktop form is a **master-detail** screen (list + detail visible together), structurally different from mobile's separate queue → detail navigation.

### Design contract (distilled from the provided desktop screenshots — do NOT reopen the images)

Source: `context/foundation/design/screenshots/21-staff-desktop-requests.jpg` (prototype "14 · Requests · review & approve") and `20-staff-desktop-dashboard.jpg` (prototype "13 · Staff dashboard"). Build against `src/styles/global.css` tokens, never the prototype JSX. Polish copy is canonical.

**App shell (both desktop screens):**
- Persistent **left sidebar** (~250px, white): `Flota` / `STAFF` logo top; section label `OPERACJE`; nav items with leading icons — `Dispatch` (home), `Pending requests` (list icon, **active = dark filled pill**, right-aligned count badge e.g. `4`), `Kalendarz`/`Calendar`, `Overdue` (warning). Bottom: user chip — round avatar initials, name (`Piotr Bednarz`), `Staff · Warszawa`.
- **Top bar:** page title (bold ~28px) + muted subtitle; right side a `Szukaj…` search input + a calendar icon button. (Search/calendar are chrome — not in S-03 scope; render inert or omit.)

**Pending requests — master-detail (`21`, the core S-03 desktop screen):**
- Title `Pending requests`, subtitle `4 need a decision` (use the canonical PL `Oczekujące` / `… oczekuje na decyzję`).
- **Two-column body:**
  - **Master list** (~360px): vertical stack of request cards. Each card: reference (mono, muted, top-left, `R-2402`); relative submitted time top-right (`2 godz. temu`, `wczoraj 17:20`); customer name (semibold ~16px); a row of vehicle silhouette thumb + make/model + date range (`02 – 09 kwi`); total price bottom-right (bold, `2380 zł`). The **selected** card carries a dark ring/border. Cards: white, `rounded-lg`, hairline border, `shadow-card`.
  - **Detail panel** (fills remainder): header = reference + amber `PENDING` badge, large customer name (~30px), `Submitted · 2 godz. temu`; right-aligned big total (`2380 zł`) over `7 dni · + kaucja 2500 zł`. Then a **Vehicle** card (silhouette + `Renault Master` + plate mono — *omit plate, no schema field*) beside a **Pickup → Return** card (uppercase `PICKUP`/`RETURN` labels, `02` → arrow → `09 kwi`). A **`Daty zarezerwowane`** (DATES HELD) card: amber dot + note `Zablokowane dla innych klientów na czas oczekiwania — odrzucenie je zwalnia.`. A **`Klient`** (CUSTOMER) card with rows: Email (chat icon), Telefon (phone icon), and Licence (`Kat. B · ważne do 2031` + green check) — *omit Licence, no schema field*. **Action bar** bottom-right: `Odrzuć` (white, hairline border, crimson text) + `Zatwierdź` (large `bg-primary` crimson CTA, white, check icon).
  - Master-detail behavior: selecting a list card loads its detail on the right (both panels always visible at `md`+); no route navigation. Reject still opens the reason sheet; on success the decided card leaves the list and the detail panel advances to the next pending request (or shows the empty state). The full result overlay renders as a **centered modal** on desktop (mobile keeps the full-screen sheet).

**Dashboard "Need a decision" panel (`20`):** the dashboard's right column is a compact stack of pending cards (reference + `PENDING` badge, name, dates + vehicle, `Odrzuć` ghost / `Zatwierdź` dark) with an `Open →` link to `/dashboard/reservations`. This informs the Phase 4 dashboard link/section — if a count + mini-list is cheap, mirror this; otherwise a plain link suffices. (Dashboard uses a dark Approve button, the Requests screen uses crimson; in the live system both map to `bg-primary`.)

### Changes Required:

#### 1. Responsive desktop layout

**File**: `src/pages/dashboard/reservations.astro`, `src/components/dashboard/PendingQueue.tsx` (+ subcomponents)

**Intent**: Render the queue + detail as a side-by-side master-detail at `md`+ breakpoints (stacked queue → detail below `md`), reusing the same SSR data, endpoint, and decision logic.

**Contract**: Tailwind responsive variants over the existing components; no new endpoints or service calls. At `md`+, list and detail render together and selection is in-island state; below `md`, the existing mobile navigation applies. Result overlay = centered modal on desktop. Layout/copy per the design contract above.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- On a desktop viewport, the queue and detail match the provided desktop designs.
- The mobile layout is unchanged at small breakpoints.
- Accept/reject + already-handled flows work identically across breakpoints.

**Implementation Note**: Build against the Phase 5 design contract above; do not reopen the screenshots (vision cost already paid at plan time).

---

## Phase 6: Calendar data layer + library setup

### Overview

Stand up the reservation calendar's data and dependencies **without any UI**: install and wire `@ilamy/calendar`, add the range read that returns the bookings to plot, and the pure mapping helpers that turn reservations into calendar events and vehicles into resource rows. All of it is verifiable via type-check, build, and Vitest before the island exists. (Library selection + verified API surface: `calendar-component-research.md`, `ilamy-calendar-reference.md`.)

### Changes Required:

#### 1. Install and wire the calendar library

**File**: `package.json`, `src/styles/global.css`, `src/lib/calendar/dayjs.ts`

**Intent**: Add `@ilamy/calendar` and its peers, make Tailwind v4 generate its classes, and extend dayjs with the plugins the library requires.

**Contract**:
- Add deps `@ilamy/calendar` + `tailwindcss-animate` (peers `react`/`react-dom`/`tailwindcss@4` already present; requires React 19 + Tailwind 4 — both satisfied). After install, **check whether `node_modules/@ilamy/calendar/dist/index.css` exists**: if present, import it once in the island; if absent (the published "no-CSS, shadcn-token" build), rely on the existing shadcn tokens. Record the outcome. See `ilamy-calendar-reference.md` (CSS-import discrepancy note).
- Tailwind v4 ignores `node_modules`: add `@source "../../node_modules/@ilamy/calendar/dist";` to `src/styles/global.css` (adjust relative depth to the file's location) so the library's utilities are generated.
- `src/lib/calendar/dayjs.ts` extends dayjs with `utc`, `timezone`, `isSameOrAfter`, `isSameOrBefore` and is imported by the calendar island. Convert any `@/` import shadcn/ilamy tooling emits to a relative path (project rule).

#### 2. Calendar range read

**File**: `src/lib/services/reservations.ts`, `src/types.ts`

**Intent**: Read the bookings to plot — `pending` + `confirmed` reservations overlapping a visible window, joined with the vehicle display fields.

**Contract**:
- `listReservationsForCalendar(client, rangeStart: string, rangeEnd: string): Promise<CalendarReservation[]>` — selects reservations with `status in ('pending','confirmed')` whose `[pickup_date, return_date]` overlaps `[rangeStart, rangeEnd]`, joined to `vehicles` (`make`, `model`); returns `[]` when client is null. Reads through the per-request authenticated client (the existing `reservations_select_authenticated` policy already allows employees).
- `CalendarReservation` in `src/types.ts`: `{ id, reference, status: 'pending' | 'confirmed', customer_name, vehicle_id, vehicle_make, vehicle_model, pickup_date, return_date }`. (Additive shared-merge surface with S-04 — low collision risk.)

#### 3. Pure mapping helpers (Vitest-covered)

**File**: `src/lib/calendar/map.ts` (+ `src/lib/calendar/map.test.ts`)

**Intent**: Convert domain rows into the library's `CalendarEvent[]` / `Resource[]` shapes — the edge-case-bearing logic, isolated as pure functions so it is testable without a UI runner (matches the slice's Vitest-for-pure-logic stance).

**Contract**:
- `reservationsToEvents(rows: CalendarReservation[]): CalendarEvent[]` — `start = pickup_date @ 14:00`, `end = return_date @ 10:00` (mirroring `reserved_period`), `resourceId = vehicle_id`, `title = customer_name`, `id`/`uid` from the reservation id, and a status→color mapping (pending → amber token, confirmed → green token). Times constructed in `Europe/Warsaw`.
- `vehiclesToResources(vehicles: Vehicle[]): Resource[]` — `id = vehicle.id`, `title = "<make> <model>"`. Active-only filtering happens at the call site via `listVehicles`.
- Tests: the 14:00/10:00 boundary; a same-day turnover (one vehicle's return 10:00 vs the next pickup 14:00 on the same date — no false overlap); status→color mapping; empty input → `[]`.

### Success Criteria:

#### Automated Verification:

- Dependencies install and build passes: `npm install` + `npm run build`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Mapping unit tests pass: `npm test`

#### Manual Verification:

- `listReservationsForCalendar` returns pending+confirmed rows with vehicle fields for a known window (SQL / scratch SSR call).
- The `dist/index.css` presence is checked and the CSS decision recorded in the change notes.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding to Phase 7.

---

## Phase 7: Reservation calendar UI

### Overview

Build the `/dashboard/calendar` resource-timeline (vehicles as rows, reservations as bars) as a `client:only="react"` island, and make clicking a **pending** bar open the same accept/reject flow the queue uses — by extracting Phase 4's decision detail / reason sheet / result overlay into shared components driven by a `useReservationDecision` hook. Depends on Phases 1–4 (decision endpoint + components) and Phase 6 (data + mapping).

### Changes Required:

#### 1. Extract the shared decision flow

**File**: `src/components/dashboard/PendingQueue.tsx` → `src/components/dashboard/ReservationDecision.tsx` + `src/components/hooks/useReservationDecision.ts`

**Intent**: Make the accept/reject detail + reason sheet + result overlay reusable by both the queue and the calendar, with one PATCH-calling hook as the single decision mechanism.

**Contract**: Lift the detail view, reason bottom-sheet, and result overlay out of `PendingQueue` into a presentational `ReservationDecision` (takes a reservation + outcome callbacks). Extract the PATCH-calling logic (confirm/reject, 200/409 handling, already-handled re-sync) into `useReservationDecision`. `PendingQueue` (Phases 4/5) is refactored to consume both — **no behavior change** to the queue; its existing manual verification must still pass.

#### 2. Calendar route registration

**File**: `src/lib/access.ts`

**Intent**: Employee-gate the calendar page.

**Contract**: Add `{ prefix: "/dashboard/calendar", role: "employee" }` to `ROUTE_ROLES` (the `/dashboard` rule already covers it; the explicit entry documents intent).

#### 3. Calendar page

**File**: `src/pages/dashboard/calendar.astro`

**Intent**: SSR the initial window's resources + events and mount the island.

**Contract**: Read `Astro.locals.{supabase,user,role}`; call `listVehicles` (active filter) + `listReservationsForCalendar` for an initial window (current month ± a buffer); map via the Phase 6 helpers and pass `resources` + `events` to the island inside `Layout`. Polish page title `Kalendarz`.

#### 4. Calendar island

**File**: `src/components/dashboard/ReservationCalendar.tsx`

**Intent**: Render the resource timeline and route pending-event clicks into the shared decision flow.

**Contract**: `client:only="react"` island (no SSR in `workerd`). Renders `IlamyResourceCalendar` with `resources`, `events`, `initialView="week"`, `firstDayOfWeek="monday"`, `locale="pl"`, `timezone="Europe/Warsaw"`, `disableDragAndDrop`, `disableCellClick` (manual-add deferred), and a Polish `translations` object. `onEventClick`: a `pending` reservation opens `ReservationDecision` via `useReservationDecision`; a `confirmed` reservation opens a read-only detail (no actions). On a successful decision, update the event in place (confirmed → recolor; rejected → remove). `onDateChange(date, range)` refetches via the Phase-7 GET endpoint and re-maps. A two-item status **legend** (pending = amber, confirmed = green) renders below the calendar; `+` and `Filtry` are omitted. Mobile: the resource timeline is horizontally scrollable with a Month toggle (ilamy responsive), matching screen 22; desktop matches screen 16. Build with `cn()` + shadcn tokens.

#### 5. Calendar range refetch endpoint

**File**: `src/pages/api/reservations/calendar.ts`

**Intent**: Let the island reload events when the visible window changes, without a full page navigation.

**Contract**: `GET` handler, role-gated to `employee` via `context.locals.role` / `isRoleSufficient` (403 otherwise); zod-validated `start`/`end` ISO-date query params (400 on bad input); returns `listReservationsForCalendar(...)` mapped to events as JSON. Reuses the Phase 6 service + mapper; no new data path. (GET read — no `Origin` check needed.)

#### 6. Nav + dashboard link

**File**: `src/pages/dashboard.astro` (+ the staff nav location)

**Intent**: Surface the `Kalendarz` entry the design shows in the sidebar/bottom-tab.

**Contract**: Add a link to `/dashboard/calendar` (the `Kalendarz` / `Calendar` nav item). Additive shared-merge surface with Phase 4 / S-04.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Unit tests still green (mapping + any extracted pure logic): `npm test`

#### Manual Verification:

- `/dashboard/calendar` shows vehicles as rows and pending+confirmed reservations as bars in the correct slots (14:00→10:00), matching screens 16 (desktop) + 22 (mobile).
- Clicking a **pending** bar opens the accept/reject flow; accepting recolors it to confirmed and composes the email; rejecting removes it — identical outcome to the queue.
- Clicking a **confirmed** bar shows a read-only detail (no actions).
- Navigating weeks/months refetches and re-plots; the mobile timeline scrolls horizontally and the Month toggle works.
- No drag/resize; no empty-slot create affordance; the legend shows only pending/confirmed.
- The **queue (Phases 4/5) is unchanged** after the decision-flow extraction — its accept/reject/already-handled checks still pass.
- A non-employee is 403'd from `/dashboard/calendar` and from `GET /api/reservations/calendar`.

**Implementation Note**: After automated verification passes, pause for manual confirmation. Build against screens 16/22 and the design tokens; do not re-open the images beyond plan time.

---

## Testing Strategy

### Unit Tests (Vitest, pure functions):

- Transition validity / reason validation helper (valid reasons, `other` requires note, terminal states rejected).
- Any pure copy/format helper added for the email templates.
- Calendar mapping helpers (`reservationsToEvents` 14:00/10:00 boundary + same-day turnover + status→color; `vehiclesToResources`).

### Integration Tests:

- None automated (no E2E runner). Covered by the manual API (curl) and UI walk-throughs in each phase.

### Manual Testing Steps:

1. Seed/submit a pending reservation via S-02's `/reserve`.
2. As an employee, accept it from `/dashboard/reservations`; verify overlay, queue removal, `/r/<token>` = Confirmed, and the composed confirmation email in the dev log.
3. Submit another; reject it with each reason (and `Inny` + note); verify stored reason, `/r/<token>` = Rejected, and the composed rejection email.
4. Open the same pending request in two tabs; decide in one; verify the other shows the friendly already-handled re-sync.
5. Hit the page/API as a signed-out and as a non-employee user; verify redirect / 403.

## Performance Considerations

Low volume (a single operator's pending queue). The queue is one indexed-status select with a vehicle join; no pagination needed for v1. The decision RPC is a single-row locked update.

## Migration Notes

One additive migration (`rejection_reason`/`rejection_note` columns + `decide_reservation` RPC + RLS tightening). The RLS change removes blanket authenticated write policies; this is safe because the only write path is the definer RPC. If S-04 (fleet-management) is built in a parallel worktree, both add separate timestamped migrations (no content conflict) but the generated `src/db/database.types.ts` must be regenerated once both are applied. Give the two migrations **distinct, sequential `YYYYMMDDHHmmss` prefixes** — order between them is functionally irrelevant (different tables), but identical/overlapping timestamps confuse the migration list.

**Cross-slice dependency on `listVehicles` (Phase 7 calendar).** Phase 7's calendar page reads vehicle rows via `listVehicles` (`src/lib/services/vehicles.ts`) — a function **S-04 concurrently modifies**: S-04 broadens `vehicles_select_authenticated` to `using (true)` (staff see retired vehicles) and compensates by adding an explicit `.eq('is_active', true)` inside `listVehicles`. The calendar wants active-only vehicles, so the patched behavior is correct for us — but it is only correct if **S-04's RLS broadening and its `listVehicles` patch land together** (they are coupled in S-04 Phase 2). If S-04's RLS change ever merged without that patch, this calendar would start showing retired vehicles as rows. No S-03 code change is needed; flagged so the coupling is not accidentally broken at merge time.

## References

- Change identity + verified dependency state: `context/changes/reservation-approval/change.md`
- S-02 plan (rails this slice consumes — email seam, status page, stepper, RPC pattern): `context/changes/public-reservation-request/plan.md` (`:7`, `:47`, `:156`)
- Data layer: `supabase/migrations/20260603155136_booking_integrity_data.sql:124-129` (EXCLUDE), `:155-174` (RLS)
- API pattern: `src/pages/api/reservations.ts`
- Email seam: `src/lib/email/index.ts`, `src/lib/email/templates.ts`
- Stepper model: `src/lib/reservation-status.ts`
- Access control: `src/lib/access.ts`, `src/middleware.ts`
- Design (mobile): `context/foundation/design-system.md`, `context/foundation/design/staff-screens.jsx:558-851`, screenshots `09/10/11-staff-mobile-*`
- Design (desktop, distilled in Phase 5): `context/foundation/design/screenshots/21-staff-desktop-requests.jpg` (master-detail approval), `20-staff-desktop-dashboard.jpg` (dashboard "Need a decision" panel)
- Design (calendar, Phases 6–7): `context/foundation/design/screenshots/16-admin-desktop-calendar.png` (resource-timeline desktop), `22-admin-mobile-calendar.jpg` (mobile timeline + Month toggle)
- Calendar library: selection rationale `context/changes/reservation-approval/calendar-component-research.md`; verified `@ilamy/calendar` API surface + setup `context/changes/reservation-approval/ilamy-calendar-reference.md`
- Data layer (calendar read): `supabase/migrations/20260603155136_booking_integrity_data.sql` (`pickup_date`/`return_date`/`reserved_period`); vehicles service `src/lib/services/vehicles.ts` (`listVehicles`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data layer — decision RPC, reason columns, RLS tightening

#### Automated

- [x] 1.1 Migration applies cleanly: `supabase db reset` — e25c5ba
- [x] 1.2 Generated types in sync: `npx supabase gen types typescript --local` — e25c5ba
- [x] 1.3 Type checking passes: `npx astro check` — e25c5ba
- [x] 1.4 Linting passes: `npm run lint` — e25c5ba

#### Manual

- [x] 1.5 `decide_reservation` flips a pending row to confirmed/rejected and returns the customer payload (SQL) — e25c5ba
- [x] 1.6 Repeat decision on the same row returns `already_decided` — e25c5ba
- [x] 1.7 Non-employee role returns `unauthorized` — e25c5ba
- [x] 1.8 Direct authenticated `update reservations` is denied by RLS — e25c5ba

### Phase 2: Service + decision API

#### Automated

- [x] 2.1 Type checking passes: `npx astro check`
- [x] 2.2 Linting passes: `npm run lint`
- [x] 2.3 Build passes: `npm run build`

#### Manual

- [x] 2.4 PATCH confirm returns 200, row confirmed, `/r/<token>` shows Confirmed
- [x] 2.5 PATCH reject (with reason) returns 200, reason stored; reject without reason returns 400
- [x] 2.6 Repeat decision returns 409 `already_decided`
- [x] 2.7 Non-employee 403; cross-origin 403

### Phase 3: Confirm / reject notification emails

#### Automated

- [ ] 3.1 Type checking passes: `npx astro check`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Unit tests pass (if template helpers covered): `npm test`

#### Manual

- [ ] 3.4 Accept logs a composed Polish confirmation email with correct fields + `/r/<token>` link
- [ ] 3.5 Reject logs a composed Polish rejection email referencing the reason
- [ ] 3.6 A forced send error still returns 200 with status changed (best-effort)

### Phase 4: Mobile approval UI

#### Automated

- [ ] 4.1 Type checking passes: `npx astro check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Build passes: `npm run build`

#### Manual

- [ ] 4.4 `/dashboard/reservations` shows pending requests (screen 10); empty state when none
- [ ] 4.5 `Sprawdź` opens detail (screen 11) with dates/customer/pricing; no license/plate
- [ ] 4.6 Accept → overlay → card removed → `/r/<token>` Confirmed
- [ ] 4.7 Reject → reason sheet (`Inny` reveals note) → overlay → `/r/<token>` Rejected
- [ ] 4.8 Already-handled request shows friendly re-sync
- [ ] 4.9 Layout/copy match design tokens and canonical Polish

### Phase 5: Desktop layout (master-detail)

#### Automated

- [ ] 5.1 Type checking passes: `npx astro check`
- [ ] 5.2 Linting passes: `npm run lint`
- [ ] 5.3 Build passes: `npm run build`

#### Manual

- [ ] 5.4 Desktop queue + detail match the provided desktop designs
- [ ] 5.5 Mobile layout unchanged at small breakpoints
- [ ] 5.6 Accept/reject + already-handled flows work across breakpoints

### Phase 6: Calendar data layer + library setup

#### Automated

- [ ] 6.1 Dependencies install and build passes: `npm install` + `npm run build`
- [ ] 6.2 Type checking passes: `npx astro check`
- [ ] 6.3 Linting passes: `npm run lint`
- [ ] 6.4 Mapping unit tests pass: `npm test`

#### Manual

- [ ] 6.5 `listReservationsForCalendar` returns pending+confirmed rows with vehicle fields for a known window
- [ ] 6.6 `dist/index.css` presence checked and the CSS decision recorded

### Phase 7: Reservation calendar UI

#### Automated

- [ ] 7.1 Type checking passes: `npx astro check`
- [ ] 7.2 Linting passes: `npm run lint`
- [ ] 7.3 Build passes: `npm run build`
- [ ] 7.4 Unit tests still green (mapping + extracted pure logic): `npm test`

#### Manual

- [ ] 7.5 `/dashboard/calendar` shows vehicles as rows + pending/confirmed bars at 14:00→10:00 (screens 16/22)
- [ ] 7.6 Clicking a pending bar opens accept/reject; accept recolors→confirmed + email; reject removes — same as queue
- [ ] 7.7 Clicking a confirmed bar shows a read-only detail (no actions)
- [ ] 7.8 Week/month navigation refetches + re-plots; mobile timeline scrolls + Month toggle works
- [ ] 7.9 No drag/resize, no empty-slot create; legend shows only pending/confirmed
- [ ] 7.10 Queue (Phases 4/5) unchanged after the decision-flow extraction
- [ ] 7.11 Non-employee 403'd from `/dashboard/calendar` and `GET /api/reservations/calendar`
