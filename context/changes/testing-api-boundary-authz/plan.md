# API Boundary Tests — Authz Matrix + Input Parity Implementation Plan

## Overview

Rollout Phase 2 of `context/foundation/test-plan.md`. Author an integration
suite that proves every `/api/*` route's **own** guards hold — because
middleware does not gate `/api/*` at all. Two risks:

- **Risk #4 (authz):** each protected route must deny anon and `norole`
  callers and admit only the correct staff role. There is no per-resource
  ownership model (shared fleet/queue), so this is a **per-route role
  self-gate matrix**, not IDOR-by-id.
- **Risk #5 (validation parity):** each write route must reject a
  client-bypassing payload with a clean 4xx **and no DB write**. Every route
  already does this; the suite is a **regression guard on schema wiring**,
  not a bug hunt.

Plus the cheapest adjacent win research surfaced: `vehicleInputSchema` has
zero unit tests — add them.

## Current State Analysis

- **`/api/*` is outside middleware.** `ROUTE_ROLES` (`src/lib/access.ts:27-38`)
  lists only `/dashboard*` page prefixes, so `src/middleware.ts:35-47` applies
  no auth/role gate to any API route. Each handler self-gates or it is open.
- **Every protected route already self-gates** (verified, research §"Per-route
  authz"): CSRF same-origin → auth/role → zod parse → DB call. The DB re-gates
  a third time (RLS `WITH CHECK` or RPC `current_app_role()`).
- **Inconsistent anon contract (accepted as a finding, not fixed here):**
  vehicle routes return **401** for signed-out callers (`!locals.user` check);
  reservation routes return **403** (no `locals.user` check — a `null` role
  just fails `isRoleSufficient`). The suite asserts each route's real contract.
- **The existing harness drives Supabase clients directly**
  (`tests/helpers/clients.ts`: `anonClient()`, `as(role)`, `serviceClient()`).
  It cannot test *routes* — handlers read `context.locals` and do a same-origin
  CSRF check. A new primitive is needed: a constructed `APIContext`.
- **Existing test conventions** (from `tests/integration/reservations-*.test.ts`):
  service-role for setup/teardown ONLY; access assertions on `anonClient()` /
  `as(role)`; disposable data on a dedicated id outside the `1111…`–`7777…`
  fleet, far-future dates; idempotent `beforeAll`/`afterEach`/`afterAll`
  teardown; `fileParallelism: false`.
- **Unit coverage gap:** `reservationRequestSchema` has 16 cases
  (`src/lib/reservation-schema.test.ts`); `vehicleInputSchema`
  (`src/lib/vehicle-schema.ts`) has **none**.

### Key Discoveries:

- The single most important structural fact: `src/lib/access.ts:27-38` has **no
  `/api/*` entry** — the per-route self-gate is the only protection.
- Route → anon-result contract (research §3 table):
  `reservations/calendar.ts:25` GET → 403; `reservations/[id].ts:110` PATCH →
  403; `vehicles.ts:30` POST → 401; `vehicles/[id].ts:28` PATCH → 401;
  `vehicles/[id]/active.ts:34` POST → 401. Public funnel
  `reservations.ts:43` POST → allowed by design (CSRF + honeypot only).
- Handlers only touch `context.request` (`.headers.get("origin")`, `.json()`),
  `context.url` (`.origin`), `context.locals` (`.supabase`, `.user`, `.role`),
  and `context.params` (`.id`). A minimal constructed object covers all of them.
- `/r/[token]` and the overlap constraint are **already covered by Phase 1**
  (`reservations-rls.test.ts`, `reservations-overlap.test.ts`) — do not duplicate.
- Seeded pending reservations exist (`aaaaaaaa-…-000000000003/4`,
  `supabase/seed.sql:123-136`) but a PATCH **mutates** them; the allow-path
  cases create disposable pending rows and tear them down.

## Desired End State

- `npm run test:integration` runs two new suites — `api-authz.test.ts` and
  `api-validation.test.ts` — green against local Supabase, plus the existing
  Phase 1 suites.
- `npm test` (unit project) runs a new `src/lib/vehicle-schema.test.ts`, green.
- A reusable `buildApiContext(...)` helper exists in `tests/helpers/`.
- Cookbook §6.3 in `test-plan.md` is filled with the API-route-test recipe; §3
  Phase 2 row reads `complete`; the freshness ledger is updated.
- The 401/403 anon-status inconsistency is written up as a product finding doc.

## What We're NOT Doing

- **No code changes to routes.** The anon-status split is documented, not
  normalized (per the planning decision). The suite asserts the *current*
  contract per route.
- **No re-coverage of `/r/[token]`, the overlap constraint, or the RLS access
  matrix** — Phase 1 owns those.
- **No re-assertion of the zod schemas through the route.** The reservation
  schema is unit-covered; the route test asserts the *HTTP contract* (status +
  no DB write), not the schema's field rules.
- **No HTTP-server / option-B harness.** Direct handler invocation only;
  middleware is irrelevant to `/api/*` today.
- **No e2e, no Playwright, no vision layer** (§7 negative space).
- **No `PUT`/`DELETE` tests** — none exist in the codebase.
- **No fix for the `vehicleInputSchema` rules** — Phase 4 *tests* them as-is.

## Implementation Approach

Build the harness primitive first (Phase 1), since the authz (Phase 2) and
validation (Phase 3) suites both depend on it. Phase 4 (vehicle schema unit) is
independent and could run any time, but lands after the integration work so the
phase reads as one arc. Phase 5 closes out documentation and state.

The harness invokes the exported `GET`/`POST`/`PATCH` handler with a constructed
`APIContext`. The factory keeps the Supabase client's JWT role **consistent**
with `locals.role`/`locals.user` — exactly as middleware derives locals from the
session — so an allow-path case passes both the app gate and the DB backstop,
and a deny-path case fails the app gate (never reaching the DB). Service-role is
used only to seed/tear down disposable rows; every *assertion* runs through a
context whose `locals.supabase` is `anonClient()` or `as(role)`.

## Critical Implementation Details

- **Client/locals role consistency.** For an allow-path case the constructed
  context must carry `locals.supabase = as(role)` AND `locals.role = role` AND a
  truthy `locals.user`; otherwise the app gate passes but the DB RPC/RLS denies
  (a real backstop, but not what the matrix is asserting). The factory derives
  all three from one `role` argument so they cannot drift.
- **CSRF precedes auth.** Every mutation handler checks `Origin` before auth, so
  a bad-origin case returns 403 regardless of role — the factory must let a test
  set `Origin` independently (default: equal to `url.origin` so normal cases
  pass).
- **PATCH/POST allow-paths mutate.** Deciding a reservation or toggling a
  vehicle changes state. Allow-path cases own disposable rows (dedicated id
  outside the seeded fleet, far-future dates) seeded and torn down via
  `serviceClient()`; teardown is idempotent so reruns stay green.
- **`no DB write` must query the DB.** A validation-parity assertion proves the
  row was not written by reading the disposable scope back through
  `serviceClient()` — not by trusting the 400 status alone.

## Phase 1: Route-invocation harness primitive

### Overview

Add a constructed-`APIContext` factory so a test can call an exported route
handler directly, and prove it drives one real handler end-to-end against local
Supabase.

### Changes Required:

#### 1. APIContext factory

**File**: `tests/helpers/context.ts` (new)

**Intent**: Provide a single `buildApiContext(...)` that assembles the minimal
`APIContext` the handlers read, so every route test constructs requests the same
way. Keeps client + locals role consistent to mirror how middleware derives
locals from the session.

**Contract**: `buildApiContext(opts)` returns an object castable to Astro's
`APIContext`. Inputs cover everything the handlers touch:

```
buildApiContext({
  method: "GET" | "POST" | "PATCH",
  path: string,                       // e.g. "/api/vehicles" → url.origin "http://localhost:4321"
  supabase: SupabaseClient,           // from anonClient() | as(role) | (anon for unauthed)
  user?: { id: string } | null,       // truthy for authed, null for anon
  role?: "admin" | "employee" | null, // locals.role
  params?: Record<string, string>,    // e.g. { id }
  body?: unknown,                      // JSON-serialized into the Request
  origin?: string,                     // defaults to url.origin; override to test CSRF
}): APIContext
```

The request is built as `new Request(url, { method, headers: { origin, "content-type": "application/json" }, body })`; `url` is a real `URL` so `context.url.origin` resolves. A convenience wrapper (e.g. `asContext(role, {...})`) that pairs `as(role)` with matching `user`/`role` is encouraged to prevent drift, but optional.

#### 2. Harness smoke test

**File**: `tests/integration/api-context.smoke.test.ts` (new)

**Intent**: Prove the factory actually drives a real handler against local
Supabase — one allow case and one deny case — before the matrix relies on it.

**Contract**: Import `GET` from `reservations/calendar.ts`; assert
`buildApiContext` with `role:"employee"` → 200, and with `role:null` (anon) →
403. No disposable data needed (calendar is read-only).

### Success Criteria:

#### Automated Verification:

- Integration suite runs the smoke test green: `npm run test:integration`
- Type checking passes: `npm run lint` (type-checked rules)
- Linting passes: `npm run lint`

#### Manual Verification:

- The factory mirrors middleware's locals derivation (client JWT role ==
  `locals.role`); the `as unknown as APIContext` cast is the only type escape
  and is commented.
