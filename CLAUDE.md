# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)

No test runner is configured. Pre-commit hooks (husky + lint-staged) run `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

Before first build, run `npx astro sync` to generate virtual module types (required for `astro:env/server` imports to resolve).

## Architecture

Astro 6 SSR app with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

### Rendering and routing

Full SSR (`output: "server"` in astro.config.mjs). All pages are server-rendered. There is no static prerendering.

- Pages: `src/pages/` (Astro file-based routing)
- API routes: `src/pages/api/` — export uppercase HTTP methods (`GET`, `POST`); validate input with zod
- Layout: `src/layouts/Layout.astro` — wraps all pages, renders missing-config banners via `src/lib/config-status.ts`

### Auth flow

Supabase auth is optional — the app runs without credentials (auth features are disabled, `createClient` returns `null`). When configured:

- `src/lib/supabase.ts` — creates Supabase SSR client using cookie-based sessions. Env vars (`SUPABASE_URL`, `SUPABASE_KEY`) come from `astro:env/server` (declared in astro.config.mjs `env.schema` as optional server secrets).
- `src/middleware.ts` — resolves user on every request, sets `context.locals.user`. Redirects unauthenticated users from `PROTECTED_ROUTES` to `/auth/signin`.
- `src/env.d.ts` — declares `App.Locals` with `user: User | null`.
- Auth API: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth UI: `src/pages/auth/{signin,signup,confirm-email}.astro`

### Key conventions

- **Import order**: group imports separated by a blank line, each preceded by a comment header:
  1. `// core` — framework and library imports (react, astro, supabase, zod)
  2. `// components` — component imports (Astro and React components, UI primitives)
  3. `// others` — types, hooks, constants, utilities, services
- **Local imports**: use relative paths (`./`, `../`) for files under `src/`. The `@/` alias is **banned** for local files and enforced by ESLint (`no-restricted-imports`). The `@/*` mapping is retained in `tsconfig.json` only so shadcn/ui tooling resolves — after `npx shadcn add`, convert any generated `@/` import to a relative path.
- **Astro components** for layout/static content; **React components** (`client:*` directives) only when interactivity is needed.
- **Tailwind classes**: always merge with `cn()` from `src/lib/utils` (relative import). Never concatenate class strings manually.
- **shadcn/ui**: components in `src/components/ui/`, "new-york" style. Add new ones with `npx shadcn@latest add [name]`, then rewrite the generated `@/` imports to relative paths.
- **React**: no Next.js directives ("use client"/"use server"). Extract hooks to `src/components/hooks/`.
- **Async buttons**: any button that triggers an async action (form submit, mutation, API POST/PATCH) must show a pending state — `disabled` while in-flight and swap its label/icon for a spinner + pending text. Reuse the `animate-spin` ring from `src/components/auth/SubmitButton.tsx`, driven by an explicit `submitting`/`pending` flag (forms post to URLs, so `useFormStatus` won't report pending). Keep the pending state through a success redirect; reset only on error. See `FormActions` in `src/components/fleet/VehicleForm.tsx`.
- **Services/helpers**: `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types**: `src/types.ts` (entities, DTOs).
- **Supabase migrations**: `supabase/migrations/` with format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with per-operation, per-role policies.

### Environment

- Node.js v22.14.0 (`.nvmrc`)
- Local Supabase: `npx supabase start` (requires Docker)
- Deploy: `npx wrangler deploy`
- `jq` — required by the per-edit lint hook in `.claude/settings.json` (it parses the edited file path from the hook's stdin). Without it the hook silently no-ops. Install: `brew install jq` (macOS) · `apt install jq` (Debian/Ubuntu) · `winget install jqlang.jq` (Windows).

## CI

GitHub Actions (`.github/workflows/ci.yml`): runs `astro sync` + lint + build on push/PR to `master`. Requires `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
