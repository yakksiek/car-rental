# Public Fleet Catalog (S-01) — Plan Brief

> Full plan: `context/changes/public-fleet-catalog/plan.md`

## What & Why

Build FleetRent's first public, user-visible surface: a landing page, a filterable fleet listing, and a vehicle detail card. It turns F-01's invisible data layer into something a visitor can browse — the prerequisite for the S-02 north-star booking funnel. v1 has no customer accounts; visitors browse and (next slice) request without logging in.

## Starting Point

F-01 shipped the `vehicles`/`reservations` schema, the no-double-booking `EXCLUDE` rule, a pure overlap predicate (`src/lib/availability.ts`), and a seeded fleet. `vehicles` is public-readable (active only); `reservations` is fully hidden from `anon`. The app has auth + a role layer (F-02) but zero domain UI — `/` still renders the starter `Welcome`, and there's no `src/lib/services/`.

## Desired End State

A visitor lands on a public homepage, enters `/fleet`, switches category tabs, sets an available-date range + minimum payload, sorts by price, and sees only bookable vehicles — then opens a detail card with full specs (seats, fuel, transmission, cargo dims) and pricing, and clicks "Zarezerwuj" to carry the vehicle + dates toward S-02.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Availability across RLS | `SECURITY DEFINER` RPC `available_vehicles(pickup,return)` | `anon` can't read `reservations`; the RPC computes overlap in-DB and returns only vehicle rows (no PII). | Plan |
| Filtering | Server-side URL params + thin React island | SSR-native, shareable URLs, fresh availability; pairs with the RPC. | Plan |
| Round-trips | Batched — island commits to URL only on "Zastosuj" | One navigation per deliberate apply, not per field; `astro:transitions` makes it feel instant. | Plan |
| S-01/S-02 line | S-01 = read-only date filter + Reserve CTA; S-02 owns the form | Matches roadmap FR-002 in S-01; date picker becomes reusable for S-02. | Plan |
| Seats/Transmission | Add both columns (enum `transmission_type`) | Design shows them; absent from F-01 — added via additive migration. | Plan |
| Landing `/` | Public landing, account chrome removed | Screen 01 is a logged-in view; v1 has no accounts. | Plan |
| Filter set | Category + dates + payload | Exactly FR-002's named specs; seats/transmission shown, not filtered. | Plan |
| Sorting | Price asc/desc | Cheap, matches design, useful. | Plan |
| Booked vehicles for a range | Filtered out | User chose actionable-only results. | Plan |
| Interactivity | Astro pages + thin islands | Matches CLAUDE.md convention; minimal JS for <2s NFR. | Plan |
| Imagery | Per-category silhouette placeholders | `photos[]` empty; storage is S-05. | Plan |
| Pricing | Daily on cards, full pricing on detail | Matches design + FR-003; one PLN formatter owns numeric-as-string. | Plan |
| Detail URL | `/fleet/[id]/[…slug?]` | UUID resolves, optional slug for readability — no slug column. | Plan |
| Testing | Vitest for pure logic + manual UI | No UI runner exists; guards money/availability mapping cheaply. | Plan |

## Scope

**In scope:** public landing; `/fleet` listing with category tabs + date/payload filters + price sort; vehicle detail card; PII-safe availability RPC; `seats`/`transmission` columns; silhouette placeholders; Polish copy; pure-logic tests.

**Out of scope:** reservation form/submit (S-02); fleet CRUD (S-04); photo storage/upload (S-05); auth-gated surfaces; real-time availability (FR-014); fuel/transmission filters; English copy; UI test runner.

## Architecture / Approach

Bottom-up. Phase 1 extends the schema and adds `available_vehicles` (definer, anon-executable, mirrors the `EXCLUDE` window exactly). Phase 2 wraps all data access + pure formatting/validation in a tested `src/lib/services` + `src/lib` layer and exposes `locals.supabase`. Phases 3–4 build the Astro-rendered landing/listing/detail against the live Flota tokens, with one React filter island. Dated queries go through the RPC; undated through a plain `vehicles` select — both return `Vehicle[]`, so one card and one mapper serve both.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema + RPC + seed/types | `seats`/`transmission` columns, `available_vehicles` RPC, refreshed seed, regen types | RPC must re-apply `is_active` and match the generated window exactly, or it leaks/diverges |
| 2. Domain layer | Vehicle service, PLN/spec formatter, filter parse+validate, tests, `locals.supabase` | Numeric-as-string formatting; date-rule agreement with the predicate |
| 3. Landing + listing + filter island | Public `/`, `/fleet` with tabs/filters/sort, cards, silhouettes, states | Design fidelity; batched round-trips; shadcn `@/`→relative rewrites |
| 4. Vehicle detail | `/fleet/[id]/[…slug]` full specs + pricing + Reserve CTA | 404 handling; CTA href contract handed to S-02 |

**Prerequisites:** F-01 (implemented) — schema, predicate, seed. Local Supabase running for `db reset` + type regen.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- The Reserve CTA's `/reserve` destination 404s until S-02 — accepted; S-01 owns only the href contract.
- Silhouette placeholders need ~5 per-category SVGs; assumed acceptable vs. real photography (production swap, per design notes).
- The availability rule now lives in three places (SQL EXCLUDE, TS predicate, RPC) — mitigated by reusing the identical `tsrange('[)')` window so they can't drift.

## Success Criteria (Summary)

- A visitor browses by category, filters by available dates + payload, sorts by price, and sees only bookable vehicles — no account.
- A detail card shows full specs + pricing and hands the vehicle + dates to the reservation route.
- Availability is computed without exposing any customer PII; `npm test` / `astro check` / `lint` / `build` all green.
