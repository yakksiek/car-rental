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
- **Astro components** for layout/static content; **React components** (`client:*` directives) only when interactivity is needed.
- **Tailwind classes**: always merge with `cn()` from `@/lib/utils`. Never concatenate class strings manually.
- **shadcn/ui**: components in `src/components/ui/`, "new-york" style. Add new ones with `npx shadcn@latest add [name]`.
- **React**: no Next.js directives ("use client"/"use server"). Extract hooks to `src/components/hooks/`.
- **Services/helpers**: `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types**: `src/types.ts` (entities, DTOs).
- **Supabase migrations**: `supabase/migrations/` with format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with per-operation, per-role policies.

### Environment

- Node.js v22.14.0 (`.nvmrc`)
- Local Supabase: `npx supabase start` (requires Docker)
- Deploy: `npx wrangler deploy`

## CI

GitHub Actions (`.github/workflows/ci.yml`): runs `astro sync` + lint + build on push/PR to `master`. Requires `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
