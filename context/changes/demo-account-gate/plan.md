# Demo Account Gate Implementation Plan

## Overview

This deployment is a portfolio. The half worth showing — the staff cockpit — sits behind auth and a role gate, so a recruiter following a link from a CV currently hits `/auth/signin` with no way in.

This plan adds a **demo admin account** whose credentials are published on the sign-in page, and marks that account in the database (`profiles.is_demo`) so the three staff mutations that reach the outside world or can lock the owner out are refused for it. Everything else in the cockpit stays fully live.

## Current State Analysis

**Auth and role resolution already give us the seam for free.** `src/middleware.ts:31` resolves the caller's profile on every request with one indexed PK lookup:

```
.select("role, deactivated_at").eq("user_id", user.id).maybeSingle()
```

and writes `context.locals.role`. Adding a third column to that select costs nothing — no extra query, no new call site.

**The RLS posture already permits reading it.** `profiles_select_authenticated` (`supabase/migrations/20260604153139_employee_admin_roles.sql:73`) is `using (user_id = auth.uid() or current_app_role() = 'admin')`. Middleware reads the caller's _own_ row, so a new column needs no policy change.

**Only one route accepts a caller-supplied email address.** `POST /api/staff` validates with `employeeInviteSchema` (`src/lib/services/staff.ts:31`) = `{ email: z.email(), full_name }`, and that address flows to `inviteUserByEmail`. On prod that is GoTrue over Resend SMTP sending as `Flota <kontakt@wujcar.com>`.

The sibling routes do **not** share this property, and were ruled out of the gate on that basis:

| Route                                                 | Recipient                                           | Verdict                                                            |
| ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| `POST /api/staff`                                     | caller-supplied                                     | **gated** — arbitrary-recipient send                               |
| `POST /api/staff/[id]/deactivate`                     | n/a                                                 | **gated** — lockout, see below                                     |
| `POST /api/staff/[id]/reset-password`                 | `getStaffEmail(admin, id)`                          | **gated** — one-click real send, no confirm step                   |
| `POST /api/staff/[id]/invite`                         | `getStaffEmail`, gated on `password_set_at is null` | not gated — can only mail an already-listed, password-less staffer |
| `/api/{protocols,return-protocols}/[id]/resend-email` | protocol's stored customer                          | not gated — fictional seed addresses                               |

**The deactivate lockout the RPC does not cover.** `deactivateStaff` (`src/lib/services/staff.ts:412`) delegates to the `deactivate_staff` RPC, whose guards return `"self" | "last_admin"`. So a demo admin cannot remove itself, and cannot remove the last admin. It **can** remove a _different_ admin — meaning that once the owner's real admin account coexists with the demo one in prod, a visitor can deactivate the owner. Recoverable only by direct SQL.

**The sign-in form is already state-driven.** `SignInForm.tsx` holds `email`/`password` in `useState`, so prefill is a two-line handler. The page is a close port of design `staff-login.jsx` (`src/pages/auth/signin.astro:8`), so the demo card is a genuine design delta — see the Design Alignment Audit.

**The roster island surfaces API failures through a mapped banner, not raw text.** `src/lib/staff-report.ts` resolves `{ httpStatus, code }` into a `Report` (`resolveAddReport`, `resolveRemoveReport`, `resolveRowActionReport`). A bare 403 already means "bad origin" or "unconfigured" there, so a demo 403 must carry a distinguishing `code` or it will render a misleading sentence.

## Desired End State

A recruiter opens `/auth/signin` (reachable from "Strefa pracownika" in `SiteFooter.astro`), sees a card naming the demo account, clicks **Wypełnij dane demo**, signs in, and lands in `/dashboard` as an admin. They can browse the fleet, approve and reject reservations, create manual reservations, run issue and return protocols, and read the full staff roster.

If they try to add a staffer, remove one, or trigger a password reset, they get a clear Polish message saying it is disabled in demo mode — and the server refuses it regardless of what the UI shows.

Verify by: signing in with the published credentials on prod, confirming the three actions are refused, and confirming no mail leaves `wujcar.com` as a result.

### Key Discoveries:

