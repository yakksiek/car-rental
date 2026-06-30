# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Read the design system before building any UI slice

- **Context**: Any user-facing slice (a UI screen or component), during both planning and implementation phases.
- **Problem**: Neither /10x-plan nor /10x-implement auto-discovers the design system, so UI gets built with no design reference — wrong tokens, spacing, structure, or copy.
- **Rule**: For any user-facing slice, read context/foundation/design-system.md first, then open only the matching screenshot(s) and source JSX for that slice. Build against the live tokens in src/styles/global.css; never import from context/foundation/design/ (it's a static prototype). Polish UI copy is canonical.
- **Applies to**: plan, implement

## Distill UI screenshots into a textual design contract at plan time

- **Context**: Any UI slice that maps to design screenshot(s), across the plan → implement handoff.
- **Problem**: PNG screenshots are vision tokens and cost far more context than text. When the plan only references screen *numbers*, /10x-implement re-opens the PNG for every slice (and on every resume), burning the image cost repeatedly. The image is already on screen during /10x-plan — that's the cheapest moment to convert it.
- **Rule**: Pay the image cost once, at plan time. While /10x-plan views a screen, distill it into a compact **textual design contract** in that phase — layout structure, spacing/token intent, the component breakdown, and the canonical Polish copy strings — and name the exact screenshot path (e.g. `context/foundation/design/screenshots/03-...png`). /10x-implement then builds from the contract text and does NOT open the PNG. If implement genuinely must view an image, delegate it to a subagent (Explore/general-purpose) and consume only the returned text description — vision tokens stay in the subagent's context, never the main loop.
- **Applies to**: plan, implement

## Use react-hook-form for larger form islands

- **Context**: Any React (TSX) form island with many fields (roughly 8+), e.g. `src/components/fleet/VehicleForm.tsx` (~18 fields). Not small forms like `ReservationForm`.
- **Problem**: The plain `useState` + manual `fieldErrors` map pattern gets boilerplate-heavy and re-render-noisy as field count grows. A misconception that "react-hook-form isn't recommended with Astro" pushes people to keep hand-rolling state — but RHF runs fine inside an Astro island (it's just client React; the only nuance is island bundle size).
- **Rule**: For larger/complex form islands, prefer `react-hook-form` + `@hookform/resolvers` (`zodResolver(sharedSchema)`) over plain `useState`; keep the zod schema as the single validation source for client + API. Reserve plain `useState` for small forms. For non-interactive forms that don't need an island at all, the Astro-native choice is a plain `<form method="POST">` to an API route (works without JS).
- **Applies to**: plan, implement, impl-review

## API routes are outside middleware's gate — every /api route must self-gate

- **Context**: Any HTTP route under `src/pages/api/`, during both planning and implementation. Touches every current and future API endpoint (e.g. an admin-only `/api/invoices`).
- **Problem**: `src/middleware.ts` only enforces auth/role for paths listed in `ROUTE_ROLES` (`src/lib/access.ts:27-38`), which contains **only `/dashboard*` page prefixes** — no `/api/*` entry. So `resolveRequiredRole("/api/...")` returns `null` and middleware calls `next()` without any check. A new API route that forgets its in-handler gate is silently reachable by anonymous or wrong-role callers. Middleware *can't* cleanly cover `/api` anyway: its unauthenticated branch is a 302 redirect to `/auth/signin` (page-shaped), not the 401/JSON an API client needs, and routes are non-uniform (`POST /api/reservations` is deliberately public; `vehicles` is staff-only). Writes have a DB backstop (RLS `WITH CHECK` / RPC `current_app_role()`), but reads via a definer RPC or service-role client do not.
- **Rule**: Treat every `/api` route as unprotected by default. Each handler must self-gate **in this order** before any work: (a) same-origin CSRF check on mutations (`origin !== context.url.origin` → 403), (b) auth (`!context.locals.user` → 401), (c) role (`!requireRole(context.locals, "<min>")` → 403), then (d) zod parse → 400, then the DB call. Use `json(status, …)` bodies, never a redirect. A route that is intentionally public must say so in a comment. Reference: `src/pages/api/vehicles.ts:30-63`. Do NOT rely on middleware or `ROUTE_ROLES` to protect API paths.
- **Applies to**: plan, implement, impl-review

## Wrap auth calls and role helpers in (select …) inside RLS policies

- **Context**: Any RLS policy `USING` / `WITH CHECK` clause that gates on the caller — `auth.uid()`, `auth.jwt()`, `current_setting(...)`, or a role helper like `public.current_app_role()`. Touches every authed slice (e.g. `supabase/migrations/20260604153139_employee_admin_roles.sql`, `20260625120000_fleet_management.sql`, and upcoming S-05/S-06/S-07/S-08).
- **Problem**: A bare `auth.<fn>()` / `current_setting()` call in a policy predicate is re-evaluated once per scanned row (O(rows)), which Supabase's `auth_rls_initplan` advisor flags as suboptimal at scale. A `STABLE SECURITY DEFINER` helper does NOT escape this — `STABLE` is necessary but not sufficient for one-time evaluation; the planner only hoists a *scalar subquery* to a one-time InitPlan. The advisor only matches literal `auth.*()`/`current_setting()` tokens, so helper-based policies carry the same cost silently and go unflagged.
- **Rule**: Wrap every per-row caller check in a scalar subquery: `user_id = (select auth.uid())`, `(select public.current_app_role()) = 'admin'`. Wrap the role helper too, not just raw `auth.uid()`. Result is identical; evaluation drops to once per statement. Schema-qualify the helper (`public.current_app_role()`). This is a pure-perf change — fix it with `ALTER POLICY` in place (reversible by a symmetric `ALTER`); no type regen, no app-code change.
- **Applies to**: plan, implement, impl-review
