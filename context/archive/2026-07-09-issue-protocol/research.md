---
date: 2026-07-09T16:55:08+0200
researcher: MarcinK
git_commit: 5e4a38539e8c3d5efa105064294d63fe9f7f2050
branch: main
repository: car-rental
topic: "S-05 issue-protocol: data layer, UI/form, API/authz, testing, email provider, and media (storage/signature/bundle)"
tags: [research, codebase, issue-protocol, s-05, supabase-storage, transactional-email, cloudflare-workers, rls]
status: complete
last_updated: 2026-07-09
last_updated_by: MarcinK
---

# Research: S-05 issue-protocol

**Date**: 2026-07-09T16:55:08+0200
**Researcher**: MarcinK
**Git Commit**: `5e4a38539e8c3d5efa105064294d63fe9f7f2050`
**Branch**: `main`
**Repository**: car-rental

> Note on links: commit `5e4a385` is not present on any remote branch, so GitHub permalinks would 404.
> References below are local `path:line` (clickable in terminal). Re-run permalink generation after push.

## Research Question

Research the `issue-protocol` slice (S-05) from `context/foundation/roadmap.md`: an employee fills an issue
protocol at pickup — mileage, fuel level, damage notes, photos, digital signature — on a phone or tablet, and
the completed protocol is auto-emailed to the customer. Prerequisites F-02 and S-03 are `done`.

Scope agreed with the user: full codebase sweep (data layer + RLS, UI + form patterns, API + authz seams,
testing surface), **plus** a scored transactional-email provider comparison and a deep investigation of the
storage/signature/bundle runtime risks.

## Summary

S-05 is the roadmap's "heaviest slice" because it stands up **file storage** and **transactional email** for
the first time. Research changes that picture in three consequential ways:

1. **The headline infrastructure risk is false.** `infrastructure.md` carries RISK A — "3 MB gzipped free-tier
   bundle limit exceeded by signature/image client libs" (likelihood M, impact M). Measured: the Worker uploads
   at **`gzip: 554.76 KiB`** against a 3 MB limit (~2,517 KiB headroom), and on `@astrojs/cloudflare` v13 the
   client island JS is a **separate static asset** (`dist/client/`, 283 KiB gzip) that Cloudflare serves without
   invoking the Worker. Signature and compression libraries are browser-only and therefore add **0 bytes to the
   Worker bundle**. RISK A should be downgraded to low/low with one guardrail: never import those libs at SSR
   module scope.

2. **The email work is far smaller than the roadmap implies.** A provider-agnostic seam already exists at
   `src/lib/email/index.ts:22-44` — `EmailAdapter`, a `devLogAdapter`, and `sendEmail()` — with a comment at
   lines 37-39 reserving S-05 for exactly one job: "select a real adapter from configuration here … Callers
   never change." Templates (`src/lib/email/templates.ts`) are already unit-tested. S-05 adds a ~15-line
   `fetch`-based adapter, not an email subsystem. **Recommended provider: Resend** (raw `fetch`, no SDK, no Node
   deps, 3,000/mo free with immediate commercial use); **runner-up Brevo** if EU data residency becomes a hard
   requirement.

3. **Two genuine gaps are larger than expected.** There is **no reservation status representing "picked up /
   issued"** — the enum is `pending|confirmed|rejected|cancelled` and only `decide_reservation` transitions it.
   And there is **no UI surface anywhere that lists confirmed reservations or offers a per-reservation action**;
   the staff dashboard only handles pending → confirm/reject. S-05 must invent both the state concept and the
   entry point.

The dominant _correctness_ risk is not the bundle — it is **RLS and grants on a new PII-bearing table**. The
archive records a confirmed, fixed leak of exactly this shape (`reservations`: default grant + `USING(true)` let
a role-null authed user read all customer PII). A `protocols` table holds customer PII _and_ damage photos.

## Detailed Findings

### 1. Data layer and RLS

