# Flota — Commercial-Vehicle Rental & Fleet Operations

**A production two-sided rental platform**: a public catalog-and-booking front-end for
customers, and a role-gated **staff dispatch cockpit** for the people who actually run the
lot — approvals, a fleet calendar, handover/return protocols, and the account system that
onboards the staff themselves.

[![Live](https://img.shields.io/badge/live-fleetrent.marcin--kulbicki.workers.dev-0f172a?style=flat-square)](https://fleetrent.marcin-kulbicki.workers.dev)
![Astro](https://img.shields.io/badge/Astro%206-SSR-ff5d01?style=flat-square)
![React](https://img.shields.io/badge/React%2019-islands-61dafb?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e?style=flat-square)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-f38020?style=flat-square)
![Tests](https://img.shields.io/badge/tests-734%20passing-16a34a?style=flat-square)

![Staff dispatch cockpit](docs/screenshots/dashboard.jpg)

---

## Highlights

The three pieces I'd point at first — each one is a real security or data-access problem,
not a CRUD screen.

|                                                                                                           🔐 **Staff login & role gate**                                                                                                            |                                                                                                                                      ✉️ **Invite-link onboarding**                                                                                                                                       |                                                                                                                             ⌘K **Global search**                                                                                                                             |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|                                                                                       [![Sign in](docs/screenshots/signin.jpg)](docs/screenshots/signin.jpg)                                                                                        |                                                                                                          [![Team roster](docs/screenshots/staff-roster.jpg)](docs/screenshots/staff-roster.jpg)                                                                                                          |                                                                                          [![Global search](docs/screenshots/search-global.jpg)](docs/screenshots/search-global.jpg)                                                                                          |
| Cookie-based SSR sessions. Role comes from a **`profiles` lookup, not a JWT claim**, and every protected path resolves through a pure, **fail-closed** route→role map. Public signup is disabled: every account is staff, provisioned deliberately. | An admin invites by e-mail; the hire sets their own first password from a tokenized link. The link is **idempotent** — it's validated without being spent, so opening it twice still works — and the roster's ACTIVE/INVITED state reads an **owned** signal, not GoTrue's misleading `last_sign_in_at`. | One ⌘K box over reservations, returns and vehicles. The `reservations` SELECT grant is **revoked**, so search _has_ to cross the RLS boundary through a role-gated `SECURITY DEFINER` RPC — backed by **pg_trgm GIN indexes** so a leading-wildcard `ILIKE` stays indexable. |

---

## Screens

### Staff operations

**Global search (⌘K)** — grouped live results across reservations, returns and vehicles,
with match highlighting and full keyboard navigation. Desktop dropdown, mobile full-screen.

![Global search](docs/screenshots/search-global.jpg)

**Team** — the admin roster: invite, re-send an invite, reset a password, deactivate.
`AKTYWNY` vs `ZAPROSZONY` is derived from whether a password was ever set through one of
our own routes.

![Team roster](docs/screenshots/staff-roster.jpg)

**Quick actions** — a create affordance in the shell header on every staff page: a manual
(phone-in) reservation, or a new vehicle.

![Quick actions](docs/screenshots/quick-actions.jpg)

**Reservations queue** — pending requests with approve / reject; a decision fires the
customer e-mail.

![Reservations queue](docs/screenshots/dashboard-reservations.jpg)

**Returns** — vehicles due back, filtered by state, with days-overdue called out and a
one-tap call link.

![Returns queue](docs/screenshots/returns.jpg)

**Fleet calendar** — every booking across the fleet on one timeline.

![Fleet calendar](docs/screenshots/dashboard-calendar.jpg)

**Fleet management** and **your own account** (in-session password change, no e-mail
round-trip):

|                      Fleet admin                      |                      My account                      |
| :---------------------------------------------------: | :--------------------------------------------------: |
| ![Fleet management](docs/screenshots/fleet-admin.jpg) | ![Staff account](docs/screenshots/staff-account.jpg) |

**Mobile** — the cockpit is built for the lot, not just the desk:

<p align="center"><img src="docs/screenshots/mobile-dashboard.jpg" alt="Staff dispatch on mobile" width="320"></p>

### Customer booking

**Landing** — the public front door.

![Landing](docs/screenshots/landing.jpg)

**Vehicle detail** — spec, pricing and a live availability calendar driven by real
busy-ranges. No account required.

![Vehicle detail and booking](docs/screenshots/reserve.jpg)

**Catalog** and **pricing**, both server-rendered from live fleet data:

|                Fleet catalog                 |                 Pricing                  |
| :------------------------------------------: | :--------------------------------------: |
| ![Fleet catalog](docs/screenshots/fleet.jpg) | ![Pricing](docs/screenshots/pricing.jpg) |

Browse and reserve on mobile:

|                           Fleet                           |                           Reservation                           |
| :-------------------------------------------------------: | :-------------------------------------------------------------: |
| ![Mobile fleet browse](docs/screenshots/mobile-fleet.jpg) | ![Mobile reservation form](docs/screenshots/mobile-reserve.jpg) |

### Protocols — handover & return

> _The two images below are design references. Every other screenshot in this README is a
> live capture of the running app._

**Return comparison** — the return protocol auto-diffs against the pickup baseline:
distance driven, fuel change, and new vs. existing damage, rolled up into a
_wydanie → zwrot_ summary.

![Return protocol comparison](docs/screenshots/return-comparison.jpg)

**Handover capture** happens on mobile, on the lot — odometer, fuel, six photo slots, and
damage notes.

<p align="center"><img src="docs/screenshots/pickup-protocol.jpg" alt="Handover protocol (mobile)" width="360"></p>

---

## What it is

Two audiences, one app, split across a hard trust boundary:

- **Customers (anonymous).** Browse the catalog, filter by category, check availability
  against real busy-ranges, and submit a reservation request. They never sign in — the
  confirmation e-mail carries a tokenized link to a live status page.
- **Staff (authenticated).** A cookie-authenticated dashboard, gated by role
  (`admin` / `employee`). Staff triage the pending queue, search the whole operation from
  the header, create manual bookings for phone-in customers, view the fleet calendar,
  manage vehicles, and run the two physical protocols that bracket every rental:
  **handover** (pickup) and **return**.

The protocols are the heart of the operational side. Each captures per-slot photos (decoded
client-side, HEIC included) and structured damage records, is rendered to a **PDF** on the
server, and is **e-mailed** to the customer with delivery status tracked. The return
protocol is compared against the pickup baseline, so the record of _new_ damage is
unambiguous.

The product is Polish-language (`pl-PL`), with timestamps pinned to `Europe/Warsaw` for
SSR-stable rendering.

## Feature map

| Area                     | What's built                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Auth & access**        | Cookie SSR sessions, DB-backed roles, fail-closed route gate, deactivation, self-service password reset, in-session password change |
| **Account provisioning** | Admin invites by e-mail, idempotent tokenized links, invite re-send, owned password-set signal, link-conflict handling              |
| **Search**               | Header ⌘K omnisearch across reservations / returns / vehicles; grouped results, keyboard nav, trigram-indexed                       |
| **Reservations**         | Public request → staff approve/reject → e-mail; **manual** staff-created confirmed bookings; atomic overlap protection              |
| **Dispatch**             | Pulpit cockpit (KPIs, today's schedule, decision rail), pickups & returns worklists, overdue flagging, fleet calendar               |
| **Protocols**            | Handover + return capture, photos (client-side HEIC decode), damage records, server-rendered PDF, tracked e-mail delivery           |
| **Fleet**                | Vehicle CRUD, activation, pricing fields feeding both the public catalog and the pricing page                                       |
| **Public site**          | Landing, catalog, vehicle detail with availability, tokenized status page, About / FAQ / Pricing                                    |

## Tech stack

| Layer         | Choice                                                                                        | Why                                                                                |
| ------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Framework     | [Astro 6](https://astro.build/) — SSR (`output: "server"`)                                    | Every page server-rendered at the edge; islands only where interactivity is needed |
| Interactivity | [React 19](https://react.dev/) islands                                                        | Booking flow, calendar, search, and protocol capture are the client-side surfaces  |
| Language      | [TypeScript 5](https://www.typescriptlang.org/)                                               | DB row types generated from the Supabase schema; typed DTOs in `src/types.ts`      |
| Styling       | [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) ("new-york") | Utility-first layout with a handful of accessible primitives                       |
| Backend       | [Supabase](https://supabase.com/) — Postgres + Auth + RLS + Storage                           | Cookie-based SSR auth, row-level security as the access contract, photo storage    |
| Forms         | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)                     | One validation schema shared by the form and the API route                         |
| Documents     | [pdf-lib](https://pdf-lib.js.org/) (+ fontkit)                                                | Server-generated PDF protocols                                                     |
| E-mail        | [Resend](https://resend.com/)                                                                 | Transactional delivery — confirmations, decisions, protocol PDFs                   |
| Hosting       | [Cloudflare Workers](https://workers.cloudflare.com/)                                         | SSR runtime at the edge (`@astrojs/cloudflare`)                                    |

## Architecture

- **SSR on the edge.** `output: "server"` via `@astrojs/cloudflare`; there is no static
  prerendering. `Layout.astro` wraps every page and surfaces missing-config banners.
- **Two trust zones in one deploy.** The public catalog/booking surface (anon) and the staff
  dashboard live in the same app. `src/middleware.ts` resolves the user on every request;
  which paths require which role is a declarative map in `src/lib/access.ts` (`ROUTE_ROLES`),
  evaluated **fail-closed** with `admin ⊇ employee`. Role comes from a `profiles.role`
  lookup, not a JWT claim — so deactivating someone takes effect on their next request.
- **Row-level security is the access contract.** Direct SELECT on `reservations` is revoked
  from both `anon` and `authenticated`; `protocols` is `revoke all` + RLS-on with zero
  policies. Every read of either crosses the boundary through a `SECURITY DEFINER` RPC that
  re-checks the caller's role in its own body — defense in depth, not either/or. The public
  status page resolves through a definer RPC keyed by a bearer token in the URL
  (`/r/[token]`) — the URL _is_ the credential, and the page is `noindex`.
- **Booking integrity is enforced by the database.** Overlapping rentals are impossible by
  construction: a Postgres `EXCLUDE` constraint over the reservation period rejects the
  conflict atomically, so the staff "manual reservation" path and the public request path
  can't race each other.
- **The protocol pipeline.** Pickup / return capture → photos (client-side HEIC decode) +
  damage records persisted in Supabase → PDF rendered with `pdf-lib` → delivered by Resend →
  outcome recorded in `email_deliveries`. Return protocols diff against the pickup baseline.
- **Single locale, on purpose.** `pl-PL` copy and `Europe/Warsaw` timestamps are pinned so
  SSR output and client hydration agree.

### A closer look: the invite journey

Worth calling out because it's where the interesting bugs lived.

An admin adds a hire → GoTrue sends an invite mail through custom SMTP with our own Polish
template → the link lands on `/auth/callback` carrying `token_hash` + `type`.

The callback used to `verifyOtp` on the **GET**, which spent the token as the set-password
form _rendered_. Two consequences: closing the tab burned the link ("Link wygasł" on
reopen), and merely clicking the link minted a full employee session before any password
existed. The fix defers the exchange to the **POST**, so the token is spent in the same
operation that sets the password — which meant re-establishing, explicitly, the four
guarantees `verifyOtp` had been enforcing implicitly. They now live in
[`resolve_link_token`](supabase/migrations/20260821110000_resolve_link_token.sql), which
returns no row unless identity, hash↔type pairing, expiry, **and** deactivation all check
out. Fail-closed: a GoTrue upgrade that breaks the lookup refuses links, it never opens one.

Separately, the roster's ACTIVE/INVITED status used to read `auth.users.last_sign_in_at` —
which GoTrue stamps on the _link exchange_, so a hire who merely clicked their link read as
active and was never sent anything again. That proxy is replaced by
[`profiles.password_set_at`](supabase/migrations/20260821100000_password_set_signal.sql), a
signal we write ourselves from our own two set-password routes.

## Testing

**734 tests across 67 files**, three layers, each scoped to what it tests best:

| Layer           | Count           | What it covers                                                                                          |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| **Unit**        | 423 in 35 files | Pure functions — the authz matrix, availability maths, protocol diffing, search grouping (node env)     |
| **Integration** | 286 in 25 files | Services and API routes against a **live local Supabase** — RLS, RPC role gates, the overlap constraint |
| **E2E**         | 25 in 7 files   | Playwright, browser → middleware → route → DB → rendered HTML, incl. the real invite/reset mail flow    |

Deliberately, the RLS policies, the `EXCLUDE` constraint and the authz matrix are proven
in the **integration** layer rather than re-proven in the browser — E2E is reserved for
risks a cheaper test would have to lie about. Quality gates run as git hooks (lint +
related unit tests + `astro check` on commit; the full integration suite on push).

## How it was built

This project was developed **spec-first with an AI coding agent**, using a structured,
markdown-driven workflow (the 10xDevs AI Toolkit). Rather than ad-hoc prompting, every unit
of work flowed through durable artifacts under `context/`:

```
shape an idea  →  PRD  →  tech-stack + infra decisions  →  roadmap
                                                              │
            per change:  identity → plan → plan-review → implement → archive
```

- `context/foundation/` — the durable "what & why": shaping notes, PRD, tech-stack
  rationale, the roadmap of vertical slices, and accumulated `lessons.md`.
- `context/changes/<id>/` — one folder per change, each with a written **implementation
  contract** (plan), research notes, a design contract, and recorded progress (commit SHAs
  written back after each phase).
- `context/archive/` — 34 completed changes, frozen — including the security pass that found
  and closed the RLS PII-exposure gap on `reservations`, and the review that caught a
  recovery route which would set a password for _any_ authenticated session.

The result is a codebase where the _reasoning_ behind each decision is checked in alongside
the code, and the implementation was executed one verified slice at a time.

## Getting started

Requires **Node.js v22.14.0** (see `.nvmrc`) and **Docker** (for local Supabase).

```bash
npm install
npx astro sync            # generate `astro:env/server` virtual module types
npx supabase start        # local Postgres + Auth + Storage (prints SUPABASE_URL / SUPABASE_KEY)
npm run dev               # Astro dev server at http://localhost:4321
```

Auth is optional in development — with no Supabase credentials the app still runs and simply
disables the auth-gated features. To exercise the full flow, put the values `supabase start`
prints into `.env` / `.dev.vars`, then `supabase db reset` seeds signable staff accounts
(`admin@fleetrent.test` / `employee@fleetrent.test`, dev-only). Add `RESEND_API_KEY` +
`EMAIL_FROM` to enable e-mail delivery.

## Scripts

| Script                      | Does                                                    |
| --------------------------- | ------------------------------------------------------- |
| `npm run dev`               | Start the Astro dev server (Cloudflare workerd runtime) |
| `npm run build`             | Production SSR build                                    |
| `npm run preview`           | Preview the production build locally                    |
| `npm run lint` / `lint:fix` | ESLint with type-checked rules                          |
| `npm run format`            | Prettier (+ Astro + Tailwind class sorting)             |
| `npm test`                  | Unit tests (Vitest, node environment)                   |
| `npm run test:integration`  | Integration tests (serial, against a local Supabase)    |
| `npm run test:e2e`          | Playwright end-to-end tests                             |
| `npm run test:watch`        | All Vitest projects in watch mode                       |

## Project structure

```
src/
├─ pages/
│  ├─ index.astro, fleet/, reserve.astro, r/[token].astro   # public: catalog, booking, tokenized status
│  ├─ about.astro, faq.astro, pricing.astro                 # public: info pages
│  ├─ auth/               # signin, callback, forgot/reset password, link-conflict
│  ├─ dashboard/          # staff: pulpit, reservations, calendar, pickups, returns, vehicles, staff, account
│  └─ api/                # vehicles, reservations, protocols, search, staff, auth (zod-validated)
├─ components/            # React islands (fleet · reservation · protocol · search · staff · account) + shell + ui
│  └─ hooks/
├─ lib/
│  ├─ services/           # reservations, vehicles, protocols, search, staff, email-delivery
│  ├─ access.ts           # ROUTE_ROLES — the pure, fail-closed role gate
│  └─ auth-session.ts · supabase.ts · config-status.ts · utils.ts
├─ middleware.ts          # auth + role gate on every request
└─ types.ts               # DB row types + DTOs
supabase/
├─ migrations/            # 29 migrations: tables, enums, RLS policies, 25 SECURITY DEFINER RPCs
├─ templates/             # custom Polish invite / recovery mail templates
└─ seed.sql
e2e/ · tests/integration/ # Playwright specs · live-Supabase integration suite
context/                  # spec-driven build artifacts (PRD, roadmap, change plans, archive)
```

## Deployment

Deployed to **Cloudflare Workers** (SSR) via `wrangler` (worker name `fleetrent`), with
**Supabase** as the managed backend. Set `SUPABASE_URL` / `SUPABASE_KEY` (and
`RESEND_API_KEY` / `EMAIL_FROM` for e-mail) as Worker secrets. CI (GitHub Actions) runs
`astro sync` + lint + build on every push and PR to `main`.

## Credits

Built by **Marcin Kulbicki**. Scaffolded from the 10x Astro Starter; developed with an
AI-assisted, spec-driven workflow (10xDevs AI Toolkit).
