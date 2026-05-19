---
project: 10x-astro-starter
checked_at: 2026-05-19T12:00:00Z
health_status: needs-attention
context_type: brownfield
language_family: js
stack_assessment_available: false
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 1
  moderate: 10
  low: 0
test_runner_detected: false
ci_provider: GitHub Actions
recommended_fixes: 6
---

## Dependency Health

### Lockfile

Status: present (package-lock.json)
Package manager: npm

### Security Audit

Tool: npm audit --json
Summary: 0 CRITICAL, 1 HIGH, 10 MODERATE, 0 LOW
Direct vs transitive: 1 HIGH is transitive; 3 direct packages have MODERATE findings via transitive chains

#### HIGH findings

- **devalue** 5.6.3–5.8.0 — GHSA-77vg-94rm-hx3p: DoS via sparse array deserialization (CVSS 7.5). Transitive dependency. Fix: `npm update` (fix available upstream).

#### MODERATE findings (10 total)

- **ws** 8.0.0–8.20.0 — GHSA-58qx-3vcg-4xpx: uninitialized memory disclosure (CVSS 4.4). Transitive via miniflare, @cloudflare/vite-plugin. Fix: update wrangler to 3.107.3.
- **yaml** 2.0.0–2.8.2 — GHSA-48c2-rrv3-qjmp: stack overflow via deeply nested collections (CVSS 4.3). Transitive via yaml-language-server → volar-service-yaml → @astrojs/language-server → @astrojs/check. Fix: downgrade @astrojs/check to 0.9.2 (breaking change) or wait for upstream patch.
- **@astrojs/check**, **@astrojs/cloudflare**, **@astrojs/language-server**, **@cloudflare/vite-plugin**, **miniflare**, **volar-service-yaml**, **wrangler**, **yaml-language-server** — moderate severity via transitive chains of the two root advisories above.

### Outdated Dependencies

Packages with major version gaps: 2

- **eslint**: 9.39.4 → 10.4.0 (1 major version behind)
- **typescript**: 5.9.3 → 6.0.3 (1 major version behind)

Minor/patch updates available for 12 other packages (astro, tailwindcss, @supabase/supabase-js, lucide-react, etc.) — routine maintenance, no urgency.

## Test Suite

Test runner: not detected
Tests found: not applicable
Test execution: not attempted

No test runner configuration found. No `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `cypress.config.*` files. No `test` script in package.json. The agent cannot verify its own changes.

Recommended: set up Vitest (the natural fit for Astro + Vite projects):

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Then add to package.json scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

## CI/CD

Provider: GitHub Actions
Configuration: .github/workflows/ci.yml

| Stage      | Status | Notes                                      |
|------------|--------|--------------------------------------------|
| Lint       | ✓      | eslint via `npm run lint`                   |
| Test       | ✗      | not configured (no test runner installed)   |
| Build      | ✓      | `npm run build` with Supabase env vars      |
| Type check | ✓      | implicit via `astro sync` + TypeScript build |
| Security   | ✗      | not configured                              |

## Configuration

### High severity

No high-severity configuration gaps. TypeScript strict mode is enabled via `extends: "astro/tsconfigs/strict"`. ESLint, Prettier, and pre-commit hooks (Husky + lint-staged) are all configured.

### Medium severity

No medium-severity gaps. Formatter (Prettier with .prettierrc.json + prettier-plugin-astro + prettier-plugin-tailwindcss) and linter (ESLint with eslint-plugin-astro, react, react-hooks, jsx-a11y, react-compiler) are both configured and enforced via lint-staged.

### Low severity

- **.editorconfig** — missing. Ensures consistent indentation/encoding across editors. Fix: create `.editorconfig` with project defaults (indent_style = space, indent_size = 2, end_of_line = lf).
- **.env.example** — was tracked but is now deleted. Documents required environment variables for new contributors. Fix: recreate with `SUPABASE_URL` and `SUPABASE_KEY` placeholders.

## Stack Assessment Cross-Reference

No stack-assessment.md found. Run /10x-stack-assess for quality-gate analysis.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Install a test runner

**Impact**: without tests, the agent cannot verify its own changes — every edit is a manual review burden.
**Severity**: high
**Effort**: moderate (15–30 min)
**Fix**:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Create `vitest.config.ts`:

```ts
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    environment: "jsdom",
  },
});
```

Add scripts to package.json:

```json
"test": "vitest run",
"test:watch": "vitest"
```

### 2. Review HIGH audit finding (devalue)

**Impact**: the `devalue` advisory (DoS via sparse arrays, CVSS 7.5) is a transitive dependency. Low risk in a server-rendered app where you control inputs, but worth patching.
**Severity**: high
**Effort**: quick (< 5 min)
**Fix**:

```bash
npm update
```

If the fix doesn't resolve via update, check if a newer Astro patch pulls a patched devalue version.

### 3. Recreate .env.example

**Impact**: new contributors (and the agent) need to know which environment variables are required. The file was tracked but deleted.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**: create `.env.example` with:

```
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key
```

### 4. Add .editorconfig

**Impact**: ensures consistent formatting across editors (spaces vs tabs, line endings). Minor but prevents formatting noise in diffs.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**: create `.editorconfig`:

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

### Addressed in upcoming lessons (Category B)

### Add test step to CI pipeline

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: wire the test runner into CI so every push and PR runs the test suite automatically.

### Add AGENTS.md for agent collaboration context

**Lesson**: [Agent Onboarding: Agents.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)
**What you'll do there**: build a structured instruction file that gives the agent project-specific conventions, architectural constraints, and workflow rules — the right content, not a generic stub.

### Add security scanning to CI

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: integrate `npm audit` or a dedicated scanner (Snyk, CodeQL) into the CI pipeline.

## Summary

Health status: needs-attention

The project scaffold is well-configured for development — TypeScript strict mode, ESLint with accessibility and React compiler plugins, Prettier with Astro/Tailwind plugins, and pre-commit enforcement via Husky. The main gap is the absence of a test runner: without it, neither you nor the agent can verify changes automatically. One HIGH transitive audit finding (devalue DoS) exists but is low practical risk. CI covers lint and build but not tests or security — those are expected at this stage and will be addressed in upcoming lessons.

Next step: install Vitest (Category A fix #1), then proceed to agent onboarding — both greenfield and brownfield paths converge with equivalent context artifacts.