**Migration conventions** (`supabase/migrations/`, 14 files): `YYYYMMDDHHmmss_short_description.sql`, each
opening with a `--` header block (title + slice tag e.g. `(S-03) — Phase 1`, rationale, an "Additive over
<prior timestamps>" note, and a `See context/changes/<id>/plan.md` pointer), with `-- ----` section rules.

**Reservation status lifecycle.** Enum `reservation_status = ('pending','confirmed','rejected','cancelled')`
(`20260603155136_booking_integrity_data.sql:23-28`). New rows are hard-coded `'pending'`
(`20260611171737_public_reservation_request.sql:118`). `decide_reservation` is the **only** transition path
(`pending → confirmed | rejected`, guarded by `select … for update`;
`20260617120000_reservation_approval.sql:118-139`).

- `'cancelled'` exists in the enum but **has no transition anywhere** — it appears only in UI stepper copy
  (`src/lib/reservation-status.ts:78-82`).
- **"Accepted and due for pickup" = `'confirmed'`.** There is **no `issued` / `picked_up` / `completed`
  notion** anywhere in `src/` or the migrations. The stepper's "pickup" step is a UI placeholder
  (`reservation-status.ts:67-72`). F-01's `change.md` explicitly deferred protocol schema to S-05.
  **S-05 must decide**: extend the enum, or treat a `protocols` row's existence as the "issued" marker.

**The reservations PII leak (fixed) is the template for what not to repeat.** Per
`context/archive/2026-06-27-testing-data-layer-integrity/finding-rls-pii-leak.md`: Supabase applies an
**implicit default ALL grant to `anon`/`authenticated` on every new `public` table**. Combined with
`reservations_select_authenticated … using(true)`, any authenticated caller — including a **role-null user with
no `profiles` row** — could `select *` all customer PII. The fix
(`20260630120000_reservations_revoke_select_grant.sql:32-36`) both `revoke select … from anon, authenticated`
**and** drops the `using(true)` policy, so a future re-grant cannot silently re-open it. Residual, deliberately
deferred: the default INSERT/UPDATE/DELETE grants on `reservations` remain open.

Net current shape for `reservations`: **zero direct-table access; every read/write goes through a role-gated
`SECURITY DEFINER` RPC** that runs as table owner.

**RPC hygiene** (uniform across all 9 RPCs): `security definer` + `set search_path = ''` + schema-qualified
names; `stable` for reads; `plpgsql` for writes with an in-RPC role gate (`current_app_role()` null → fail
closed → `unauthorized`); `grant execute … to authenticated` (never `anon`) for staff RPCs. Result tags
(`ok | not_found | unauthorized | conflict | already_decided`) map to HTTP codes at the route.

**InitPlan wrapping** (`lessons.md`, `20260627120000_rls_initplan_optimization.sql`): every caller check in a
policy must be a scalar subquery — `(select public.current_app_role()) in ('employee','admin')`. `STABLE` +
`SECURITY DEFINER` is **necessary but not sufficient**; only a scalar subquery is hoisted to a one-time InitPlan.

**Role model.** `public.profiles(user_id → auth.users, role app_role)`, one row per user, no default — an absent
row means `null` role means denied. Helper `public.current_app_role()` is `sql stable security definer set
search_path = ''` (`20260604153139_employee_admin_roles.sql:47-55`); DEFINER is load-bearing to avoid
profiles-RLS recursion. `admin ⊇ employee` (`src/lib/access.ts:18-21`). In v1, `authenticated == staff`.

**Types.** `src/db/database.types.ts` is Supabase-generated (`supabase gen types typescript --linked`); never
hand-edited. `src/types.ts` derives all entity/DTO aliases from it. Adding `protocols` requires a regen. Gotcha
recorded repeatedly (`src/types.ts:12-16, 68-70`): `numeric(10,2)` columns **deserialize as `string`** in
supabase-js despite the generated `number` type.

### 2. UI and form patterns

**`src/components/fleet/VehicleForm.tsx` is the largest form (~18 fields) — and it uses plain `useState`, not
react-hook-form.** `react-hook-form` is **not a dependency** (verified: `grep -c 'react-hook-form' package.json`
→ `0`).

This is **not** a case of a lesson written after the code. Git ordering (verified): the lesson landed at
`5d13d95` (2026-06-26 14:05) and `VehicleForm.tsx` at `14db20a` (2026-06-26 15:39) — the lesson is an **ancestor**
of the form commit. The rule already existed and the form did not adopt it. So `VehicleForm` is a **known
exception, not the convention**, and `lessons.md` has been amended to say so explicitly. S-05 is the first
adopter (Decision 1).

The patterns below are still the reference for everything _except_ state management — they hold regardless of
form library:

- **One zod schema across the trust boundary.** `vehicleInputSchema` + `firstIssuePerField` from
  `src/lib/vehicle-schema.ts` is `safeParse`d client-side (`VehicleForm.tsx:15,321`) and enforced server-side by
  the route. "The client and the trust boundary cannot disagree" (`VehicleForm.tsx:22-23`).
- **Numeric fields held as strings**, so the payload drops straight onto the schema's coerce step
  (`VehicleForm.tsx:24-25,179-204`).
- **Per-field errors** rendered under each control with `aria-invalid`; on failed submit, scroll to + focus the
  first error in visual order via double-`requestAnimationFrame` (`:331-346`).
- **Submit is `fetch` POST/PATCH**, not a native form post; on 400 with `body.errors`, re-map server errors onto
  fields (`:371-375`); hard-nav on success (`:365-368`); `setSubmitting(false)` only in `finally`.
- **Pending pattern** (`FormActions`, `:239-278`): `disabled` + `aria-busy`, content swaps to the
  `animate-spin` ring from `src/components/auth/SubmitButton.tsx:30`. `SubmitButton.tsx:9-14` documents _why_ an
  explicit flag exists: the form posts to a URL, so `useFormStatus` never reports pending.

**Hook convention** (`src/components/hooks/`, one file): a bare async service function + a thin hook wrapping it
with a `busy` flag — `useReservationDecision.ts:17-48,55-74` returns `{ busy, decide }`.

**shadcn primitives present**: badge, button, calendar, card, checkbox, input, label, popover, select, textarea.
**Missing**: form, radio-group, slider, dialog, sonner/toast, table. Radix _is_ available (`radix-ui@^1.5.0`), so
adding primitives costs no new top-level dep. Dialogs/toasts today are **hand-rolled** (`RetireDialog` in
`FleetList.tsx:125`; `ReasonSheet`/`ResultOverlay` in `ReservationDecision.tsx`) — reuse that idiom. A
**fuel-level control has no primitive**; the cheapest on-convention path is the existing chip button-group idiom
(`VehicleForm.tsx:462-502`).

**The entry point does not exist.** `grep` for `protocol|protokół|wydani|handover` across `src/` returns zero
matches. `PendingQueue.tsx` handles only pending → confirm/reject; **no surface lists confirmed reservations or
offers a per-reservation action**. S-05 must add it.

**Design targets exist and are mobile-first.** Per `context/foundation/design-system.md:65-66`, mapped to S-05:

- `context/foundation/design/screenshots/12-staff-mobile-pickup-protocol.png` — mileage/fuel/damage
- `context/foundation/design/screenshots/13-staff-mobile-pickup-signature.png` — signature + email send

(`14-staff-mobile-return-protocol.png` is S-06.) Per `lessons.md`, these PNGs should be distilled into a textual
design contract **at plan time**, and never re-opened during implement. Tokens: brand crimson `--primary
#B43638`, cool-grey app bg, `shadow-card`, 12px base radius, no dark theme. **Polish copy is canonical.**

**Photo/signature capture is greenfield.** Zero hits across `src/` for `type="file"`, `capture`, `canvas`,
`signature`, `touchstart`, `getUserMedia`, `toDataURL`, `compress`. `VehicleForm.tsx:546` says photos are a URL
textarea and "Real upload is deferred to S-05." The responsive chassis _does_ exist though: mobile-first
breakpoints, a mobile bottom action bar (`VehicleForm.tsx:574-580`), 44px touch targets (`h-11`/`h-12`).

**Hydration.** 10× `client:load`, 2× `client:idle`, 3× `client:only`. The calendar uses `client:only="react"`
because "the lib never SSRs in workerd" (`dashboard/calendar.astro:14,66`) — the precedent for any browser-only
library. Mount the protocol form `client:load`; isolate signature/compression behind lazy `import()` or a
`client:only` sub-island so they never enter the SSR path.

### 3. API and authz seams

**Every `/api` route is outside middleware's gate.** `ROUTE_ROLES` (`src/lib/access.ts:27-38`) contains only
four `/dashboard*` prefixes; `resolveRequiredRole("/api/...")` returns `null` → `next()` with no check
(`src/middleware.ts:35-47`).

**Reference gating sequence** (`src/pages/api/vehicles.ts:30-63`):

1. CSRF — `origin !== context.url.origin` → `json(403, {error: badOrigin})` (`:32-35`)
2. auth — `!context.locals.user` → `json(401, …)` (`:38-40`)
3. role — `!requireRole(context.locals, "employee")` → `json(403, …)` (`:41-43`)
4. body parse — `try { await request.json() } catch` → `json(400, {error: badBody, errors:{}})` (`:45-50`)
5. zod — `safeParse`; failure → `json(400, {errors: firstIssuePerField(...)})` (`:53-56`)
6. service call → `switch (result.status)` → status codes (`:59-63`)

`json()` is defined **locally in all six route files** (no shared util) — e.g. `vehicles.ts:26-28`.

**No service-role client exists.** `grep` for `SERVICE_ROLE|serviceRole` across `src/` + `astro.config.mjs`:
zero hits. `src/lib/supabase.ts:7-26` creates a per-request anon-key SSR client (returns `null` when
unconfigured). Every RLS-crossing operation goes through a `SECURITY DEFINER` RPC that self-gates on
`current_app_role()`. **A protocol write must follow that pattern, not introduce a service-role key.**

**Service conventions** (`src/lib/services/{vehicles,reservations}.ts`): every function takes the per-request
`client: Client | null` first, degrades a `null` client to a "cannot act"/empty value rather than throwing, and
returns a discriminated union `{ status: … }`. Unexpected DB errors rethrow (→ 500); expected outcomes are typed
tags. UUID params guarded by a `UUID_RE` regex so a malformed id becomes a typed miss, not a Postgres 500.

**The closest sibling to "submit protocol" is `PATCH /api/reservations/[id].ts:110-160`**: gate → definer RPC
transition → **best-effort email after commit**. `notifyCustomer` (`:64-98`) is wrapped in try/catch that
swallows send errors so a failed email never fails the committed decision (`:148-150`). Note the tension with
testing risk #3 ("email fails _silently_") — see Open Questions.

Overlap re-check on accept is deliberately absent: confirm is "conflict-free by construction — pending already
participates in the `reservations_no_overlap` EXCLUDE set"
(`20260617120000_reservation_approval.sql:52-54`).

**Recorded, deferred inconsistency (F2).** `context/archive/2026-06-30-testing-api-boundary-authz/finding-anon-status-inconsistency.md`:
vehicle routes return **401** for signed-out callers; reservation routes return **403** (role-only gate, null
fail-closes). Protection is identical; only the status differs. `tests/integration/api-authz.test.ts` pins the
current split. **S-05 must pick deliberately** — the vehicles two-step (explicit 401) is the shape `lessons.md`
cites as reference.

**Secrets.** `astro.config.mjs:45-50` declares `SUPABASE_URL`/`SUPABASE_KEY` as
`envField.string({context:"server", access:"secret", optional: true})` — **optional**, so the app runs
unconfigured. `src/lib/config-status.ts:11-21` exports `configStatuses` / `missingConfigs`, which `Layout.astro`
renders as a banner. A new `RESEND_API_KEY` follows this exact path (+ `npx astro sync` to regen virtual types).

**No route accepts file uploads.** The only `formData()` call in the API tree is `auth/signin.ts:6-8` (no file
field). All mutations use `await context.request.json()`. Photos today are validated as `https?` URL strings
(`vehicle-schema.ts:117-120`, whose comment reads "object storage is S-05").

### 4. Testing surface

**`CLAUDE.md` is stale on two counts — verified directly this session:**

| `CLAUDE.md` claim                     | Reality                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `:14` "No test runner is configured." | `vitest.config.ts` defines two projects (`unit`, `integration`); 10 unit + 6 integration + 1 e2e spec; 4 test scripts in `package.json` |
| `:65` CI runs on push/PR to `master`  | `.github/workflows/ci.yml:5-7` targets `main`                                                                                           |

**S-05 is the trigger for test-plan Phase 4.** `context/foundation/test-plan.md:72` — "Protocol email & photo
integrity", risk #3, not started; `:79-80` — "Phase 4 activates only when slices S-05/S-06 ship — there is no
code to test before then." And `:287` — "**Risk #3 remains untestable at any layer until S-05 ships.**"

Risk #3 (`test-plan.md:45`): "A handover protocol email fails silently or carries wrong/missing photos."
Response guidance (`:56`): prove send is _attempted_, failures _surface_ (not swallowed), payload carries the
correct photos; cheapest layer = "integration with a captured/fake transport + contract on the payload."

**Harness state.** `e2e/e2e-rules.md` mandates role/label/text locators, no `waitForTimeout`, `storageState`
auth, unique timestamp-suffixed ids + `afterEach` cleanup, and — critically — `waitForIslands()`
(`e2e/support/hydration.ts:42-47`, waits for `astro-island[ssr]` to drain). Only **risk #6** has an e2e spec
(`e2e/seed.spec.ts`); risks #1/#2/#4/#5 are integration-only. Integration fixtures: `tests/helpers/clients.ts`
(`anonClient`, `as(role)`, `serviceClient`) and `tests/helpers/context.ts` (`buildApiContext`, which calls route
handlers directly — necessary because `/api/*` bypasses middleware). Seeded fail-closed fixture:
`norole@fleetrent.test` (valid session, no `profiles` row).

**Three harness gaps S-05 must close:**

1. **No server-side email stub.** `e2e-rules.md:87-88` flags it explicitly: "When S-05 lands transactional
   email, mock it where the server calls out — `page.route()` intercepts the browser, and the send happens
   server-side, so it will not fire." There are **zero** mocking primitives in the repo (`vi.mock`, `vi.fn`,
   `msw` → no hits). This is the single biggest gap, and it interacts with a real design constraint:
   `EmailAdapter` is declared at `src/lib/email/index.ts:22` but **not exported**, and `adapter` is a
   module-level `const` (`:39`) — neither is swappable from a test today.
