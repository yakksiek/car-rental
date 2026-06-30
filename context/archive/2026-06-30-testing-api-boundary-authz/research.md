---
date: 2026-06-30T11:11:20+0200
researcher: MarcinK
git_commit: b5a5343b09a604aa1c5484ad1b2865047a1934f0
branch: main
repository: car-rental
topic: "Phase 2 grounding — API boundary: authz (#4 IDOR/authz) + input parity (#5 validation bypass)"
tags: [research, codebase, api-routes, authz, validation, rls, test-plan-phase-2]
status: complete
last_updated: 2026-06-30
last_updated_by: MarcinK
---

# Research: Phase 2 — API boundary authz + input parity

**Date**: 2026-06-30T11:11:20+0200
**Researcher**: MarcinK
**Git Commit**: b5a5343b09a604aa1c5484ad1b2865047a1934f0
**Branch**: main
**Repository**: car-rental

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md` — Risks **#4 (IDOR / broken authorization)** and **#5 (server-side validation bypass)**. Verify (not blindly accept) the §2 risk response guidance: prove protected routes deny anon/wrong-role/cross-resource access, and prove the API rejects client-bypassing payloads with a clean 4xx and no DB write. Identify the cheapest useful test layer, locate existing coverage, and flag speculative risks or misleading hot-spot evidence.

## Summary

The codebase is **more defended than the risk wording assumes**, which shifts both risks from *bug hunt* toward *regression guard* — but two real, test-worthy facts emerged, plus one cheap coverage gap.

1. **The load-bearing authz fact: middleware does NOT gate `/api/*` at all.** `ROUTE_ROLES` (`src/lib/access.ts:27-38`) lists only `/dashboard*` prefixes. Every API route is reachable by anyone unless it **self-gates** in its own handler. This is the true Risk #4 — *a route forgets its own role check* — not the "middleware gate vs ownership check" tension the plan describes.
2. **There is no per-resource ownership model — by design.** Vehicles and reservations have no per-user owner; staff act on the entire shared fleet/queue. So the §2 #4 framing ("cross-resource access by id", "ownership check", "IDOR") has **no ownership to break**. The genuine authz axis is **role** (anon vs `norole` vs employee vs admin), enforced per route. Reframe #4 around role-coverage-per-route, not IDOR-by-id.
3. **The one ownership-like boundary — the customer `access_token` on `/r/[token]` — is correctly scoped AND already tested** by Phase 1 (`tests/integration/reservations-rls.test.ts`). Do not re-cover it.
4. **Every write route already validates server-side** through the shared zod schema before any DB write, returning **400** (§3 table below). The feared "server trusts the client / skips validation" (#5) does **not** exist in current code. The valuable test is therefore a **regression guard**: prove each route *wires* the schema and returns 400 with **no DB write** — an integration concern, not re-asserting the schema.
5. **Cheap coverage gap:** `vehicleInputSchema` (`src/lib/vehicle-schema.ts`) has **no unit test**; `reservationRequestSchema` has 16 unit cases. A `vehicle-schema.test.ts` is the cheapest signal for vehicle input rules — cheaper than any API-layer test.
6. **New harness work required:** the existing harness drives Supabase clients directly. Testing *routes* means invoking the exported `GET`/`POST`/`PATCH` handler functions with a constructed `APIContext` (populate `locals.supabase` from `as(role)`, set `locals.user`/`locals.role`, set `url`/`Origin` so the CSRF same-origin check passes). This is the key infrastructure decision for the plan — see "Harness gap" below.

## Detailed Findings

### Authorization model (Risk #4)

**Role source of truth — a `profiles.role` lookup, two layers, no JWT/metadata roles.**
- App layer: `src/middleware.ts:22` reads `profiles.role` into `locals.role` (`:23`); missing profile → `null` → fail-closed.
- DB layer: `public.current_app_role()` (`supabase/migrations/20260604153139_employee_admin_roles.sql:47-55`), used by RLS/definer RPCs.
- Pure decision core: `src/lib/access.ts` — `ROLE_RANK` admin(2) ⊇ employee(1), `null` never suffices (`:18-21,62-66`); `requireRole(locals,min)` (`:72-74`); `isRoleSufficient` (`:62-67`).
- No `app_metadata`/`user_metadata` authz anywhere in `src/`.

**Middleware scope — the critical gap.** `matchesPrefix` longest-prefix match (`src/lib/access.ts:42-44`) over `ROUTE_ROLES` (`:27-38`), which contains **only** `/dashboard`, `/dashboard/calendar`, `/dashboard/reservations` (employee) and `/dashboard/staff` (admin). **No `/api/*` entry exists**, so `src/middleware.ts:35-47` applies neither auth nor role gate to any API route. Pages: anon → 302 to `/auth/signin` (`:37-42`); wrong-role → 403 (`:44-46`). API routes: unprotected by middleware — each must self-gate.

**Per-route authz (every protected route is a ROLE gate; none checks ownership):**

| Route | Method | App-level gate | DB backstop | Anon result |
| --- | --- | --- | --- | --- |
| `src/pages/api/reservations.ts:43` | POST | **none — public funnel** (CSRF `:46-49`, honeypot `:61-70`) | definer RPC `create_reservation_request` | allowed (by design) |
| `src/pages/api/reservations/calendar.ts:25` | GET | `isRoleSufficient(role,"employee")`→403 (`:26-28`) | RPC re-gates `current_app_role()` | **403** |
| `src/pages/api/reservations/[id].ts:110` | PATCH | `isRoleSufficient(role,"employee")`→403 (`:118-120`); CSRF `:112-115` | RPC `decide_reservation` re-gates (`20260617120000…:90-96`) | **403** |
| `src/pages/api/vehicles.ts:30` | POST | `!locals.user`→**401** (`:38-40`); `requireRole(...,"employee")`→403 (`:41-43`); CSRF `:32-35` | RLS `vehicles_insert_staff` WITH CHECK | **401** |
| `src/pages/api/vehicles/[id].ts:28` | PATCH | `!locals.user`→401 (`:36-38`); `requireRole`→403 (`:39-41`); CSRF `:30-33` | RLS `vehicles_update_staff` | **401** |
| `src/pages/api/vehicles/[id]/active.ts:34` | POST | `!locals.user`→401 (`:42-44`); `requireRole`→403 (`:45-47`); CSRF `:36-39` | RPC `set_vehicle_active` re-gates | **401** |
| `src/pages/api/auth/{signin,signout,signup}.ts` | POST | public by design (signup is closed — always errors, `signup.ts:8-12`) | — | n/a |

**No PUT or DELETE exists anywhere.** Reservation/vehicle mutation is POST/PATCH only (the §2 "PATCH/PUT/DELETE" wording is wrong). No route uses a service-role / RLS-bypassing client; every route uses the per-request SSR cookie client `locals.supabase`. RLS bypass happens only inside `SECURITY DEFINER` RPCs, which all re-gate on `current_app_role()`.

**Inconsistent anon contract (finding):** vehicle routes return **401** for signed-out callers (explicit `!locals.user` check); reservation routes return **403** (no `locals.user` check — a `null` role just fails `isRoleSufficient`). Same protection, different status. A test must accept the per-route contract; whether to normalize is a product decision to flag, not a test to assert blindly.

### `/r/[token]` and IDOR surface (Risk #4, read path)

- `src/pages/r/[token].astro:20-27` resolves the path `token` via `getReservationStatus(locals.supabase, token)` (anon/cookie client, **not** service-role); unknown/malformed token → 404.
- Service: `src/lib/services/reservations.ts:83-96` — UUID-shape guard then `client.rpc("get_reservation_status", { p_token: token })`.
- RPC: `supabase/migrations/20260611190621_status_read_customer_email.sql:15-45` — `security definer`, keyed solely on `where r.access_token = p_token`, granted to `anon, authenticated`. Returns reference/status/dates/vehicle spec + **only** `customer_name` + `customer_email`. **Not** exposed: phone, company, vat_id, notes, reservation `id`. (No protocol-photo concept on reservations.)
- Token entropy: `access_token uuid not null default gen_random_uuid()` (UUIDv4, ~122 bits) — `supabase/migrations/20260611171737_public_reservation_request.sql:21-24`. The `reference` (`R-XXXX`) is a sequential base36 code but is **display-only** — not a lookup key — so it cannot be enumerated to read data.
- Base-table direct SELECT is revoked for `anon, authenticated` and the `using(true)` policy dropped (`supabase/migrations/20260630120000_reservations_revoke_select_grant.sql:32,36` — the Phase 1 F1 fix). Reads succeed only via the token-filtered definer RPC.
- **Verdict:** `/r/[token]` is correctly scoped (token-gated, minimal PII, no enumeration) and is **already covered** by `tests/integration/reservations-rls.test.ts` (anon-no-token → 0 rows; valid token → exactly one name+email). The only caveat is design-accepted: the email link is a bearer secret (no second factor).
- **No genuine IDOR exists** on id-addressed mutations: each enforces role at the route AND re-enforces role in the DB (RPC `current_app_role()` gate or RLS WITH CHECK). The absence of ownership checks is correct (shared fleet/queue, no per-row owner).

### Server-side validation parity (Risk #5)

**Shared schema confirmed — one module, imported by both client island and server route:**
- Reservation: owner `src/lib/reservation-schema.ts`; client `src/components/reservation/ReservationForm.tsx:16,204`; server `src/pages/api/reservations.ts:7,73`.
- Vehicle: owner `src/lib/vehicle-schema.ts`; client `src/components/fleet/VehicleForm.tsx:15,321`; server `src/pages/api/vehicles.ts:7,53` and `src/pages/api/vehicles/[id].ts:7,56`.

**Every write route parses server-side before any DB write, returns 400:**

| Route | Method(s) | Parse | Fail status | Write behind parse? |
| --- | --- | --- | --- | --- |
| `src/pages/api/reservations.ts` | POST | `reservationRequestSchema.safeParse` `:73` | 400 `{errors}` `:75` | yes — DB at `:83/:89/:96` |
| `src/pages/api/reservations/[id].ts` | PATCH | `decisionSchema.safeParse` `:135` | 400 `{errors}` `:137` | yes — RPC `:143` |
| `src/pages/api/vehicles.ts` | POST | `vehicleInputSchema.safeParse` `:53` | 400 `{errors}` `:55` | yes — `createVehicle` `:59` |
| `src/pages/api/vehicles/[id].ts` | PATCH | `vehicleInputSchema.safeParse` `:56` | 400 `{errors}` `:58` | yes — `updateVehicle` `:62` |
| `src/pages/api/vehicles/[id]/active.ts` | POST | `activeSchema.safeParse` `:62` | 400 `{error}` `:64` | yes — `setVehicleActive` `:69` |

Malformed JSON → 400 before schema runs. No write route skips validation; no 422/500 used for validation. So the #5 fear ("crafted request skips client and is accepted") is **not reproducible** in current code — the test's value is a regression guard that the wiring stays in place.

**Date/overlap rules are mirrored three times by design:**
- `start<end` & not-in-past: `validateDateRange` (`src/lib/catalog-filters.ts:116-142`) via the schema's `.superRefine` (`src/lib/reservation-schema.ts:72-80`); half-open window pickup 14:00 / return 10:00 (`catalog-filters.ts:113-114`); `today` injectable for tests.
- Overlap: authority is the DB `EXCLUDE` constraint `reservations_no_overlap` (`supabase/migrations/20260603155136_booking_integrity_data.sql:124-129`); racing insert → `23P01` → typed `conflict` in `create_reservation_request` (`20260611171737…:127`). The API `isVehicleAvailable` pre-check (`src/lib/services/reservations.ts:101-123`) is explicitly UX-only. **(Already covered by Phase 1 `reservations-overlap.test.ts`.)**

**Existing unit coverage:**
- Covered: `reservationRequestSchema` — `src/lib/reservation-schema.test.ts` (16 cases incl. UUID/email/phone/terms/honeypot and date-range via the `validateDateRange` mirror).
- **NOT covered:** `vehicleInputSchema` (no `vehicle-schema.test.ts`) — coerce-number / empty→null / positive-rate / `production_year` range / `photos` http(s)-url-scheme logic has zero standalone tests. Also uncovered: inline `decisionSchema`, `activeSchema`, `querySchema`.

### Harness gap — how to test the routes (cheapest layer)

Existing harness (`tests/helpers/clients.ts`, `vitest.config.ts` `integration` project, `fileParallelism: false`, `tests/integration/setup.ts` loading `.env.test`) drives **Supabase clients** directly: `anonClient()`, `as(role)` (real `signInWithPassword` JWT for seeded `admin`/`employee`/`norole`), `serviceClient()` (setup/teardown only). Seed (`supabase/seed.sql`) provides the three signable roles, 6 active + 1 retired vehicle, 2 confirmed + 2 pending reservations with known tokens.

Testing API routes needs a new pattern, because handlers read from `context.locals` and do a same-origin CSRF check. Two options:

- **(A) Invoke the exported handler with a constructed `APIContext`** — build `locals = { supabase: <client from as(role) or anonClient()>, user: <or null>, role: <"admin"|"employee"|null> }`, set `request` with an `Origin` header equal to `context.url.origin`, pass `params` for `[id]` routes. Call the route's exported `POST`/`PATCH`/`GET`. Cheapest, deterministic, runs in the existing `integration` project against local Supabase. Caveat: `as(role)` returns a supabase-js client, not the SSR cookie client — fine, routes only call `.rpc()`/`.from()`; the test must set `locals.role` itself (middleware normally derives it).
- **(B) Run the dev/preview server and `fetch` over HTTP** — higher fidelity (exercises middleware + cookie session), but needs a live server + cookie handling; more setup, slower, more flake surface.

**Recommendation:** (A) for the authz matrix and validation-wiring assertions (cost × signal winner — exercises each route's real guard + schema wiring against the real DB without an HTTP server). Reserve (B)/e2e only if a guard turns out to depend on middleware (it does not today, since `/api/*` is outside `ROUTE_ROLES`).

## Code References

- `src/lib/access.ts:27-38` — `ROUTE_ROLES`; **no `/api/*` entry** (the Phase 2 keystone).
- `src/lib/access.ts:42-44,62-74` — prefix match, `isRoleSufficient`, `requireRole`.
- `src/middleware.ts:22-23,35-47` — role lookup; page-only auth/role gate.
- `src/pages/api/reservations.ts:46-49,73-76,83-99` — CSRF, zod, DB-after-parse.
- `src/pages/api/reservations/[id].ts:110,118-120,135-143` — PATCH role gate + decision schema.
- `src/pages/api/vehicles.ts:30,38-43,53-59` — 401/403 gate + vehicle schema.
- `src/pages/api/vehicles/[id].ts:28,36-41,56-62` — PATCH 401/403 + schema.
- `src/pages/api/vehicles/[id]/active.ts:34,42-47,62-69` — 401/403 + activeSchema.
- `src/pages/api/reservations/calendar.ts:16,25-28` — GET self-gates (confirmed).
- `src/pages/r/[token].astro:20-27` + `src/lib/services/reservations.ts:83-96` + `supabase/migrations/20260611190621_status_read_customer_email.sql:15-45` — token read path.
- `supabase/migrations/20260611171737_public_reservation_request.sql:21-24` — `access_token` UUIDv4.
- `supabase/migrations/20260630120000_reservations_revoke_select_grant.sql:32,36` — Phase 1 F1 fix.
- `src/lib/reservation-schema.ts:47-80` + `src/lib/reservation-schema.test.ts` — reservation schema + its 16 unit cases.
- `src/lib/vehicle-schema.ts:90-121,130-137` — vehicle schema (**no test file**).
- `src/lib/catalog-filters.ts:116-142` — `validateDateRange`.
- `vitest.config.ts:24-40` — unit + integration projects; `fileParallelism:false`.
- `tests/helpers/clients.ts:27-63` — `anonClient`/`as`/`serviceClient`, `SEEDED_CREDENTIALS`.
- `tests/integration/{smoke,reservations-overlap,reservations-rls}.test.ts` — existing patterns + already-covered token read.
- `supabase/seed.sql:22-89,100-136,169-230` — seeded vehicles, reservations, roles.

## Architecture Insights

- **Defense in depth, role-based, no ownership.** Each mutation route gates by role at the app layer AND re-gates in the DB (RPC `current_app_role()` or RLS WITH CHECK). There is deliberately no per-row owner; "any staff acts on any row" is the domain model, so classic IDOR-by-id is not applicable. The only secret-scoped read is the customer `access_token`.
- **Shared zod schema is the server trust boundary**; the client copy is UX-only. Validation, overlap, and date rules are each mirrored across SQL/RPC/JS by design — tests should assert the *authority* layer for each (DB for overlap, route for HTTP-status wiring, unit for schema rules).
- **`/api/*` lives outside middleware protection** — the single most important structural fact for this phase; the per-route self-gate is the only thing protecting the API.

## Historical Context (from prior changes)

- `context/archive/2026-06-27-testing-data-layer-integrity/` (Phase 1) — stood up the integration harness, proved the overlap constraint and RLS access matrix, and **already covers** the `/r/[token]` token read and the `norole` raw-table regression guard. Phase 2 must not duplicate these.
- `context/foundation/lessons.md` — RLS `(select …)` wrapping rule; relevant only if Phase 2 touches policies (it should not — it tests existing app-layer guards).

## Related Research

- `context/archive/2026-06-27-testing-data-layer-integrity/research.md` — prior grounding of the RLS/overlap layer this phase builds atop.

## Backport recommendations for `test-plan.md` §2 (for `/10x-test-plan`)

These are response-guidance / risk-wording corrections only (no file anchors added to §2):

1. **#4 reframe** — replace "IDOR / cross-resource access by id / ownership check" with "**per-route role self-gate**: middleware does not protect `/api/*`, and there is no ownership model — the real risk is a route omitting its own role check, letting anon/`norole` reach a staff action." Keep the `/r/[token]` scoping as *verify*, noting it is already covered by Phase 1.
2. **#4 cheapest layer** — confirm integration via **direct handler invocation with a constructed `APIContext`** (option A), not e2e; middleware is irrelevant to `/api/*`.
3. **#5 reposition** — all write routes already validate server-side (400, no write); the test is a **regression guard on schema wiring + no-DB-write**, not a bug hunt. Add the cheap win: a **`vehicle-schema.test.ts` unit suite** (currently missing) is cheaper signal than an API test for vehicle input rules.
4. **Anti-pattern to add** — do not re-assert the zod schema through the route (already unit-covered for reservations); the route test must assert the *HTTP contract* (status + that no row was written), and accept the per-route anon status (401 vehicles / 403 reservations).

## Open Questions

1. **Anon status normalization** — is the 401-vehicles / 403-reservations split intentional, or should it be unified? Product decision; flag, don't assert blindly.
2. **Handoff fidelity** — does the team want any single HTTP-level (option B) smoke over a route to prove middleware+cookie wiring once, or is direct-handler invocation (A) sufficient for the whole matrix? (Recommendation: A for the matrix; defer B unless a guard ever depends on middleware.)
3. **CSRF Origin check coverage** — worth one explicit case per mutation route (missing/foreign `Origin` → 403) since it precedes auth; cheap to add in option A.
