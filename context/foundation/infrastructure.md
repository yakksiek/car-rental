---
project: FleetRent
researched_at: 2026-05-29
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19
  runtime: Cloudflare Workers (workerd edge runtime)
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare scored a clean pass on all five agent-friendly criteria, is **free at FleetRent's traffic** (low QPS, well under the 100k-requests/day free cap), and is **already the configured adapter** in this repo (`@astrojs/cloudflare`) — no migration tax. The developer interview pointed the same way: with no persistent-connection requirement, a single-region (Polish) audience, external Supabase, and a DX-first priority, Cloudflare's fully-serverless model (no container, no OS, no Dockerfile) gives the lowest operational surface and the fastest agent-driven ops loop (`wrangler deploy` / `wrangler rollback` / `wrangler tail`). The one structural caveat — `@astrojs/cloudflare` no longer supports Cloudflare **Pages**, so the deploy target is **Workers** (`wrangler deploy`) — is a fixable contradiction in this repo's own artifacts, not a platform weakness, and is captured in the risk register below.

## Platform Comparison

All six candidates pass the hard filters: the Astro 6 SSR + TypeScript stack runs on each (Cloudflare keeps `@astrojs/cloudflare`; all others require an adapter swap), and because FleetRent needs no persistent server-side connections, no serverless-only platform is excluded.

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Net |
|---|---|---|---|---|---|---|
| **Cloudflare** | Pass | Pass | Pass | Pass | Pass | **5 Pass** |
| **Vercel** | Pass | Pass | Pass | Pass | Partial | **4½ Pass** |
| **Fly.io** | Pass | Partial | Pass | Pass | Partial | **4 Pass** |
| **Netlify** | Partial | Pass | Partial | Pass | Pass | **3½ Pass** |
| **Render** | Partial | Pass | Pass | Partial | Pass | **3½ Pass** |
| **Railway** | Partial | Pass | Pass | Partial | Partial | **3 Pass** |

**Per-platform scoring notes:**

