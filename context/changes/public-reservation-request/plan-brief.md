# Public Reservation Request (S-02) — Plan Brief

> Full plan: `context/changes/public-reservation-request/plan.md`

## What & Why

The product's north star: let a visitor with **no account** browse to a vehicle, pick dates, enter name/email/phone, and submit a reservation request — with **overlapping dates blocked at submission**, not after the fact. It proves the core hypothesis (frictionless, conflict-free public booking) and ties to the #1 success criterion ("reserve in under 3 minutes, without an account") and the core guardrail (no double bookings).

## Starting Point

F-01 shipped the `vehicles`/`reservations` schema, the no-double-booking `EXCLUDE` constraint, and the TS overlap mirror; S-01 shipped the public catalog whose "Zarezerwuj" CTA already links to `/reserve?vehicle_id=…&pickup=…&return=…` (a route that 404s until now). `reservations` holds PII and is **fully anon-denied** — F-01 deliberately left the public funnel to S-02. Transactional email is absent (roadmap stands it up in S-05).

## Desired End State

`/reserve` hosts a multi-step island (dates → details → review) that submits through a definer RPC, atomically creating a `pending` reservation and blocking overlaps. The customer lands on — and is emailed a link to — a live status page `/r/<token>` showing a reference (`R-XXXX`), a status pill, the booking summary, and a "co dalej" stepper. The status page + email helper are reusable by S-03 (employee confirm/reject).

## Key Decisions Made


| Decision             | Choice                                                                         | Why                                                                                                                     | Source |
| -------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| Public write path    | `create_reservation_request` SECURITY DEFINER RPC                              | Keeps `reservations` anon-denied; mirrors `available_vehicles`; one atomic home for insert + conflict + reference/token | Plan   |
| Overlap block        | RPC catches `23P01` (authority) + `available_vehicles` pre-check (UX)          | Atomic correctness without reintroducing the check-then-insert race; friendly early message                             | Plan   |
| Email scope          | Build the seam (dev/log adapter + Polish templates), defer the provider        | Ships full UX now without blocking on the unchosen provider (speed); S-05 swaps the adapter                             | Plan   |
| Confirm/reject email | S-02 builds status page + token + helper; **S-03 triggers**                    | Each email sends where its trigger lives; no speculative S-03 work                                                      | Plan   |
| Field set            | name/email/phone + `reference` + `access_token` + `terms_accepted_at` (no B2B) | Matches FR-004 + the design's terms checkbox; B2B addable later                                                         | Plan   |
| Status access        | Tokenized link `/r/<token>` via `get_reservation_status` RPC                   | Unguessable no-account deep link from email; reservations stays anon-SELECT-denied                                      | Plan   |
| Status page          | Live "what happens next" stepper                                               | Matches screen 06; one step model S-03/S-05/S-06 extend                                                                 | Plan   |
| Funnel shape         | One `/reserve` island, multi-step, redirect to `/r/<token>`                    | "Under 3 min", no full reloads; received page = status page (DRY)                                                       | Plan   |
| Abuse guard          | Honeypot + Origin/CSRF + zod + required terms                                  | Cheap, no third party/cookies; keeps the pending queue clean                                                            | Plan   |
| Testing              | Vitest on pure logic (schema, pricing, stepper); RPCs verified manually        | Matches the project's Vitest-only convention                                                                            | Plan   |


## Scope

**In scope:** the `/reserve` funnel, the submit RPC + status RPC, the `/r/<token>` status page, the email seam + submit-confirmation email, reference + token plumbing, honeypot/CSRF/zod hardening, Vitest on the new pure logic.

**Out of scope:** any anon RLS policy on `reservations`; a real email provider (S-05); employee confirm/reject + its emails (S-03); B2B Company/VAT/Notes; registration plate + branch (not in schema); Daily/Monthly toggle (Daily estimate only); booked-date greying in the calendar; customer accounts/payments; UI/E2E runner.

## Architecture / Approach

Bottom-up, mirroring S-01. Data + two definer RPCs (write, status) → tested domain layer (service, zod schema, pricing/stepper helpers, email seam) → the status page `/r/<token>` (built first, as it's the funnel's redirect + email target) → the funnel (`/reserve` page, `ReservationForm` island, `POST /api/reservations`). The public never reads `reservations` directly — both RPCs are `security definer` and granted to `anon`, exactly like `available_vehicles`.

## Phases at a Glance


| Phase            | What it delivers                                                                                                             | Key risk                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1. Schema & RPCs | `reference`/`access_token`/`terms_accepted_at` columns; `create_reservation_request` + `get_reservation_status`; types; seed | Definer hygiene (`search_path=''`, schema-qualify); `23P01` mapping must be exception-based, not check-then-insert |
| 2. Domain layer  | reservation service, zod schema (+honeypot), pricing/stepper helpers, email seam; Vitest                                     | Date semantics must agree with `availability.ts`/the constraint                                                    |
| 3. Status page   | `/r/[token].astro` + stepper, against the design contract                                                                    | Stepper step model must stay stable for S-03/S-05/S-06                                                             |
| 4. Funnel        | `/reserve` + `ReservationForm` island + `POST /api/reservations` (CSRF + zod + RPC + email + redirect)                       | Overlap must surface as 409 not 500 under a true race; no booked-date greying                                      |


**Prerequisites:** F-01 (done), S-01 (the catalog + Reserve CTA). Local Supabase running for RPC verification.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- The emailed link works, but **no email is actually delivered** until S-05 wires a provider — the dev/log adapter only logs. Flagged so it isn't mistaken for a live send.
- `access_token` is a bearer secret in a URL — acceptable for low-stakes status viewing; not a login.
- Reference generation (`R-XXXX`) must be unique under concurrency — minted in-RPC from a sequence, guarded by a unique constraint.

## Success Criteria (Summary)

- A no-account visitor reserves in a few steps and overlapping dates are blocked at submission (pre-check message; `23P01`→409 under a race, never a 500).
- Submitting lands on `/r/<token>` with a reference + PENDING stepper, and a confirmation email (logged) carries that link; revisiting the link shows current status.
- `reservations` remains anon-denied; both RPCs are anon-executable and leak no other reservation's data; `npm test` + `astro check` + `lint` + `build` green.

