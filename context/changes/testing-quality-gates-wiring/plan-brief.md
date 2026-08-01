# Quality-Gates Wiring — Plan Brief

> Full plan: `context/changes/testing-quality-gates-wiring/plan.md`
> Research: `context/changes/testing-quality-gates-wiring/research.md`

## What & Why

Wire the project's existing, already-green-locally **unit** and **integration**
suites into GitHub Actions as required gates on every PR to `main`. Today CI is
lint+build only and the local hooks that "cover" tests are bypassable
(`--no-verify`) and fail open when Supabase is down — so a regression in any
covered risk class (PII/RLS, booking overlap, IDOR/authz, input parity, protocol
email) can merge without the suites ever running. This is the CI half of
test-plan §5; the local post-edit hook half already shipped.

## Starting Point

`.github/workflows/ci.yml` runs `npm ci → astro sync → lint → build` on push/PR
to `main` — no test step, no database. The suites, harness, seed, and `.env`
contract all exist and pass locally; the integration suite (18 serial files)
needs the full local Supabase stack (Postgres + API + GoTrue + Storage).

## Desired End State

Every PR to `main` runs two checks — `ci` (lint + build + **unit**) and a new
`integration` job that boots a slimmed Supabase and runs `npm run
test:integration` — and both are **required status checks**, so a PR cannot merge
unless both are green. The foundation docs reflect the wired gates.

## Key Decisions Made

| Decision          | Choice                                                 | Why (1 sentence)                                                                   | Source   |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------- |
| Enforcement layer | CI (not local hooks)                                   | Only CI is non-bypassable and fail-closed; hooks are `--no-verify`/fail-open.      | Research |
| Job layout        | Unit in existing `ci` job + separate `integration` job | Fast checks report without waiting on Docker; a stack flake can't mask lint/build. | Plan     |
| Supabase CLI      | `npx supabase` (devDep `^2.23.4`)                      | CI runs the exact version the local pre-push gate uses — zero drift.               | Plan     |
| Stack scope       | Slim via `supabase start -x …`, keep Storage           | Cuts cold-start and drops the flaky analytics pair no test uses.                   | Plan     |
| Migrations/seed   | Automatic on fresh runner (no `db reset`)              | `supabase start` on an empty volume applies migrations + `seed.sql`.               | Research |
| Credentials       | Export from `supabase status -o env`                   | Keys come from the local stack; **no repo secrets** needed.                        | Research |
| Required checks   | Land green first, then mark required                   | Avoids a cold-start flake blocking all merges on day one.                          | Plan     |
| Triggers          | PR + push to `main` + `concurrency` cancel-in-progress | Keeps main verified; stops stacked ~3-min Docker runs.                             | Plan     |

## Scope

**In scope:** `npm test` step on the `ci` job; a new `integration` job (Supabase

- `npm run test:integration`); workflow concurrency guard; proving both checks
  green on a real PR; enabling required status checks on `main`; updating
  `test-plan.md` §5 + `infrastructure.md`.

**Out of scope:** any app code; wiring e2e into the required gate; editing the
committed `config.toml`; Docker image caching; changing the local hooks;
backporting the stale test-plan §3/§6.3 archive paths.

## Architecture / Approach

Two independent GitHub Actions jobs in one workflow. `ci` stays fast and DB-free
(lint + build + unit). `integration` runs on `ubuntu-latest` (Docker
preinstalled): `npm ci` → `npx supabase start -x <unused services>` → remap
`supabase status -o env` into `$GITHUB_ENV` → `npm run test:integration` →
`supabase stop` (`if: always()`). No `astro sync` (Vitest stubs the Astro virtual
modules). The gate's "teeth" — required status checks — are enabled in repo
settings after the jobs are observed green.

## Phases at a Glance

| Phase                           | What it delivers                                  | Key risk                                                            |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Unit gate + concurrency      | `npm test` on the `ci` job + cancel-in-progress   | Minimal — DB-free, fast                                             |
| 2. Integration job              | Supabase-backed `integration` check on every PR   | Cold-start time / `-x` service-name drift on CLI 2.23.4             |
| 3. Prove green + enforce + docs | Green PR, required checks on `main`, docs updated | Required-check enablement is a manual repo-admin step (out of tree) |

**Prerequisites:** local Supabase runs the suite green today; repo-admin access
to set branch protection on `main`; branch `testing-quality-gates-wiring` will be
pushed and a PR opened in Phase 3.
**Estimated effort:** ~1 session across 3 phases (mostly YAML + one PR + one
settings change).

## Open Risks & Assumptions

- The exact excludable service names for `supabase start -x` must be verified on
  CLI 2.23.4; wrong flag aborts the start (fallback: full stack, no `-x`).
- `supabase status -o env` key names must be confirmed; a `sed` remap is the
  version-safe fallback to `--override-name`.
- Enabling required checks is a GitHub-settings action the agent cannot commit —
  it depends on the user (admin) and is sequenced after a green PR.
- Cold-start image pull adds a few CI minutes per PR; accepted (caching deferred).

## Success Criteria (Summary)

- A PR to `main` runs both `ci` (incl. unit) and `integration`, both green.
- Both are required status checks on `main` — a red check blocks the merge.
- `test-plan.md` §5 and `infrastructure.md` describe the wired gates; the local
  post-edit hook half remains as-is.
