# Required status checks on `main` — enablement runbook

> Phase 3, step 2 of `testing-quality-gates-wiring`. This is the **out-of-tree**
> half of the gate: a workflow that _runs_ on a PR does not _block_ a merge until
> its checks are marked **required** on `main`. That is a GitHub repo-settings
> action requiring **admin** — it cannot be committed. Do it **only after** both
> checks are observed green on a real PR (Phase 3, step 1), so a cold-start flake
> never blocks every merge.

## Exact check names

These are the GitHub Actions **job ids** in `.github/workflows/ci.yml` (a job with
no `name:` reports under its id):

- `ci`
- `integration`

Both come from the single workflow `CI`. When adding required checks, GitHub may
prompt you to pick the workflow too (`CI`).

## Prerequisite: prove green first

1. Push the branch and open a PR to `main`.
2. Wait for both `ci` and `integration` to complete **green** on that PR.
3. Only then enable the required checks below.

## Option A — Branch protection (classic), via UI

1. GitHub → repo → **Settings → Branches → Branch protection rules → Add rule**
   (or edit the existing rule for `main`).
2. **Branch name pattern**: `main`.
3. Check **Require status checks to pass before merging**.
   - (Recommended) also check **Require branches to be up to date before merging**.
4. In the search box, add **`ci`** and **`integration`** as required checks.
   (They only appear in the picker once they've run at least once — hence "prove
   green first".)
5. Save.

## Option B — Repository ruleset, via UI

1. GitHub → repo → **Settings → Rules → Rulesets → New branch ruleset**.
2. Target: **Default branch** (or a pattern matching `main`); **Enforcement: Active**.
3. Enable **Require status checks to pass**, then add **`ci`** and **`integration`**.
4. Save.

## Option C — `gh` CLI (classic branch protection)

Requires admin + `gh auth login`. Replace `OWNER/REPO` with the real slug.

```bash
gh api -X PUT repos/OWNER/REPO/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[checks][][context]=ci' \
  -f 'required_status_checks[checks][][context]=integration' \
  -F 'enforce_admins=true' \
  -F 'required_pull_request_reviews=null' \
  -F 'restrictions=null'
```

Verify:

```bash
gh api repos/OWNER/REPO/branches/main/protection/required_status_checks \
  --jq '.checks[].context'
# expect: ci  integration
```

## After enabling — spot check (optional)

Open a throwaway PR that deliberately breaks a test (e.g. flip a unit assertion).
Confirm the PR is **blocked from merging** until fixed, then close it.

## If job ids ever change

The required-check name is the **job id**, not the workflow name. If a future
change renames the `ci` or `integration` job, the required-check entry must be
updated here **and** in branch protection, or merges will hang waiting on a check
name that never reports.