- `src/middleware.ts:31` — the single profile lookup that carries `role`; extend, don't duplicate.
- `supabase/migrations/20260604153139_employee_admin_roles.sql:73` — `profiles` SELECT policy already covers own-row reads; no policy work needed.
- `src/lib/access.ts:79` — `requireRole(locals, min)` is the established in-handler guard shape; the demo predicate belongs beside it.
- `src/lib/services/staff.ts:31` — `employeeInviteSchema` is why `POST /api/staff` is the only relay.
- `src/lib/staff-report.ts:129` — `ReportTarget`/`Report` is the only path to a roster banner; a new failure needs a branch here.
- `supabase/seed.sql:145-232` — the dev staff/auth block, with the exact `auth.users` + `identities` + `profiles` triple a signable-in seeded account needs. `seed.prod.sql` deliberately excludes it.
- `e2e/auth.setup.ts` and the integration suite sign in as `admin@fleetrent.test` / `employee@fleetrent.test`. The demo account must be a **new** account so no existing password rotates.

## What We're NOT Doing

- **No demo employee account.** Admin only. The role-gating story is visible in `access.ts` and its tests; a second seeded account is not worth the surface.
- **No `DEMO` badge in the staff roster.** It would need its own design-contract entry on a second surface for a signal only the owner would ever read.
- **No gating of `/api/staff/[id]/invite` or the protocol resend-email routes** — see the Current State table for why each is not a relay.
- **No new unauthenticated endpoint.** An earlier idea — a `/demo` route that mints a session server-side — is deliberately dropped: publishing credentials on the existing, already-hardened sign-in path adds strictly less surface than a new session-granting route.
- ~~**No changes to the `deactivate_staff` RPC guards.**~~ **Superseded during Phase 2 (owner, 2026-08-28.)** A route-only gate was probed and found bypassable: `profiles.is_demo` is not a JWT claim, the demo credentials are published, and the publishable anon key is serialized into the page HTML on the protocol screens — so a visitor can reach PostgREST directly. The RPC now carries a `demo` arm and the `profiles` write policies exclude demo callers. The `self`/`last_admin` guards themselves are untouched. See Phase 2 §6.
- **No read-side restrictions.** A demo admin sees every page and every record a real admin sees. The seed data is fictional.

## Implementation Approach

Mark the account, not the deployment. A boolean on `profiles` rides the lookup middleware already performs, lands on `App.Locals` next to `role`, and is read by a pure predicate in `access.ts` — the same shape as `requireRole`. The owner's own admin account is unaffected, so no secret needs flipping to do real staff work.

Defense sits on the server; the UI merely stops offering what the server will refuse.

---

## Phase 1: `is_demo` through the stack

### Overview

