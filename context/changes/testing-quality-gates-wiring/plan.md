# Quality-Gates Wiring — CI unit + integration gate — Implementation Plan

## Overview

Wire the project's existing, already-green-locally **unit** and **integration**
test suites into GitHub Actions as gates on every PR to `main`, then enforce them
as **required status checks**. This is the CI half of test-plan §5 ("unit +
integration = local + CI"); the local post-edit hook half already shipped. No
application code changes — this is CI YAML plus one out-of-tree repo-settings
step.

## Current State Analysis

- `.github/workflows/ci.yml` runs `npm ci → astro sync → lint → build` on
  push/PR to `main` (`ci.yml:4-24`). **No test step, no database.**
- The local hooks that appear to "cover" tests are not a real gate:
  - `.husky/pre-commit` runs only `vitest related --project unit` on _staged_
    files (`package.json:82-92`) — never the full suite, and `--no-verify`-bypassable.
  - `.husky/pre-push` runs the full integration suite but **fails open** — it
    `exit 0`s when Supabase `:54322` is unreachable (`pre-push:16-20`) and is
    `--no-verify`-bypassable.
  - `.claude/settings.json` PostToolUse runs `eslint --fix` + `vitest related`
    (`src/lib/*.ts`, unit only) — the shipped local half, agent-loop only.
  - Net: no non-bypassable layer runs the full unit suite or any integration; CI
    is the only place that closes this.
- The integration suite (`tests/integration/`, 18 files, serial) needs the
  **full local Supabase stack**: Postgres `:54322`, API/Kong `:54321` fronting
  PostgREST + **GoTrue** (~80 real `signInWithPassword` calls) + **Storage** (the
  `protocols` bucket, created by `20260710120000_issue_protocol.sql:191`). It
  boots via `supabase start`, which on a **fresh runner** auto-applies all 23
  migrations + `seed.sql` (`[db.seed] enabled=true`, `config.toml:60-65`) — no
  separate `db reset`. It needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (`tests/integration/setup.ts:11`) and no repo
  secrets. Email is faked in-process (`tests/helpers/email.ts`) — no SMTP.
- The `supabase` CLI is a devDependency `^2.23.4` (`package.json:73`), so
  `npx supabase` runs the exact version the local pre-push gate uses.
- **Enforcement gap:** a workflow _running_ on a PR does not _block_ a merge —
  that needs GitHub **branch protection / required status checks** on `main`,
  which live in repo settings, outside the tree. A repo-wide search found **zero**
  references to branch protection / required checks (research.md §E).

## Desired End State

Every PR to `main` runs two checks: `ci` (lint + build + **unit**) and a new
`integration` job (boots slimmed Supabase, runs `npm run test:integration`).
Both are **required status checks** on `main`, so a PR cannot merge unless both
are green. The foundation docs (`test-plan.md` §5, `infrastructure.md`) reflect
the now-wired gates. Verify by: opening a PR and seeing both checks pass, and by
confirming `main`'s branch-protection lists both checks as required.

### Key Discoveries:

- CI today is lint+build only (`ci.yml:18-24`); test-plan §5 defers the gate to
  this phase (`test-plan.md:126-128`).
- Integration needs the full stack, not DB-only — GoTrue + Storage are load-
  bearing (research.md §C).
- `supabase start` on a cold runner applies migrations + seed automatically; no
  `db reset` step (research.md §D, Context7 `/supabase/cli`).
- Docker is preinstalled on `ubuntu-latest`; `supabase start` needs it — no
  `services:` block.
- `dotenv` won't clobber real `process.env`, and a missing `.env.test` is a
  no-op (`setup.ts:9`) → export the three vars into the job env; no file needed.
- Vitest stubs `astro:env/server` + `astro:middleware` (`vitest.config.ts:16-26`)
  → the integration job does **not** need `npx astro sync`.

## What We're NOT Doing

- **No application code changes.** The suites, harness, seed, and env contract
  already exist and pass locally.
- **Not wiring e2e** into the required gate — it stays optional/local per
  test-plan §5; the one Playwright spec is out of scope.
- **Not editing the committed `supabase/config.toml`** — slim the stack at
  runtime with `supabase start -x …` so local dev is unaffected.
- **Not adding Docker image caching** — accept the ~1.5–3 min pull; revisit only
  if the job proves consistently slow.
- **Not touching the local hooks** (pre-commit / pre-push / post-edit) — already
  shipped; CI is the non-bypassable complement.
- **Not backporting** the stale test-plan §3/§6.3 archive paths for the archived
  Phase 2/4 folders (surfaced in research.md) — that is `/10x-test-plan`
  reconciliation, tracked separately.

## Implementation Approach

Three phases, each independently verifiable. Phase 1 adds the fast, DB-free unit
step to the existing job and a workflow-level concurrency guard. Phase 2 adds the
heavier `integration` job that boots Supabase. Phase 3 proves both checks green on
a real PR, then enables the required-check enforcement (the out-of-tree half) and
updates the foundation docs. Enforcement is deliberately sequenced **after** green
so a still-settling integration job never blocks all merges.

## Critical Implementation Details

- **Credential export ordering.** `supabase status -o env` must run **after**
  `supabase start` completes, and its output must be remapped to the three names
  `setup.ts` requires before being written to `$GITHUB_ENV`. Because `dotenv`
  does not overwrite existing `process.env`, exporting these is sufficient and no
  `.env.test` file is created.
- **Verify the `-x` service list on CLI 2.23.4** (`supabase start --help`) before
  committing it — a wrong service name aborts the start. **Storage must stay in.**
- **No `astro sync` in the integration job** — Vitest stubs the Astro virtual
  modules, and adding sync only slows the job.
- **Sequence enforcement last.** Do not mark the checks required until they are
  observed green on a real PR, or a cold-start flake blocks every merge to `main`.

## Phase 1: Unit gate + workflow concurrency

### Overview

Make the existing `ci` job also run the full unit suite, and stop redundant
stacked runs with a workflow-level concurrency group.

### Changes Required:

#### 1. CI workflow — unit step + concurrency

**File**: `.github/workflows/ci.yml`

**Intent**: Add the DB-free unit suite to the existing lint+build job so a logic
regression fails the `ci` check, and add a workflow-level concurrency group so a
newer push cancels a superseded in-progress run.

**Contract**: A top-level `concurrency` block keyed by workflow + `github.ref`
with `cancel-in-progress: true`. A new `- run: npm run test` step in the `ci`
job, placed after `npm run lint` and before `npm run build` (fail fast on logic
before the heavier build). No new env or secrets — the unit project is DB-free.

### Success Criteria:

#### Automated Verification:

- Unit suite passes locally (the command CI will run): `npm test`
- Workflow YAML is valid: `actionlint .github/workflows/ci.yml` (or any YAML
  parser if actionlint is unavailable)
- Lint still passes: `npm run lint`

#### Manual Verification:

- On a PR, the `ci` check log shows the unit step running and passing.
- Two rapid pushes to the same branch: the earlier run shows as cancelled.

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Integration job

### Overview

Add a separate `integration` job that boots a slimmed local Supabase stack,
exports its credentials, and runs the integration suite — mirroring the local
pre-push gate but without the fail-open skip.

### Changes Required:

#### 1. CI workflow — integration job

**File**: `.github/workflows/ci.yml`

**Intent**: Add a new `integration` job (parallel to `ci`) that stands up
Supabase on the runner and runs `npm run test:integration` against it. Same
triggers as `ci`; no repo secrets (keys come from the local stack).

**Contract**: New job `integration` on `runs-on: ubuntu-latest` with steps:
`actions/checkout@v4` → `actions/setup-node@v4` (node 22, `cache: npm`) →
`npm ci` → start Supabase → export creds → `npm run test:integration` →
`supabase stop` guarded by `if: always()`. No `astro sync` step. The Supabase
start excludes services no test uses (keep Postgres/API/Auth/Storage):

```
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,inbucket
```

The credential-export step must remap `supabase status -o env` output to the
three names `setup.ts` requires and append them to `$GITHUB_ENV` (run the command
once locally to confirm the actual key names on CLI 2.23.4 — defaults are
`API_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY`):

```
# maps API_URL/ANON_KEY/SERVICE_ROLE_KEY -> SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY
npx supabase status -o env \
  | sed -e 's/^API_URL=/SUPABASE_URL=/' \
        -e 's/^ANON_KEY=/SUPABASE_ANON_KEY=/' \
        -e 's/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/' \
  >> "$GITHUB_ENV"
```

(`--override-name` is an alternative if the dotted key names are confirmed; the
`sed` remap is the version-safe fallback.)

### Success Criteria:

#### Automated Verification:

- Integration suite passes locally against local Supabase (the command CI runs):
  `npm run test:integration`
- Workflow YAML is valid: `actionlint .github/workflows/ci.yml` (or any YAML
  parser)
- The `-x` exclude list is accepted by the pinned CLI: `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,inbucket` starts with no "unknown service" error (then `npx supabase stop`)

#### Manual Verification:

- On a real PR, the `integration` check goes green; the job log shows
  `supabase start` applying migrations + seed, the suite passing, and
  `supabase stop` running at the end.
- Total added CI time is acceptable (cold-start ~1.5–3 min + serial suite).
- No repo secrets were needed for the job.

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Prove green + enforce + docs

### Overview

Prove both checks green on a real PR, enable the required-status-check
enforcement on `main` (the out-of-tree half), and update the foundation docs to
reflect the now-wired gates.

### Changes Required:

#### 1. Prove the gate on a real PR

**File**: (no file) — push the `testing-quality-gates-wiring` branch and open a
PR to `main`.

**Intent**: Confirm both `ci` (with unit) and `integration` run and pass on an
actual PR before anything is marked required.

**Contract**: A PR to `main` showing both checks green. The branch is not yet
pushed, so this is a real step (push + `gh pr create`).

#### 2. Enable required status checks (manual admin step)

**File**: (no file) — GitHub repo settings (branch protection or ruleset on
`main`).

**Intent**: Mark `ci` and `integration` as required status checks so a red check
blocks merging — delivering the change's "cannot merge without those suites
executing" intent.

**Contract**: Branch-protection / ruleset on `main` lists both check names as
required. This is a repo-admin action (cannot be committed); the plan records the
exact check names and steps. Do this only after step 1 shows green.

#### 3. Update foundation docs

**File**: `context/foundation/test-plan.md`, `context/foundation/infrastructure.md`

**Intent**: Make the docs match reality — the CI unit + integration gates are now
wired and required.

**Contract**: In `test-plan.md` §5, update the prose that says "CI today
(`.github/workflows/ci.yml`) runs `astro sync` + lint + build only; the unit and
integration gates are wired by §3 Phase 5" to reflect that they are now wired
(and the gate rows' "required after Phase N" become satisfied). In
`infrastructure.md`, add a short note that CI now runs a local Supabase
integration gate (no new secrets; keys come from the runner's local stack).
Record the required-check names + enablement steps (in `infrastructure.md` or the
change folder) so the manual step is reproducible.

### Success Criteria:

#### Automated Verification:

- `test-plan.md` no longer claims CI is lint+build only: `grep -n "lint + build only" context/foundation/test-plan.md` returns nothing (or the line now reads as wired).
- `infrastructure.md` mentions the integration CI job: `grep -ni "integration" context/foundation/infrastructure.md` shows the new note.

#### Manual Verification:

- Both `ci` and `integration` checks are green on the PR.
- `main` branch-protection lists `ci` and `integration` as required status checks
  (confirmed in repo settings).
- Spot-check (optional): a PR that deliberately breaks a test is blocked from
  merging until fixed.

**Implementation Note**: The required-status-check enablement (step 2) is a
manual repo-admin action performed by the user; the agent prepares everything up
to and including the green PR and the documentation.

---

## Testing Strategy

### Unit Tests:

- No new unit tests — this phase runs the existing `unit` project (`npm test`) in
  CI. The suite itself is the artifact under gate.

### Integration Tests:

- No new integration tests — this phase runs the existing `integration` project
  (`npm run test:integration`) in CI against a runner-local Supabase. Correctness
  of the gate = the existing suite passing in the CI environment.

### Manual Testing Steps:

1. Push the branch and open a PR to `main`; confirm both `ci` and `integration`
   checks appear and pass.
2. Inspect the `integration` job log: `supabase start` applied migrations + seed,
   the suite ran serially and passed, `supabase stop` ran.
3. After green, enable required checks on `main`; open a throwaway PR that breaks
   a test and confirm it is blocked from merging, then close it.

## Performance Considerations

- The `integration` job's dominant cost is the Docker image pull for
  `supabase start` (~1.5–3 min on a cold runner) plus the serial suite (a few
  min). Excluding unused services (`-x …`, esp. the analytics logflare+vector
  pair) is the main lever; image caching is deliberately out of scope.
- `concurrency: cancel-in-progress` prevents stacked long runs on rapid pushes.
- The `ci` job (lint+build+unit) stays fast and reports independently of the
  Docker-bound integration job.

## Migration Notes

- No data or schema migration. The runner uses an ephemeral, fresh Supabase
  volume each run, so migrations + seed are re-applied deterministically.
- If the integration job proves flaky before it is marked required, it blocks
  nothing — that is the reason for the land-green-then-require sequence.

## References

- Research: `context/changes/testing-quality-gates-wiring/research.md`
- Current CI: `.github/workflows/ci.yml:4-24`
- Enforcement gap (local hooks): `.husky/pre-push:16-20`, `.husky/pre-commit`,
  `.claude/settings.json`
- Integration harness: `tests/integration/setup.ts:11`, `tests/helpers/clients.ts`,
  `vitest.config.ts:40-48`
- Supabase config: `supabase/config.toml:60-65` (seed), `:5` (project_id)
- Test-plan gate matrix: `context/foundation/test-plan.md:116-128`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Unit gate + workflow concurrency

#### Automated

- [x] 1.1 Unit suite passes locally: `npm test`
- [x] 1.2 Workflow YAML is valid (`actionlint` or any YAML parser)
- [x] 1.3 Lint still passes: `npm run lint`

#### Manual

- [ ] 1.4 On a PR, the `ci` check log shows the unit step passing
- [ ] 1.5 Two rapid pushes: the earlier run shows as cancelled

### Phase 2: Integration job

#### Automated

- [ ] 2.1 Integration suite passes locally: `npm run test:integration`
- [ ] 2.2 Workflow YAML is valid (`actionlint` or any YAML parser)
- [ ] 2.3 The `-x` exclude list is accepted by the pinned CLI (start with no "unknown service" error, then stop)

#### Manual

- [ ] 2.4 On a real PR, the `integration` check goes green; log shows start → migrations+seed → suite pass → stop
- [ ] 2.5 Added CI time is acceptable (cold-start + serial suite)
- [ ] 2.6 No repo secrets were needed for the job

### Phase 3: Prove green + enforce + docs

#### Automated

- [ ] 3.1 `test-plan.md` no longer claims CI is lint+build only (`grep` shows updated prose)
- [ ] 3.2 `infrastructure.md` mentions the integration CI job (`grep` shows the new note)

#### Manual

- [ ] 3.3 Both `ci` and `integration` checks are green on the PR
- [ ] 3.4 `main` branch-protection lists `ci` and `integration` as required status checks
- [ ] 3.5 Optional: a PR that breaks a test is blocked from merging