2. **No object-storage test setup.** `supabase/config.toml:109-112` enables storage (`file_size_limit
"50MiB"`) but **defines no buckets** (all commented out, `:114-120`). No storage RLS, no upload fixtures, no
   teardown for uploaded objects.
3. **CI runs no tests** (`ci.yml`: `astro sync` + lint + build only). Phase-4 tests run locally until test-plan
   Phase 5 wires the gate. Local `inbucket` exists (`config.toml:99-101`) for manual mail inspection.

### 5. Transactional email provider (roadmap Open Question #1 — resolved)

**Platform truth that decides it:** workerd has **no arbitrary TCP sockets → SMTP is impossible**. Every
candidate must be driven over HTTPS via bare `fetch()`. All Node SDKs are unnecessary and several are actively
broken on Workers, so the winning pattern is **raw `fetch()`, zero SDK, ~0 KB added**.

| Provider                 | fetch() API                               | Free tier (card? commercial?)                                        | Attachments                     | EU residency                               | Docs                 | Fit     |
| ------------------------ | ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------- | ------------------------------------------ | -------------------- | ------- |
| **Resend**               | ✅ Bearer JSON                            | 3,000/mo, 100/day; no card; **commercial ✅, no sandbox**            | base64 **or hosted URL**, 40 MB | ✗ (sends from eu-west-1, **stores in US**) | Excellent (llms.txt) | **4.7** |
| **Brevo**                | ✅ `api-key` JSON                         | 300/day; no card; commercial ✅ (adds footer)                        | base64 or URL; 20 MB            | **✅ by default** (FR/DE/BE)               | Excellent            | 4.4     |
| Mailgun                  | ✅ multipart                              | 100/day                                                              | multipart, 25 MB                | ✅ free EU region                          | Good                 | 3.9     |
| Postmark                 | ✅ JSON (**SDK unsupported on Workers**)  | 100/mo, commercial behind manual approval                            | base64, 50 MB                   | ✗ US-only                                  | Very good            | 3.8     |
| Cloudflare Email Service | ✅ native binding                         | **not on Workers Free**; 3,000/mo on Paid $5                         | 32 attachments                  | undocumented                               | Good                 | 3.2     |
| Amazon SES               | ✅ but **SigV4 signing required**         | 3,000/mo 12mo; **card required**; **200/day sandbox** until approval | raw MIME                        | ✅ eu-central-1                            | Dense                | 2.6     |
| SendGrid                 | ✅ JSON (**SDK breaks: `require('fs')`**) | **no free tier** since 2025-05-27                                    | base64, 30 MB                   | Pro $89.95/mo only                         | Good                 | 2.3     |
| MailChannels             | ✅                                        | **free Workers tier withdrawn 2024-06-30**                           | ✅                              | —                                          | OK                   | 1.5     |