Add the column, carry it to `App.Locals`, expose a predicate, and seed a local demo admin so phases 2 and 3 have something to test against.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260828120000_demo_account_flag.sql`

**Intent**: Add the demo marker to `profiles`. Additive and non-breaking — every existing row is a real account.

**Contract**: `alter table profiles add column is_demo boolean not null default false;` No RLS or grant changes: `profiles_select_authenticated` already covers own-row and admin reads. Add a table comment explaining that the flag denies outward-reaching mutations rather than granting anything, so it is safe by default.

#### 2. Generated DB types

**File**: `src/db/database.types.ts`

**Intent**: Regenerate so `profiles.is_demo` is typed for the middleware select.

**Contract**: Regenerated output only — no hand edits.

#### 3. App.Locals

**File**: `src/env.d.ts`

**Intent**: Carry the flag per request beside `role`.

**Contract**: `isDemo: boolean` on `App.Locals`. Non-nullable and defaulting to `false` — an unauthenticated or profile-less caller is not a demo caller, and the guard must never depend on a nullable read.

#### 4. Middleware wiring

**File**: `src/middleware.ts`

**Intent**: Populate `locals.isDemo` from the profile lookup that already runs.

**Contract**: Extend the existing `.select("role, deactivated_at")` to include `is_demo`; set `context.locals.isDemo` from the row. Set it to `false` on all three fail-closed paths the file already handles — no user, no profile, and Supabase unconfigured. A deactivated profile resolves `role` to `null` today; `isDemo` should follow the raw column so the two decisions stay independent.

#### 5. Demo predicate

**File**: `src/lib/access.ts`

**Intent**: One named predicate the guarded routes call, kept beside `requireRole` because it is the same concern — an in-handler check adapting `App.Locals` to a decision.

**Contract**: `export function isDemoAccount(locals: App.Locals): boolean`. Reads `locals.isDemo` only. Keep the file's pure/I-O-free property intact.

#### 6. Local seed demo admin

**File**: `supabase/seed.sql`

**Intent**: A signable-in `demo@fleetrent.test` admin with `is_demo = true`, so integration and E2E can exercise the gate without touching the accounts the existing suites depend on.

**Contract**: Follow the existing dev-account pattern at `supabase/seed.sql:169-232` exactly — an `auth.users` row with a `crypt(..., gen_salt('bf'))` password, a matching `identities` row whose `identity_data.sub` echoes the user id, and a `profiles` row with `role = 'admin'`, `is_demo = true`, `password_set_at` stamped. Use a fresh fixed UUID in the established style (e.g. `d0000000-0000-0000-0000-0000000000de`). Extend the credential comment block at `supabase/seed.sql:145` with the new account.

**Do not touch** `admin@fleetrent.test` or `employee@fleetrent.test` — `e2e/auth.setup.ts` and the integration suite authenticate as those, and rotating either breaks both suites.

`seed.prod.sql` is not modified: it excludes the staff/auth block by design, and the prod demo account is provisioned by the runbook in Migration Notes.

#### 7. Unit coverage

**File**: `src/lib/access.test.ts`

**Intent**: Pin the predicate's fail-closed behavior.

**Contract**: Cover `isDemo: true` → `true`, `isDemo: false` → `false`, and that the predicate is independent of `role` (a demo _employee_ would also be flagged, even though we only seed an admin).

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Unit tests pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- `demo@fleetrent.test` signs in locally and reaches `/dashboard`
- The existing `admin@fleetrent.test` and `employee@fleetrent.test` logins still work unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Guard the three mutation routes

### Overview

Refuse the arbitrary-recipient send, the lockout vector, and the one-click mail send for demo callers — on the server first, then stop the UI from offering them.

### Changes Required:

#### 1. Route guards

**Files**: `src/pages/api/staff.ts`, `src/pages/api/staff/[id]/deactivate.ts`, `src/pages/api/staff/[id]/reset-password.ts`

**Intent**: Add the demo refusal to each route's existing self-gating ladder.

**Contract**: A `MSG.demoBlocked` entry in each file's existing `MSG` object, and a guard placed **after** the `requireRole` admin check and **before** any body parse or admin-client construction — so a demo caller's refusal reason is "demo", never "unconfigured", and no service-role client is built for a request that will be refused.

Respond `403` with `{ error: MSG.demoBlocked, code: "demo_blocked" }`. The `code` is load-bearing: `staff-report.ts` already maps a bare 403 to a bad-origin/unconfigured sentence, so without it the roster banner would name the wrong cause.

Shared Polish copy across all three: `"Ta akcja jest wyłączona na koncie demo."`

#### 2. Banner mapping

**File**: `src/lib/staff-report.ts`

**Intent**: Give the three resolvers a branch for the demo refusal so the roster banner explains it instead of misattributing it.

**Contract**: `resolveAddReport`, `resolveRemoveReport` and `resolveRowActionReport` each recognize a 403 carrying `code: "demo_blocked"` and return a `Report` with `tone: "error"` and the shared sentence. `RemoveOutcome` and `RowActionOutcome` are currently `{ kind: "http"; httpStatus: number }` and must widen to carry an optional `code`, matching `AddOutcome`'s existing shape. Target follows each mutation's `allowedTargets` — the remove flow keeps its modal, the row actions keep the banner. No retry affordance: retrying is futile by construction.

#### 3. Island affordances

**Files**: `src/pages/dashboard/staff.astro`, `src/components/staff/StaffList.tsx`

**Intent**: A demo admin should see the roster and its actions, but not be invited to click three things that will be refused.

**Contract**: The page passes `isDemo` from `Astro.locals` into the island as a prop. `StaffList` disables the "add employee" trigger and the remove / reset-password row actions when set, each carrying the shared sentence as its accessible explanation. The invite row action stays enabled — it is not gated. Buttons are disabled, not hidden: a recruiter should see that staff management exists and is deliberately fenced, which is the point of showing the slice at all.

#### 6. DB-layer gate (added during implementation, owner-approved)

**File**: `supabase/migrations/20260828140000_demo_account_write_gate.sql`

**Intent**: Close the same three actions at the layer the route cannot reach. Added after probing the route-only gate and finding all four of these succeed for a demo caller holding nothing but published credentials + the publishable anon key: direct `update profiles` (the lockout), `update profiles set role`, `delete from profiles`, and `rpc deactivate_staff`.

**Contract**: A `public.current_is_demo()` helper shaped exactly like `current_app_role()` (STABLE SECURITY DEFINER, `search_path = ''`, per-function revoke then grant to `authenticated` + `service_role`, coalescing a missing profile to `false` so an unknown caller is never locked out). The three `profiles` write policies gain `and not (select public.current_is_demo())` via `ALTER POLICY` in place; SELECT is untouched. `deactivate_staff` gains a `demo` arm after the admin check and before `self`, because SECURITY DEFINER bypasses RLS and is therefore a genuinely different door.

Safe for every non-demo caller by construction: no app code writes `profiles` through the caller's own authenticated client — `services/staff.ts` uses the service-role client and `mark_password_set()` is a definer RPC, both of which bypass RLS.

#### 4. Integration coverage

**File**: `tests/integration/staff.test.ts`

**Intent**: Prove the server boundary independently of the UI — the guard must hold against a direct API call.

**Contract**: Authenticate as a demo admin fixture and assert each of the three routes returns `403` with `code: "demo_blocked"`. ~~Assert the negative control: the same calls as a non-demo admin still succeed.~~ Assert `POST /api/staff/[id]/invite` is **not** refused for a demo caller, pinning the deliberate scope boundary. Follow the suite's existing fixture and cleanup conventions.

**Negative control weakened during Phase 2 — recorded 2026-09-01 (impl-review F8).** "Still succeed" is not reachable at this layer: the integration harness stubs `astro:env/server` unconfigured, so `createAdminClient()` returns `null` and **all four** routes end in their own `unconfigured` 403 regardless of caller. What shipped (`tests/integration/staff.test.ts:884-888`) asserts the real-admin call gets a **code-less** `unconfigured` 403 instead of a `demo_blocked` one — a genuine discriminator (it proves the admin got _past_ the gate), but weaker than the contracted assertion, and it was never written back here until now. The gap is partly covered elsewhere: `e2e/demo-gate.spec.ts` gets a live `400`-vs-`403` discriminator for `POST /api/staff`, and `e2e/staff-admin.spec.ts` proves a real admin's add and remove succeed end to end. **`reset-password`'s real-admin success path is asserted nowhere** — the one hole left.

#### 5. Report unit coverage

**File**: `src/lib/staff-report.test.ts`

**Intent**: Pin the new branch in all three resolvers.

**Contract**: A 403 with `code: "demo_blocked"` yields the demo sentence; a 403 _without_ the code keeps its existing bad-origin/unconfigured meaning.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- Signed in as the demo admin, the three controls render disabled with a visible reason
- Calling each route directly with `curl` (correct `Origin`, demo session cookie) returns 403 `demo_blocked`
- Signed in as `admin@fleetrent.test`, all three actions still work end to end
- No mail arrives at Mailpit as a result of any refused call

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: Sign-in demo card

### Overview

Publish the credentials on `/auth/signin` with a one-click prefill, without disturbing the page's port of `staff-login.jsx`.

> **Precondition — this phase is gated.** The demo card has no canonical mockup. Before building, author it into `staff-login.jsx` in the Claude Design project (`352d78a6-84fd-49a2-8b38-2fe289691fc3`, writable) and re-export `design-review/auth-signin-d.png` and `auth-signin-m.png`, so the vision-diff at 3.6 has a target. Every value is already fixed in `design-contract.md` §2 — this is transcription, not design invention. Phases 1, 2 and 4 are unblocked and can proceed without it.

### Changes Required:

#### 1. Env fields

**File**: `astro.config.mjs`

**Intent**: Carry the demo credentials as configuration rather than repo literals, so rotating them is a `wrangler secret` change and not a commit.

**Contract**: `DEMO_EMAIL` and `DEMO_PASSWORD` added to `env.schema` as ~~`access: "public"`~~ `envField.string({ context: "server", access: "secret", optional: true })`.

~~`access: "public"` is deliberate and correct: the value is rendered into the page for anyone to read, and marking a deliberately-published value `secret` would misrepresent it to every future reader of the schema.~~ **Superseded during Phase 3 (owner, 2026-08-28.)** The semantic argument was right and the mechanical consequence sank it: Astro **inlines `access: "public"` server vars into the build**. Verified by building with probe values — `probe-demo@example.test` and `Probe-Secret-1234` landed as literals in `dist/server/chunks/*.mjs`, and disappeared the moment the fields were declared `secret`, which emits a runtime import instead. So `public` would have made Migration Notes step 3 (`npx wrangler secret put`) a no-op: the secret would be set, the code would never read it, and the card would stay invisible on prod with nothing in any log to say why. `secret` is what makes the Intent above ("rotating them is a `wrangler secret` change and not a commit") actually true. That the value is deliberately published is now carried by a comment in `astro.config.mjs` rather than by the schema.

Both `optional` — with either absent the card does not render, so local dev, CI and any other deployment stay unchanged.

**Consequence for local work**: `secret` fields resolve from `.dev.vars` in dev (the adapter logs "Using secrets defined in .dev.vars") and **not** from the process environment, so the pair must sit in `.dev.vars` for the card to render locally, and in `.env.test` for the E2E spec's skip guard to clear. Exporting them into the dev server's environment does nothing.

#### 2. Page wiring

**File**: `src/pages/auth/signin.astro`

**Intent**: Read the pair server-side and hand it to the island.

**Contract**: Import both from `astro:env/server`; pass a single optional `demo?: { email: string; password: string }` prop to `SignInForm`, present only when **both** values are set. Partial configuration renders nothing rather than a half-filled card.

#### 3. Demo card and prefill

**File**: `src/components/auth/SignInForm.tsx`

**Intent**: Explain why a public demo login exists, show the credentials, and fill both fields in one click.

**Contract**: Optional `demo` prop. When present, render a bordered card above the `<h1>` holding a short Polish explanation, the email and password as selectable text, and a **"Wypełnij dane demo"** button that calls the existing `setEmail`/`setPassword` and clears any field errors.

The button is `type="button"` — it must not submit the form. It performs no async work, so the project's async-button pending-state rule does not apply; the existing `SubmitButton` still owns the submit pending state.

When the prop is absent the component renders exactly as it does today — no wrapper element, no layout shift.

#### 4. Design contract

**File**: `context/changes/demo-account-gate/design-contract.md`

**Intent**: Record the card's exact values before it is built, per the project's design workflow.

**Contract**: Token map, the sign-in screen inventory, and a per-element spec with an exact value per line (radius, padding, font size and weight, colors as token names) plus the verbatim Polish copy. Every line marked `exact` or `deviation(reason)`. See the Design Alignment Audit section below for the source of these values.

#### 5. E2E coverage

**File**: `e2e/staff-auth.spec.ts`

**Intent**: Prove the recruiter path works end to end — the thing the whole slice exists for.

**Contract**: Navigate to `/auth/signin`, click **Wypełnij dane demo** by role, assert both fields are populated, submit, and `waitForURL` to `/dashboard`. Locators by role and label per the project's E2E rules; no `waitForTimeout`. Call `waitForIslands()` before interacting — `SignInForm` is a `client:*` island and a pre-hydration click is dropped.

Requires `DEMO_EMAIL`/`DEMO_PASSWORD` in the E2E environment, pointed at the seeded `demo@fleetrent.test`; skip the spec when they are unset so the suite stays green on a machine without them.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Formatting clean: `npm run format`
- E2E passes: `npm run test:e2e`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Demo card authored into `staff-login.jsx` and re-exported to `design-review/auth-signin-{d,m}.png`
- Rendered vision-diff of `/auth/signin` against the canonical mockup passes at mobile and desktop breakpoints
- The card is absent when `DEMO_EMAIL`/`DEMO_PASSWORD` are unset, with no layout shift
- Prefill fills both fields and the form submits to `/dashboard`
- A password manager auto-filling the form does not fight the prefill

**Implementation Note**: This phase carries the design gate. Do not close it until the vision-diff passes. Pause for manual confirmation before proceeding.

---

## Phase 4 (deferrable): Nightly demo-data reset

> **DROPPED 2026-08-28 (owner).** Not built, and not scheduled. Phases 1–3 ship a complete,
> correct slice, and this phase's stated trigger — visitor mutations having visibly rotted the
> demo — has not happened yet. Dropping it also avoids standing up a scheduled endpoint that
> truncates business tables, which the Overview below calls the single most dangerous thing in
> this plan, for a problem nobody has observed.
>
> **Premise corrected 2026-09-01 (impl-review F6).** The drop note originally justified itself
> with "there is no prod demo account at all." That is no longer true: the demo card renders on
> `fleetrent.marcin-kulbicki.workers.dev/auth/signin` with working published credentials, and
> `supabase migration list --linked` confirms both `20260828120000` and `20260828140000` are
> applied on prod. **The decision stands** — the argument that survives is the second one (a cron
> endpoint that truncates business tables is not worth building for unobserved rot), not the
> first. Re-checked because a dropped phase's premise is a claim about the world, and the world
> moved.
>
> Two things this phase would also have carried, re-homed so they are not lost with it:
>
> - **The demo-password hijack** (a visitor can change the published password via GoTrue) moved to
>   `context/foundation/known-issues.md` → "A demo visitor can change the published demo password",
>   together with the spike-verified `auth.users` trigger that fixes it. That fix is orthogonal to
>   data rot and does not need this phase.
> - **Data rot itself** stays unaddressed by design, and now lives in
>   `context/foundation/known-issues.md` → "Demo visitors mutate live data with no reset path"
>   (added 2026-09-01, impl-review F6) so it survives this plan being archived. That entry also
>   records the sharper consequence this block never named: a visitor can empty the **public**
>   catalog, not just clutter the cockpit. Revive this phase, or open a new change, if it bites.

### Overview

Without this, the demo degrades: every visitor leaves rejected reservations and half-finished protocols behind, and after a few months the cockpit shows accumulated noise instead of a designed flow.

**This phase is independently skippable.** Phases 1–3 ship a complete, correct slice. Start this one only once the data has visibly rotted enough to justify the surface — a scheduled endpoint that truncates business tables is the single most dangerous thing in this plan.

### Changes Required:

#### 1. Reset function

**File**: `supabase/migrations/<timestamp>_reset_demo_data.sql`

**Intent**: Restore reservations and protocols to their seeded state in one transaction.

**Contract**: `reset_demo_data()`, `SECURITY DEFINER`, `set search_path = ''`, executable by **service_role only** — `revoke execute ... from anon, authenticated` following the pattern established in `20260714120000_rpc_execute_grant_hardening.sql` and pinned by `tests/integration/rpc-execute-grants.test.ts`.

Deletes and re-inserts only reservation and protocol data from `seed.prod.sql`'s data block. It must **not** touch `auth.users` or `profiles` — the demo account and the owner's admin account survive every reset.

#### 2. Trigger route

**File**: `src/pages/api/demo/reset.ts`

**Intent**: Let the scheduler invoke the reset without exposing it to the internet.

**Contract**: `POST`, authenticated by a constant-time comparison against a `DEMO_RESET_SECRET` server secret in a request header. Fail closed on a missing or mismatched secret and on a missing service-role client. Returns 204 on success. Not reachable from the browser and not linked anywhere.

#### 3. Schedule

**File**: `wrangler.jsonc`

**Intent**: Run it nightly.

**Contract**: A `triggers.crons` entry plus the scheduled handler wiring the Cloudflare adapter requires. Confirm against current Workers documentation before writing — the scheduled-handler contract for `@astrojs/cloudflare` is the one part of this plan not already demonstrated in the repo.

#### 4. Integration coverage

**File**: `tests/integration/demo-reset.test.ts`

**Intent**: Prove the reset restores state and cannot be called without the secret.

**Contract**: Assert `anon` and `authenticated` cannot execute the RPC; assert the route refuses a missing and a wrong secret; assert that after mutating a reservation and running the reset, the seeded state returns and the demo account still exists.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- Integration tests pass: `npm run test:integration`
- Grant guardrail still passes: `npm run test:integration -- rpc-execute-grants`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Manually triggering the route with the correct secret restores seeded state on a scratch database
- The demo account and the owner's admin account both survive a reset
- The scheduled trigger fires on prod and the run appears in Workers observability

---

## Testing Strategy

### Unit Tests:

- `isDemoAccount` is fail-closed and independent of `role` (`src/lib/access.test.ts`)
- All three `staff-report` resolvers distinguish a `demo_blocked` 403 from a bare 403 (`src/lib/staff-report.test.ts`)

### Integration Tests:

- Each of the three guarded routes returns 403 `demo_blocked` for a demo admin (`tests/integration/staff.test.ts`)
- The DB layer refuses the same caller with no route handler in the path: `deactivate_staff` returns `demo`, and direct `profiles` INSERT/UPDATE/DELETE are refused — each with a real-admin negative control (`tests/integration/staff.test.ts`)
- `current_is_demo` is not anon-executable (`tests/integration/rpc-execute-grants.test.ts`)
- Negative control: the same three calls succeed for a non-demo admin
- Scope boundary: `/api/staff/[id]/invite` is **not** refused for a demo caller

### E2E Tests:

- Prefill → submit → `/dashboard` as the demo admin (`e2e/staff-auth.spec.ts`)

### Manual Testing Steps:

1. Sign in as the demo admin locally; confirm the three roster controls are disabled with a visible reason.
2. `curl` each guarded route directly with a demo session cookie and a correct `Origin`; confirm 403 `demo_blocked`.
3. Confirm Mailpit received nothing from any refused call.
4. Sign in as `admin@fleetrent.test`; confirm all three actions still work.
5. Unset `DEMO_EMAIL`; confirm `/auth/signin` renders exactly as before.
6. Vision-diff `/auth/signin` against the canonical mockup at both breakpoints.

## Performance Considerations

None. The flag rides an existing indexed PK lookup — no new query, no new round trip. The guards are boolean checks that run before body parsing and before any admin client is constructed, so a refused request does strictly less work than an accepted one.

## Migration Notes

**The column ships ahead of the account.** `is_demo` defaults to `false`, so applying the migration changes no existing behavior. Phases 1–2 are therefore safe to deploy before the prod demo account exists.

**Provisioning the prod demo account** (a runbook step, not code — a migration cannot create a GoTrue user cleanly):

1. Signed in as the real admin, add the demo staffer through `/dashboard/staff`, then complete the invite to set its password.
2. Promote and mark it: `update profiles set role = 'admin', is_demo = true where user_id = '<uuid>';`
3. Set `DEMO_EMAIL` and `DEMO_PASSWORD` via `npx wrangler secret put`. This works **because** both fields are declared `access: "secret"` (Phase 3 §1) — a Worker secret is a runtime binding, and only a `secret` field is read at runtime. If anyone ever "corrects" the schema to `access: "public"` on the grounds that the value is published anyway, this step silently stops working: the value gets inlined at build time instead, the secret is set but never read, and the card vanishes from prod with no error anywhere.

Order matters — step 1 must happen **before** the account is marked, because Phase 2 blocks a demo caller from completing it.

**Push the migration explicitly.** Merging to `main` auto-deploys the Worker but pushes **no** migrations. Deploying phases 1–2 without `supabase db push` leaves prod querying a column that does not exist, which fails the middleware profile lookup for **every** authenticated request — not just demo ones. Run `npx supabase migration list --linked` after the merge to confirm.

**Rollback** is `alter table profiles drop column is_demo` plus reverting the guards; nothing depends on the column outside this slice. The Phase 2 DB gate reverses symmetrically and in place: re-issue the three `ALTER POLICY` statements without the `current_is_demo` clause, `create or replace` `deactivate_staff` without its `demo` arm, then `drop function public.current_is_demo()`. Drop the column last — the policies reference it through the helper.

## References

- Change identity: `context/changes/demo-account-gate/change.md`
- Design contract: `context/changes/demo-account-gate/design-contract.md`
- Guard ladder to mirror: `src/pages/api/staff/[id]/reset-password.ts:35-52`
- In-handler role guard: `src/lib/access.ts:79`
- Seeded dev accounts pattern: `supabase/seed.sql:145-232`
- RPC grant-hardening pattern (Phase 4): `supabase/migrations/20260714120000_rpc_execute_grant_hardening.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: `is_demo` through the stack

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — 81babdd
- [x] 1.2 Unit tests pass: `npm test` — 81babdd
- [x] 1.3 Type checking passes: `npx astro check` — 81babdd
- [x] 1.4 Linting passes: `npm run lint` — 81babdd

#### Manual

- [x] 1.5 `demo@fleetrent.test` signs in locally and reaches `/dashboard` — 81babdd
- [x] 1.6 Existing `admin@` and `employee@` logins still work unchanged — 81babdd

### Phase 2: Guard the three mutation routes

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — f91c1b9
- [x] 2.2 Integration tests pass: `npm run test:integration` — f91c1b9
- [x] 2.3 Type checking passes: `npx astro check` — f91c1b9
- [x] 2.4 Linting passes: `npm run lint` — f91c1b9
- [x] 2.9 DB gate migration applies cleanly from scratch: `npx supabase db reset` — f91c1b9
- [x] 2.10 Demo caller refused at the DB layer (RPC `demo` + profiles INSERT/UPDATE/DELETE), with a real-admin negative control — f91c1b9

#### Manual

- [x] 2.5 Three roster controls render disabled with a visible reason for the demo admin — f91c1b9
- [x] 2.6 Direct `curl` to each guarded route returns 403 `demo_blocked` — f91c1b9
- [x] 2.7 `admin@fleetrent.test` can still perform all three actions — f91c1b9
- [x] 2.8 No mail arrives at Mailpit from any refused call — f91c1b9
- [x] 2.11 Direct PostgREST call with the published demo credentials cannot lock the owner out — f91c1b9

### Phase 3: Sign-in demo card

#### Automated

- [x] 3.1 Type checking passes: `npx astro check` — dc624cc
- [x] 3.2 Linting passes: `npm run lint` — dc624cc
- [x] 3.3 Formatting clean: `npm run format` — dc624cc
- [x] 3.4 E2E passes: `npm run test:e2e` — dc624cc
- [x] 3.5 Production build succeeds: `npm run build` — dc624cc

#### Manual

- [x] 3.6 Demo card authored into `staff-login.jsx` and re-exported to `design-review/auth-signin-{d,m}.png` — dc624cc
- [x] 3.7 Vision-diff of `/auth/signin` against canonical mockup passes at both breakpoints — dc624cc
- [x] 3.8 Card absent when env unset, with no layout shift — dc624cc
- [x] 3.9 Prefill fills both fields and submits to `/dashboard` — dc624cc
- [x] 3.10 Password manager autofill does not fight the prefill — dc624cc (observed manually only — see note)

> **Note on 3.10 (impl-review F10, 2026-09-01).** Unlike every other row in this Progress
> section, nothing in the diff backs this one. The `autoComplete="username"` /
> `"current-password"` attributes in `SignInForm.tsx` predate this change and `dc624cc`
> touches neither line, so no test would fail if the behaviour regressed. Left ticked because
> it WAS observed; annotated so a later reader does not mistake it for covered.

### Phase 4 (deferrable): Nightly demo-data reset

> **DROPPED 2026-08-28 (owner).** The rows below are left unticked on purpose — they were
> never done, and marking them otherwise would be a lie. `/10x-archive` will surface them
> as informational warnings; that is the intended record. See the phase block above.

#### Automated

- [ ] 4.1 Migration applies cleanly: `npx supabase db reset`
- [ ] 4.2 Integration tests pass: `npm run test:integration`
- [ ] 4.3 Grant guardrail passes: `npm run test:integration -- rpc-execute-grants`
- [ ] 4.4 Production build succeeds: `npm run build`

#### Manual

- [ ] 4.5 Manual trigger with correct secret restores seeded state on a scratch database
- [ ] 4.6 Demo account and owner admin account both survive a reset
- [ ] 4.7 Scheduled trigger fires on prod and appears in Workers observability
