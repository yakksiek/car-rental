---
starter_id: 10x-astro-starter
package_manager: npm
project_name: fleet-rent
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

FleetRent is a web-app for a small team on a 3-week timeline with auth, file storage (protocol photos), and transactional email as the key technical demands. The 10x-astro-starter ships Astro 6 + React 19 + TypeScript + Tailwind CSS 4 + Supabase + Cloudflare out of the box — auth, PostgreSQL, file storage, and edge deployment are built in. It clears all four agent-friendly quality gates (typed, convention-based, popular in training data, well-documented) and matches the existing repo scaffold. The standard path was taken because the recommended default for (web-app, js) fits the project priors without modification. Deployment targets Cloudflare Pages (the starter's default), CI runs on GitHub Actions with auto-deploy-on-merge — both already configured in the repo.
