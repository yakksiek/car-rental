# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-09 (§7 e2e exclusion narrowed — Playwright wired; one browser spec covers risk #6's rendered calendar; §4/§5 stack + gate rows updated to match)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/` (hand-written app code),
with `supabase/migrations/` tracked separately for RLS churn.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                                                    | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | An employee, wrong-role, or anonymous caller reads customer PII (names, phones, emails, protocol photos) they shouldn't — an RLS gap                                                                                       | High   | High       | PRD Access Control + Guardrail #2; interview Q1, Q4; hot-spot dir `supabase/migrations/` (13 files/30d); lessons.md (RLS policies actively churned)   |
| 2   | A double-booking slips through — two confirmed reservations overlap on one vehicle, or the same-day changeover buffer is off-by-one                                                                                        | High   | High       | PRD FR-005 / Guardrails / Business Logic; interview Q3; hot-spot dir `src/lib/services/` (11 commits/30d), `src/lib/` (39 commits/30d); roadmap S-02a |
| 3   | A handover protocol email fails silently or carries wrong/missing photos — the customer gets nothing, or bad dispute evidence                                                                                              | High   | Medium     | PRD FR-008 / US-02; interview Q1; roadmap S-05/S-06 (slice not yet built — phase activates when it ships)                                             |
| 4   | IDOR / broken authorization — an authed-but-wrong-role caller or crafted request reaches a reservation/protocol/vehicle resource (including the public `/r/[token]` link) without an ownership/role check                  | High   | Medium     | PRD Access Control; hot-spot dir `src/pages/api/` (11 commits/30d), `src/pages/` (11 commits/30d); abuse lens (authorization/IDOR)                    |
| 5   | Server-side validation bypass — a request crafted to skip the client (bad dates, overlapping range, malformed fields, invalid vehicle id) is accepted by the API                                                           | High   | Medium     | PRD FR-004 / FR-005; interview Q3; hot-spot dir `src/pages/api/` (11 commits/30d); abuse lens (input parity)                                          |
| 6   | The dashboard shows wrong reservation/availability state — calendar/queue render stale or incorrect day-states (phantom availability, overdue not flagged, accepted booking not blocking) → an employee accepts a conflict | Medium | High       | interview Q3; hot-spot dir `src/components/dashboard/` (15 commits/30d)                                                                               |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                         | Must challenge                                                                                        | Context `/10x-research` must ground                                                               | Likely cheapest layer                                                                               | Anti-pattern to avoid                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| #1   | anon + employee + admin clients each get exactly the rows policy allows; a wrong-role SELECT returns 0 PII rows                     | "logged in" ≠ "allowed to read this"; a `STABLE SECURITY DEFINER` helper ≠ enforced access            | every table's per-role × per-operation policy; which client (anon vs service-role) each path uses | integration vs real local Postgres with RLS                                                         | asserting policy SQL text instead of observed row access; a service-role client masking the gap |
| #2   | a second overlapping reservation is rejected at the DB; same-day return-10:00 / pickup-14:00 turnover is _allowed_                  | a green insert means "no conflict"; the existing pure-rule unit test already covers the DB constraint | the overlap constraint + the service insert path; the half-open window boundaries                 | integration (constraint via service) + existing unit on the rule                                    | oracle copied from the rule's own code; testing only the helper, not the DB constraint          |
| #3   | email send is attempted, failures surface (not swallowed), and the payload carries the correct photos                               | a 200 from the provider ≠ correct attachments; "sent" ≠ "received correct"                            | the send path + attachment assembly once S-05 lands; the transport seam to fake                   | integration with a captured/fake transport + contract on the payload                                | mocking the transport so deeply nothing real is asserted; happy-path-only                       |
| #4   | each protected route denies anon + wrong-role + cross-resource access by id/token                                                   | a route "is protected" ≠ "checks ownership"; a middleware gate ≠ a per-resource check                 | the middleware coverage map; which routes check role vs ownership; the `/r/[token]` scope         | integration (API route auth matrix)                                                                 | testing only the happy authed path; trusting middleware to cover IDOR                           |
| #5   | the API rejects payloads the client would block (bad dates, overlap, bad id) with a clean 4xx and no DB write                       | client-side zod ≠ server enforcement; importing the schema ≠ applying it server-side                  | where the shared schema is actually parsed server-side; the reject path                           | integration (API route) — the schema unit test already exists                                       | re-asserting the zod schema in isolation (already covered) instead of the route applying it     |
| #6   | day-states / availability derived for the calendar match the server overlap rule exactly (no phantom availability; overdue flagged) | UI greying matches the server rule (the known calendar↔catalog asymmetry)                             | the busy-ranges → day-states derivation; the overdue computation                                  | unit on the extracted pure mapping (extend the existing calendar map test) + a thin component check | snapshot-without-meaning on the calendar; asserting rendered DOM over the derivation logic      |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                                 | Goal (one line)                                                                                                                                                                                   | Risks covered | Test types            | Status      | Change folder                                            |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------- | ----------- | -------------------------------------------------------- |
| 1   | Data-layer integrity harness + RLS/overlap | Stand up the integration harness vs local Supabase (anon/employee/admin clients); prove no role reads PII it shouldn't and the overlap constraint rejects double-bookings incl. same-day turnover | #1, #2        | integration           | complete    | context/archive/2026-06-27-testing-data-layer-integrity/ |
| 2   | API boundary: authz + input parity         | Prove API routes deny wrong-role/anon/IDOR access and reject server-side when the client is bypassed                                                                                              | #4, #5        | integration, contract | complete    | context/changes/testing-api-boundary-authz/              |
| 3   | Dashboard & availability state             | Prove the calendar/queue derive correct day-states and availability (no phantom availability, overdue flagged)                                                                                    | #6            | unit + thin component | not started | —                                                        |
| 4   | Protocol email & photo integrity           | Prove the handover email sends, fails loudly, and carries the correct photos                                                                                                                      | #3            | integration, contract | not started | —                                                        |
| 5   | Quality-gates wiring                       | Wire unit + integration into CI as a required gate (CI is lint+build only today); recommend a local post-edit hook                                                                                | cross-cutting | gates                 | not started | —                                                        |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

