---
change_id: public-info-pages
title: Public informational pages (About / FAQ / Pricing)
status: plan_reviewed
created: 2026-08-01
updated: 2026-08-02
archived_at: null
---

## Notes

Roadmap slice **S-09** (`context/foundation/roadmap.md`). Net-new / post-v1 (not in PRD); Cennik reuses FR-003 pricing data.

Three public pages over the existing shell (`Layout` + `SiteHeader` + `SiteFooter`), English slugs + Polish labels, added to header + footer nav:

- `/about` — **O nas** — static content
- `/faq` — **FAQ** — static content (accordion or native `<details>`; no `Accordion` primitive in `src/components/ui/` yet)
- `/pricing` — **Cennik** — **dynamic**: prices pulled from fleet data (reuse the pricing already on `/fleet` as the single source; don't re-derive)

Decisions carried in from roadmap discussion (2026-08-01):

- User supplies **mockups for all three pages at the start of `/10x-plan`** — the Design Alignment Audit runs against those (port exact values per `context/foundation/lessons.md`, check against tokens + business logic).
- **Reconcile Cennik's pricing model with our stored rate fields** (daily/monthly rate, deposit, km limit, per-extra-km). If the mockup shows a model we don't store (weekly tiers, package deals, promo prices), flag it as a data-model gap — don't silently invent.
- O nas / FAQ copy likely arrives with the mockups; if layout-only, real Polish copy gates launch (content task, not build).
