---
date: 2026-08-01T15:46:11+02:00
researcher: MarcinK
git_commit: d660f27b9875dbc611d868528f5338b094a309c6
branch: testing-quality-gates-wiring
repository: car-rental
topic: "Wire unit + integration suites into CI as a required gate (test-plan Phase 5: Quality-gates wiring)"
tags: [research, codebase, ci, quality-gates, integration-tests, supabase, github-actions, branch-protection]
status: complete
last_updated: 2026-08-01
last_updated_by: MarcinK
---

# Research: Quality-gates wiring — run unit + integration in CI as a required gate

**Date**: 2026-08-01T15:46:11+02:00
**Researcher**: MarcinK
**Git Commit**: d660f27b9875dbc611d868528f5338b094a309c6
**Branch**: testing-quality-gates-wiring
**Repository**: car-rental

> Note: this branch is not pushed and `d660f27` is not on `origin`, so file
> references below are **local paths**, not GitHub permalinks.

## Research Question

Ground rollout Phase 5 of `context/foundation/test-plan.md` ("Quality-gates
wiring"), a cross-cutting _gates_ phase whose deliverable is CI configuration,
not a per-risk test. The goal: make the existing unit + integration suites run
as a **required gate on every PR to `main`**, closing the gap that bypassable /
fail-open local hooks leave (test-plan §5 "unit + integration = local + CI"; the
local post-edit hook half is already shipped). Verify — not blindly accept — the
plan's claims that CI is the right enforcement layer and that the local hooks are
bypassable + fail-open; identify the cheapest _reliable_ way to run the
integration suite (which needs local Supabase) in GitHub Actions; flag flakiness
/ cost risks.

## Summary

- **CI today runs no tests.** `.github/workflows/ci.yml` runs `npm ci → astro sync
→ lint → build` only, on push/PR to `main` (`ci.yml:4-24`). This is the whole
  gap. Both the unit gate ("required after Phase 1") and the integration gate
  ("required after Phase 2") from test-plan §5 are still unwired in CI
  (`test-plan.md:118-128`).
- **The test-plan's enforcement-gap claims are all CONFIRMED against the code:**
  - `.husky/pre-push` runs the full integration suite but **fails open** — it
    TCP-probes Supabase on `:54322` and `exit 0`s (skips, never blocks) when the
    DB is unreachable (`pre-push:16-20`), and is `--no-verify`-bypassable
    (stated in its own header, `pre-push:14`).
  - `.husky/pre-commit` runs only **lint-staged** — `eslint --fix` +
    `vitest related --run --project unit` on _staged_ `*.{ts,tsx}` — plus
    `astro check` (`pre-commit:1-6`, `package.json:82-92`). It runs _related_
    unit tests on changed files, **never the full unit suite and never
    integration**, and is likewise `--no-verify`-bypassable.
  - The **post-edit hook already shipped** is `.claude/settings.json`
    `PostToolUse (Write|Edit)`: `eslint --fix` on `*.{ts,tsx,astro}` and
    `vitest related --run --project unit` on `*src/lib/*.ts` only. Agent-loop
    local only; never runs integration.
  - **Net:** no layer anywhere runs the _full_ `npm test` unit suite, and no
    non-bypassable layer runs integration at all. CI is genuinely the only place
    that closes this — the plan's framing holds.
- **But "required gate" has a second half the repo does not address.** A CI
  _job_ running is not the same as _blocking merge_. That requires GitHub
  **branch protection / required status checks**, which live in repo settings,
  **outside the tree**. A codebase-wide search for "branch protection" /
  "required check" / "required status check" returns **zero hits**
  (`context/**`). The change intent ("cannot merge without those suites
  executing", `change.md:14`) is only true once the new checks are marked
  required — an out-of-band GitHub-settings step (needs admin), not just a YAML
  edit. **This is the load-bearing planning caveat.**
- **Running the integration suite in CI is well-understood and cheap-ish.**
  `supabase start` needs Docker, which is preinstalled on `ubuntu-latest`; a
  **fresh runner has no `supabase_db_<project_id>` volume, so `supabase start`
  applies all 23 migrations and runs `seed.sql` automatically** (`[db.seed]
enabled=true`, `config.toml:60-65`) — no separate `supabase db reset` needed.
  Credentials come from `supabase status -o env` (the suite needs `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`); **no repo secrets required**
  for the integration job (unlike the build job, which uses `SUPABASE_URL/KEY`
  secrets). `dotenv` won't clobber real `process.env`, so exporting the three
  vars into the job env is enough — no `.env.test` file, and its absence is a
  no-op (`setup.ts:9`).
- **The suite needs the FULL local stack, not DB-only.** ~80 real
  `signInWithPassword` calls hit **GoTrue**, and five suites upload/download real
  objects to the **`protocols` Storage bucket** (created by
  `20260710120000_issue_protocol.sql:191`). So Postgres + Kong/API (`:54321`) +
  Auth + PostgREST + **Storage** must be up. Realtime, Studio, Inbucket,
  edge-runtime, and analytics (logflare+vector) are **unused by any test** and
  can be excluded to cut cold-start and flakiness.
- **Recommended shape:** add a full unit-test step to the existing fast job, and
  add a **separate `integration` job** (Supabase + `npm run test:integration`).
  Make both required via branch protection. Cheapest reliable cost driver is the
  Docker image pull (~1.5–3 min) + serial suite (~a few min).

## Detailed Findings

### A. Current CI state — the gap

`.github/workflows/ci.yml`:

- Triggers: `push` and `pull_request` to `main` (`ci.yml:4-7`). (A prior change
  already fixed a stale `master` target → `main`; see Historical Context.)
- Steps: `actions/checkout@v4` → `actions/setup-node@v4` (node 22, `cache: npm`)
  → `npm ci` → `npx astro sync` → `npm run lint` → `npm run build` with
  `SUPABASE_URL` / `SUPABASE_KEY` from repo secrets (`ci.yml:13-24`).
- **No test step. No Postgres/Supabase service.** This is the entire deliverable
  gap for Phase 5.

test-plan §5 quality-gate table (`test-plan.md:116-128`):

- `unit` → local + CI → "required after §3 Phase 1" (Phase 1 is `complete`).
- `integration (RLS + overlap + API)` → local + CI → "required after §3 Phase 2"
  (Phase 2 is `complete`).
- Prose confirms: "CI today (`.github/workflows/ci.yml`) runs `astro sync` + lint
  - build only; the unit and integration gates are wired by §3 Phase 5"
    (`test-plan.md:126-128`).
- `e2e` → "local (CI: §3 Phase 5) | optional — green locally, not enforced".
  **Scope note:** this phase wires **unit + integration only.** e2e stays
  optional/local (§5); the one Playwright spec (`e2e/seed.spec.ts`, risk #6's
  rendered calendar) is out of scope for the _required_ gate.

### B. The enforcement gap — local hooks verified

**`.husky/pre-commit`** (`pre-commit:1-6`):

```
npx lint-staged
# then, only when staged files match \.(ts|tsx|astro)$:
npx astro check
```

`lint-staged` config (`package.json:82-92`): `*.astro → eslint --fix`;
`*.{ts,tsx} → eslint --fix, vitest related --run --project unit
--passWithNoTests`; `*.{json,css,md} → prettier --write`. So pre-commit runs
**related unit tests on staged files only** — not the full unit suite, not
integration. Bypassable with `git commit --no-verify`.

**`.husky/pre-push`** (`pre-push:1-28`) — the "heavier tests" layer:

- Header explicitly defers the real gate: _"CI wiring is test-plan §3 Phase 5"_
  and documents the emergency bypass `git push --no-verify` (`pre-push:14`).
- **Fails open:** probes `net.connect(54322)` and on timeout/error prints a skip
  note and `exit 0` — "never block an unrelated push" (`pre-push:16-20`).
- When the DB _is_ reachable: runs `npm run test:integration` and blocks the push
  on failure (`pre-push:22-28`).
- Confirms it "subsumes the earlier anon-grant-only hook" — the
  `security-definer-anon-guardrail.test.ts` now runs inside the full suite.

**Post-edit hook (already shipped)** — `.claude/settings.json`
`hooks.PostToolUse`, matcher `Write|Edit`:

1. `eslint --fix "$FILE" --quiet` for `*.ts|*.tsx|*.astro` (no tests).
2. `AI_AGENT=1 … vitest related "$FILE" --run --project unit` for `*src/lib/*.ts`
   only — the sole test-running hook, unit-project only, agent-loop only.

This is test-plan §5's "post-edit hook | local (agent loop) | recommended after
§3 Phase 5" (`test-plan.md:121`). **It is the "local half already shipped."**

**Conclusion:** the plan's claim that CI is the right (and only non-bypassable)
enforcement layer is correct. A subtle bonus: because every hook uses
`vitest related`, the **full** unit suite (`npm test`) never runs locally either
— CI is the only place a complete unit run would happen.

### C. What the suites are, and what the integration suite needs

Vitest two-project config (`vitest.config.ts`):

- `unit` — `src/**/*.test.ts`, node env, DB-free, parallel. `npm test` =
  `vitest run --project unit` (`package.json:13`). Test-plan §4 notes 9 unit
  files, all pure helpers in `src/lib/`.
- `integration` — `tests/integration/**/*.test.ts`, node env,
  `setupFiles: tests/integration/setup.ts`, **`fileParallelism: false`** (serial
  — the GiST `EXCLUDE` overlap constraint makes concurrent reservation writes
  collide, `vitest.config.ts:12-14,40-48`). `npm run test:integration` =
  `vitest run --project integration` (`package.json:14`).
- Vitest **stubs** `astro:env/server` and `astro:middleware`
  (`vitest.config.ts:16-26`), so the integration job does **not** need
  `npx astro sync`.

**Bootstrap (`tests/integration/setup.ts`):**

- Loads `.env.test` via `dotenv.config({ path: ".env.test" })` — **relative to
  cwd**, so CI must run from the repo root (`setup.ts:9`).
- Requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`;
  throws an actionable error if any is missing (`setup.ts:11-21`).
- **No `globalSetup`/`globalTeardown`** anywhere — it does _not_ start Supabase,
  migrate, or seed. That is out-of-band before `npm run test:integration`.
- `dotenv` does not overwrite existing `process.env`, and a missing `.env.test`
  is a no-op → **in CI, just export the three vars into the job env**.

**Test clients (`tests/helpers/clients.ts`):**

- `anonClient()` (`:38-40`) — anon/publishable key, sessionless (the
  unauthenticated caller).
- `as(role)` (`:47-55`) — signs in a **seeded** user via `signInWithPassword` to
  get a real `authenticated` JWT; throws on failure. **JWTs are obtained by
  signing in seeded users, not minted.**
- `serviceClient()` (`:61-63`) — service-role key, bypasses RLS, setup/teardown
  only.
- Seeded credentials (`:27-31`): `admin@fleetrent.test`,
  `employee@fleetrent.test`, `norole@fleetrent.test` (the last deliberately has
  **no `profiles` row** → `current_app_role()` NULL, the fail-closed probe).

**Direct Postgres (`tests/helpers/db.ts`):** one suite
(`security-definer-anon-guardrail.test.ts`) connects directly via the `postgres`
npm dep to `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (`db.ts:24`),
overridable with `SUPABASE_DB_URL` (`db.ts:38`). Standard `supabase start`
already satisfies this.

**Email (`tests/helpers/email.ts`):** the email transport is faked in-process via
`setEmailAdapter` (`captureEmails()`, `failEmails()`), so **no SMTP / Inbucket is
needed** by tests.

**Seed + migrations dependency:** the suite depends hard on `supabase db reset`
state — 23 migrations under `supabase/migrations/` **plus** `supabase/seed.sql`
(`[db.seed] enabled=true`, `config.toml:60-65`). Seed inserts staff into
`auth.users` + `public.profiles` (signup is disabled, `config.toml:184`), fixed
vehicle UUIDs `1111…`–`7777…`, reservations `R-0001…R-0004`, and returns/protocol
baselines. Several migrations are the exact behavior under test
(`20260714120000_rpc_execute_grant_hardening.sql`,
`20260731…_current_app_role_revoke_anon.sql`, etc.).

**Suite heaviness:** 18 files, ~160 `it` blocks, run **serially**. No artificial
waits/timers — wall time is dominated by ~80 real GoTrue sign-ins and Storage
round-trips (five protocol suites). Heaviest: `returns-rls.test.ts` (24 `it`),
`api-authz.test.ts` (29), `api-validation.test.ts` (12). `staff.test.ts` also
exercises the **admin API** (`auth.admin.createUser/deleteUser`).

**What a CI runner needs for `npm run test:integration` to pass:**

1. Full Supabase stack up: Postgres `:54322`, API/Kong `:54321` (fronts
   PostgREST + GoTrue + Storage). DB-only is insufficient.
2. All 23 migrations + `seed.sql` applied (automatic on fresh `supabase start`).
3. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in the job
   env (from `supabase status`).
4. Direct Postgres at `:54322` (satisfied by the stack) or `SUPABASE_DB_URL`.
5. `npm ci` (installs `postgres` + `supabase` devDeps). No `astro sync` needed.
6. No external email/SMTP.

### D. Running Supabase in GitHub Actions (Context7-grounded)

- **Docker:** `supabase start` requires Docker; **Docker is preinstalled on
  `ubuntu-latest`** → no `services:` block needed.
- **CLI:** two options. (a) `npx supabase …` after `npm ci` — reuses the exact
  pinned `^2.23.4` from the lockfile, mirroring the local pre-push gate, zero
  extra actions. (b) `supabase/setup-cli@v1` with `version: 2.23.4` — a native
  version-pinned binary independent of node_modules. **Lean (a)** to guarantee
  CI == local; (b) is a fine alternative.
- **Migrations + seed are automatic on a cold runner.** Context7 (`/supabase/cli`,
  `internal/db/start/start.go`): on a fresh volume `StartDatabase` sets
  `NoBackupVolume=true` then `SetupLocalDatabase` applies migrations and runs the
  seed. A separate `supabase db reset` is redundant insurance on a cold runner.
- **Credentials:** `supabase status -o env` prints shell-ready `KEY=value` lines.
  The robust, version-insensitive path is to emit env and rename to the three
  names `setup.ts` wants (the default keys are `ANON_KEY` / `SERVICE_ROLE_KEY` /
  `API_URL`; `--override-name` also works but the dotted key names should be
  verified against the pinned CLI's output). Append to `$GITHUB_ENV`.
- **Slim the stack** (biggest speed + reliability win) without editing the
  committed `config.toml` (which would also change local dev) — use the runtime
  exclude flag, keeping `storage-api` in:
  `supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,inbucket`.
  Analytics (logflare + vector) is the most common slow/flaky boot; Studio,
  Inbucket, edge-runtime, Realtime are unused by any test. **Verify the exact
  excludable service names on CLI 2.23.4 (`supabase start --help`) before
  committing the flag list.**
- **No repo secrets for the integration job** — keys come from the local stack.

### E. The "required gate" = branch protection (out-of-tree)

- The workflow running on PRs is necessary but **not sufficient** to block a
  merge. GitHub only blocks a merge on a red check when that check is a
  **required status check** under branch-protection (or a ruleset) on `main`.
- **Zero references** to branch protection / required checks exist in
  `context/**` or the workflow — this enforcement is not configured or documented
  anywhere. It is a **GitHub repo-settings action requiring admin**, not a YAML
  change.
- Practical consequence for the plan: the deliverable has two parts — (1) the
  CI job(s) [in-repo, this change], and (2) marking them required on `main`
  [repo settings, likely a manual step by the repo admin]. If the job names
  change later, the required-check name must be updated too. The plan should
  name part (2) explicitly and decide who does it / how it's recorded (e.g. a
  note in `infrastructure.md` or a checklist item), since it can't be committed.
- Related: making a new job "required" while it's still flaky will **block all
  merges**. Sequence: land the job, watch it green on a few PRs, _then_ mark it
  required.

### F. Verifying the test-plan's risk-response intent

The change intent says the gate protects risk classes #1 PII/RLS, #2 overlap,
#4 IDOR/authz, #5 input parity, #6 dashboard, #3 protocol email. Mapping to what
the suites actually prove (all already `complete` phases):

- #1/#2 → `reservations-rls.test.ts`, `returns-rls.test.ts`,
  `protocols-rls.test.ts`, `reservations-overlap.test.ts`, plus the
  anon-guardrail/grant suites (**integration**).
- #4/#5 → `api-authz.test.ts`, `api-validation.test.ts`, `pages-authz.test.ts`
  (**integration**).
- #3 → `protocol-email.test.ts`, `return-protocol-email.test.ts`,
  `protocols-api.test.ts`, `return-protocols-api.test.ts` (**integration**).
- #6 → the pure `busyRanges → dayStates` derivation is **unit**
  (`src/lib/availability.test.ts`); its _rendered_ composition is the one **e2e**
  spec, which stays optional/local (§5) — **not** part of this required gate.

So wiring **unit + integration** into CI does cover #1–#5 and the unit half of
#6. The intent is sound; the only nuance is that #6's rendered-calendar guarantee
is e2e and therefore out of the enforced gate's scope by design.

## Code References

- `.github/workflows/ci.yml:4-24` — current CI: triggers `main`; lint + build,
  no tests, no DB.
- `.husky/pre-commit:1-6` — lint-staged + conditional `astro check`.
- `.husky/pre-push:16-20` — fail-open skip when Supabase `:54322` unreachable;
  `:22-28` run + block; `:14` `--no-verify` bypass.
- `.claude/settings.json` — PostToolUse `Write|Edit`: eslint + `vitest related`
  (`src/lib/*.ts`, unit only) — the shipped local half.
- `package.json:13-14` — `test` / `test:integration` scripts; `:82-92`
  lint-staged; `:69` `postgres`; `:73` `supabase ^2.23.4`.
- `vitest.config.ts:16-26` — astro virtual-module stubs; `:40-48` integration
  project; `:47` `fileParallelism: false`.
- `tests/integration/setup.ts:9,11,15-21` — `.env.test` load + required-vars
  fail-fast.
- `tests/helpers/clients.ts:27-31,38-40,47-55,61-63` — seeded creds, anon /
  `as(role)` / service clients.
- `tests/helpers/db.ts:24,38` — direct PG `:54322`, `SUPABASE_DB_URL` override.
- `tests/helpers/email.ts` — in-process email fake (no SMTP).
- `supabase/config.toml:5` project_id; `:7-10` api; `:27-29` db; `:60-65` seed;
  `:88-91` studio; `:99-102` inbucket; `:109-110` storage; `:402-404` analytics.
- `supabase/migrations/20260710120000_issue_protocol.sql:191` — `protocols`
  Storage bucket.
- `context/foundation/test-plan.md:73` Phase 5 row; `:116-128` §5 gates.
- `context/foundation/infrastructure.md:80,104` — build-time `SUPABASE_URL/KEY`
  repo secrets.
- `context/foundation/health-check.md:185-188,204` — "add test step to CI"
  recommendation.

## Architecture Insights

- **The whole change is CI/YAML + one repo-settings step; no app code.** The
  suites, harness, env contract, and seed already exist and are green locally.
- **Two natural jobs, split by cost:** unit (`npm test`, DB-free, fast — can be a
  step on the existing lint+build job) vs integration (needs the Supabase stack —
  its own job). Splitting keeps a Docker/DB flake from masking a lint/build fail
  and lets the fast checks report quickly.
- **CI mirrors the local pre-push gate**, minus the fail-open: same
  `npm run test:integration` against the same stack, but a red check is
  authoritative instead of skippable. Using `npx supabase` (lockfile-pinned)
  keeps CI == local exactly.
- **Determinism comes free from ephemerality:** a fresh runner volume every run
  means migrations + seed are re-applied identically; the suite's own disposable
  far-future data scope + serial execution already handle isolation.
- **The gate's teeth are in GitHub settings, not the repo.** The most
  overlooked-yet-load-bearing part is marking the checks _required_ on `main` —
  without it, the change ships a workflow that runs but doesn't actually block a
  merge, which would silently under-deliver the change's stated intent.

## Historical Context (from prior changes)

- **Phase 1 — data-layer integrity** (`context/archive/2026-06-27-testing-data-layer-integrity/`):
  built the harness Phase 5 runs (two-project split, `tests/helpers/clients.ts`,
  `.env.test` loader, `norole` fixture). **Explicitly deferred CI to Phase 5** and
  kept `npm test` DB-free "so today's CI stays green" (`plan.md:131-132`,
  `research.md:160`).
- **Phase 2 — API boundary authz** (`context/archive/2026-06-30-testing-api-boundary-authz/`):
  added `api-authz` / `api-validation` / smoke suites into the same integration
  project; run/verify gated on `npx supabase start` + `db reset` + `npm run
test:integration`. _(test-plan §3 / §6.3 still cite the pre-archive
  `context/changes/testing-api-boundary-authz/` path — stale; real location is
  the archive.)_
- **Phase 4 — issue/protocol email** (`context/archive/2026-07-09-issue-protocol/`):
  added protocol email/photo integration tests; states "CI runs no tests …
  Phase-4 tests run locally until test-plan Phase 5 wires the gate"
  (`research.md:266`). Also corrected a stale "CI targets master" claim →
  confirmed `main` (`ci.yml:5-7`). _(test-plan §3 cites the pre-archive
  `context/changes/issue-protocol/` path — stale.)_
- **Deployment change** (`context/archive/2026-05-29-deployment/`): fixed the CI
  branch `master → main` (commit `eafadad`) "so PR/build checks actually run. (CI
  stays build-only; deploy is handled by Cloudflare.)"
- **CI-related commits:** `fb19dcb` (add GitHub Actions CI workflow),
  `cc0bfeb` (astro sync before lint), `eafadad` (branch → main). The local-hook
  half of this gate landed across `14a31a6` / `57f24a9` / `abda1cc` (post-edit
  hooks) and `1b9cded` (pre-push integration gate + lint-staged unit split).
- **health-check.md:185-188,204** already flags "CI covers lint and build but not
  tests" and recommends wiring the runner into CI — corroborates this phase.

## Related Research

- `context/archive/2026-06-27-testing-data-layer-integrity/research.md` — harness
  - local-Supabase setup; original CI deferral.
- `context/archive/2026-07-09-issue-protocol/research.md` — protocol suites; CI
  branch correction; local-only-until-Phase-5 note.
- `context/foundation/test-plan.md` §4–§5 — stack + gate matrix (source of truth
  for what "required" means per phase).

## Open Questions

1. **Branch protection / required checks (out-of-tree, needs admin).** Confirm
   who marks the new check(s) required on `main` and how it's recorded (it can't
   be committed). Decide the ruleset vs classic branch-protection path. Sequence:
   land green first, then require.
2. **One combined `test` job or two (unit + integration)?** Recommendation: add
   `npm test` to the existing fast job and add a separate `integration` job.
   Confirm this split at plan time.
3. **`npx supabase` vs `supabase/setup-cli@v1`.** Recommendation: `npx` (lockfile
   parity with local). Confirm.
4. **Exact `-x` service-exclude list on CLI 2.23.4.** Verify the excludable
   service names (`supabase start --help`) and that Storage stays in, before
   committing the flag list. Fallback: no `-x` (full stack) if names differ.
5. **`supabase status -o env` key names on 2.23.4.** Verify default keys /
   `--override-name` mapping to `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
   `SUPABASE_SERVICE_ROLE_KEY`; a shell-rename step is the version-safe fallback.
6. **Cost tolerance.** The integration job adds ~image pull (1.5–3 min) + serial
   suite (a few min) per PR. Acceptable? If cold-start proves slow/flaky,
   revisit service excludes before attempting Docker image caching (usually not
   worth it).
7. **e2e stays out of the required gate** (§5: optional/local). Confirm we are
   not wiring `test:e2e` in this phase.