- The smoke test's 403 runs through a real anon/`norole`-shaped context, not
  service-role.

**Implementation Note**: After this phase and all automated verification passes,
pause for manual confirmation before proceeding.

---

## Phase 2: Authz matrix (Risk #4)

### Overview

Prove each protected route admits only the correct role and denies anon/`norole`,
and that the CSRF origin check fires before auth. Encode the public funnel's
by-design openness explicitly so "anon allowed" is a documented contract, not an
oversight.

### Changes Required:

#### 1. Authz matrix suite

**File**: `tests/integration/api-authz.test.ts` (new)

**Intent**: One role × status matrix per protected route, asserting the route's
*actual* anon contract (401 for vehicle routes, 403 for reservation routes),
`norole` → 403, and staff → allowed. Plus a CSRF bad-origin case per mutation
route, and the public funnel's anon-allowed + honeypot short-circuit.

**Contract**: Cases per route (handlers from research §3 table):

- `reservations/calendar.ts` GET: anon → 403, `norole` → 403, employee → 200,
  admin → 200.
- `reservations/[id].ts` PATCH: anon → 403, `norole` → 403; employee → 200 on a
  disposable pending reservation (decision commits, then torn down).
- `vehicles.ts` POST: anon → **401**, `norole` → 403; employee → 201 (disposable
  vehicle, torn down).