**Recommendation: Resend.** Single Bearer-authenticated JSON `POST` over bare `fetch()`; both Cloudflare and
Resend publish a Workers guide. Adding **no SDK and no Node deps** directly retires the `infrastructure.md`
pre-mortem's fear of "a Node stream API in the protocol-email path that threw only in production." Free tier
(3,000/mo, no card, **immediate commercial production access, no approval gate**) dwarfs FleetRent's
tens-to-low-hundreds/month permanently. Uniquely supports **hosted-URL attachments** (`path`), so Supabase
signed URLs drop straight in. Domain auth is 2 records (SPF + DKIM) + optional DMARC.

**Runner-up: Brevo** — the pick if EU data residency is a hard requirement (EU company, EU storage by default,
no paid gate). Costs: the 300/day free budget is shared with marketing sends, a "Sent with Brevo" footer until
$9/mo, and mid-pack (~80–90%) deliverability.

**Devil's advocate against Resend:** a handover protocol is a legally-flavoured document carrying customer PII
(name, signature, damage photos). Resend's per-domain "region" chooses only where mail is _dispatched_ — account
data, recipient addresses and logs are **stored in the US**. That is GDPR-lawful via DPA + SCCs, so it is a
posture concern, not a compliance blocker — but if counsel or a B2B customer's procurement demands EU-border
storage, Resend fails outright and Brevo is the drop-in switch. If instead _maximum deliverability_ for a legal
document were the priority, the target would be Postmark (~98% inbox) at $15/mo.

**Three direct answers** (all checked 2026-07-09):

- **MailChannels' free Workers tier is gone** — terminated 2024-06-30. The widespread "free default for Workers"
  advice is dead.
- **Cloudflare does now offer outbound send** (Cloudflare Email Service, `env.EMAIL.send()` binding), distinct
  from Email Routing, which remains **inbound-only**. Not on Workers Free; $5/mo Paid includes 3,000/mo. Docs
  dated June 2026 → unproven track record for a legal artifact.
- **Supabase custom SMTP is auth-emails-only** (signup confirmation, magic link, password reset, invites). It
  cannot send arbitrary transactional mail. FleetRent needs its own provider regardless.

**Integration shape** (conforms to the existing seam; ~15 lines):

```ts
// src/lib/email/resend.ts
const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    from: EMAIL_FROM,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  }),
});
if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
```

```ts
// src/lib/email/index.ts:39 — keep dev-log as the unconfigured fallback
const adapter: EmailAdapter = RESEND_API_KEY && EMAIL_FROM ? resendAdapter : devLogAdapter;
```

Plus `RESEND_API_KEY` / `EMAIL_FROM` as optional server secrets in `astro.config.mjs` `env.schema`, a
`configStatuses` entry in `config-status.ts` (Polish copy), `wrangler secret put` for prod, `.dev.vars` for
local. The existing `EmailMessage` type (`{to, subject, html, text}`) needs **no change** for the
signed-URLs-in-body approach.

### 6. Media: storage, signature, and the bundle risk

**Measured, not assumed.** `npx astro sync && npm run build` succeeded (a `.dev.vars` is present).
`npx wrangler deploy --dry-run --outdir <scratchpad>` printed verbatim:

```
Total Upload: 2680.69 KiB / gzip: 554.76 KiB
✨ Read 58 files from the assets directory .../dist/client
```

Corroborated by `find dist/server -name '*.mjs' | xargs cat | gzip -c | wc -c` = 568,690 bytes (~555 KiB).