Phase ordering: Phases 1–2 are High×High / High-impact and reuse one
harness, so they come first. Phase 3 is the cheapest layer (extend existing
pure-mapping units) for the highest-churn UI area. Phase 4 activates only
when slices S-05/S-06 ship — there is no code to test before then. Phase 5
locks the floor once suites exist; the unit gate can be wired right after
Phase 1.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer                  | Tool                                                        | Version | Notes                                                                                                                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration     | Vitest                                                      | ^4.1.8  | configured; `npm test` = `vitest run`. 9 unit files, all in `src/lib/` (pure helpers). Components/pages/API/services/RLS untested                                                                                                                                                                    |
| DB integration harness | local Supabase (`npx supabase start`) + supabase-js clients | n/a     | none yet — see §3 Phase 1. Needs anon/employee/admin clients against a seeded test DB to exercise RLS + the overlap constraint for real                                                                                                                                                              |
| API route integration  | Vitest + Astro route handlers                               | ^4.1.8  | none yet — see §3 Phase 2. Routes export `GET`/`POST`; test request → response + DB side-effect                                                                                                                                                                                                      |
| e2e                    | Playwright                                                  | ^1.61.1 | wired 2026-07-09. `playwright.config.ts` + `storageState` auth (`e2e/auth.setup.ts`, employee + admin). 1 spec: `e2e/seed.spec.ts` (risk #6's rendered calendar). Levers: `e2e/seed.spec.ts` + `e2e/e2e-rules.md`. Local only — not a CI gate yet (§5)                                               |
| accessibility          | axe-core                                                    | —       | none yet — not prioritized in this rollout                                                                                                                                                                                                                                                           |
| (optional) AI-native   | Playwright CLI — checked: 2026-07-09                        | 0.1.15  | available (global install; agent-driven exploration via accessibility snapshots). Playwright MCP still not installed — CLI is preferred (lower token cost). When NOT to use: never put a vision/agent layer on RLS, overlap, or authz — deterministic integration gives the cheaper, stronger signal |

**Stack grounding tools (current session):**

- Docs: Context7 — available; can ground Vitest 4 + Astro route + Supabase local-test setup at plan time; checked: 2026-06-27
- Search: Exa.ai — available; for current tool status / discovery only; checked: 2026-06-27
- Runtime/browser: Playwright (test runner + CLI) — wired and driving one spec; MCP not installed and not needed (CLI covers exploration at ~4x lower token cost); checked: 2026-07-09
- Provider/platform: no Supabase/GitHub MCP this session; repo uses `gh` CLI + `npx supabase` locally + Cloudflare Workers deploy; checked: 2026-06-27

Use docs MCPs for current framework/library APIs and setup details. Use
search MCPs for discovery or current status only, then prefer official docs
as the evidence. Do not use MCP docs/search to infer code failure anchors;
those belong in per-phase `/10x-research`.

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is planned.

| Gate                              | Where                  | Required?                              | Catches                                              |
| --------------------------------- | ---------------------- | -------------------------------------- | ---------------------------------------------------- |
| lint + typecheck                  | local + CI             | required (wired today)                 | syntactic / type drift                               |
| unit                              | local + CI             | required after §3 Phase 1              | logic regressions in pure helpers                    |
| integration (RLS + overlap + API) | local + CI             | required after §3 Phase 2              | PII leaks, double-bookings, authz/validation bypass  |
| post-edit hook                    | local (agent loop)     | recommended after §3 Phase 5           | regressions at edit time                             |
| e2e on critical flows             | local (CI: §3 Phase 5) | optional — green locally, not enforced | phantom availability; broken booking/auth user paths |
| visual diff / multimodal review   | CI on PR               | optional                               | rendering regressions classic tests miss             |
| pre-prod smoke                    | between merge + prod   | optional                               | environment-specific failures                        |

CI today (`.github/workflows/ci.yml`) runs `astro sync` + lint + build only;
the unit and integration gates are wired by §3 Phase 5 (and the unit gate
may be wired as soon as Phase 1 lands).

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the
relevant rollout phase ships; before that, the sub-section reads "TBD — see
§3 Phase <N>."

### 6.1 Adding a unit test

- **Location**: next to the unit under test in `src/lib/` (e.g. `src/lib/<module>.test.ts`).
- **Naming**: `<module>.test.ts`.
- **Reference test**: `src/lib/availability.test.ts` (the canonical pure-logic unit test).
- **Run locally**: `npm test` (or `npx vitest run src/lib/<module>.test.ts`).

### 6.2 Adding an integration test (RLS + DB)

Integration tests run against a **local Supabase** (`npx supabase start`),
driving real Postgres so RLS policies, grants, constraints, and SECURITY
DEFINER RPCs are observed — never asserted as SQL text.

- **Location**: `tests/integration/` (separate from the `src/`-colocated unit
  suite). Shared client factories live in `tests/helpers/clients.ts`.
- **Naming**: `<area>-<concern>.test.ts` (e.g. `reservations-overlap.test.ts`,
  `reservations-rls.test.ts`).
- **Reference test**: `tests/integration/reservations-overlap.test.ts` (the
  canonical DB-constraint suite — disposable test vehicle, far-future dates,
  unique `reference`/`access_token`, service-role teardown). For an RLS
  access-matrix, see `tests/integration/reservations-rls.test.ts`.
- **Run command**: `npm run test:integration`
  (= `vitest run --project integration`). `npm test` runs only the DB-free
  `unit` project and must stay that way (today's CI runs it without Supabase).
- **Env**: copy `.env.test.example` → `.env.test` and fill from
  `npx supabase status` (anon = Publishable key, service = Secret key). Run
  `npx supabase db reset` after any seed/migration change to pick it up.
- **Conventions** (non-negotiable):
  - **Service-role is setup/teardown ONLY.** `serviceClient()` bypasses RLS;
    every _access assertion_ must run on `anonClient()` / `as(role)` (anon key +
    real JWT), or an RLS bypass will make a leak test pass falsely.
  - **Serial execution.** The integration project runs `fileParallelism: false`
    — the GiST `EXCLUDE` overlap constraint makes concurrent reservation writes
    collide. Don't parallelize.
  - **Disposable data scope.** Own a dedicated vehicle / far-future window that
    no seed row touches; clean up via `serviceClient()` in `afterEach`/`afterAll`
    so reruns stay green (teardown must be idempotent).
  - **Untyped client caveat.** Test clients are built without generated DB
    types, so `.rpc()` results are `any` — cast them to a local row interface to
    satisfy lint (see the row shapes in `reservations-rls.test.ts`). `.from()`
    selects infer their shape and need no cast.
  - **Catalog functions (`has_table_privilege`, `information_schema`) are not
    reachable** through PostgREST/supabase-js (only `public`-schema functions
    are exposed). Assert the _behavior_ (e.g. a direct read returns 0 rows)
    rather than the grant; verify grants out-of-band via psql if needed.

### 6.3 Adding an API route integration test

API-route tests invoke an exported handler (`GET`/`POST`/`PATCH`) **directly**
with a constructed `APIContext` — no HTTP server, because `/api/*` is outside
middleware (see `context/foundation/lessons.md`) so the handler's own self-gate
is the whole contract. They run in the same local-Supabase integration project
as §6.2.

- **Location**: `tests/integration/` (alongside the RLS/overlap suites).
- **Naming**: `api-<concern>.test.ts` (e.g. `api-authz.test.ts`,
  `api-validation.test.ts`).
- **Helper**: `tests/helpers/context.ts` exports `buildApiContext({ method,
path, supabase, user, role, params, body, origin })`, which assembles the
  minimal object the handlers read (`request`, `url`, `locals.{supabase,user,
role}`, `params`) and casts it to `APIContext`. Import the handler from the
  route module and call it: `const res = await POST(buildApiContext({...}))`.
- **Reference tests**: `tests/integration/api-authz.test.ts` (role × status
  matrix per route + CSRF + public funnel), `tests/integration/api-validation.test.ts`
  (bad-payload → 400 + no-DB-write), `tests/integration/api-context.smoke.test.ts`
  (harness self-check).
- **Run command**: `npm run test:integration`.
- **Conventions** (non-negotiable):
  - **Client ⇄ locals role consistency.** For an allow-path case the context
    must carry `supabase: as(role)` AND `role: role` AND a truthy `user` — all
    derived from one role argument so they can't drift. A mismatch passes the
    app gate but the DB RPC/RLS denies, testing the wrong layer. Mirror how
    middleware derives locals from the session.
  - **Deny assertions run through anon / `norole` contexts**, never
    `serviceClient()` — service-role bypasses RLS and would make a deny test
    pass falsely (same rule as §6.2).
  - **CSRF precedes auth.** Every mutation handler checks `Origin` first, so a
    foreign/missing `origin` → 403 regardless of role. `buildApiContext`
    defaults `origin` to `url.origin`; override it to test the CSRF branch.
  - **No-DB-write is verified by querying the DB back** through `serviceClient()`
    on the disposable scope — never trust the 4xx status alone.
  - **Accept each route's real anon status.** Vehicle routes return 401 for
    signed-out callers, reservation routes 403; assert the actual contract per
    route, not a normalized one (see
    `context/changes/testing-api-boundary-authz/finding-anon-status-inconsistency.md`).
  - **Allow/funnel cases own disposable rows** (dedicated id outside the seeded
    fleet, far-future dates) seeded + torn down via `serviceClient()`, per §6.2.

### 6.4 Adding a dashboard / availability state test

- TBD — see §3 Phase 3 (extend the pure busy-ranges → day-states mapping).

### 6.5 Adding a protocol email test

- TBD — see §3 Phase 4 (send path + photo attachment correctness, captured transport).

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2–3 line note
here capturing anything surprising the rollout phase taught.)

- **Phase 1 (data-layer integrity, 2026-06-30):** Risk #1 was not hypothetical —
  the harness confirmed a live PII leak (F1): `authenticated` held an implicit
  schema-wide `SELECT` grant on `reservations` (contrary to a migration
  comment), so any logged-in user — even one with no `profiles` row — read every
  customer's name/email/phone directly off the table. Fixed in-phase by revoking
  SELECT + dropping the `using(true)` policy (migration
  `20260630120000_reservations_revoke_select_grant.sql`). See
  `context/changes/testing-data-layer-integrity/finding-rls-pii-leak.md`. The
  `norole` (role-null) fixture is the sharpest probe for this class of hole.
- **Phase 2 (API boundary, 2026-06-30):** Risks #4/#5 were regression guards, not
  bug hunts — every route already self-gates and applies its schema. The load-
  bearing fact: `/api/*` is entirely outside middleware (`ROUTE_ROLES` lists only
  `/dashboard*`), so the per-route gate is the _only_ protection — tests invoke
  handlers directly via a constructed `APIContext` (`tests/helpers/context.ts`),
  not over HTTP. One real inconsistency surfaced (F2): vehicle routes return 401
  for signed-out callers, reservation routes 403 — same protection, different
  status; documented as a deferred product decision, not normalized. See
  `context/changes/testing-api-boundary-authz/finding-anon-status-inconsistency.md`.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5, plus the
challenger pass). Future contributors should respect these unless the
underlying assumption changes.

