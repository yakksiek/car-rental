# Cloudflare Workers Integration & Deployment Plan — FleetRent

## Context

`context/foundation/infrastructure.md` selected **Cloudflare Workers** as the MVP platform.
The deploy approach is **Cloudflare's native Git integration (Workers Builds)** so that pushes to
the default branch auto-deploy without a GitHub Action (per the user's decision).

Exploration found the repo is **already most of the way there** — the `infrastructure.md`
"Getting Started" steps largely assume a fresh repo, but most are done:

| Already in place | Detail |
|---|---|
| Adapter | `@astrojs/cloudflare` **v13.5.0**, `output: "server"`, `adapter: cloudflare()` |
| `wrangler.jsonc` | exists: `nodejs_compat`, `compatibility_date 2026-05-08`, `ASSETS` binding → `./dist`, `observability.enabled` |
| wrangler CLI | **v4.90.0** in devDependencies |
| `.dev.vars` | exists with real Supabase creds, **gitignored** (`.dev.vars`, `.wrangler/`) |
| Dev parity | Astro 6 runs `astro dev` on real **workerd** with `platformProxy` enabled by default — the register's "almost-Node dev parity" risk is largely mitigated already |
| Env schema | `SUPABASE_URL`/`SUPABASE_KEY` declared `astro:env/server`, `secret`, `optional: true` |

**Genuine gaps this plan closes:**
1. Worker `name` is still the starter default `"10x-astro-starter"` → rename to `fleetrent`.
2. Production **runtime** secrets are not wired on Cloudflare (the load-bearing risk in the register).
3. Supabase Auth (external integration) needs its **Site/Redirect URLs** pointed at the deployed URL or signup/email-confirm breaks.
4. No auto-deploy yet → set up **Workers Builds** Git integration.
5. CI workflow triggers on `master` but the repo's default branch is **`main`** → it currently never runs.

> **Branch note:** the request said "push to master", but this repo's default branch is **`main`** (no `master` exists). This plan uses `main` everywhere (Workers Builds production branch + CI trigger). Flag if a real `master` is intended.

---

## Prerequisites — accounts, CLI, and Supabase (do before Phase 0)

These set up the credentials and tools every later phase assumes. None of them deploy anything.

### P1 — Local toolchain
- [ ] Use the pinned Node: `nvm use` (reads `.nvmrc` → **22.14.0**).
- [ ] `npm ci` to install dependencies. **No global installs needed** — `wrangler` (v4.90.0) and `supabase` (v2.23.4) are already devDependencies; invoke them with `npx wrangler …` / `npx supabase …`.

### P2 — Cloudflare account + Wrangler auth
- [ ] Create / confirm a Cloudflare account at **dash.cloudflare.com** (free tier is sufficient at FleetRent's scale).
- [ ] `npx wrangler login` → opens a browser OAuth flow; authorize Wrangler. The token is stored locally (no secret in the repo).
- [ ] Verify with `npx wrangler whoami` → should print your email + account name + account ID.
- [ ] **Multiple Cloudflare accounts?** Pin the target so deploys don't go to the wrong one: add `"account_id": "<id>"` to `wrangler.jsonc` (or `export CLOUDFLARE_ACCOUNT_ID=<id>`). The ID is shown by `wrangler whoami` / in the dashboard URL.
- [ ] *(Optional, non-interactive only)* If browser login isn't possible, create a **scoped API token** (`Workers Scripts:Edit`) and `export CLOUDFLARE_API_TOKEN=…`. Not required for the manual first deploy; Workers Builds issues its own token in Phase 3.

### P3 — Supabase project + keys (external integration)
- [ ] Confirm dashboard access to the existing project (`.dev.vars` points at `https://recfckvdrnedcuqzpbtg.supabase.co`).
- [ ] Locate credentials in **Supabase dashboard → Project Settings → API**:
      - **Project URL** → use as `SUPABASE_URL`
      - **Publishable key** (`sb_publishable_…` — the new client-safe key that replaced the legacy `anon` key) → use as `SUPABASE_KEY`. The app pairs this with `@supabase/ssr` for cookie-based, **RLS-enforced** sessions. **Do not** use the `secret`/`service_role` key here — it would bypass RLS and must never reach the client path.
- [ ] Confirm **Email** auth provider is enabled (**Authentication → Providers → Email**) — the signup / confirm-email flow (`src/pages/auth/*`) depends on it.
- [ ] *(Site URL / Redirect URLs are configured in Phase 2, once the deployed URL exists.)*

### P4 — Supabase CLI (optional — only when DB migrations appear)
- [ ] No action required now: `supabase/config.toml` exists but `supabase/migrations/` is **empty**, so this deploy has no DB schema step.
- [ ] If migrations are added later: `npx supabase login` → `npx supabase link --project-ref recfckvdrnedcuqzpbtg` → `npx supabase db push`. Recall the register caveat — schema changes do **not** roll back with `wrangler rollback`, so pair any migration with a manual revert plan.

### P5 — GitHub repo access (for Phase 3)
- [ ] Confirm admin rights on the GitHub repo (needed to authorize the Cloudflare GitHub App) and that the default branch is **`main`**.

**Gate:** `wrangler whoami` succeeds, Supabase URL + publishable key are in hand, and `.dev.vars` already holds them for local dev. Proceed to Phase 0.

---

## Phase 0 — Pre-flight reconciliation (local only, no deploy)

- [ ] **Rename Worker** in `wrangler.jsonc`: `"name": "10x-astro-starter"` → `"name": "fleetrent"`.
      (Workers Builds requires the dashboard Worker name to **match** `wrangler.jsonc` `name`, or builds fail.)
- [ ] **Fix CI branch** in `.github/workflows/ci.yml`: change `push.branches` and `pull_request.branches` from `[master]` → `[main]` so PR/build checks actually run. (CI stays build-only; deploy is handled by Cloudflare.)
- [ ] **Dry-run + bundle-size check:** `npm run build && npx wrangler deploy --dry-run`.
      Confirm the Worker bundle is well under the **3 MB gzip** free-tier ceiling (register risk). Note: `public/template.png` (~1.26 MB) is served via the `ASSETS` binding, **not** counted in the Worker bundle — safe.
- [ ] **Smoke test on workerd:** `npm run dev` (already workerd), verify the fleet catalog renders, `/dashboard` redirects to `/auth/signin` when logged out, and the missing-config banner is **absent** (proves `.dev.vars` resolves through `astro:env/server`).

**Files:** `wrangler.jsonc`, `.github/workflows/ci.yml`

---

## Phase 1 — Manual first deploy (human-gated cutover)

Per `infrastructure.md`'s production-access boundary, the **first** production cutover is human-run; this also creates the Worker so the Git integration can attach to it in Phase 3.

- [ ] `npx wrangler login` → confirm with `npx wrangler whoami`.
- [ ] **First deploy:** `npm run build && npx wrangler deploy` → creates Worker `fleetrent` and returns the `*.workers.dev` URL. (Expect the config banner here — secrets not set yet.)
- [ ] **Wire runtime secrets** (the load-bearing step — these are read at **runtime**, separate from build-time):
      `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`.
      Setting a secret redeploys the existing Worker automatically.
      > Edge case: if `secret put` errors "Worker not found", it means the deploy in the prior step didn't complete — re-run `wrangler deploy` first.
- [ ] **Verify secrets resolved:** reload the `*.workers.dev` URL → catalog renders and the missing-config banner is **gone** (proves runtime secrets reach `astro:env/server` on workerd).
- [ ] **Confirm ops loop:** `npx wrangler tail` streams live logs; `npx wrangler versions list` shows history (rollback target exists).

---

## Phase 2 — Supabase auth external integration (edge-case heavy)

The signup → confirm-email → signin flow (`src/pages/auth/*`, `src/pages/api/auth/*`) depends on Supabase's redirect configuration. Build/deploy success does **not** prove auth works.

- [ ] In the Supabase dashboard → **Authentication → URL Configuration**, set **Site URL** to the deployed `https://fleetrent.<subdomain>.workers.dev` and add it (plus any future custom domain) to **Redirect URLs**. Otherwise confirmation emails link back to localhost / the old default and the flow silently breaks.
- [ ] **End-to-end test on the deployed URL:** sign up → receive confirm email → confirm → sign in → reach `/dashboard`. Watch `wrangler tail` for any workerd-only errors in the Supabase SSR cookie path (`src/lib/supabase.ts`, `src/middleware.ts`) — the register's top runtime-divergence risk.
- [ ] Confirm cookie-based session persists across requests (middleware sets `context.locals.user`).

> Note: the `.dev.vars` Supabase key is a `sb_publishable_...` key — fine for the public/anon client. Use the **same** values for the runtime secrets; do not commit them anywhere else.

---

## Phase 3 — Workers Builds: auto-deploy on push to `main`

Cloudflare's Git integration (not a GitHub Action). This is a **dashboard / OAuth** operation (external integration, human-gated by nature).

- [ ] Dashboard → **Workers & Pages → `fleetrent` → Settings → Builds → Connect**.
- [ ] Authorize the **Cloudflare GitHub App** for this repository (one-time OAuth; scope to this repo only).
- [ ] Configure build settings:
      - **Production branch:** `main`
      - **Build command:** `npm run build`
      - **Deploy command:** `npx wrangler deploy` (default)
      - **Root directory:** blank (repo root)
      - **Non-production branch command:** leave default `npx wrangler versions upload` (harmless; PR previews are out of scope but this just uploads a non-promoted version)
- [ ] **Runtime secrets** are already set from Phase 1 (Settings → Variables & Secrets). Build-time vars are **not required** because the schema vars are `optional` — `astro build` won't fail without them. (Optional: add them as build variables too if you want build-time `astro:env` validation; not needed for MVP.)
- [ ] **Trigger & verify:** push a trivial commit to `main` → confirm Cloudflare runs the build and deploys; the commit shows a Cloudflare check/status. Reload the URL to confirm the change shipped.

> Edge case: if the build fails immediately with a name error, the dashboard Worker name and `wrangler.jsonc` `name` (`fleetrent`) don't match — reconcile them.
> Tradeoff to acknowledge: once connected, **every push to `main` auto-deploys to production**. Destructive Supabase ops (drop table, rotate primary key, delete project) remain **human-only**, panel-by-hand.

---

## Phase 4 — Guardrails & rollback verification

- [ ] Confirm rollback works: `npx wrangler versions list` then `npx wrangler rollback [<version-id>]` reverts code in seconds.
- [ ] Record the **DB-migration caveat**: `wrangler rollback` reverts **code only** — Supabase schema migrations do not roll back. Any deploy paired with a migration needs a manual revert plan (register risk).
- [ ] Confirm observability (already `enabled` in `wrangler.jsonc`) via dashboard logs / `wrangler tail`. Remember: slow Supabase queries are invisible on Cloudflare's CPU-time meter — watch them via Supabase-side query insights (register risk).

---

## Verification summary (end-to-end)

1. `npm run build && npx wrangler deploy --dry-run` → no bundle/runtime errors, under 3 MB gzip.
2. Deployed `*.workers.dev` URL: catalog renders, **no** missing-config banner (runtime secrets OK).
3. Full auth round-trip on the deployed URL (signup → confirm → signin → `/dashboard`).
4. Push to `main` → Workers Builds auto-deploys; commit shows Cloudflare status.
5. `wrangler versions list` + a test `wrangler rollback` → rollback path proven.

## Files to be modified

- `wrangler.jsonc` — `name` → `fleetrent`
- `.github/workflows/ci.yml` — trigger branches `master` → `main`

External (no repo change): Cloudflare runtime secrets, Cloudflare Workers Builds connection, Supabase Auth URL configuration.
