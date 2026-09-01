# Demo Account Gate — Plan Brief

> Full plan: `context/changes/demo-account-gate/plan.md`
> Design contract: `context/changes/demo-account-gate/design-contract.md`

## What & Why

This deployment is a portfolio, and the half worth showing — the staff cockpit — sits behind auth and a role gate. A recruiter following a link from a CV currently reaches `/auth/signin` with no way in.

We publish a **demo admin account** on the sign-in page and mark it in the database, so it can explore everything but cannot reach the three staff mutations that either send mail from a domain we own or can lock the owner out of their own deployment.

## Starting Point

Auth resolves a profile on every request in `src/middleware.ts` — one indexed PK lookup that already reads `role` and `deactivated_at` — and gates routes through the pure `resolveRequiredRole` / `isRoleSufficient` pair in `src/lib/access.ts`. `profiles` RLS already permits a caller to read their own row.

Of the staff mutations, exactly one — `POST /api/staff` — accepts a **caller-supplied** email address, which flows to GoTrue over Resend SMTP as `Flota <kontakt@wujcar.com>`. The `deactivate_staff` RPC guards `self` and `last_admin`, but not "some other admin", so a demo admin could deactivate the owner's real account once both exist in prod.

## Desired End State

A recruiter opens `/auth/signin`, clicks **Wypełnij dane demo**, and lands in `/dashboard` as an admin. They browse the fleet, approve and reject reservations, create manual reservations, run issue and return protocols, and read the full staff roster.

Adding a staffer, removing one, or triggering a password reset shows a clear Polish message saying it is disabled in demo mode — and the server refuses it regardless of what the UI offers.

## Key Decisions Made

| Decision            | Choice                                                          | Why                                                                                                                                               | Source       |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Demo marker         | `is_demo` boolean on `profiles`                                 | Rides the profile lookup middleware already performs; leaves the owner's real admin unaffected, so no secret needs flipping to do real staff work | Conversation |
| Gate scope          | `POST /api/staff`, `[id]/deactivate`, `[id]/reset-password`     | The only arbitrary-recipient send, the only lockout vector, and a one-click real send with no confirm step                                        | Conversation |
| Left ungated        | `[id]/invite`, both protocol `resend-email` routes              | Recipients are resolved server-side from existing records; invite additionally requires `password_set_at is null`                                 | Plan         |
| Credential delivery | Prefill button **and** visible credentials on `/auth/signin`    | One click for the impatient, readable for anyone who wants to know what they're signing into                                                      | Conversation |
| No `/demo` endpoint | Publish on the existing sign-in path                            | A new unauthenticated session-minting route is strictly more surface than credentials on an already-hardened form                                 | Plan         |
| Credential storage  | `DEMO_EMAIL` / `DEMO_PASSWORD` as `access: "public"` env fields | Rotation becomes a `wrangler secret` change, not a commit; `public` honestly represents a deliberately-published value                            | Plan         |
| Demo account role   | Admin only, no demo employee                                    | Role-gating is already visible in `access.ts` and its tests                                                                                       | Plan         |
| Data reset          | Trailing phase 4, independently skippable                       | A scheduled endpoint that truncates business tables is the most dangerous thing here; earn it only once the data visibly rots                     | Conversation |

## Scope

**In scope:** `is_demo` column and its path to `App.Locals`; an `isDemoAccount` predicate beside `requireRole`; guards on three routes; banner mapping so the roster names the real cause; disabled affordances in `StaffList`; a seeded `demo@fleetrent.test` admin; the sign-in card and prefill; unit, integration and E2E coverage.

**Out of scope:** a demo employee account; a `DEMO` badge in the roster; gating the invite or protocol-email routes; any read-side restriction; changes to the `deactivate_staff` RPC guards.

## Architecture / Approach

Mark the account, not the deployment.

```
profiles.is_demo ──► middleware profile lookup (existing query, +1 column)
                        │
                        ▼
                  App.Locals.isDemo
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
 isDemoAccount(locals)          StaffList prop
 → 403 demo_blocked             → controls disabled
   (the real boundary)            (courtesy only)
```

Defense sits on the server; the UI merely stops offering what the server will refuse. The 403 carries `code: "demo_blocked"` because `staff-report.ts` already maps a bare 403 to a bad-origin/unconfigured sentence.

## Phases at a Glance

| Phase                           | What it delivers                                                 | Key risk                                                                             |
| ------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1. `is_demo` through the stack  | Column, types, `App.Locals.isDemo`, predicate, seeded demo admin | Seed edits touching the accounts `auth.setup.ts` and the integration suite depend on |
| 2. Guard three routes           | 403 `demo_blocked` + banner mapping + disabled controls          | A bare 403 misattributed to bad-origin in the roster banner                          |
| 3. Sign-in demo card            | Env fields, card, prefill, E2E                                   | Design delta on a close port of `staff-login.jsx` — carries the vision-diff gate     |
| 4. Nightly reset _(deferrable)_ | Cron, `reset_demo_data()`, secret-authenticated route            | A scheduled endpoint that truncates business tables                                  |

**Prerequisites:** Local Supabase running; prod Supabase linked for the eventual `db push`; `wrangler` access for the two secrets.
**Estimated effort:** ~2 sessions for phases 1–3; phase 4 is a separate session if ever taken.

## Open Risks & Assumptions

- **Migrations lag the Worker deploy.** Merging to `main` deploys the Worker but pushes no migrations. Shipping phases 1–2 without `supabase db push` leaves prod selecting a column that doesn't exist — breaking the middleware profile lookup for _every_ authenticated request, not just demo ones. The runbook makes this explicit; it remains the sharpest operational risk in the plan.
- **Provisioning is ordered.** The prod demo account must be created and its password set _before_ it is marked `is_demo`, because phase 2 blocks a demo caller from completing an invite.
- **Phase 4's scheduled-handler contract is unverified.** It's the one piece not already demonstrated in this repo; confirm against current Cloudflare Workers docs at implementation time.
- **Assumption:** seed reservation and protocol data is fictional, so a demo admin reading every record exposes nothing. True today; it would stop being true if prod ever carried real customer data.

## Success Criteria (Summary)

- A recruiter reaches the staff cockpit in one click from `/auth/signin` and can exercise the reservation, fleet and protocol flows end to end.
- The three guarded actions are refused server-side with an accurate Polish message, verified by direct API call rather than through the UI.
- No mail leaves `wujcar.com` as a result of anything a demo visitor does.
