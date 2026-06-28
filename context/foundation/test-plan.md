# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-27 (Phase 1 → change opened)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/` (hand-written app code),
with `supabase/migrations/` tracked separately for RLS churn.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | An employee, wrong-role, or anonymous caller reads customer PII (names, phones, emails, protocol photos) they shouldn't — an RLS gap | High | High | PRD Access Control + Guardrail #2; interview Q1, Q4; hot-spot dir `supabase/migrations/` (13 files/30d); lessons.md (RLS policies actively churned) |
| 2 | A double-booking slips through — two confirmed reservations overlap on one vehicle, or the same-day changeover buffer is off-by-one | High | High | PRD FR-005 / Guardrails / Business Logic; interview Q3; hot-spot dir `src/lib/services/` (11 commits/30d), `src/lib/` (39 commits/30d); roadmap S-02a |
| 3 | A handover protocol email fails silently or carries wrong/missing photos — the customer gets nothing, or bad dispute evidence | High | Medium | PRD FR-008 / US-02; interview Q1; roadmap S-05/S-06 (slice not yet built — phase activates when it ships) |
| 4 | IDOR / broken authorization — an authed-but-wrong-role caller or crafted request reaches a reservation/protocol/vehicle resource (including the public `/r/[token]` link) without an ownership/role check | High | Medium | PRD Access Control; hot-spot dir `src/pages/api/` (11 commits/30d), `src/pages/` (11 commits/30d); abuse lens (authorization/IDOR) |
| 5 | Server-side validation bypass — a request crafted to skip the client (bad dates, overlapping range, malformed fields, invalid vehicle id) is accepted by the API | High | Medium | PRD FR-004 / FR-005; interview Q3; hot-spot dir `src/pages/api/` (11 commits/30d); abuse lens (input parity) |
| 6 | The dashboard shows wrong reservation/availability state — calendar/queue render stale or incorrect day-states (phantom availability, overdue not flagged, accepted booking not blocking) → an employee accepts a conflict | Medium | High | interview Q3; hot-spot dir `src/components/dashboard/` (15 commits/30d) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | anon + employee + admin clients each get exactly the rows policy allows; a wrong-role SELECT returns 0 PII rows | "logged in" ≠ "allowed to read this"; a `STABLE SECURITY DEFINER` helper ≠ enforced access | every table's per-role × per-operation policy; which client (anon vs service-role) each path uses | integration vs real local Postgres with RLS | asserting policy SQL text instead of observed row access; a service-role client masking the gap |
| #2 | a second overlapping reservation is rejected at the DB; same-day return-10:00 / pickup-14:00 turnover is *allowed* | a green insert means "no conflict"; the existing pure-rule unit test already covers the DB constraint | the overlap constraint + the service insert path; the half-open window boundaries | integration (constraint via service) + existing unit on the rule | oracle copied from the rule's own code; testing only the helper, not the DB constraint |
| #3 | email send is attempted, failures surface (not swallowed), and the payload carries the correct photos | a 200 from the provider ≠ correct attachments; "sent" ≠ "received correct" | the send path + attachment assembly once S-05 lands; the transport seam to fake | integration with a captured/fake transport + contract on the payload | mocking the transport so deeply nothing real is asserted; happy-path-only |
| #4 | each protected route denies anon + wrong-role + cross-resource access by id/token | a route "is protected" ≠ "checks ownership"; a middleware gate ≠ a per-resource check | the middleware coverage map; which routes check role vs ownership; the `/r/[token]` scope | integration (API route auth matrix) | testing only the happy authed path; trusting middleware to cover IDOR |
| #5 | the API rejects payloads the client would block (bad dates, overlap, bad id) with a clean 4xx and no DB write | client-side zod ≠ server enforcement; importing the schema ≠ applying it server-side | where the shared schema is actually parsed server-side; the reject path | integration (API route) — the schema unit test already exists | re-asserting the zod schema in isolation (already covered) instead of the route applying it |
| #6 | day-states / availability derived for the calendar match the server overlap rule exactly (no phantom availability; overdue flagged) | UI greying matches the server rule (the known calendar↔catalog asymmetry) | the busy-ranges → day-states derivation; the overdue computation | unit on the extracted pure mapping (extend the existing calendar map test) + a thin component check | snapshot-without-meaning on the calendar; asserting rendered DOM over the derivation logic |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Data-layer integrity harness + RLS/overlap | Stand up the integration harness vs local Supabase (anon/employee/admin clients); prove no role reads PII it shouldn't and the overlap constraint rejects double-bookings incl. same-day turnover | #1, #2 | integration | change opened | context/changes/testing-data-layer-integrity/ |
| 2 | API boundary: authz + input parity | Prove API routes deny wrong-role/anon/IDOR access and reject server-side when the client is bypassed | #4, #5 | integration, contract | not started | — |
| 3 | Dashboard & availability state | Prove the calendar/queue derive correct day-states and availability (no phantom availability, overdue flagged) | #6 | unit + thin component | not started | — |
| 4 | Protocol email & photo integrity | Prove the handover email sends, fails loudly, and carries the correct photos | #3 | integration, contract | not started | — |
| 5 | Quality-gates wiring | Wire unit + integration into CI as a required gate (CI is lint+build only today); recommend a local post-edit hook | cross-cutting | gates | not started | — |

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

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | ^4.1.8 | configured; `npm test` = `vitest run`. 9 unit files, all in `src/lib/` (pure helpers). Components/pages/API/services/RLS untested |
| DB integration harness | local Supabase (`npx supabase start`) + supabase-js clients | n/a | none yet — see §3 Phase 1. Needs anon/employee/admin clients against a seeded test DB to exercise RLS + the overlap constraint for real |
| API route integration | Vitest + Astro route handlers | ^4.1.8 | none yet — see §3 Phase 2. Routes export `GET`/`POST`; test request → response + DB side-effect |
| e2e | Playwright (or Cypress) | — | none yet — deferred (see §7). The DOM is reachable, but integration covers the booking/auth logic more cheaply |
| accessibility | axe-core | — | none yet — not prioritized in this rollout |
| (optional) AI-native | Playwright MCP — checked: 2026-06-27 | n/a | **not available in current session.** When NOT to use: never put a vision/agent layer on RLS, overlap, or authz — deterministic integration gives the cheaper, stronger signal |