- **shadcn/ui primitives (`src/components/ui/`)** — vendored; the upstream is the test. Re-evaluate if a primitive is forked and customized. (Source: Phase 2 interview Q5.)
- **Marketing / static-layout Astro pages** — snapshot tests churn and catch nothing. Re-evaluate if a static page gains real logic. (Source: Phase 2 interview Q5.)
- **Dev-only Tailwind/ClientRouter CSS staleness** — known, accepted, prod-unaffected. (Source: `context/foundation/known-issues.md`.)
- **Rate-limiting / abuse mitigation on the public reservation endpoint** — unimplemented today; a test would require building the safeguard first. Flag as a product gap, not a test. Re-evaluate if rate limiting is added. (Source: challenger pass on the abuse lens.)
- **e2e for risks #1, #2, #4, #5** — each is already proven deterministically by a named suite in `tests/integration/` against real Postgres and real route handlers. A browser test would be slower, flakier, and would tell us nothing new. This is the half of the original exclusion that still holds. Re-evaluate only if a risk moves out of reach of the integration harness. (Source: challenger pass; re-affirmed 2026-07-09.)
- **Vision / agent layers on RLS, overlap, or authz** — never put a vision or agent layer where deterministic integration gives the cheaper, stronger signal. Unchanged. (Source: challenger pass; §4 grounding.)
- **Pixel/visual regression** — if it is ever wanted, use a deterministic tool (`toMatchSnapshot`, Argos, Lost Pixel), not a vision model. (Source: §4 grounding.)

