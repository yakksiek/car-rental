---
change_id: deployment
title: Cloudflare Workers integration & deployment (Workers Builds auto-deploy on main)
status: implemented
created: 2026-05-29
updated: 2026-07-09
---

## Notes

Seeded from `context/foundation/infrastructure.md` → **Cloudflare Workers** as the MVP
platform, deployed via **Cloudflare's native Git integration (Workers Builds)** so pushes
to `main` auto-deploy without a GitHub Action.

Full plan in `deployment-plan.md`. All concrete deliverables shipped:

- **Worker rename** `10x-astro-starter` → `fleetrent` in `wrangler.jsonc` (commit `eafadad`).
- **CI branch fix** `master` → `main` in `.github/workflows/ci.yml` (commit `eafadad`).
- **Account pinned** + `nodejs_compat_populate_process_env` flag (commits `258bcc3`, `6abe51f`).
- **Live in production:** `fleetrent.marcin-kulbicki.workers.dev`, runtime Supabase secrets
  wired, Workers Builds auto-deploy on `main` active.

Retired as a historical record.

> Stale references in `deployment-plan.md`: its checkboxes were never ticked, and it names
> Supabase project `recfckvdrnedcuqzpbtg` — the real prod project ref is `fmgbyfpilgzvhkziigsj`.
> Treat the plan as the original design, not current truth.