**Stack grounding tools (current session):**
- Docs: Context7 — available; can ground Vitest 4 + Astro route + Supabase local-test setup at plan time; checked: 2026-06-27
- Search: Exa.ai — available; for current tool status / discovery only; checked: 2026-06-27
- Runtime/browser: Playwright MCP — not available in current session; e2e would need wiring as its own future phase; checked: 2026-06-27
- Provider/platform: no Supabase/GitHub MCP this session; repo uses `gh` CLI + `npx supabase` locally + Cloudflare Workers deploy; checked: 2026-06-27

Use docs MCPs for current framework/library APIs and setup details. Use
search MCPs for discovery or current status only, then prefer official docs
as the evidence. Do not use MCP docs/search to infer code failure anchors;
those belong in per-phase `/10x-research`.

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is planned.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required (wired today) | syntactic / type drift |
| unit | local + CI | required after §3 Phase 1 | logic regressions in pure helpers |
| integration (RLS + overlap + API) | local + CI | required after §3 Phase 2 | PII leaks, double-bookings, authz/validation bypass |
| post-edit hook | local (agent loop) | recommended after §3 Phase 5 | regressions at edit time |
| e2e on critical flows | CI on PR | optional (deferred — see §7) | broken booking/auth user paths |
| visual diff / multimodal review | CI on PR | optional | rendering regressions classic tests miss |
| pre-prod smoke | between merge + prod | optional | environment-specific failures |

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

- TBD — see §3 Phase 1 (RLS per-role × per-operation denial + overlap-constraint rejection vs local Supabase).

### 6.3 Adding an API route integration test

- TBD — see §3 Phase 2 (authz matrix + server-side validation parity).

### 6.4 Adding a dashboard / availability state test

- TBD — see §3 Phase 3 (extend the pure busy-ranges → day-states mapping).

### 6.5 Adding a protocol email test

- TBD — see §3 Phase 4 (send path + photo attachment correctness, captured transport).

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2–3 line note
here capturing anything surprising the rollout phase taught.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5, plus the
challenger pass). Future contributors should respect these unless the
underlying assumption changes.

- **shadcn/ui primitives (`src/components/ui/`)** — vendored; the upstream is the test. Re-evaluate if a primitive is forked and customized. (Source: Phase 2 interview Q5.)
- **Marketing / static-layout Astro pages** — snapshot tests churn and catch nothing. Re-evaluate if a static page gains real logic. (Source: Phase 2 interview Q5.)
- **Dev-only Tailwind/ClientRouter CSS staleness** — known, accepted, prod-unaffected. (Source: `context/foundation/known-issues.md`.)
- **Rate-limiting / abuse mitigation on the public reservation endpoint** — unimplemented today; a test would require building the safeguard first. Flag as a product gap, not a test. Re-evaluate if rate limiting is added. (Source: challenger pass on the abuse lens.)
- **AI-native / vision / agent e2e layers** — deferred; classic integration covers RLS/overlap/authz more cheaply, and Playwright MCP is not wired. Re-evaluate if a DOM-unreachable surface appears or Playwright MCP is added. (Source: challenger pass; §4 grounding.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-27
- Stack versions last verified: 2026-06-27
- AI-native tool references last verified: 2026-06-27

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