**The decisive structural fact:** on `@astrojs/cloudflare` v13 the output splits into `dist/server/` (the
Worker) and `dist/client/` (static assets). The 554.76 KiB "Total Upload" is Worker modules **only**; the 58
client files were "Read from the assets directory" as a _separate_ step. Client island JS totals **283 KiB
gzip** in `dist/client/_astro/` and is served via the `ASSETS` binding — Cloudflare serves static assets free,
unlimited, **without invoking the Worker**.

**Verdict on RISK A: does not materialize.** Headroom is ~2,517 KiB gzip (~5.5× the current bundle), and
signature/compression libraries are browser-only, so they compile into `dist/client` and add **0 bytes to the
Worker**. The original risk conflated "client libs" with "Worker bundle"; on v13's split output that conflation
is false. Guardrail: import them lazily inside island handlers, never at SSR module scope.

**Verdict on RISK B: client-side compression is genuinely required, and nearly free.** Workers give 10 ms
CPU/invocation and no image pipeline — and the upload should never transit the Worker anyway.

**Storage design.** No Supabase Storage usage exists today (`grep` → only commented `config.toml` defaults and
"deferred to S-05" comments). Vehicle photos are a `text[]` of external URLs (picsum placeholders in seed).
Recommended shape:

- One **private** bucket `protocols`, created by migration SQL, with bucket-level `allowed_mime_types` +
  `file_size_limit` as a first defense. Objects keyed `issue/<protocol_id>/photo-N.jpg` and
  `issue/<protocol_id>/signature.png` — folder-per-protocol makes S-06 reuse and cleanup trivial.
- Per-operation, per-role RLS on `storage.objects` gated on `current_app_role()` via the
  `(storage.foldername(name))[1]` path idiom.
- **Customer delivery: a PDF attachment, not signed URLs (see Decision 5&7).** Customers have no accounts and
  therefore no JWT (hard PRD constraint), so a signed URL would be the only account-less private-read path —
  which is exactly why the protocol is delivered as a self-contained PDF instead, and the customer never
  receives a bucket URL at all. The **only** signed URL minted is a short-TTL (minutes) link to the generated
  PDF, which Resend fetches server-side at send time. `expiresIn` is in **seconds**.
- **Upload path: direct browser → Supabase**, bypassing the Worker entirely (either anon key + staff JWT under
  RLS, or a presigned `createSignedUploadUrl` minted by a ~1 ms API route). This sidesteps both the 10 ms CPU
  budget and the 100 MB request-body limit; no image bytes ever touch the Worker.

**Client libraries** (all static assets; sizes are min+gzip, checked 2026-07-09):

- **Signature: `signature_pad` v5 — 4.4 KB.** Same engine as `react-signature-canvas` (4.6 KB) without
  depending on that package's alpha `latest` tag. Variable-width Bézier strokes, Pointer Events,
  `toDataURL('image/png')`. A hand-rolled canvas (0 KB, ~40–60 LOC) is viable but strictly worse-looking for a
  signature.
- **Compression: native `createImageBitmap` + `OffscreenCanvas` + `canvas.toBlob('image/jpeg', 0.8)` — 0 KB**,
  with EXIF orientation applied by the browser default. `compressorjs` (4.6 KB) adds size-target iteration and
  explicit EXIF correction; `browser-image-compression` (19.6 KB, last release 2023-03-06) is 4× larger and
  staler.
- **HEIC is the real field bug, and it is a correctness issue, not a size one.** iPhones capture HEIC by
  default. Safari can decode it to canvas; **Chrome/Firefox/Edge generally cannot**, so client compression
  silently yields a blank image. Mitigation: sniff the file (magic bytes / attempt `createImageBitmap` and
  catch), then **lazily `import('heic2any')`** (~MBs of wasm — never in the initial bundle) to convert to JPEG
  before compressing. Also: keep `image/heic` **out** of `accept` on Safari, which has been observed converting
  uploads to HEIC when it is present. Use `accept="image/*"`.
- **Capture element:** `<input type="file" accept="image/*" capture="environment">` opens the rear camera on
  iOS/Android and degrades to a normal file picker on desktop (`capture` is ignored there).

### 7. Email delivery tracking (resolves Open Question #3)

**The problem is live in shipped code, not just in S-05.** There are three `sendEmail` call sites, each wrapping
the send in a `try/catch` that swallows into `console.error`:

| Site                                    | Template                               | Caller                        | If the send fails                                                                                                             |
| --------------------------------------- | -------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/api/reservations.ts:123`     | `reservationReceivedEmail`             | **anonymous** (public funnel) | Customer already landed on `/r/<token>` (`ReservationForm.tsx:273`) and knows the reservation exists. Loses the durable link. |
| `src/pages/api/reservations/[id].ts:94` | `reservationConfirmed`/`RejectedEmail` | employee                      | **Customer is not on the site. This is their only notification that the booking was accepted or rejected.**                   |
| S-05 (new)                              | protocol issued                        | employee                      | **Email is the sole delivery mechanism** for the handover document — the PRD forbids a customer portal.                       |

Crucially, **none of these have ever failed**: the only adapter is `devLogAdapter`, which cannot throw
(`src/lib/email/index.ts:24-35`). All three `catch` blocks are dead code. They go live the moment a real provider
lands — i.e. in S-05. The swallow was a sound decision written for a world where email had no failure mode.

**Decision.** Keep the commit-then-best-effort order (rolling back a completed handover because a provider
returned 503 is strictly worse — the vehicle has physically changed hands). Make the failure _visible_ instead:

- **New table `email_deliveries`** — append-only, one row per attempt (`entity_type`, `entity_id`, `template`,
  `recipient`, `status: sent|failed`, `error`, `created_at`), indexed on `(entity_type, entity_id, created_at
desc)`. Append-only gives retry history for free; two columns on `protocols` would give none, and no place to
  hang the reservation-decision email.
- **Grants closed from the start**: `revoke all … from anon, authenticated`; RLS enabled with **no policies**;
  all access via a role-gated `SECURITY DEFINER` RPC — the prospective application of the `reservations` PII-leak
  lesson.
- **`record_email_delivery(...)` RPC**: `security definer set search_path = ''`, gated on
  `(select public.current_app_role()) in ('employee','admin')`, `grant execute … to authenticated`.

**Scope cut forced by the auth model.** Tracking the _creation_ email would require an anon caller to write to
the audit table, i.e. `grant execute … to anon` — handing the public internet a row-forging primitive on an
audit log. Hardening it (verify the reservation exists, verify recipient matches `customer_email`) still lets
anon mark arbitrary reservations sent/failed. So **only the two staff-authenticated sends are tracked**
(decision + protocol). The creation email keeps its swallow, defensible because that path has a second channel
(the on-screen `/r/<token>` redirect). One swallow stays live, knowingly.

**Seam shape: a service wrapper, not an adapter change.** `EmailAdapter` sees only `{to, subject, html, text}` —
it cannot know which row a message belongs to, and holds no DB client. So recording cannot be invisible to
callers; each of the two sites changes by one line. `sendEmail`/`EmailAdapter` keep their exact contract
(the adapter's job is bytes-on-the-wire); recording lives in `src/lib/services/email-delivery.ts` as
`sendTracked(client, to, content, ctx)` — client-first, never throws, returns `{status: "sent" | "failed"}`,
matching the repo's service convention. `notifyCustomer`'s `try/catch` collapses into it.

**Read path + recovery.** Fold the newest delivery row into the existing list RPCs via a `lateral` join (no
extra round-trip); badge any protocol whose latest delivery is absent or `failed`; add
`POST /api/protocols/[id]/resend-email` behind the standard gate (CSRF → 401 → 403 → zod → service). Append-only
means a retry shows up as a second row.

**This is what makes risk #3 testable.** `test-plan.md:56` wants "send is attempted, failures surface, payload
carries correct photos":

- _attempted_ → an `email_deliveries` row exists (integration assertion, zero mocking)
- _failures surface_ → inject a throwing adapter, assert `status='failed'` + the dashboard badge
- _correct payload_ → the capturing adapter, which the Resend config-selection delivers anyway

Cost: one migration, one RPC, one service module, one API route, one badge, and a one-line edit at two call
sites (one of them in archived, regression-tested S-03 code). It widens S-05 past its roadmap outcome — accepted
deliberately, because the alternative is shipping a known-silent failure into the one path where the customer
has no other channel.

## Code References

- `supabase/migrations/20260603155136_booking_integrity_data.sql:23-28` — `reservation_status` enum (no `issued` value)
- `supabase/migrations/20260603155136_booking_integrity_data.sql:104-106` — generated `reserved_period tsrange` (half-open `[14:00, 10:00)`)
- `supabase/migrations/20260617120000_reservation_approval.sql:52-54,118-139` — `decide_reservation`; why no overlap re-check
- `supabase/migrations/20260630120000_reservations_revoke_select_grant.sql:32-36` — the PII-leak fix (revoke + drop `using(true)`)
- `supabase/migrations/20260604153139_employee_admin_roles.sql:47-55` — `current_app_role()` DEFINER helper
- `supabase/config.toml:109-120` — storage enabled, **no buckets defined**
- `src/lib/access.ts:27-38` — `ROUTE_ROLES`: `/dashboard*` only, no `/api`
- `src/middleware.ts:35-47` — the gate that does not cover `/api`
- `src/pages/api/vehicles.ts:30-63` — canonical self-gating sequence (CSRF → 401 → 403 → 400 → DB)
- `src/pages/api/reservations/[id].ts:64-98,148-150` — best-effort post-commit email (`notifyCustomer`)
- `src/lib/email/index.ts:22-44` — the `EmailAdapter` seam; `:37-39` is the S-05 TODO; `:22` type **not exported**
- `src/lib/email/templates.ts` + `templates.test.ts` — pure, unit-tested Polish templates to extend
- `src/lib/services/vehicles.ts:187-261` — discriminated-union service result convention
- `src/lib/supabase.ts:7-26` — per-request anon client; returns `null` unconfigured; **no service-role client**
- `src/lib/config-status.ts:11-21` — missing-config banner mechanism a new secret must join
- `src/components/fleet/VehicleForm.tsx:239-278,319-346` — `FormActions` pending pattern; validate + scroll-to-error
- `src/components/auth/SubmitButton.tsx:9-14,30` — canonical `animate-spin` pending ring and why `useFormStatus` won't work
- `src/components/hooks/useReservationDecision.ts:55-74` — service-fn + `busy`-flag hook convention
- `src/pages/dashboard/calendar.astro:14,66` — `client:only="react"` precedent for libs that can't SSR on workerd
- `src/lib/availability.ts` + `availability.test.ts:22-70,123-151` — pure-helper-extracted-for-testability pattern
- `e2e/support/hydration.ts:42-47` — `waitForIslands()`
- `e2e/e2e-rules.md:87-88` — flags that `page.route()` cannot stub the server-side email send
- `tests/helpers/context.ts` — `buildApiContext` (calls route handlers directly)
- `context/foundation/test-plan.md:45,56,72,79-80,287` — risk #3, Phase 4, and "untestable until S-05 ships"
- `context/foundation/design-system.md:65-66` — screenshots 12 & 13 are the S-05 targets

## Architecture Insights

- **RPC-as-trust-boundary.** With no service-role client anywhere, `SECURITY DEFINER` RPCs that self-gate on
  `current_app_role()` _are_ the privilege-escalation mechanism. The API route's job is CSRF + auth + role + zod;
  the RPC re-verifies role and owns atomicity (`select … for update`). Result tags flow outward and map to HTTP
  codes. A protocol write should be an RPC, not a table insert.
- **Defense at the constraint, not in the app.** The no-double-booking guarantee lives in a Postgres `EXCLUDE`
  constraint; `decide_reservation` needs no overlap re-check because pending rows already hold their slot.
  Expect S-05's integrity rules (one protocol per reservation; only on a `confirmed` reservation) to be pushed
  down the same way — a `unique (reservation_id)` constraint plus a `for update` status re-read.
- **Seams are planted a slice early.** The email adapter (S-02), the `photos text[]` URL column (S-01/S-04), and
  test-plan Phase 4 were all authored _anticipating_ S-05. The slice's job is largely to fill pre-cut holes.
  Corollary: resist widening them.
- **Grants are the silent hole.** RLS is only half the control; Supabase's implicit default grant to
  `anon`/`authenticated` on every new public table is the other half. The `reservations` leak needed _both_ a
  revoke and a policy drop. A new PII table should close all four verbs from the start.
- **The `@astrojs/cloudflare` v13 server/client split changes the cost model.** Anything browser-only is free
  (static assets); anything reachable from SSR module scope is charged against a 3 MB budget. This is the single
  most useful fact for S-05's media work, and it inverts a documented risk.

## Historical Context (from prior changes)

- `context/archive/2026-06-03-booking-integrity-data/` — EXCLUDE-constraint-first integrity; the half-open
  `[14:00, 10:00)` window is replicated byte-for-byte in three enforcement points that "cannot drift". Protocol
  schema explicitly scoped out to S-05.
- `context/archive/2026-06-27-testing-data-layer-integrity/finding-rls-pii-leak.md` — the confirmed
  authenticated-role-null PII read; the revoke-and-drop fix; the still-open INSERT/UPDATE/DELETE over-grants on
  `reservations`.
- `context/archive/2026-06-27-rls-auth-initplan/` — `STABLE` + `SECURITY DEFINER` is necessary but _not
  sufficient_; only a `(select …)` scalar subquery is hoisted to a one-time InitPlan. The advisor only flags
  literal `auth.*` tokens, so helper-based policies carry the cost silently.
- `context/archive/2026-06-30-testing-api-boundary-authz/finding-anon-status-inconsistency.md` — F2: vehicles
  return 401 for anon, reservations return 403. Deferred, pinned by a regression test. S-05 must choose.
- `context/archive/2026-06-17-reservation-approval/` — S-05 depends on the `confirmed` state this slice
  produces; reuse S-02's `sendEmail` helper. Shared merge surface: `src/lib/access.ts`, `src/types.ts`,
  `src/db/database.types.ts`.
- `context/archive/2026-06-17-fleet-management/plan-brief.md:28,31,61` — chose full-page `/new` + `/[id]/edit`
  routes with "simplest island state" over a modal; "Photos are URLs until S-05 stands up storage."

## Related Research

- `context/foundation/infrastructure.md` — the Cloudflare decision, its pre-mortem, and RISK A/RISK B, both of
  which this research revises (RISK A → low/low; RISK B → confirmed but cheap).
- `context/foundation/test-plan.md` §3 Phase 4, §7 — the e2e exclusion narrowed 2026-07-09.
- `context/foundation/lessons.md` — the four standing rules; entry 3 (react-hook-form) is contradicted by the
  code (see Open Questions).

## Decisions (all open questions resolved 2026-07-09)

1. **Form library: introduce `react-hook-form`.** ✅ _Decided — honors `lessons.md`, diverges from
   `VehicleForm`._ Add `react-hook-form` + `@hookform/resolvers`, `zodResolver(protocolInputSchema)` over the
   same schema the API enforces, and `useFieldArray` for the dynamic photo rows (each carrying its own upload
   state and possible HEIC conversion) — the one requirement `VehicleForm` never had, and the strongest real
   argument for RHF beyond the lesson.
   - **Chronology (verified, and it matters):** the lesson is an _ancestor_ of `VehicleForm` — `5d13d95`
     (06-26 14:05) precedes `14db20a` (06-26 15:39). The rule existed and the form skipped it. `VehicleForm` is
     therefore a **known exception, not a precedent**; a planner or reviewer must not cite it as "the codebase
     convention is `useState`".
   - **`lessons.md` amended 2026-07-09** with an explicit forward-looking clause: apply RHF to new large forms
     even though existing forms don't, and don't let "match the surrounding code" override it.
   - **Consequence to accept knowingly:** the repo holds **two form conventions** until `VehicleForm` is
     migrated (a worthwhile follow-up change, not a prerequisite for S-05).
   - Keep everything else: the shared zod schema across the trust boundary, `firstIssuePerField` for the 400
     shape, the `FormActions` / `animate-spin` pending pattern, scroll-to-first-error.
   - Bundle: RHF is client-side, so it lands in `dist/client` static assets — **0 bytes to the Worker**.

2. **"Issued / picked up" = the existence of a `protocols` row.** ✅ _Decided — booking integrity does not
   move._ No `reservation_status` enum change; the `EXCLUDE` predicate stays `where status in