- **Cloudflare** — `wrangler` covers the full loop (`deploy`, `rollback`, `versions deploy`, `tail`). Fully serverless on `workerd`. Docs published as `llms.txt`/`llms-full.txt` + GitHub markdown source. `wrangler deploy` is GA. ~13 remote MCP servers (observability, bindings) exist — treat as evolving. Free tier (100k req/day, 10 ms CPU/invocation) covers FleetRent entirely.
- **Vercel** — `vercel` / `vercel --prod` / `vercel rollback` / `vercel logs` are stable and scriptable; docs as `llms.txt`. **Hobby tier prohibits commercial use** (checked 2026-05-29), so a B2B product like FleetRent requires **Pro at $20/seat/mo**. MCP is **Public Beta** (read-only, 13 tools) — scored Partial. Requires swapping to `@astrojs/vercel`.
- **Fly.io** — `flyctl` does the full loop; docs are GitHub markdown. Scored **Partial on managed** because SSR runs as a Node container you own (Dockerfile + Node-version upkeep) — more ops surface, penalized under the DX-first weighting. No free tier (~$2–6/mo with auto-stop). MCP is experimental. Warsaw (`waw`) region would be ideal for Polish users, but single-region scope neutralizes that as a differentiator.
- **Netlify** — Astro 6 "just works" (GA, changelog 2026-03-10); official production-grade `@netlify/mcp` server is best-in-class. Scored **Partial on CLI** (no first-class `netlify rollback` — rollback is a dashboard "Publish deploy") and **Partial on docs** (Netlify's own docs are rendered HTML, not GitHub markdown). New credit-based pricing (since Sept 2025) adds cost opacity.
- **Render** — Node web service with `@astrojs/node`; publishes `llms.txt`; official MCP server GA (Aug 2025, 20+ tools). Scored **Partial on CLI/deploy** — the `render` CLI defaults to an interactive TUI (scriptable only with `-o json --confirm`) and rollback is dashboard-driven; free tier spins down after 15 min (~30–60 s cold start), so a usable setup is Starter at $7/mo.
- **Railway** — `@astrojs/node` via Railpack, no Dockerfile. Scored **Partial** on CLI and deploy API: it is dashboard-centric (project creation, region selection, env wiring are GUI-smoother), and its headline strength — one-click co-located Postgres — is **neutralized** here because FleetRent uses external Supabase. ~$5/mo Hobby. MCP marked "work in progress."

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Wins on every agent-friendliness axis and is free at FleetRent's scale. Crucially, it is the **only candidate requiring no adapter migration** — the repo already ships `@astrojs/cloudflare`. Fully serverless means the smallest set of things an agent (or developer) can misconfigure: no OS, no open ports, no Dockerfile, automatic TLS/routing. The deploy/rollback/log loop is entirely CLI-scriptable with deterministic output.

#### 2. Vercel

The strongest pure-DX option with excellent agent-readable docs and a clean, predictable CLI — arguably the smoothest iteration loop on a 3-week timeline. It loses the top slot on two counts: the **commercial-use ban on Hobby forces $20/seat/mo** (vs Cloudflare's $0), and adopting it means swapping the adapter and re-validating Supabase SSR cookie auth on Vercel's serverless functions. Genuine Node serverless (not edge polyfills) means *fewer* runtime surprises than Cloudflare — its real advantage if `workerd` friction materializes.

#### 3. Netlify

Best-in-class **official, production-recommended MCP server** and confirmed GA Astro 6 support make it a serious agent-ops contender on Node serverless (lower runtime-surprise risk than `workerd`). It drops to third on the **missing CLI rollback** (dashboard-only) — a real gap for unattended agent operations — and the opacity of the new credit-based pricing model, which can be exhausted by deploy count and bandwidth rather than requests.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **`workerd` is "almost-Node," not Node.** Supabase SSR cookie auth (`src/middleware.ts`, `src/lib/supabase.ts`) and any transitive dependency touching Node `crypto`/`streams`/`Buffer` run on polyfills behind the `nodejs_compat` flag. Runtime-only failures that don't reproduce under `npm run dev` are the hardest bug class — and they surface in production.
2. **3 MB gzipped Worker bundle limit on the free tier.** The protocol features (FR-006/007: photo upload + **digital signature** capture) will pull in client libraries (signature pad, image compression). Astro 6 + React 19 + Supabase client + those can crowd 3 MB gzip, forcing the $5/mo plan (10 MB ceiling) or a mid-sprint refactor.
3. **A stale Pages reference lingered in the hand-off docs.** `@astrojs/cloudflare` v13 **dropped Pages support**; current deploys must target **Workers** (`wrangler deploy`). The code (`astro.config.mjs`) was already Workers-only, and `CLAUDE.md` already documents `wrangler deploy`, but `tech-stack.md` carried `deployment_target: cloudflare-pages` from the starter default. *Resolved 2026-05-29:* `tech-stack.md` frontmatter + prose corrected to `cloudflare-workers`. (CI has no deploy step, so nothing Pages-shaped to fix there.)
4. **Free-tier CPU budget is 10 ms per invocation.** SSR-rendering the fleet catalog with React hydration plus Supabase data fetching could brush this ceiling (CPU time excludes Supabase fetch-wait, which helps) — a latency/cost surprise vector on heavier pages.
5. **No server-side image processing.** Protocol photos are a core feature, but Workers isn't a file-processing runtime. Server-side resize/optimization means adding the paid Cloudflare Images product or doing it all client-side.

### Pre-Mortem — How This Could Fail

The team shipped FleetRent on Workers because the starter defaulted to it and the free tier looked unbeatable. The first crack came in week two: the issue-protocol form pulled in a signature-pad library and a client-side image compressor, and the Worker bundle crossed the 3 MB gzip free limit mid-sprint. They upgraded to the $5 plan — fine — but the real trouble was `workerd`. A transitive dependency in their protocol-email path used a Node stream API that worked in `npm run dev` yet threw only in production, because local dev parity wasn't fully wired. Two days lost to a bug that wouldn't reproduce locally. Then CI — still set to a Pages-style build from the old starter default — deployed to a target that behaved differently from the Workers build they'd been testing. By the time they reconciled Pages-vs-Workers drift, the deadline had slipped. None of these were fatal alone, but the edge runtime's almost-Node nature taxed every Node-shaped assumption, and on a 3-week timeline that verification tax compounded.

### Unknown Unknowns

- **A hand-off doc carried a stale Pages label.** `tech-stack.md` said `deployment_target: cloudflare-pages` (a starter default) while the installed adapter is Workers-only — a contradiction an agent could have followed into the deprecated path. *Resolved 2026-05-29.* Note CI does not deploy at all (lint + build only), so the deploy path is not yet automated. *(Version-accuracy finding — per the skill's Getting-Started validation rule.)*
- **`astro:env/server` secrets ≠ Worker runtime secrets.** The app reads `SUPABASE_URL`/`SUPABASE_KEY` via `astro:env/server`. On Workers these must be wired as runtime secrets (`wrangler secret put`), plus a local `.dev.vars`; the build-time schema won't populate the runtime. A green build can still ship null config to production — which is what `src/lib/config-status.ts` exists to catch, but it's better to wire it right.
- **No Hyperdrive needed — until a raw Postgres driver appears.** FleetRent uses the Supabase JS client over HTTPS, so Hyperdrive is unnecessary. But Workers can't easily open arbitrary TCP, so any future direct `pg` connection (a migration runner, a heavy query path) would suddenly require Hyperdrive.
- **Billing is CPU-time, not wall-time.** A slow Supabase query costs nothing on Cloudflare's meter — counterintuitively good for this I/O-bound app, but it means slow DB must be watched via Supabase-side observability; Cloudflare's metrics won't reveal it.
- **"Works in `astro dev`" is a weaker guarantee here.** True binding/secret parity sometimes only surfaces under the actual Workers build, not the dev server — so green local runs prove less than they would on a Node host.

## Operational Story

- **Preview deploys**: `wrangler versions upload` creates a preview version with its own URL without promoting to production; PR previews can be wired via the Cloudflare Workers GitHub integration / a CI job on pull requests. Preview URLs are public by default — gate sensitive previews with Cloudflare Access if needed.
- **Secrets**: production secrets live in Workers Secrets, set via `wrangler secret put SUPABASE_URL` / `wrangler secret put SUPABASE_KEY` (encrypted at rest, not in the repo); local dev reads `.dev.vars` (gitignored). CI reads `SUPABASE_URL` / `SUPABASE_KEY` from GitHub repository secrets. Rotation = re-run `wrangler secret put` (overwrites) and redeploy.
- **Rollback**: `wrangler rollback [<version-id>]` reverts to a previous deployed version in seconds; `wrangler versions list` shows the history. Caveat: rollback reverts code only — Supabase schema migrations do **not** roll back automatically, so a deploy paired with a DB migration needs a manual migration-revert plan.
- **Approval**: an agent may run `wrangler deploy` to a non-production version and `wrangler tail`/`wrangler versions list` unattended. Human-only actions: promoting a version to production for the first cutover, rotating the primary Supabase key, and any destructive Supabase operation (drop table, delete project) — those stay panel-by-hand even when the agent suggests them.
- **Logs**: `wrangler tail` streams live runtime logs (read-only); `wrangler deployments list` and `wrangler versions list` show deploy history. The Cloudflare observability MCP server (`https://observability.mcp.cloudflare.com/sse`) exposes structured log/analytics queries for agent use — evolving, treat as a bonus over the CLI.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| ~~Stale Pages label in `tech-stack.md`~~ (resolved 2026-05-29) | Research finding | — | — | Fixed: `tech-stack.md` frontmatter + prose now `cloudflare-workers`; `astro.config.mjs` and `CLAUDE.md` were already Workers-aligned. Remaining: create `wrangler.jsonc` with `nodejs_compat` + a current `compatibility_date` during Plan Mode deploy. |
| `workerd` runtime diverges from Node — production-only failures in Supabase SSR / deps | Devil's advocate / Pre-mortem | M | H | Enable `@astrojs/cloudflare` `platformProxy` for dev parity; smoke-test auth + protocol-email paths against an actual `wrangler` build (not just `astro dev`) before relying on them. |
| 3 MB gzipped free-tier bundle limit exceeded by signature/image client libs | Devil's advocate / Pre-mortem | M | M | Monitor build output size; lazy-load heavy client libs as islands; budget the $5/mo paid plan (10 MB) as the accepted fallback. |
| Runtime secrets not wired (green build, null config in prod) | Unknown unknowns | M | H | Set `wrangler secret put SUPABASE_URL/KEY` for prod + `.dev.vars` locally; rely on `config-status.ts` banner as the backstop, not the primary control. |
| Free-tier 10 ms CPU/invocation ceiling on SSR-heavy pages | Devil's advocate | L | M | CPU excludes Supabase fetch-wait, so headroom is large; if hit, the $5 plan raises the limit. Watch via observability. |
| No server-side image processing for protocol photos | Devil's advocate | L | M | Keep photos in Supabase Storage; do client-side compression/resize; add Cloudflare Images only if server-side processing becomes necessary. |
| Slow Supabase queries invisible on Cloudflare's CPU-time meter | Unknown unknowns | M | M | Use Supabase-side observability / query insights to catch slow DB; don't rely on Cloudflare metrics for DB latency. |
| Future direct Postgres (`pg`) connection blocked by Workers TCP limits | Unknown unknowns | L | M | Keep all DB access via the Supabase JS client over HTTPS; if a raw driver is ever needed, route it through Hyperdrive. |

## Getting Started

> Validated against `@astrojs/cloudflare` as Workers-only (Pages deployment removed) and `wrangler deploy` as the GA path, checked 2026-05-29. Do **not** use `wrangler pages deploy`.

1. **Reconcile the repo's deploy target first.** Update `context/foundation/tech-stack.md` (`deployment_target: cloudflare-pages` → `cloudflare-workers`), the deploy step in `.github/workflows/ci.yml`, and any Pages language in `CLAUDE.md`. Confirm `wrangler.jsonc`/`wrangler.toml` sets `compatibility_flags = ["nodejs_compat"]` and a `compatibility_date` ≥ `2024-09-23`.
2. **Authenticate and configure Wrangler.** `npx wrangler login`, then verify the project config with `npx wrangler whoami` and `npx wrangler deploy --dry-run` to catch bundle/runtime issues before a real deploy.
3. **Wire secrets.** Production: `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. Local dev: create a gitignored `.dev.vars` with the same keys. CI: store both as GitHub repository secrets (already required by the workflow).
4. **First deploy.** `npm run build && npx wrangler deploy`. Confirm the returned `*.workers.dev` URL renders the fleet catalog and that the missing-config banner is absent (proves secrets resolved at runtime).
5. **Verify the ops loop.** `npx wrangler tail` to confirm live logs stream; `npx wrangler versions list` to confirm version history exists for rollback. Then proceed to Plan Mode for the full guided deploy.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
