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

## 10xDevs AI Toolkit - Module 2, Lesson 4

Prepare for a harder implementation stream with the **research-backed planning chain**:

```
internal research (/10x-research) + external research (exa.ai, Context7) -> /10x-plan -> /10x-implement -> success
```

The lesson focus is distinguishing internal from external research and using evidence to back planning decisions.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Internal research (lesson focus)** | |
| `/10x-research <change-id>` | You need evidence from the existing codebase — patterns, conventions, integration points, or existing implementations. Runs parallel sub-agents over the repo and writes structured findings to `research.md`. |
| **External research (lesson focus)** | |
| exa.ai | You need AI-native web search for library comparisons, best practices, or ecosystem context that the codebase cannot answer. |
| Context7 (`resolve-library-id` → `get-library-docs`) | You need live, current documentation for a specific library or framework. Resolves a library ID first, then fetches relevant doc pages. |
| **Framing spare wheel** | |
| `/10x-frame <change-id>` | The plan won't converge, the plan doesn't deliver expected results, or persistent drift keeps breaking the implementation. Use as an escape hatch on a separate problem (demonstrated on Space Explorers example), not as pre-research ritual. |
| **Planning and execution** | |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Use the same planning and execution chain from Lesson 2, now with upstream research evidence feeding the plan. |

### Research discipline

- Internal research (`/10x-research`) answers "what does our codebase already do?" — patterns, schemas, conventions, integration points.
- External research (exa.ai, Context7) answers "what should we do?" — library capabilities, API docs, ecosystem best practices.
- Combine both as evidence-backed input to `/10x-plan`. A plan without research evidence on a non-trivial stream is a guess.
- Agent-friendly docs (`llms.txt`, markdown-for-agents, `/md` endpoints) are a quality signal for library selection — libraries that publish agent-readable docs integrate faster.

### `/10x-frame` as spare wheel

Three triggers for reaching for `/10x-frame`:
1. The plan won't converge — research keeps opening more questions instead of narrowing to a contract.
2. The plan doesn't deliver — implementation repeatedly fails to meet success criteria.
3. Persistent drift — the implementation keeps diverging from the plan in ways that suggest the problem was mis-framed.

Demonstrated on a Space Explorers example, not the SRS path. It is an escape hatch, not a mandatory step.

### Paths used by this lesson

- `context/changes/<change-id>/research.md` - internal research output
- `context/changes/<change-id>/frame.md` - framing output when needed
- `context/changes/<change-id>/plan.md` - evidence-backed implementation contract
- `context/foundation/lessons.md` - recurring rules and pitfalls

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