> **Amended 2026-07-09 — e2e is no longer deferred wholesale.** The original
> exclusion rested on two reasons. The first (integration covers RLS/overlap/authz
> more cheaply) is still true and is preserved above. The second ("Playwright MCP
> is not wired") no longer holds: Playwright is installed, `storageState` auth is
> wired, and Playwright CLI is available. Its own re-evaluation condition —
> _"re-evaluate if … Playwright MCP is added"_ — was therefore met.
>
> A standalone `/10x-e2e` run then applied the browser-level gate to all six
> risks. Only **risk #6** survived it, and only its _rendered composition_: the
> pure `busyRanges → dayStates` derivation is unit-covered
> (`src/lib/availability.test.ts`), but nothing proved the hydrated calendar
> actually consumes it — and finding F1 of the S-02 Phase-6 review shipped exactly
> that bug. `e2e/seed.spec.ts` now covers it, verified by deliberately breaking
> the production behavior in both directions and confirming the test goes red.
>
> This does not promote e2e generally. §1 principle #1 stands: the cheapest test
> that gives a real signal wins. Risk #3 remains untestable at any layer until
> S-05 ships (see §3 Phase 4).

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-07-09 (§4 e2e + AI-native rows, §5 e2e gate)
- Stack versions last verified: 2026-07-09 (Playwright ^1.61.1, Playwright CLI 0.1.15)
- AI-native tool references last verified: 2026-07-09
- Cookbook (§6) last extended: 2026-06-30 (Phase 2 → §6.3 API-route recipe). No e2e recipe yet — `e2e/e2e-rules.md` + `e2e/seed.spec.ts` serve that role until an e2e rollout phase exists.

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