('pending','confirmed')`, so a rented-out vehicle keeps holding its slot and the no-double-booking guarantee
   cannot regress. Dashboard and S-07's overdue logic read `EXISTS`/`LEFT JOIN`:

   ```sql
   select r.*, (p.id is not null) as issued
   from reservations r
   left join protocols p on p.reservation_id = r.id
   where r.status = 'confirmed';
   ```

   New invariant to enforce: `unique (reservation_id)` on `protocols` (one issue protocol per reservation), plus
   an in-RPC `for update` re-read asserting the reservation is still `'confirmed'` before insert.

3. ~~**Does a failed protocol email surface or swallow?**~~ **RESOLVED 2026-07-09 — see "Email delivery
   tracking" below.** Decision: the commit-then-swallow order stays (a completed field handover must not roll
   back because a provider 503'd), but the outcome is **recorded** in a new `email_deliveries` table and
   surfaced in the dashboard with a resend action. Silent → visible → recoverable.

4. ~~**Make `src/lib/email/index.ts` injectable.**~~ **RESOLVED** — the Resend integration selects the adapter
   from config anyway, which is exactly the injectability risk #3's test seam needs. Export `EmailAdapter`;
   leave `sendEmail`'s signature alone (recording lives in the service layer, not the adapter — see below).

5 & 7. **Media delivery: a client-generated PDF attachment. No signed URLs to the customer at all.**
✅ _Decided 2026-07-09 — reverses an earlier same-day decision to email signed links._

**Why the reversal.** A PDF does **not** reduce forwarding exposure — it makes the photos permanent in the
recipient's mailbox, where a signed URL would at least expire. The reversal is not about confidentiality
against the mail path. It is about two other things:

- **No live link into the storage bucket.** A leaked signed URL points at Supabase infrastructure; a leaked
  PDF is just a file.
- **Durability — the decisive one.** The protocol exists as _dispute evidence_. Disputes surface months
  later, by which time a 30-day link is dead and the customer must ask the operator (their counterparty in
  the dispute) to re-issue it. A PDF in their inbox is theirs. Emailing an expiring link makes the
  customer's evidence contingent on the operator's goodwill — backwards for the document's purpose.

**Consequence: the bearer-capability risk and the whole TTL question are deleted**, not mitigated. Staff read
photos from the private bucket under RLS with their JWT; the customer never receives a bucket URL. The PDF's
own storage URL needs only **minutes** of TTL because Resend fetches a hosted `path` **server-side at send
time**.

**Where it is generated: client-side, in the employee's phone island.** The photos and signature are already
on the device before upload.

- **Worker cost: 0 ms CPU, 0 MB.** This matters: server-side generation on the Worker is _not viable on the
  free plan_ — the workload is tens-to-hundreds of ms against a **10 ms CPU/invocation** cap. (Memory,
  128 MB/isolate, is the secondary constraint; peak here is ~35–50 MB.) Generating client-side means neither
  limit is ever in play.
- pdf-lib is pure JS, zero Node built-ins, runs unchanged on workerd _and_ in the browser; `embedJpg` copies
  JPEG bytes verbatim (`DCTDecode`) rather than re-decoding. It lands in `dist/client` as a **free static
  asset** (see §6 — client JS does not count against the Worker bundle).
- Rejected alternatives: Workers free tier (10 ms CPU); Supabase Edge Functions (2,000 ms CPU — ample, but
  stands up a second platform the repo does not use); Cloudflare Browser Rendering ($5/mo + $0.09/browser-hr,
  overkill for a structured form); `@react-pdf/renderer` (its `yoga-layout` Wasm dep is disallowed on
  workerd).

**⚠ Polish diacritics will crash pdf-lib unless fontkit is wired.** The 14 standard PDF fonts are
**WinAnsi (Windows-1252)** encoded and `drawText` **throws** on any character outside that encoding. Of
`ą ć ę ł ń ó ś ź ż`, **only `ó` is in Windows-1252 — the other eight throw.** In a Polish-only app this is a
guaranteed production crash on the first customer name or damage note containing `ą`/`ł`/`ę`/… A prototype
built with `StandardFonts.Helvetica` will appear to work.

- **Fix:** `pdfDoc.registerFontkit(fontkit)` + `embedFont(ttfBytes, { subset: true })`, then draw with that
  font.
- **Cost:** `@pdf-lib/fontkit` +342 KB gzip (roughly triples pdf-lib's 178 KB gzip → ~520 KB total), a TTF to
  subset from (~150–600 KB, e.g. Noto/DejaVu Sans), and ~10–40 KB of embedded subset per output PDF. All of
  this is free static-asset weight on the client path.

**Accepted trade-offs:**

- **Client-generated means client-authored.** The emailed PDF is a _rendering_, not a server-attested
  artifact. The authoritative record remains the `protocols` row in Postgres, from which the server can
  always regenerate. Acceptable for trusted staff; worth stating explicitly.
- **Mobile memory is the unverified bit.** 8 × 2 MB photos + a PDF copy ≈ 35–50 MB peak. Almost certainly
  fine on a modern phone, but iOS Safari's per-tab ceiling is undocumented. **This is a second reason the
  client-side compression step (resize ~1600px, JPEG q0.8) is not optional** — it cuts the input bytes long
  before pdf-lib sees them.

**Failure path (decided):** if PDF generation fails mid-handover, **submit the protocol anyway** — the
handover physically happened and the row must reflect it. No email goes out; the protocol is badged in the
dashboard and the employee retries later from a desktop. This reuses the `email_deliveries` + resend
machinery from Decision 3 at zero extra cost. Blocking submission would strand an employee at the vehicle
with a customer waiting — the exact failure mode commit-then-best-effort exists to prevent.

**Resend delivery:** 40 MB total per email **after base64 encoding** (≈28–29 MB of real file), and a hosted
`path` URL counts against the same cap as inline `content`. A few-MB protocol PDF is comfortably inside it.
Attachment emails cannot use Resend's batch endpoint.

6. **EU data residency: defer — ship Resend, keep Brevo documented.** ✅ _Decided._ US processing is GDPR-lawful
   via DPA + SCCs; this is a posture concern, not a compliance blocker. The `EmailAdapter` seam makes the switch
   a one-file swap, so the decision forecloses nothing. Revisit only if counsel or a B2B customer's procurement
   demands EU-border storage — at which point Brevo (EU company, EU storage by default, no paid gate) is the
   drop-in. **Roadmap Open Question #1 is resolved.**

7. **Stale `CLAUDE.md`.** ✅ _Decided — fix in the S-05 PR._ `:14` ("No test runner is configured") and `:65`
   (CI branch `master`) are both false; verified directly. Since S-05 adds tests, the correction rides along.

### Residual risks carried into `/10x-plan`

- **pdf-lib + Polish diacritics = a guaranteed crash** unless `@pdf-lib/fontkit` and an embedded TTF subset are
  wired from the start. Eight of the nine Polish diacritics are outside WinAnsi and make `drawText` **throw**.
  A `StandardFonts.Helvetica` prototype passes; production dies on the first `Wąsik`. Test with a name and a
  damage note containing `ą ć ę ł ń ś ź ż`.
- **HEIC decode** is a correctness requirement, not a size one: iPhone captures HEIC, which Chrome/Firefox/Edge
  generally cannot draw to canvas — client compression then silently produces a blank image. Sniff the file,
  lazily `import('heic2any')` on detection, and keep `image/heic` out of `accept` on Safari.
- **Client-side compression is now doubly load-bearing** — it protects both the upload path and pdf-lib's peak
  memory on the employee's phone. It is not an optimization.
- **The emailed PDF is client-authored**, not server-attested. The `protocols` row is the authoritative record;
  the server can regenerate. Revisit if a customer or counsel ever challenges the artifact's provenance.
- **F2 (401 vs 403 for anon)** is still unresolved repo-wide. S-05's routes should use the vehicles two-step
  (explicit `!user` → 401, then role → 403), the shape `lessons.md` cites as reference.
- **The creation email keeps its swallow** (Decision 3's scope cut). One silent-failure path stays live,
  knowingly, because that path has a second channel.