- `vehicles/[id].ts` PATCH: anon → **401**, `norole` → 403; employee → 200 on a
  disposable vehicle.
- `vehicles/[id]/active.ts` POST: anon → **401**, `norole` → 403; employee → 200
  on a disposable vehicle.
- CSRF: for each mutation route, a foreign/missing `Origin` → 403 (asserted
  before any auth — runnable as anon).
- Public funnel `reservations.ts` POST: anon with valid same-origin body → 201
  (by design); non-empty `company_url` honeypot → 201 success-shape with **no**
  row written (verify via `serviceClient()` on the disposable scope).

Deny cases need no disposable data (they never write). Allow/funnel cases own a
disposable vehicle + far-future window, seeded and torn down via `serviceClient()`
following the `reservations-overlap.test.ts` pattern.

### Success Criteria:

#### Automated Verification:

- Authz suite passes: `npm run test:integration`
- All 5 protected routes + CSRF + public funnel covered (case count matches the
  contract list)
- Linting + type checking pass: `npm run lint`

#### Manual Verification:

- Every deny assertion runs through an anon/`norole` context (never
  service-role); an RLS/role bypass could not make a deny test pass falsely.
- The 401-vehicles / 403-reservations split is asserted as-is (per the
  documented finding), not normalized.
- Disposable rows are gone after the run (rerun stays green).

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: Validation parity (Risk #5)

### Overview

Prove each write route applies its schema server-side: a client-bypassing
payload returns 400 **and writes nothing**. A regression guard on the wiring, not
a re-assertion of the schema's field rules.

### Changes Required:

#### 1. Validation parity suite

**File**: `tests/integration/api-validation.test.ts` (new)

**Intent**: For each write route, send an authed (sufficient-role) context with a
payload the client would block and assert a clean 400 with no DB side-effect;
plus malformed JSON → 400.

**Contract**: Per write route, one representative invalid payload (the rule
class differs per route — e.g. reservations: past/inverted dates or bad UUID;
vehicles: non-positive `daily_rate` or a `javascript:` photo URL; decision:
`reject` with no `reason`; active: non-boolean) → 400. Malformed JSON body → 400
before schema runs. After each 400, read the disposable scope back through
`serviceClient()` and assert **zero** new rows. Use a sufficient role so the
request reaches validation (not stopped at the gate). Do NOT enumerate the
schema's field rules — that is unit-covered for reservations and is Phase 4 for
vehicles.

### Success Criteria:

#### Automated Verification:

- Validation suite passes: `npm run test:integration`
- Each write route has a bad-payload → 400 + no-DB-write case, plus a
  malformed-JSON → 400 case
- Linting + type checking pass: `npm run lint`

#### Manual Verification:

- The no-DB-write assertion actually queries the DB back (not status-only).
- Cases assert the HTTP contract, not the schema internals (no duplication of
  `reservation-schema.test.ts`).

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Vehicle schema unit suite

### Overview

Close the cheapest coverage gap research surfaced: `vehicleInputSchema` has no
unit test. Cheaper signal for vehicle input rules than any API-layer test.

### Changes Required:

#### 1. Vehicle schema unit tests

**File**: `src/lib/vehicle-schema.test.ts` (new)

**Intent**: Cover the schema's non-trivial transforms and bounds, mirroring the
breadth of `reservation-schema.test.ts`.

**Contract**: Cases for — a valid minimal payload; `coerceNumber` (string
"120.00" → 120, non-numeric → reject); `requiredPositive` rejects blank / NaN /
≤ 0; `optionalNumber` empty → `null`; `production_year` out-of-range
(`<1950`/`>2100`) → reject; `seats`/dimensions non-negative int rules;
`photos` rejects non-`http(s)` schemes (`javascript:`, `data:`) and accepts
`https`; empty optional text → `null`. Use `vehicleInputSchema.safeParse`, a
`messagesOf`-style helper like the reservation test.

### Success Criteria:

#### Automated Verification:

- Unit suite includes and passes the new file: `npm test`
- Linting + type checking pass: `npm run lint`

#### Manual Verification:

- Case breadth is comparable to `reservation-schema.test.ts` (transforms +
  bounds + the http(s) photo rule all represented).

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 5: Cookbook §6.3 + finding + close-out

### Overview

Fill the cookbook recipe, record the per-phase note, write up the anon-status
inconsistency as a product finding, and advance the rollout state.

### Changes Required:

#### 1. Cookbook §6.3

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.3 "TBD" with the API-route-test recipe so the next
contributor can add one without re-deriving the harness.

**Contract**: Fill §6.3 with location (`tests/integration/`), naming
(`api-<concern>.test.ts`), the `buildApiContext` helper and its
client/locals-consistency rule, reference tests (`api-authz.test.ts`,
`api-validation.test.ts`), the run command (`npm run test:integration`), and the
key conventions (deny-on-anon/`norole`-context, CSRF-before-auth,
no-DB-write-verified-via-service-role, accept-per-route-anon-status).

#### 2. Per-phase note (§6.6) + freshness

**File**: `context/foundation/test-plan.md`

**Intent**: Append a 2–3 line §6.6 note capturing what Phase 2 taught (the
`/api/*`-outside-middleware fact, the 401/403 split, the harness pattern) and
bump the §8 freshness ledger date.

**Contract**: One bullet under §6.6; update the §3 Phase 2 row Status to
`complete`; refresh the "Last updated" header line.

#### 3. Anon-status finding doc

**File**: `context/changes/testing-api-boundary-authz/finding-anon-status-inconsistency.md` (new)

**Intent**: Record the 401-vehicles / 403-reservations split as a product
decision to make later (normalize or accept), mirroring the Phase 1 finding-doc
style.

**Contract**: Short doc: observed contract per route (with file refs), why it
happens (`!locals.user` check present vs absent), impact (cosmetic — same
protection), and the open product question (normalize to 401 everywhere?). Link
it from `change.md`.

#### 4. Close change

**File**: `context/changes/testing-api-boundary-authz/change.md`

**Intent**: Mark the change done so the orchestrator advances.

**Contract**: Set `status: complete` (or the repo's close convention) and
`updated:` to today; reference the finding doc.

### Success Criteria:

#### Automated Verification:

- `test-plan.md` §3 Phase 2 row reads `complete`; §6.3 no longer says "TBD"
- Finding doc exists: `ls context/changes/testing-api-boundary-authz/finding-anon-status-inconsistency.md`
- Full suite green: `npm test` and `npm run test:integration`

#### Manual Verification:

- §6.3 reads as a usable recipe (a contributor could add an API test from it
  alone).
- The finding doc captures the decision clearly enough to act on later.

**Implementation Note**: Final phase — confirm the whole suite is green and the
rollout state is advanced.

---

## Testing Strategy

### Unit Tests:

- `src/lib/vehicle-schema.test.ts` — coerce/transform/bounds + http(s) photo
  rule (Phase 4).

### Integration Tests:

- `tests/integration/api-authz.test.ts` — role × status matrix per protected
  route + CSRF + public funnel (Phase 2).
- `tests/integration/api-validation.test.ts` — bad-payload → 400 + no DB write
  per write route (Phase 3).
- `tests/integration/api-context.smoke.test.ts` — harness self-check (Phase 1).

### Manual Testing Steps:

1. `npx supabase start` (Docker) and `npx supabase db reset` to load seed.
2. `npm run test:integration` — all suites green; rerun to confirm idempotent
   teardown.
3. `npm test` — unit project includes the new vehicle schema suite.
4. Inspect the disposable scope (`serviceClient()` query) is empty after a run.

## Performance Considerations

The integration project runs serial (`fileParallelism: false`) by necessity (the
GiST EXCLUDE constraint). Two more suites add wall-clock but no new contention.
Allow-path cases that sign in via `as(role)` pay a `signInWithPassword`
round-trip; reuse a signed-in client per role within a file where practical.

## Migration Notes

None — no schema or app-code changes. The only product follow-up (anon-status
normalization) is deferred and captured as a finding doc.

## References

- Research: `context/changes/testing-api-boundary-authz/research.md`
- Risk source: `context/foundation/test-plan.md` §2 (#4, #5), §3 Phase 2
- Lessons: `context/foundation/lessons.md` — "API routes are outside
  middleware's gate — every /api route must self-gate"
- Harness conventions: `tests/integration/reservations-overlap.test.ts`,
  `tests/integration/reservations-rls.test.ts`, `tests/helpers/clients.ts`
- Cookbook: `context/foundation/test-plan.md` §6.2 (integration test pattern)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Route-invocation harness primitive

#### Automated

- [x] 1.1 Integration suite runs the smoke test green: `npm run test:integration` — 3081372
- [x] 1.2 Type checking passes: `npm run lint` — 3081372
- [x] 1.3 Linting passes: `npm run lint` — 3081372

#### Manual

- [x] 1.4 Factory mirrors middleware locals derivation; cast escape commented — 3081372
- [x] 1.5 Smoke 403 runs through a real anon-shaped context, not service-role — 3081372

### Phase 2: Authz matrix (Risk #4)

#### Automated

- [x] 2.1 Authz suite passes: `npm run test:integration` — 0e80919
- [x] 2.2 All 5 protected routes + CSRF + public funnel covered — 0e80919
- [x] 2.3 Linting + type checking pass: `npm run lint` — 0e80919

#### Manual

- [x] 2.4 Every deny assertion runs through anon/`norole` context (never service-role) — 0e80919
- [x] 2.5 401-vehicles / 403-reservations split asserted as-is, not normalized — 0e80919
- [x] 2.6 Disposable rows gone after the run (rerun stays green) — 0e80919

### Phase 3: Validation parity (Risk #5)

#### Automated

- [x] 3.1 Validation suite passes: `npm run test:integration`
- [x] 3.2 Each write route has bad-payload → 400 + no-DB-write, plus malformed-JSON → 400
- [x] 3.3 Linting + type checking pass: `npm run lint`

#### Manual

- [x] 3.4 No-DB-write assertion queries the DB back (not status-only)
- [x] 3.5 Cases assert HTTP contract, not schema internals

### Phase 4: Vehicle schema unit suite

#### Automated

- [ ] 4.1 Unit suite includes and passes the new file: `npm test`
- [ ] 4.2 Linting + type checking pass: `npm run lint`

#### Manual

- [ ] 4.3 Case breadth comparable to `reservation-schema.test.ts`

### Phase 5: Cookbook §6.3 + finding + close-out

#### Automated

- [ ] 5.1 §3 Phase 2 row reads `complete`; §6.3 no longer says "TBD"
- [ ] 5.2 Finding doc exists
- [ ] 5.3 Full suite green: `npm test` and `npm run test:integration`

#### Manual

- [ ] 5.4 §6.3 reads as a usable recipe
- [ ] 5.5 Finding doc captures the decision clearly enough to act on later
