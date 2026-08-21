# Invite Journey Fixes — Implementation Plan

## Overview

Two bugs in the invited-hire journey, sharing one root: **an irreversible act happens before the
thing it commits to is done.** Bug 1 sends the invite mail before the `profiles` row lands; Bug 2
spends the link token when the set-password form _renders_ rather than when the password is
_submitted_.

The change ships as two independent phase groups. **Phase group A** (phases 1–3) makes the failed
provisioning legible and self-cleaning, and replaces the corrupted `last_sign_in_at` proxy with an
owned password-set signal. **Phase group B** (phases 4–6) defers the token exchange to submit-time,
which dissolves Bug 2 and the password-less-session finding, and carries the deletion inventory that
redesign owes.

**Hard rule, inherited from `change.md`: A must not depend on B.** A is a service-layer bugfix; B is
a redesign of an auth surface hardened in S-14 and reviewed twice. A ships and merges on its own, so
if B turns out worse than it looks once built, it can be dropped without stranding A.

## Current State Analysis

`createEmployee` (`src/lib/services/staff.ts:136-205`) has two arms. The net-new arm invites through
GoTrue at `:192`, then inserts the `profiles` row at `:200`; a failed insert throws at `:204` and
nothing rolls back the already-delivered invite. The `existing` arm (`:149-188`) is a deliberate
repair path shipped in `00863c8` on 2026-07-23 — it unbans, upserts the profile, and returns
`reactivated`. **The repair mechanism works; nothing tells the admin it is needed.**

The failure is invisible in three places at once:

- `list_staff` is `from public.profiles p join auth.users u` (`20260723194602:52-58`) — an INNER
  join driven from `profiles`, so an auth user with no profile drives no roster row.
- `src/pages/api/staff.ts:66` has no `try`/`catch`, so the PostgrestError becomes a bare 500.
- `src/components/staff/StaffList.tsx:491` routes every unexpected status to `COPY.mutationError`
  — `Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj ponownie.` — which blames the
  network for a failure that has already sent mail. The add modal stays open (`setAddOpen(false)`
  runs only on the success arm at `:485`), reinforcing "nothing happened".

One accidental mitigation exists: the banner ships a `Ponów` button (`StaffList.tsx:69`, rendered at
`:643-655`) wired to `addEmployee(values)` with the same payload. Clicking it re-POSTs, takes the
`existing` branch, and repairs the orphan — real, unlabelled, and gone the moment the admin dismisses
the banner or reloads.

On the auth side, `/auth/callback` (`src/pages/auth/callback.ts:88-91`) calls `verifyOtp` on a
**GET**, so the token is spent as the form renders. That mints a full employee session before any
password exists, and leaves the reopened link dead.

### Key Discoveries

- **There is no GoTrue-side password-set signal.** Probed against local GoTrue v2.188.1,
  2026-08-20: before the invite exchange `auth.users.encrypted_password` is `''`; after
  `POST /auth/v1/verify` it is a 60-char bcrypt hash — and **not** bcrypt of the empty string
  (checked with `extensions.crypt`), so GoTrue stamps a random one. `encrypted_password` is
  corrupted by exactly the same event as `last_sign_in_at`, which kills research's suggested fix
  ("key off password-set") unless the signal is owned by us.
- **`auth.one_time_tokens` resolves a link's identity without spending it.** Probed 2026-08-20: the
  `hashed_token` the admin `generate_link` API returns is byte-identical to
  `auth.one_time_tokens.token_hash`, which carries `user_id` and `token_type` (`confirmation_token`
  for invites). This dissolves what `research.md` §5.5 called option C's main cost — the role
  refusal moving after the exchange.
- **`profiles` UPDATE is admin-only** (`20260604153139:80-84`), so an employee cannot stamp their
  own row. The stamp needs a `SECURITY DEFINER` RPC.
- **Adding an OUT column to `list_staff` forces DROP + CREATE**, and a drop resets the ACL to
  Supabase's default (EXECUTE to PUBLIC + anon). This repo already took that exact regression:
  `20260728120000` recreated `list_pending_reservations` and silently reopened anon, fixed forward in
  `20260731212650:1-20`. `list_staff` is **not** in the guard suite today —
  `tests/integration/rpc-execute-grants.test.ts:43-66` covers only `decide_reservation`,
  `set_vehicle_active`, `list_pending_reservations`, `list_reservations_for_calendar`.
- **Exactly two app paths set a password**, both ours: `src/pages/api/auth/reset-password.ts:116`
  and `src/pages/api/auth/change-password.ts:99`. Nothing else calls `updateUser({ password })`.
- **Three places mint passwords out-of-band** and would read as password-less without an explicit
  stamp: `supabase/seed.sql:179,188,197,260,269` (direct `crypt()` inserts into `auth.users`),
  `e2e/fixtures/staff.ts:35`, and `tests/integration/staff.test.ts:120` — the last is what makes the
  existing "reactivating a previously-ACTIVE user" test pass.
- **`last_sign_in_at` is stamped by the link exchange** (`research.md` §1.5(a), confirmed by probe),
  which is why both `wasActive` (`staff.ts:180`) and `deriveStatus` (`staff.ts:69-71`) misreport.
- **`shouldSecureCookies`** (`src/lib/secure-cookies.ts:38`) is imported by `auth-session.ts:5` **and**
  by `middleware.ts:4,11`, `api/auth/signin.ts:8,47`, `api/auth/signout.ts:3,10`. Deleting the
  link-session module wholesale would take it with them and silently weaken every auth cookie.
- **The gates do not cover what this change touches.** An `.astro`-only edit runs `eslint --fix` and
  `astro check` and nothing else; `staff.ts` has no unit test importing it; Playwright runs in no
  CI workflow.

## Desired End State

**Bug 1.** When the `profiles` insert fails, `createEmployee` attempts a compensating `deleteUser`
and returns a distinguishable result. `api/staff.ts` maps it to its own status and `StaffList`
renders its own message naming what happened and what to do — never the network banner. An admin can
tell "the invite went out but the account wasn't finished" from "your connection dropped".

**The status signal.** `profiles.password_set_at` is the single answer to "does this person have a
working password", written only by the two routes that set one. Both `wasActive` on the repair path
and the roster's ACTIVE/INVITED badge read it, so the roster stops misreporting in both directions —
no more AKTYWNY for someone who cannot sign in, no more ZAPROSZONY for someone already inside.

**Bug 2 / option C.** `/auth/callback` validates the link, resolves its target through
`auth.one_time_tokens` **without spending the token**, refuses a non-employee with the existing R14
card, and stamps a short-lived httpOnly cookie carrying `token_hash` + `type`. The set-password POST
performs `verifyOtp` + `updateUser` + the password stamp as one operation. Reopening the link is
idempotent, no session is minted until a password exists, and the R11 conflict card's promise
("sign out and open the link again") becomes literally true.

**Verification.** Phase-level automated criteria below; the end-to-end proof is the e2e sequence in
"Manual Testing Steps" — an invited hire opens their link, abandons the form, reopens it, and lands
on the form again rather than on `/auth/link-conflict`.

## What We're NOT Doing

- ~~**Option 2a** (reorder to `generateLink` → insert → send our own mail). Deferred: it moves the
  invite mail onto the Resend seam with a new app template, the prod-only hosted-attachment send
  gate, and the `EMAIL_FROM` format trap.~~ **Superseded by phase 8 (owner decision 2026-08-21.)**
  The deferral rested on having to own the send — and that premise was probe-disproved:
  `inviteUserByEmail` works on an **already-created** user, so create-then-invite keeps the real
  GoTrue invite and its existing template. None of the Resend costs above apply. Phase 8 does the
  reorder as two _explicit_ steps rather than an internal one, which also makes the created-but-not-
  yet-invited state visible on the roster.
- **Option 2b** (`createUser` + `resetPasswordForEmail`) — rejected on evidence: it silently
  downgrades every new hire's first contact from the invite journey to a password-reset journey.
- **Option 3** (transactional RPC / trigger) — closed on evidence. The RPC form is not constructible
  (no `pg_net`/`http` extension; the only `create extension` in 24 migrations is `btree_gist`), and
  the trigger form reverses the fail-closed invariant at `20260604153139:22-24`.
- **Widening `list_staff` to a LEFT JOIN** so orphans surface as a roster row. With the compensating
  delete in place an orphan only survives when the delete _also_ fails; the new roster state would
  need its own design decision and Polish copy. Still out of scope after phase 8 — but the stakes
  drop there, because no mail is sent for an account that failed to create, so a surviving orphan
  costs nobody a dead link and a retry heals it.
- **The continue card** for `/auth/link-conflict` — dropped by owner decision 2026-08-20; option C
  makes the state it explains unreachable. `research.md` Part 2 retains its full contract as the
  fallback if phase group B is abandoned.
- **Fixing `deactivateStaff`'s sibling defect** (`staff.ts:251-262`, `research.md` §1.6 — RPC first,
  ban second, no rollback, and a manual retry 404s forever). Recorded, not fixed here.
- **Adding a Playwright CI job.** The e2e specs are updated but remain ungated; standing up a
  browser + seeded stack + the `:4321` pin is its own slice.
- **Promoting the 21 auth artboards into `design-system.md`'s catalog.** A standing to-do inherited
  from S-14 (`design-contract.md:164-167`), out of scope here.

## Implementation Approach

Phase group A is ordered so the highest-value fix lands first and carries no migration: phase 1 is
pure service + API + island. Phases 2 and 3 then introduce the owned signal, data layer first, then
its consumers — the codebase's established order for a schema change.

Phase group B follows the same shape: phase 4 changes what the GET does and extracts the branch
decisions into testable pure functions, phase 5 moves the exchange to the POST and re-sources the
page's render inputs, phase 6 removes what the old timing existed to compensate for.

Throughout, behaviour that must be _enforced_ is expressed as a pure function in `src/lib` (the unit
project, which CI actually runs) or as an integration test — because per `research.md` §4 an
`.astro`-only edit runs no test and `staff.ts` has no unit coverage. Extraction alone is not
sufficient (`e2e/seed.spec.ts:27-28`: "extracting a correct helper does not prove the widget calls
it"), so each extracted decision also gets an integration or e2e assertion that the surface calls it.

## Critical Implementation Details

**`list_staff` recreation resets its grants.** Adding `password_set_at` to the `returns table (…)`
changes the signature, so `create or replace` cannot do it — the migration must
`drop function if exists public.list_staff()` and recreate. A drop resets the ACL to Supabase's
default (EXECUTE to PUBLIC + anon), so the migration must re-state **both** the
`revoke execute on function public.list_staff() from public, anon` **and** the
`grant execute … to authenticated`. Re-stating only the grant is exactly the regression
`20260731212650` was written to fix forward. Phase 2 adds `list_staff` to
`tests/integration/rpc-execute-grants.test.ts` so this cannot recur silently.

**Stamp ordering in the reset-password route.** `src/pages/api/auth/reset-password.ts:136` ends with
`signOut({ scope: "global" })`, which invalidates the caller's session. The `mark_password_set()`
call must happen **before** it, while the session still authenticates the RPC. In
`change-password.ts` the sign-out is `scope: "others"` (`:110`), so the caller survives and ordering
is free there — but keep both calls in the same relative position for symmetry.

**The set-password page loses `locals.user` under option C.** With no exchange on the GET there is
no session, so `reset-password.astro:104` (the R14 role gate) and the `AccountBox` at `:150`
(`email={user.email}`) both lose their input. Phase 4's token-lookup RPC is what restores them; the
page must be re-sourced from the RPC result, not from `Astro.locals.user`, before phase 5 lands.

**Shared local Supabase.** Four worktrees share one Docker stack (`project_id = "10x-astro-starter"`).
Apply new migrations with `supabase migration up` — **never** `db reset`, which reapplies only this
worktree's migrations and drops the siblings'.

---

## Phase 1: Legibility + compensating rollback

### Overview

Make a failed `profiles` insert a first-class outcome instead of a bare 500: roll the invite back
when possible, and tell the admin what actually happened either way. No migration; no dependency on
phases 2–3.

### Changes Required:

#### 1. The service's net-new arm

**File**: `src/lib/services/staff.ts`

**Intent**: Stop letting the insert error at `:204` escape as a throw. On failure, attempt a
compensating `admin.auth.admin.deleteUser(userId)` and report the outcome distinguishably, because
whether the rollback succeeded changes what the admin should do next — a deleted user means "retry
cleanly", a surviving one means "retry to repair the existing account".

**Contract**: Two new arms on `CreateEmployeeResult` (`staff.ts:53-57`) — one for "invite sent,
profile failed, invite rolled back" and one for "…, rollback also failed". The existing
`created` / `reactivated` / `duplicate_active` / `unauthorized` arms are unchanged, so every current
call site keeps compiling. Follow the tagged-union convention already used in the file. The delete
must not throw out of the handler — a failed rollback is data for the second arm, not an error.

#### 2. The API route's status mapping

**File**: `src/pages/api/staff.ts`

**Intent**: Map the two new tags onto their own HTTP status so the island can distinguish them from
a network failure. Today the `switch` at `:67-77` is exhaustive over the four existing tags, so
adding arms to the union makes TypeScript point at this file.

**Contract**: New `case` arms returning a distinct status (not 200/201/409, which are already
claimed) with a JSON body carrying a machine-readable discriminator — following the existing
`json(status, { error })` / `json(status, { errors })` shapes and the `MSG` constant block at
`:17-24` for any Polish string.

#### 3. The roster island's banner

**File**: `src/components/staff/StaffList.tsx`

**Intent**: Render the provisioning failure as its own message instead of `COPY.mutationError`.
The message must state that the invitation was sent but the account was not finished, and that
`Ponów` completes it — turning today's accidental, unlabelled repair into an explicit one. The
retry callback already exists and already performs the repair; this phase names it.

**Contract**: New entries in the `COPY` block (`:60-80`) beside `mutationError`; a new branch in
`addEmployee` (`:481-497`) keyed on the new status before the fallback `setBanner`. Both new arms
keep `retry` wired to `addEmployee(values)`. Decide and record the add-modal behaviour explicitly:
the modal currently closes only on success (`:485`), and a failure the admin is meant to retry from
the banner should not leave a second, competing retry surface open behind it.

#### 4. Integration coverage for the failure path

**File**: `tests/integration/staff.test.ts`

**Intent**: Prove the rollback with a real GoTrue hop, so the assertion is real: after a failed
insert, `listUsers()` must find no user for that address.

**Contract**: A partial double over the service-role client that fails **only**
`.from("profiles").insert` while leaving `auth.admin` untouched, passed to `createEmployee` (which
takes its client as a parameter, `staff.ts:136-139`). Precedent for doubles at this altitude:
`tests/helpers/context.ts:119-139`, `src/lib/auth-session.test.ts:27-37`. Do **not** use the
`queryDb`-DDL route — its contract is catalog-introspection only, and on a stack shared by four
worktrees a crashed test leaves a live constraint that breaks siblings. Cover both arms: rollback
succeeds, and rollback also fails.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type checking passes: `npx astro check`
- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`
- The new failure-path tests assert no orphaned `auth.users` row survives a rolled-back invite
- Existing provisioning coverage still green: `tests/integration/staff.test.ts:49,:72,:82,:117,:146`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Forcing an insert failure surfaces the new banner, not `Nie udało się zapisać zmiany…`
- `Ponów` on that banner completes the account and the person appears on the roster
- The banner's Polish copy matches `design-contract.md` §9 verbatim
- Roster renders unchanged against `19-admin-desktop-employees.png` / `25-admin-mobile-employees.jpg`
  apart from the new banner
- A genuine network failure still shows the original network banner

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 2: Password-set signal — data layer

### Overview

Introduce `profiles.password_set_at` as the owned answer to "does this person have a working
password", backfilled so the migration is behaviour-neutral, and surface it on the roster read. No
consumer changes yet — phase 3 wires them.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_password_set_signal.sql`

**Intent**: Add the column, backfill it from `auth.users.last_sign_in_at` so no existing row changes
behaviour on deploy, add the RPC that lets a signed-in user stamp their own row, and recreate
`list_staff` carrying the new column.

**Contract**: Four parts, in this order.

1. `alter table public.profiles add column password_set_at timestamptz` — nullable; null means "no
   password set".
2. Backfill: set it from `auth.users.last_sign_in_at` where non-null, joined on `user_id`. This
   preserves today's exact `wasActive`/`deriveStatus` outcome for every existing row, so the
   migration changes no live account's label and mails nobody. Document in a comment that it
   knowingly inherits today's error for the small clicked-but-never-set population.
3. `public.mark_password_set()` — `SECURITY DEFINER`, `set search_path = ''`, stamps
   `password_set_at = now()` for `auth.uid()` only, and is a no-op for a caller with no profile row.
   It must not accept a target parameter: taking one would let any authenticated user stamp anyone.
   Grants per `lessons.md` → "Revoke EXECUTE before granting it": `revoke execute … from public, anon`
   **before** `grant execute … to authenticated`.
4. `list_staff` — `drop function if exists public.list_staff()` then recreate with
   `password_set_at timestamptz` added to the `returns table (…)`, re-stating the role gate, the
   definer hygiene, **and both** the revoke and the grant. See "Critical Implementation Details".
   `20260728120000_list_pending_reservations_add_plate.sql:1-14` is the shape to mirror, and
   `20260731212650` is the regression that proves the revoke must be re-stated.

#### 2. Generated types

**File**: `src/db/database.types.ts`

**Intent**: Bring the generated types in sync so `password_set_at` is typed on both the `profiles`
row and the `list_staff` return.

**Contract**: Regenerate with `npx supabase gen types typescript --local` (the command lives in no
npm script and is not in `CLAUDE.md`). Commit the result; the file must show no diff on a re-run.

#### 3. Out-of-band password creators

**Files**: `supabase/seed.sql`, `e2e/fixtures/staff.ts`, `tests/integration/staff.test.ts`

**Intent**: Every fixture that mints a password without going through our two routes must stamp
`password_set_at`, or it will read as password-less once phase 3 lands. The migration's backfill
covers rows that exist at deploy time; these create new ones afterwards.

**Contract**: Stamp it in each `profiles` insert whose matching `auth.users` row carries a real
password — `seed.sql:228` and `:301` (covering the users written with `crypt()` at `:179,:188,:260,
:269`), `e2e/fixtures/staff.ts:35`'s `createUser` path, and `tests/integration/staff.test.ts:120`.
Leave the deliberately password-less fixtures alone: `norole@fleetrent.test` has no profiles row by
design (`seed.sql:226-227`), `lukasz@fleetrent.test` is the invited-never-accepted shape, and
`inviteCallbackLink` (`e2e/fixtures/staff.ts:119-138`) must stay password-less — it is the fixture
phase group B's tests depend on.

#### 4. Contract-surface registry

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Keep the registry honest. It opens with "Do not rename or change the shape of anything
listed here without updating every consumer", and this phase changes the shape of two rows under
**Employee account management (S-08)**.

**Contract**: Update the `profiles.full_name / deactivated_at` row to carry `password_set_at`, and
the `list_staff()` row to note the new OUT column. Add a row for `mark_password_set()`. Phase 1's
`CreateEmployeeResult` arms and phase 3's `reactivated` mail field land on the existing
`StaffMember, CreateEmployeeResult, …` row — fold them in here rather than opening the file twice.
No consumer discovery is needed: every caller of all four is already inventoried in this plan.

#### 5. Grant-layer regression guard

**File**: `tests/integration/rpc-execute-grants.test.ts`

**Intent**: Pin the grant layer beneath the in-function role gates for the RPCs this change touches
or adds, so a future recreation cannot silently reopen them to anon.

**Contract**: Add `list_staff`, `deactivate_staff`, and `mark_password_set` to the
"anon is refused" block (`:40-66`), using the existing `isPermissionDenied` helper and calling each
with its exact signature so the only reason it errors is the missing grant. Update the suite's
header comment, which currently says "the four staff RPCs".

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase migration up` (**not** `db reset` — shared stack)
- Generated types in sync: `npx supabase gen types typescript --local` leaves no diff
- Type checking passes: `npx astro check`
- Lint passes: `npm run lint`
- Integration tests pass: `npm run test:integration`
- `rpc-execute-grants.test.ts` proves anon is refused on `list_staff`, `deactivate_staff` and
  `mark_password_set`
- Backfill is behaviour-neutral: every seeded account's roster status is unchanged from before the
  migration
- `docs/reference/contract-surfaces.md` reflects `password_set_at`, `list_staff()`'s new column,
  `mark_password_set()`, and phase 1's `CreateEmployeeResult` arms

#### Manual Verification:

- The roster renders identically to before the migration (no label moved)
- A `mark_password_set()` call from a non-admin employee session stamps only their own row

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Wire the signal

### Overview

Point both misreading consumers at `password_set_at`, start writing it from the two routes that set
a password, and stop swallowing the activation-mail error. This is what closes `research.md`
§1.5(a) and (b).

### Changes Required:

#### 1. Status derivation

**File**: `src/lib/staff-status.ts` (new) + `src/lib/staff-status.test.ts` (new)

**Intent**: Extract the ACTIVE/INVITED decision into a pure function so it lands in the `unit`
project — the one layer that actually gates CI for this change. `staff.ts` has no unit test
importing it today, so the rule is otherwise unenforced.

**Contract**: A pure function taking the password-set timestamp (and whatever else the badge needs)
and returning `StaffMember["status"]`. Mirrors the shape `readLinkOrigin` (`auth-session.ts:77-79`)
and `resolveAuthError` already use for page-level decisions. Unit tests cover: password set → active;
never set → invited; and explicitly the regression case — a link exchange stamped `last_sign_in_at`
but no password → invited.

#### 2. The service's two readers

**File**: `src/lib/services/staff.ts`

**Intent**: Replace both uses of `last_sign_in_at`-as-password-proxy. `deriveStatus` (`:69-71`) and
`listStaff`'s mapping (`:97`) move to the extracted function fed by the new column; `wasActive`
(`:180`) reads the profile row the repair arm has already fetched.

**Contract**: The repair arm's existing select at `:150-154` already reads the profile — widen it to
include `password_set_at` rather than issuing a second query. `ListStaffRow` (`:73-83`) gains the
field. `buildMember`'s `status` argument (`:186`) follows from the new derivation. `lastSignInAt`
stays on `StaffMember` — it is still displayed; it just stops meaning "has a password".

#### 3. The two password-set routes

**Files**: `src/pages/api/auth/reset-password.ts`, `src/pages/api/auth/change-password.ts`

**Intent**: Stamp the signal on every successful password set. These two `updateUser({ password })`
calls are the only ones in the app, so this makes the column complete going forward.

**Contract**: Call `mark_password_set()` on the caller's (cookie) client immediately after the
successful `updateUser` — `reset-password.ts:116`, `change-password.ts:99`. In `reset-password.ts`
it **must** precede the `signOut({ scope: "global" })` at `:136` (see "Critical Implementation
Details"). A failed stamp must not fail the request: the password has already changed, and failing
here would tell the user their reset didn't work when it did.

#### 4. The swallowed activation mail

**File**: `src/lib/services/staff.ts`

**Intent**: `:182` is `await admin.auth.resetPasswordForEmail(...).catch(() => undefined)` — but
`supabase-js` returns `{ error }` rather than throwing and the result is not destructured, so the
`.catch()` is dead code and the error is discarded either way. On hosted Supabase, where the
2-emails/hour cap is enforced, a repair after the orphaning invite already burned the quota returns
`reactivated` / HTTP 200 / a green roster row with no mail ever sent and no signal.

**Contract**: Destructure the result and propagate the mail outcome through
`CreateEmployeeResult`'s `reactivated` arm. This follows the same house pattern as the
protocol-delivery flow (`src/lib/services/email-delivery.ts:57-77`;
`src/pages/api/return-protocols/[id]/pdf.ts:18-21` — "Returns 200 regardless of the email outcome,
carrying the delivery status").

#### 5. The route and the island for that outcome

**Files**: `src/pages/api/staff.ts`, `src/components/staff/StaffList.tsx`

**Intent**: Give §4's outcome somewhere to land. Without this the service change is invisible — and
the copy for it (`repairedMailFailed`, `design-contract.md` §9) is already written and assigned to
this phase.

**Contract**: The repair still succeeded, so it stays **HTTP 200** per the house pattern above — the
mail outcome rides in the body beside `member`, not in the status. That means `StaffList` must branch
**inside** its existing success arm: `addEmployee` (`:481-486`) currently treats `200`/`201` as
unqualified success — it merges the row, calls `setAddOpen(false)`, and returns before any banner
code runs. Keep all of that (the account really was repaired and really does belong on the roster)
and additionally `setBanner` with `COPY.repairedMailFailed`. Per design-contract §8.1 this banner is
`kind: "error"` (the admin must act) and carries **no** `retry` — its remedy is the row's own
`Resetuj hasło` action, which the copy names. Reuse phase 1's banner machinery; add no third
mechanism.

#### 6. Integration coverage

**File**: `tests/integration/staff.test.ts`

**Intent**: Cover the two shapes no test reaches today — the actual orphan (`profile === null`), and
the §1.5(a) inversion.

**Contract**: Two cases. (a) The repair arm starting from an auth user with **no** profiles row —
both existing tests that reach it (`:82-115`, `:117-135`) start from a deactivated profile that
exists. (b) A hire who exchanged their invite link but never set a password: assert they are
reported INVITED and **are** sent an activation mail, where today they are reported AKTYWNY and sent
nothing. Mint the link-exchanged shape the way the probe did — `generateLink` then the verify hop —
so `last_sign_in_at` is genuinely stamped.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new `staff-status.test.ts`: `npm test`
- Integration tests pass: `npm run test:integration`
- The §1.5(a) regression test asserts INVITED + mail sent for a clicked-but-never-set hire
- The orphan-shape repair test (`profile === null`) passes
- A repair whose activation mail fails returns 200 carrying the failed mail outcome (service +
  route level)
- Type checking passes: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Setting a password through `/auth/reset-password` stamps `password_set_at` and the roster flips to
  AKTYWNY
- Changing a password through `/dashboard/account/password` stamps it too and leaves the caller
  signed in
- A hire who clicks their invite link but sets no password stays ZAPROSZONY on the roster
- Re-adding that hire's address sends them an activation mail
- A repair whose mail fails shows the `repairedMailFailed` banner — error tone, **no** `Ponów`
  button — while the row still lands on the roster and the add modal still closes
- That banner's Polish copy matches `design-contract.md` §9 verbatim

**Implementation Note**: Phase group A is complete here. It can merge on its own. After manual
confirmation, decide whether to proceed to phase group B or stop.

---

## Phase 4: Deferred exchange — the callback

### Overview

Stop `/auth/callback` from exchanging the token on a GET. Resolve the link's target through
`auth.one_time_tokens` instead — enough to keep the R14 role refusal and the account box — and stamp
a cookie carrying the credential for the POST to spend.

### Changes Required:

#### 1. Token-lookup RPC

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_resolve_link_token.sql`

**Intent**: Let the callback learn who a link is for, and whether they are still an active employee,
without spending the token. This is what keeps R14 ("Konto jest nieaktywne", shipped by
`auth-followups` Phase 1 three days before this change) running before the form.

**Contract**: A `SECURITY DEFINER` function, `set search_path = ''`, taking the token hash and the
link type and returning the target's `user_id`, email, `full_name`, and app role. It reads
`auth.one_time_tokens` joined to `auth.users` and `public.profiles`; probe-verified 2026-08-20 that
`token_hash` matches the link's hash verbatim, and that an invite's `token_type` is
`confirmation_token` (map the caller-supplied `type` onto that enum rather than passing it through).
It must be lookup-only — it may never delete, update, or otherwise spend the token.

`/auth/callback` is where `verifyOtp` used to enforce four separate guarantees at once. Three of
them move here, and the function returns **no row** unless all three hold. Fail-closed is the whole
contract; each clause below is load-bearing, not defensive padding.

1. **Hash AND type must both match.** Match on `token_hash` **and** the mapped `token_type` — a
   mismatched pair yields no row. Today `verifyOtp` resolves the token by hash _and_ type, and that
   is the only reason the caller-supplied `?type` can be trusted at all (`callback.ts:56-78`). With
   the exchange gone from the GET, nothing else vouches for it: `LINK_TYPES` (`:25-29`) validates
   membership in a closed **set**, never the **pairing**. Matching on hash alone would let
   `&type=invite` on a genuine recovery link render "Witaj we Flocie" again — precisely the
   `auth-followups` F3 defect. Verified 2026-08-20 that the enum distinguishes them:
   `recovery_token` vs `confirmation_token` (invite and signup share the latter, as `verifyOtp` does
   today). Update `callback.ts`'s comment block, which currently credits `verifyOtp` with this
   guarantee.
2. **Expired tokens must yield no row.** `auth.one_time_tokens` has **no expiry column** and GoTrue
   deletes a token on _use_, not on expiry — verified 2026-08-20, the local table held a row
   3 days old against `config.toml` `otp_expiry = 3600`. A lookup with no expiry predicate therefore
   resolves dead links, renders the form, and only refuses at the POST — after the hire has chosen
   and submitted a password. Join `auth.users` and compare `confirmation_sent_at` (invite/signup) or
   `recovery_sent_at` (recovery) against the otp window, returning no row past it. This is what
   criterion 4.11 asserts; without it 4.11 cannot hold. Probe which timestamp GoTrue actually
   measures from before writing the predicate, and state the window as a named SQL constant beside a
   comment pointing at `config.toml:238`, so the duplication is findable when that value changes.
3. **The role must be deactivation-aware.** Return the app role as **null** when the profile's
   `deactivated_at` is non-null. `profiles.role` stays `'employee'` after `deactivate_staff` runs,
   and `current_app_role()` (`20260604153139:54`) reads it with no deactivation check — the ONLY
   place the null-ing happens is `middleware.ts:36`, which never runs for a session-less path.
   Returning `profiles.role` verbatim hands a deactivated staffer `'employee'`, passes them through
   branch 3, and shows them the set-password form: the exact defect R14 was shipped to close. Mirror
   `middleware.ts:36`, not `current_app_role()`.

`full_name` is in the return because `AccountBox` needs it — see phase 5 §2.

Grants: `revoke execute on function … from public, anon` **first**, then an explicit
`grant execute … to anon`, called on `context.locals.supabase` — the client `/auth/callback` already
uses. This is lessons.md carve-out (a), an **intentionally public** RPC, so the migration must say so
in a comment and `rpc-execute-grants.test.ts` asserts anon **can** call it (the public-RPC block at
`:77-110`), not that it is refused.

**Do NOT route this through `createAdminClient()`**, which was the earlier draft. Two reasons, both
verified: (1) it is documented service-role-only for admin-gated routes —
`src/lib/supabase.ts:43-45` ("construct it only inside admin-gated `/api/staff*` route handlers,
which self-gate with `requireRole` before touching it") and the same constraint is registered in
`docs/reference/contract-surfaces.md`. `/auth/callback` is the app's one deliberately
unauthenticated route; there is no gate to put in front of it. (2) `createAdminClient()` returns
`null` when `SUPABASE_SERVICE_ROLE_KEY` is unset (`supabase.ts:51-53`), and that key is a registered
**optional** server secret — today an unconfigured deployment loses staff management but keeps the
invite and recovery journeys working. Depending on it here would silently kill the whole link
journey on a missing secret, and the symptom (`/auth/forgot-password?expired=1` for everyone) reads
as an expired-link problem rather than a config one.

The anon grant is safe for the same reason the design is safe at all: the caller must already hold a
valid `token_hash`, the function returns nothing without one, and it is lookup-only. Enumeration
resistance comes from the hash's entropy, not from the grant — and the three fail-closed clauses
above mean a guessed hash still yields no row unless the type, the expiry window, and the
deactivation check all pass. Rate-limiting a guessing loop is out of scope for this change; note it
in the migration comment.

**Note the coupling**, and record it in the migration's header comment: `auth.one_time_tokens` is a
GoTrue-internal table with no stability contract. A GoTrue upgrade that changes it breaks the role
gate, not the flow — so the function must fail closed (no row → refuse), and the upgrade risk is
worth naming in `known-issues.md`.

#### 2. The callback handler

**File**: `src/pages/auth/callback.ts`

**Intent**: Replace the exchange with validate → resolve → gate → stamp. Nothing irreversible
happens on the GET, which is the whole of the fix.

**Contract**: The `?code=` PKCE arm (`:82-86`) is **removed** — our own templates never mint one, it
has no deferred form, and keeping it would leave one arm that defers and one that exchanges. Removing
it also retires the impl-review F1 hazard that forced `invite` to be computed inside the `token_hash`
arm. The `LINK_TYPES` closed set (`:25-29`) **survives and stays load-bearing** — `type` is still
caller-supplied and must be validated before it reaches the RPC. It is **not sufficient on its own**:
it bounds the set, and the RPC's hash-AND-type match (phase 4 §1 clause 1) is what bounds the
pairing. Both are required; neither replaces `verifyOtp`'s guarantee alone. The anti-fixation refusal at
`:42-44` **stays** (see phase 5). On success, stamp the repurposed cookie with `token_hash` + `type`
using `linkCookieOptions(url)` unchanged, and redirect as today. A non-employee target redirects to
the page's R14 branch with the token unspent.

#### 3. The cookie's payload

**File**: `src/lib/auth-session.ts`

**Intent**: `LINK_ORIGIN_COOKIE` stops being a freshness marker and becomes the carrier for
`token_hash` + `type`. Its freshness role is subsumed by GoTrue's own token expiry, which is the
authority now.

**Contract**: A serialise/parse pair for the new payload, beside `readLinkOrigin`, which **survives**
— `type` still selects invite-vs-recovery copy and is likely folded into the new parse.
`LINK_COOKIE_OPTIONS` / `linkCookieOptions` (`:60-74`) survive: the same attributes are needed, and
`httpOnly` + short-lived + single-use is the posture a cookie-borne credential requires. Parsing must
fail closed on anything malformed. **Do not touch `shouldSecureCookies`** (`:5`) — it is shared with
`middleware.ts`, `signin.ts`, and `signout.ts`.

#### 4. Extracted branch decisions

**Files**: `src/lib/auth-session.ts` + `src/lib/auth-session.test.ts`

**Intent**: Put the callback's and the page's new branch logic where a gate can see it. Per
`research.md` §4 an `.astro`-only edit runs no test at all, so anything left in frontmatter is
unenforced.

**Contract**: Pure functions for "is this a usable pending-token cookie" and the page's branch
selection, with unit tests in the existing `auth-session.test.ts`. The 11 `readSessionOrigin` cases
at `:48-116` are phase 6's problem, not this phase's — leave them passing until then.

#### 5. The registry and the risk register

**Files**: `docs/reference/contract-surfaces.md`, `context/foundation/known-issues.md`

**Intent**: Record the two things this phase changes that live outside the code it touches.

**Contract**: In `contract-surfaces.md`, the `/auth/callback, /auth/forgot-password,
/auth/reset-password` row currently reads "PKCE recovery + invite-accept" — the PKCE arm is deleted
in §2, so that description becomes false. Restate it as the deferred-exchange shape and add the
token-lookup RPC as its own row (noting it is intentionally anon-callable).

In `known-issues.md`, record the `auth.one_time_tokens` coupling: it is a GoTrue-internal table with
no stability contract, the app now depends on its `token_hash`, `token_type`, and `user_id` columns,
and a GoTrue upgrade that changes them breaks the role gate rather than the flow — the function fails
closed, so the symptom is a refused link, not an open one. Name the GoTrue version the probes ran
against (v2.188.1, 2026-08-20) so a future reader can tell when the assumption was last true. Both
this plan and `plan-brief.md` already promise this entry; this is the phase that owes it.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase migration up`
- Generated types in sync: `npx supabase gen types typescript --local` leaves no diff
- New unit tests for the cookie payload and branch selection pass: `npm test`
- `rpc-execute-grants.test.ts` covers the new RPC in its **public** block — anon must be able to
  call it, and the grant must not have been left at the default
- The RPC fails closed on each of §1's three clauses, asserted separately against real GoTrue-minted
  tokens: a hash presented with the wrong `type` returns no row; a token past the otp window returns
  no row; a deactivated target returns a null role
- Type checking passes: `npx astro check`
- Lint passes: `npm run lint`
- Integration tests pass: `npm run test:integration`
- `contract-surfaces.md` no longer describes `/auth/callback` as a PKCE path, and lists the
  token-lookup RPC; `known-issues.md` carries the `auth.one_time_tokens` coupling with its probed
  GoTrue version

#### Manual Verification:

- Opening an invite link renders the set-password form and **does not** create a session — confirm
  `/dashboard` still redirects to sign-in from that browser (this is `research.md` §5.1's measured
  defect, closed)
- Opening the same link a second time renders the form again rather than "Link wygasł"
- A deactivated staffer's link still gets "Konto jest nieaktywne" before the form
- An invalid or expired token still lands on the expired screen, never a 500
- A genuine **recovery** link with `&type=invite` appended renders the recovery copy, never
  `Witaj we Flocie` (the `auth-followups` F3 regression check)

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 5: Submit-time exchange

### Overview

Move `verifyOtp` onto the POST, where it happens as one operation with the password set, and
re-source the page's render inputs from the token lookup now that there is no session.

### Changes Required:

#### 1. The set-password route

**File**: `src/pages/api/auth/reset-password.ts`

**Intent**: Perform the exchange and the password set together, so the token is spent exactly when
the task completes. The route's gate order changes shape: there is no incoming session to classify,
so provenance now comes from holding an unspent token rather than from a session's `amr`.

**Contract**: Gates (d) `readSessionOrigin` (`:83`) and (e) the marker (`:90`) **collapse** into "is
there a pending, unspent token cookie". Gate (a) CSRF (`:61-64`) is unchanged and still runs first.
Gates (b) session and (c) role (`:67-77`) are re-sourced: identity comes from the token lookup, and
the role check uses the same RPC phase 4 added. On success the order is `verifyOtp` → `updateUser`
→ `mark_password_set()` → delete the token cookie → set `PW_SET_DONE_COOKIE` →
`signOut({ scope: "global" })`. `PW_SET_DONE_COOKIE` **survives** — the success screen still needs
its one-shot marker after the global sign-out.

Preserve the two deliberate retryability behaviours: a zod failure (`:110-114`) and a rejected
password (`:117-122`) must **not** spend the token, so a typo does not bounce the user to "Link
wygasł". Under the new shape that means the exchange must be ordered so a validation failure returns
before `verifyOtp` runs.

**Conflict guard.** `verifyOtp` at POST still mints a session that would replace a signed-in
colleague's on a shared workstation. Refuse when a different user is already signed in, and route to
the existing R11 card rather than silently switching accounts.

#### 2. The set-password page

**File**: `src/pages/auth/reset-password.astro`

**Intent**: Render the same six branches from the new inputs. The page currently reads
`Astro.locals.user`, which no longer exists on this path.

**Contract**: All six branches survive with their screens, in their current order. Two of the five
predicates change, and they must be restated **precisely** — "no token" alone is not a drop-in for
"no session", because it would swallow branch 4's entire population:

| #   | Screen                            | Predicate today              | Predicate after                     |
| --- | --------------------------------- | ---------------------------- | ----------------------------------- |
| 1   | R4 done                           | `done` cookie (`:57`)        | unchanged                           |
| 2   | R13 "Nie ma tu nic do ustawienia" | `!user` (`:90`)              | **no pending token AND no session** |
| 3   | R14 "Konto jest nieaktywne"       | `!staff` (`:104`)            | role from the token lookup is null  |
| 4   | R12 "Zmień hasło w ustawieniach"  | `origin !== "link"` (`:120`) | **a session, but no pending token** |
| 5   | R5 "Link wygasł"                  | `!mode` (`:137`)             | pending token present but unusable  |
| 6   | the form                          | else                         | else                                |

Branches 2 and 4 partition the "no pending token" case by whether a session exists — a cold visitor
gets R13, a signed-in staffer who typed the URL gets R12 and its CTA to the account screen. Collapse
them and R12's whole block goes dead, including its `AccountBox` at `:133`; design-contract §8.2
asserts R12 parity, so that would surface as a failed vision-diff rather than a caught bug.

**Data sources, per branch.** Branch 3's R14 card and the form's `AccountBox` (`:156`) are fed from
the token lookup — email, `full_name`, and role. Branch 4's `AccountBox` (`:133`) stays on
`Astro.locals.user`: there is no token on that branch, so the RPC has no input, and the box's label
there is `Zalogowano jako` — it names the session in the way, not the link's target.

`fullName` (`:76`) currently comes from `user.user_metadata.full_name` and drives the initials avatar
via `staffInitials` (`AccountBox.astro:34`). On the link path there is no user, so it must come from
the RPC's `full_name` — `profiles.full_name` and the metadata copy are written together at invite
time (`services/staff.ts:192-202`), so it is the same name. Omitting it would silently downgrade the
avatar to an email-derived fallback on the invite form, which is exactly the screen this change
exists to fix.

`readSessionOrigin` at `:63` and the marker read at `:73` are replaced by the pending-token read.
**No visual change is intended on any of these screens** — this is a re-sourcing of the same rendered
output, and the design-contract entries assert parity rather than describing new surfaces.

#### 3. The conflict page and the signout marker

**Files**: `src/pages/auth/link-conflict.astro`, `src/pages/api/auth/signout.ts`

**Intent**: Keep R11 — and note that its copy becomes _true_ under this design. The card promises
"wyloguj się, a potem otwórz link ponownie"; today the token is spent on the GET so that promise
fails, which is Bug 2. With the exchange deferred, the token is genuinely unspent and reopening works.

**Contract**: `link-conflict.astro` is unchanged. Its header comment (`:8-19`) should be updated to
record the new reason the promise holds. Separately, `/api/auth/signout` never deletes the link
cookie (`:5-16`) — add the deletion so a signed-out browser carries no stale pending token. This is
strictly narrowing: the cookie can only ever deny, never grant.

### Success Criteria:

#### Automated Verification:

- Integration tests pass: `npm run test:integration`
- Unit tests pass: `npm test`
- Type checking passes: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- The retryability cases assert the token survives a password mismatch and a rejected password

#### Manual Verification:

- **Bug 2's exact sequence**: open invite link → close the tab without setting a password → reopen
  the link → the set-password form renders (today: `/auth/link-conflict`)
- Setting a password succeeds, shows the R4 success card, and signs the user out globally
- Reopening the link after a successful set lands on "Link wygasł"
- A colleague signed in on a shared workstation still gets R11, and signing out then reopening the
  link now works
- Invite copy (`Witaj we Flocie` / `Ustaw hasło` / `Aktywuj konto`) still renders for an invite link,
  recovery copy for a recovery link
- The account box still names the address whose password is changing, **with the hire's initials** —
  not an email-derived fallback
- The R13/R12 partition holds: a signed-out visitor typing `/auth/reset-password` gets
  `Nie ma tu nic do ustawienia`; a signed-in staffer typing it gets `Zmień hasło w ustawieniach`
  with the `Zalogowano jako` box naming their own session

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 6: Deletion sweep

### Overview

Remove the machinery that existed only to compensate for the old timing. Leaving it half-present is
worse than either design, so every symbol gets a verified-dead check.

### Changes Required:

#### 1. Verified-dead deletions

**File**: `src/lib/auth-session.ts` + `src/lib/auth-session.test.ts`

**Intent**: Delete the session-provenance machinery. Authority now comes from the token, not from how
a session was minted — so `amr` classification has no remaining consumer.

**Contract**: Delete `readSessionOrigin` (`:126-163`), its private helpers `readAmr` (`:96-116`) and
`decodeBase64Url` (`:82-93`), the `SessionOrigin` type (`:33`), and the 11 `readSessionOrigin` tests
(`auth-session.test.ts:48-116`). This removes the app's only JWT-claim read. Also delete the module
comment's origin/freshness rationale (`:7-30`), which documents a design that no longer exists.

**Per-symbol gate**: `grep -rn "<symbol>" src tests e2e` must return nothing, then
`npm run lint && npx astro check && npm test && npm run test:integration`. The grep **is** the gate —
neither `astro check` nor lint errors on an unused public export, so the type-checker will not catch
a dead symbol left behind.

#### 2. What must NOT be deleted

**Intent**: Record the trap explicitly so the sweep does not overreach.

**Contract**: `shouldSecureCookies` (`src/lib/secure-cookies.ts:38`) is imported by
`auth-session.ts:5` **and** by `middleware.ts:4,11`, `api/auth/signin.ts:8,47`,
`api/auth/signout.ts:3,10` — it is the one shared rule deciding the `secure` attribute for the
session cookies, and its own tests are `src/lib/secure-cookies.test.ts`. `src/lib/access.ts`
(`requireRole`, `ROUTE_ROLES`, `isRoleSufficient`) is untouched. `readLinkOrigin` / `LinkOrigin`,
`LINK_COOKIE_OPTIONS` / `linkCookieOptions`, `PW_SET_DONE_COOKIE`, and the `LINK_TYPES` closed set
all survive.

#### 3. Test-helper and integration rewrites

**Files**: `tests/helpers/link-session.ts`, `tests/integration/reset-password.test.ts`,
`tests/integration/auth-callback.test.ts`

**Intent**: These are built on a shape the new design never produces.

**Contract**: `link-session.ts` (82 lines) fabricates an `amr: [{ method: "otp" }]` session — rewrite
it to mint a pending-token cookie instead. `reset-password.test.ts` (291 lines, ~12 tests) is built
on origin + marker — rewrite against the new gate set, preserving the retryability assertions.
`auth-callback.test.ts` carries the committed GoTrue probe that a recovery token presented as
`type=invite` answers 403 `otp_expired` — that probe **must survive**, retargeted at the POST where
the exchange now happens, so a later GoTrue cannot loosen it silently.

#### 4. E2E specs

**File**: `e2e/auth-hardening.spec.ts`

**Intent**: Two of these tests assert a property that becomes trivially true, and should assert the
new one instead.

**Contract**: `:76` and `:107` ("refused, not consumed") become tautologies — retarget them to assert
**idempotent reopen**: the same link opened twice renders the form both times. `:53` and `:171` need
review against the new flow. `:132` ("a deactivated staffer on a live recovery link is told why, not
shown the form") **must keep passing unchanged** — it is the e2e proof of phase 4 §1 clause 3, and
the one test that would catch a token-lookup RPC returning `profiles.role` verbatim. `:66-67` —
which asserts the conflict card names
`employee@fleetrent.test` and not the link recipient — must keep passing; the genuine-conflict case
is unchanged. Specs must open their own
`browser.newContext({ storageState: { cookies: [], origins: [] } })` — never `test.use` at file
level — and must **never** click sign-out, because `/api/auth/signout` runs at supabase-js's default
_global_ scope and would kill the shared `employee` storage state for every later spec.

**Run on `:4321`.** GoTrue's allow-list pins Mailpit-derived links to that port regardless of
`E2E_BASE_URL`; `inviteCallbackLink` assembles its own URL from `BASE_URL`, but `webServer.command`
is `npm run dev` so the suite runs there in practice anyway.

### Success Criteria:

#### Automated Verification:

- `grep -rn "readSessionOrigin\|readAmr\|decodeBase64Url\|SessionOrigin" src tests e2e` returns
  nothing
- `grep -rn "shouldSecureCookies" src` still returns the four keep-list call sites
- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`
- The retargeted GoTrue type-confusion probe passes against the POST
- Type checking passes: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- E2E suite passes on `:4321`: `npm run test:e2e`

#### Manual Verification:

- The full invited-hire journey works end to end: invite → mail → link → form → password → sign in
- The recovery journey works end to end from `/auth/forgot-password`
- Signing out clears the pending-token cookie
- No auth screen renders differently from before phase group B

**Implementation Note**: Phase group B is complete here.

---

---

## Phase 7: One-step framing for the provisioning failure

### Overview

The two provisioning-failure strings describe the failure the way the **transaction** experienced it
("the invite went out, but the account didn't finish") rather than the way the **admin** did ("adding
this person failed"). That decomposition is ours, not theirs. Collapse both arms to one message, and
name the address — because a failed provisioning is invisible on the roster, so the banner is the
only place in the product where that address exists.

No behaviour changes. This is copy plus the branch that selects it.

### Changes Required:

#### 1. The message, as a testable pure function

**File**: `src/lib/staff-banner.ts` (new) + `src/lib/staff-banner.test.ts` (new)

**Intent**: The `COPY` block is a module-private object inside a `.tsx` island, so nothing can gate
its wording — and this change exists _because_ the wording was wrong. Follow the same move `staff-status.ts`
made in phase 3: put the decision in `src/lib`, where the `unit` project holds it.

**Contract**: A pure function mapping the API's failure `code` plus the submitted address to the
string to render. It must map **both** provisioning codes to the **same** sentence — that identity is
the whole point, and a test asserting it is what stops a future edit from re-splitting them. Unit
tests cover: both codes yield byte-identical output; the address is interpolated; an unknown code
yields null so the caller falls through to the network banner.

#### 2. The island

**File**: `src/components/staff/StaffList.tsx`

**Intent**: Render the collapsed string; extend the same treatment to `repairedMailFailed`, which has
the same "which person?" gap for a different remedy.

**Contract**: `COPY.provisionRolledBack` and `COPY.provisionOrphaned` are **replaced by one entry**
sourced from §1's function, following the `eyebrowMobileWord` precedent (`:80`) for a function-valued
`COPY` member. The approved string (design-contract §9.2, verbatim):

```
provisionFailed: (email) => `Nie udało się utworzyć konta dla ${email}. Spróbuj ponownie.`
```

`repairedMailFailed` also becomes a function of the address in this phase; **phase 8 rewrites the
control it names**, so change only the interpolation here and leave the wording alone. `addEmployee`'s branch
still matches **both** codes — the API keeps distinguishing them — and still closes the modal and
keeps `retry` wired on both. The `repairedMailFailed` arm still carries **no** retry.

#### 3. The route keeps both codes — say why

**File**: `src/pages/api/staff.ts`

**Intent**: Stop a later reader "simplifying" the API to match the UI.

**Contract**: Comment only. `provision_rolled_back` vs `provision_orphaned` is a system-health signal
— an orphan means the compensating delete failed — and belongs in logs and monitoring. The collapse
is a **UI** decision; the seam is the island, not the service.

#### 4. Design contract

**File**: `context/changes/invite-journey-fixes/design-contract.md`

**Contract**: §9 drops from three strings to two. §10 entry 1 loses the `naprawić` accepted
imprecision entirely — the word goes away — and restates the delivered-mail imprecision as a
deliberate omission that **phase 8 removes at the root**. §8.1 gains a note that the message may wrap
to a second line at 390px with a long address, which is accepted (it is shorter than the two-sentence
string it replaces).

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new `staff-banner.test.ts`: `npm test`
- Both provisioning codes provably render the same sentence
- Lint passes: `npm run lint`
- Type checking passes: `npx astro check`
- Integration tests pass (the API still returns both codes): `npm run test:integration`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Both failure arms show one message naming the address
- `repairedMailFailed` names the address and still carries no `Ponów`
- Copy matches `design-contract.md` §9 verbatim
- A long address wraps without breaking the banner row at 390px

---

## Phase 8: Two-step add — create, then invite

### Overview

Adding an employee becomes two explicit acts: **create** the account (silent), then **send the
invitation**. This applies the change's own root-cause framing properly — the irreversible act now
happens _last_, after the thing it commits to exists.

It settles what phases 1 and 7 could only describe: **no mail is ever sent for an account that does
not exist**, so the dead link disappears, and with it the hire's silent dead end (research showed a
rolled-back hire lands on "Link wygasł", asks for a new link, and `resetPasswordForEmail` on a
non-existent address succeeds silently and mints nothing — they cannot self-rescue).

**Probe-verified 2026-08-21, and the reason this is cheap:**

- `createUser({ email, email_confirm: false })` sends **zero** mail and leaves `invited_at` null.
- `inviteUserByEmail` **works on a user that already exists** — it sends the real GoTrue invite
  through `supabase/templates/invite.html`, leaves the `profiles` row intact, stamps `invited_at`,
  and the link exchanges cleanly. So we never own the send, and option 2a's deferred cost (the Resend
  seam, a new app template, the prod-only hosted-attachment gate, the `EMAIL_FROM` format trap) does
  **not** apply.
- `invited_at` is already an OUT column of `list_staff`, so the third roster state needs **no migration**.

### Changes Required:

#### 1. The service splits

**File**: `src/lib/services/staff.ts`

**Intent**: `createEmployee` stops sending mail. Sending becomes its own operation.

**Contract**: The net-new arm becomes `admin.auth.admin.createUser({ email, email_confirm: false,
user_metadata: { full_name } })` followed by the `profiles` insert — no `inviteUserByEmail`. The
compensating delete stays and is now unconditionally safe (nothing was sent); **keep both result tags**
for the health signal, per phase 7 §3. A new `inviteEmployee(admin, userId, origin)` resolves the
address through `getStaffEmail` (never trust a client-sent one, `staff.ts:286`) and calls
`inviteUserByEmail`, returning a `sent` / `failed` tag.

**Both open decisions are now settled (owner, 2026-08-21), and probe-verified the same day:**

- **Who may be invited.** The roster offers the action **iff `password_set_at` is null** — which
  covers both password-less states: a first send for someone created-but-never-invited, and a
  **resend** for someone invited who lost the mail. Today the only remedy for a lost invite is
  `Resetuj hasło`, which answers with a _recovery_ link and so downgrades a new hire's first contact
  to the reset journey — precisely the defect that got option 2b rejected. The resend closes it.
- **The repair arm invites; it does not reset.** A never-activated hire reached through the
  `existing` arm gets `inviteUserByEmail`, not `resetPasswordForEmail`. That removes
  `resetPasswordForEmail` from `createEmployee` entirely, and `ActivationMailOutcome` becomes the
  invite's outcome. `repairedMailFailed`'s copy still reads true — an invite _is_ the activation mail.

**Probe findings that bind the implementation (2026-08-21, GoTrue v2.188.1):**

- `inviteUserByEmail` is **refused** for an address that is already confirmed-registered
  (`"A user with this email address has already been registered"`), and **accepted** for a user
  created with `email_confirm: false`. Step 1 must therefore create with `email_confirm: false`, or
  step 2 cannot run at all. In our flow "confirmed" and "has a password" coincide, because the only
  way to get a password is the link exchange, which confirms the address.
- **Do not lean on that refusal as the control.** Carry an explicit `password_set_at is null` check in
  `inviteEmployee` and treat GoTrue's error as defence in depth — lessons.md, "prefer an explicit
  in-app check you can test over a provider flag you cannot see".
- The invite succeeds **after the repair arm's unban**, with the `profiles` row intact — so the
  ordering unban → upsert → invite is buildable as written.
- A **resend invalidates the previous link**. There is never more than one live invite token per
  person, so a resend is safe and the older email's link dies rather than lingering.

**The two row actions become mutually exclusive** (owner, 2026-08-21). `Wyślij zaproszenie` while
`password_set_at` is null; `Resetuj hasło` only once it is set. The reason is correctness, not
clutter: for a password-less person `Resetuj hasło` sends `resetPasswordForEmail`, i.e. a _recovery_
link and recovery copy — the option-2b downgrade — so it is the wrong door rather than a redundant
one, and its label presupposes a password that does not exist. Nothing is lost, because the invite
and its resend cover that population with the right journey.

**This forces a copy change, and the two must land together.** `repairedMailFailed` fires **only**
when the target has no password (`activationMail` is `failed` only under `!hasPassword`), and its
string names `„Resetuj hasło"` — the one control that row would no longer show. Since this phase's
repair arm **invites** rather than resets, the failed mail is a failed _invite_ and the remedy is
`Wyślij zaproszenie`, which that row does carry. Rewrite the string to name it. (Phase 7 adds the
address to this string and that survives; only the control it names changes here — do not re-do the
address.) Leaving the two apart would break design-contract §9's stated rule that the copy names
controls the admin can actually see on screen.

Nothing in `e2e/` or `tests/` asserts `Resetuj hasło` on a row, so hiding it breaks no gate — which
is itself worth noting: the action column becoming state-dependent is a **design** change with no
test to catch a mistake in it, so it needs the §5 contract entry and the rendered check in 8.14.

#### 2. The third status

**Files**: `src/lib/staff-status.ts`, `src/lib/staff-status.test.ts`

**Contract**: `deriveStaffStatus` takes `invitedAt` alongside `passwordSetAt`: a password → `active`;
invited but no password → `invited`; neither → the new third state. `StaffMember["status"]` widens.
`ListStaffRow` already carries `invited_at`, and `listStaff`'s mapping already reads it. The phase-3
regression case must still hold — a link exchange stamping `last_sign_in_at` is still not an input.

#### 3. The invite route

**File**: `src/pages/api/staff/[id]/invite.ts` (new)

**Contract**: Admin-gated, mirroring `src/pages/api/staff/[id]/reset-password.ts` exactly — CSRF →
auth → `requireRole(admin)` → act → `json(...)`. Per lessons.md, `/api` sits outside middleware's
gate and must self-gate in that order.

#### 4. The island

**File**: `src/components/staff/StaffList.tsx`

**Contract**: A third badge state (desktop + mobile labels + a filter tab/chip with its count), and a
row action offered for **both** password-less states. Approved copy, design-contract §9.2, verbatim:

| Key                   | String                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `statusCreated`       | `DODANY`                                                                                                   |
| `statusCreatedMobile` | `Dodany`                                                                                                   |
| `tabCreated`          | `Dodany` (singular — matches `tabActive`)                                                                  |
| `chipCreated`         | `Dodani` (plural — matches `chipActive`)                                                                   |
| row action            | `Wyślij zaproszenie` (one label for BOTH password-less states)                                             |
| add-modal CTA         | `Dodaj` (was `Wyślij zaproszenie`)                                                                         |
| `emptyHint`           | `Dodaj pierwszą osobę — zaproszenie wyślesz w kolejnym kroku.`                                             |
| `repairedMailFailed`  | `Konto zostało odnowione, ale zaproszenie nie zostało wysłane. Użyj „Wyślij zaproszenie” przy tej osobie.` |

**One label, not two.** A resend does not get its own wording: `repairedMailFailed` has to NAME the
button, and after a repair the target may be in either password-less state, so two labels would make
that string unnameable. The badge carries the first-send-vs-resend distinction instead. The action needs a pending state per
`CLAUDE.md` ("Async buttons") — `disabled` plus a spinner, reusing `SubmitButton`'s `animate-spin` ring.

**Both replaced strings are load-bearing elsewhere**: `e2e/staff-admin.spec.ts:38` clicks the
add-modal CTA **by name**, so renaming it to `Dodaj` reds that spec until updated; and `emptyHint`
promises `wyślemy jej link aktywacyjny e-mailem`, which step 1 no longer does.

#### 5. Design contract + registry

**Files**: `context/changes/invite-journey-fixes/design-contract.md`,
`docs/reference/contract-surfaces.md`

**Contract**: A new badge state and a new row action are a **new user-facing surface with no
artboard** — it needs its own Design Alignment Audit pass and a `deviation(no artboard)` entry with
exact values and **verbatim Polish copy**, the same shape entry 1 took. `contract-surfaces.md` gains
the new route and records the widened `StaffMember["status"]` union and `CreateEmployeeResult`.

#### 6. Tests

**Files**: `tests/integration/staff.test.ts`, `e2e/staff-admin.spec.ts`, `e2e/staff-auth.spec.ts`

**Contract**: Integration — creating sends **no** mail (assert against Mailpit's message count, not
just the absence of an error), inviting sends exactly one, inviting an already-created user succeeds,
and the roster reports the third state. E2E — `staff-admin.spec.ts`'s add flow follows the renamed
CTA and asserts the new badge, then a create → invite → accept path proves the link still works end
to end. `staff-auth.spec.ts`'s invite-accept journey must keep passing.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the three-state derivation: `npm test`
- Integration proves **zero** mail on create and exactly one on invite
- Integration proves `inviteUserByEmail` succeeds for an already-created user
- Integration tests pass: `npm run test:integration`
- Type checking passes: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- E2E suite passes on `:4321`: `npm run test:e2e`

#### Manual Verification:

- Adding a person creates a roster row immediately and sends nothing
- `Wyślij zaproszenie` sends the invite; the badge moves to ZAPROSZONY
- The emailed link still lands on the invite form with the hire's initials
- A failed create shows phase 7's banner and leaves no mail in Mailpit
- The new badge and row action match `design-contract.md` verbatim at both breakpoints

---

## Phase 9: Report the add failure where the admin is — inside the modal

### Overview

Every failure of `POST /api/staff` is reported in the wrong place, and one of them is reported
nowhere at all. Raised by the owner at phase 7's manual gate, then measured against the running app
(1280×900, `/dashboard/staff`, `elementFromPoint` hit-test at the banner's centre, 2026-08-21):

| Arm                                      | Modal      | Is the error actually visible?                                     |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------ |
| 409 duplicate                            | stays open | **Yes** — inline under the email field (`:324`), the shipped idiom |
| `provision_rolled_back` / `_orphaned`    | **closes** | Yes, as a banner — but the admin is moved off the form they filled |
| Unhandled 500 / network (`fetch` throws) | stays open | **NO** — see below                                                 |

The last row is the defect. `addEmployee`'s network arm sets the banner and leaves the modal open, so
the banner paints **behind** `ModalShell`'s overlay (`StaffList.tsx:212`,
`fixed inset-0 z-[60] … bg-[rgba(20,18,22,0.55)] backdrop-blur-sm`). Hit-testing the banner's centre
returns the overlay, not the banner: the admin submits, the button returns to idle, and their only
feedback is a blurred red smear behind a dimmed backdrop. **The most common failure — a dropped
connection, the one case where the typed values are still perfectly good — is the one that reports
nothing.**

The partition is also backwards. The 409 already proves this design's own answer to "the server
refused your add": say so in the form. Phase 7's own copy ends `Spróbuj ponownie.` — an instruction
to retry, issued after the form the admin would retry in has been taken away.

**This reopens a phase-1 decision deliberately, and must not silently overwrite it.**
`StaffList.tsx:521-522` records the reasoning: _"Close the modal: the banner's `Ponów` is the single
retry surface, and leaving the form open behind it would offer a competing second one."_ That
reasoning was sound while the invite mail had already gone out — closing the modal was the signal
that something irreversible **had** happened, against a shipped bug where the modal stayed open and
implied nothing had. Two things changed it: phase 7 collapsed the copy to `Spróbuj ponownie.`, and
phase 8 stops sending any mail on create, so a failed create becomes fully retryable in place with
nothing delivered. The "competing retry surface" problem does not disappear — it inverts. Resolve it,
do not inherit it.

**Ordered after phase 8 on purpose.** Phase 8 already rewrites this modal (CTA → `Dodaj`, `addSub`),
so running this first would touch identical lines twice and force two design passes over one surface.

### Changes Required:

#### 1. Where each failure is reported — the decision, as a testable pure function

**File**: `src/lib/staff-banner.ts`, `src/lib/staff-banner.test.ts`

**Intent**: The routing decision ("this outcome is reported in the modal / in the banner / in both")
must not be an `if` buried in an island, for the same reason phase 7 moved the copy out: an `.astro`
or `.tsx`-only edit runs no test, and this phase exists because the routing was wrong.

**Contract**: Extend the phase-7 module with a function mapping an add outcome — HTTP status plus
`code`, including the `fetch`-threw case — onto a **target** (`modal` / `banner` / `both`) and the
string. Every arm gets a case, including the ones that keep today's behaviour, so the table is
readable in one place. Unit tests cover each arm's target, and specifically that no arm resolves to
`banner` while leaving the modal open — the exact state that produced the invisible error.

#### 2. A form-level error slot in the add modal

**File**: `src/components/staff/StaffList.tsx`

**Intent**: The modal's two error slots are field-level (`:294-299`, `:317-325`) and can only attach
to a field. A provisioning or network failure belongs to the submission, not to a field.

**Contract**: One form-level slot in `AddModal`, reusing the shipped inline-error idiom verbatim —
`text-destructive mt-1.5 flex items-center gap-1.5 text-[13px]` with `AlertTriangle className="size-3.5"`
— placed per the design entry in §4. It clears on edit, exactly as `dupEmail` does at `:315`. The
modal stays open on both provisioning arms and on the network arm; its submit button becomes the
retry, and `busy` already gives it the pending state `CLAUDE.md` requires.

#### 3. The retry surfaces, resolved rather than duplicated

**File**: `src/components/staff/StaffList.tsx`

**Contract**: With the modal staying open, decide and record ONE of: (a) the banner is not set for
these arms at all — the modal owns the failure; or (b) the banner is still set for the record but
drops `Ponów`, leaving one retry control on screen. Do **not** ship the modal's submit and the
banner's `Ponów` as two live retries for one failure — that is the state `:521-522` was written to
prevent, and it is the reason this phase is not a two-line edit. Replace that comment with the new
reasoning; leaving a comment that describes the opposite decision is worse than no comment.

`repairedMailFailed` is **out of scope and must not move**: it rides a 200, the row really did land,
and its modal really should close. It stays a banner.

#### 4. Design contract

**File**: `context/changes/invite-journey-fixes/design-contract.md`

**Contract**: A form-level error on the add modal is a **new user-facing state with no artboard** —
catalog 19/25 carry the healthy roster only, and §10 entry 1 already records that there is no banner
artboard either. It needs its own `deviation(no artboard)` entry with exact values (they should be
inherited-exact from the field-level idiom above — verify, do not invent) and **verbatim Polish
copy**, plus a §8 layout row. §11 gains a vision-diff row for the modal's error state at both
breakpoints. Entry 1's "Retry affordance" paragraph in §8.1 is restated to match §3's decision.

**Copy is an open decision for the design pass, not the implementer**: whether the modal reuses
phase 7's `provisionFailed` string verbatim, or a shorter form-level variant (the modal is ~400px
wide and the string interpolates an address the admin can already see in the field two rows above —
which is the argument the banner version could not make). Same question for `mutationError`.

#### 5. Tests

**Files**: `src/lib/staff-banner.test.ts`, `e2e/staff-admin.spec.ts`

**Contract**: Unit tests per §1. Extraction alone is not sufficient (`e2e/seed.spec.ts:27-28`), so
add an e2e assertion that the surface actually calls it: with `POST /api/staff` stubbed to fail, the
modal is still open **and** the error is the topmost element at its own centre — assert visibility
the way the defect was measured, not with a bare `toBeVisible()`, which passes today on an error
buried under the overlay.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the outcome→target table: `npm test`
- No arm resolves to a banner-only report while the modal stays open
- Lint passes: `npm run lint`
- Type checking passes: `npx astro check`
- Integration tests pass: `npm run test:integration`
- Production build succeeds: `npm run build`
- E2E suite passes on `:4321`: `npm run test:e2e`

#### Manual Verification:

- A forced provisioning failure reports inside the modal, with the typed values intact
- A dropped connection reports inside the modal — the phase-9 defect, closed
- Exactly one retry control is on screen for one failure
- A 409 duplicate still reports inline under the email field, unchanged
- `repairedMailFailed` still closes the modal and reports as a banner
- The error state matches `design-contract.md` verbatim at 1280px and 390px

## Phase 10: The roster banner is unreachable from the row that triggers it

### Overview

The roster's feedback banner is inserted at the **top of the document flow**, above the filter card,
while three of the four controls that set it are **per-row** and reachable at any scroll depth. So the
message routinely lands outside the viewport, and `toBeVisible()` passes on every one of them.

Found at phase 9's manual gate as "the remove modal has phase 9's defect too", then measured against
the running app and found to be larger than that (1280×900, `/dashboard/staff`, real fixture,
`getBoundingClientRect` + `elementFromPoint`, 2026-08-21):

| Trigger                                      | scrollY | Banner top | In viewport? | `toBeVisible()` |
| -------------------------------------------- | ------- | ---------- | ------------ | --------------- |
| `removeEmployee` failure (abort **and** 500) | 329     | **-151**   | **no**       | **passes**      |
| `resetPassword` failure, row scrolled to     | 259     | **-159**   | **no**       | **passes**      |

Two distinct failures compound in the remove case, and the first is the one phase 9's framing missed:

1. **The banner is off-screen entirely.** `RemoveModal` is `fixed inset-0`, pinned to the viewport;
   the banner is in document flow at the top of a page the admin has scrolled. `elementFromPoint` at
   its centre returns `null` — the point is not covered, it is outside the viewport. `body` keeps
   `overflow: visible` while the modal is open, so the page really is scrolled behind it.
2. **Scroll up to it and it is still unreadable** — that is where `ModalShell`'s overlay
   (`fixed inset-0 z-[60] ... bg-[rgba(20,18,22,0.55)] backdrop-blur-sm`) takes over, the phase-9
   state. Stack at that point: overlay, then the table beneath it.

**Why phase 9 did not cover this.** Phase 9's scope was "every failure of `POST /api/staff`", and the
add modal escaped the scroll half by accident: `Dodaj pracownika` sits in a **non-sticky** header, so
the admin is necessarily at the top of the page when they open it. Its banner was covered, never
off-screen. The ✕, `Wyślij zaproszenie` and `Resetuj hasło` are per-row and carry no such guarantee.
Phase 9's fix is immune by construction — the message now lives inside a `fixed` modal, where scroll
position cannot move it — and `repairedMailFailed`, the one add outcome still on the banner, is safe
for the same reason the add modal was.

**The row actions are the harder half, and they include the SUCCESS banners.** `removeEmployee` has a
modal to move its message into; `sendInvite` and `resetPassword` do not. Their failures use
`mutationError` + `Ponów`, and their successes use `inviteSent` / `resetSent` — and `inviteSent` is
load-bearing: design-contract §9.3 authored it precisely because "a **resend** changes nothing on
screen — the badge is already ZAPROSZONY — so without it the admin gets no feedback at all." A
success banner the admin never sees fails that job exactly as completely as a failure banner does.

**Ordered after phase 9 on purpose.** Phase 9 built `resolveAddReport` and the modal's form-level
slot; this phase generalises both rather than inventing a second copy of each. Running it first would
have produced two routing tables.

### Changes Required:

#### 1. The routing table, generalised past the add flow

**File**: `src/lib/staff-banner.ts`, `src/lib/staff-banner.test.ts`

**Intent**: Phase 9 proved the routing decision must be a tested pure function rather than an `if`
inside an island. That argument does not stop at `POST /api/staff` — the three arms this phase
covers are the same decision for a different mutation.

**Contract**: Extend the module so remove and the row actions resolve through it too, keeping phase
9's invariant sweep and adding the new one this phase discovers: **no arm may report to a surface the
admin cannot reach from the control that triggered it.** Every arm gets a case, successes included.

**Two open decisions, neither for the implementer to take silently:**

- **Shape.** A sibling `resolveRemoveReport` / `resolveRowActionReport`, or one
  `resolveMutationReport` over a widened `Outcome` union. The union is tempting and may over-couple
  three mutations whose surfaces genuinely differ; decide it on the arms as written out, not in the
  abstract.
- **Module name.** `staff-banner.ts` already outgrew its name in phase 9 (it owns modal copy and
  routing, not banners). If this phase adds two more non-banner surfaces, rename it — and if it is
  renamed, that is a mechanical move plus import updates, recorded here so it is not smuggled in as
  part of a behaviour change.

#### 2. A form-level error slot in the remove modal

**File**: `src/components/staff/StaffList.tsx`

**Intent**: `RemoveModal` has no error slot at all today — unlike `AddModal`, which had two
field-level ones to generalise from — so this is slightly more than phase 9's edit.

**Contract**: One form-level slot, reusing phase 9's §8.4 element **verbatim** (`text-destructive mt-5
flex items-start gap-1.5 text-[13px]`, glyph `mt-0.5 size-3.5 shrink-0`, `role="alert"`); it is the
same state on a sibling surface, so nothing here is a new dimension. The modal stays open on both
failure arms, its `Usuń` button becomes the retry, and the typed-confirm value survives the retry
exactly as the add modal's field values do.

**Must not move**: the 200 arm (row removed, modal closes) and the 409 last-admin arm, which swaps to
`LastAdminModal`. Both already clear `removeFor`; neither is part of this defect.

#### 3. The row actions — the half with no modal to move into

**File**: `src/components/staff/StaffList.tsx`, and whatever surface §4 chooses

**Intent**: This is the part that is **not** a copy problem and not solvable by phase 9's move. Four
messages — `mutationError` + `Ponów` for a failed invite or reset, plus `inviteSent` and `resetSent`
-- are set from controls reachable at any scroll depth, and land above the fold.

**Contract**: Decide and record ONE approach, with the reasoning, the way §1 of phase 9 was recorded:

- (a) the banner becomes **sticky** within the content column, so it is reachable wherever the admin
  is;
- (b) the banner is **scrolled into view** when set;
- (c) feedback moves **next to the row** that produced it.

A toast is deliberately **not** on this list: `StaffList.tsx`'s own header comment records the shipped
decision as "an inline banner + optimistic list mutation (**no toast**)", and reversing that is a
design decision for the whole app, not a bug fix for one screen. If the phase concludes a toast is
nonetheless right, it stops and re-plans rather than shipping it here.

Note (b)'s trap before choosing it: a scroll-into-view fires while a modal may be open, and scrolling
the page behind an open modal is the behaviour §5 is about.

#### 4. Design contract

**File**: `context/changes/invite-journey-fixes/design-contract.md`

**Contract**: The remove modal's error state is the **same** state phase 9 specified in §8.4 on a
sibling surface, so it should be an **inherited-exact** entry, not a second specification — verify
that claim against the rendered modal rather than assuming it (the remove modal has no field group
above the slot, so the `mt-5` block rhythm needs re-measuring, not re-asserting). §3's chosen surface
IS a new dimension and needs its own `deviation(no artboard)` entry with exact values, plus §11
vision-diff rows at both breakpoints.

**Copy is an open decision, as it was in phase 9 §4**: whether the remove modal's form-level string is
a remove-specific sentence (`Nie udało się usunąć pracownika. …`, mirroring §9.4's construction) or
reuses `mutationError`. §9.4's own argument applies — the modal names the person two rows above --
and so does its counter-argument, that a new string needs approval. Do not author it outside §9.

#### 5. Body scroll under an open modal — named, and explicitly scoped

**Contract**: `getComputedStyle(document.body).overflow` is `visible` while `ModalShell` is open, so
the page scrolls behind every modal on this screen. It is a **contributing cause** of §1's
measurement and a real defect in its own right. Decide **in this phase** whether locking it is in
scope or a follow-up, and record which — do not leave it implied. Locking it does **not** fix this
phase's defect on its own (the banner is already off-screen when the modal opens), so it is not a
substitute for §2 or §3.

#### 6. Tests

**Files**: `src/lib/staff-banner.test.ts`, `e2e/staff-admin.spec.ts`

**Contract**: Unit tests per §1, including the widened invariant sweep. E2E must assert reachability
**the way this defect was measured** — `toBeVisible()` passed on every arm in the table above, so it
proves nothing here. Reuse phase 9's `isTopmostAtItsOwnCentre` and add an in-viewport assertion, then
prove both bite by deliberately reintroducing the defect and watching them go red, per
`e2e/e2e-rules.md`. Cover a **success** banner too (`inviteSent` after a resend from a scrolled row),
not only failures.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the widened outcome-to-surface table: `npm test`
- No arm resolves to a surface unreachable from the control that triggered it
- Lint passes: `npm run lint`
- Type checking passes: `npx astro check`
- Integration tests pass: `npm run test:integration`
- Production build succeeds: `npm run build`
- E2E asserts in-viewport AND topmost-at-its-own-centre, on a failure and on a success
- E2E suite passes on `:4321`: `npm run test:e2e`
- `design-contract.md` carries the remove-modal entry, §3's chosen surface, its copy, and §11 rows

#### Manual Verification:

- A failed remove reports inside the remove modal, with the typed confirmation intact
- The remove modal's 200 and 409 (last-admin) arms are unchanged
- A failed invite or reset, triggered from a row scrolled to the bottom of the roster, is readable
  without scrolling
- `Wysłano zaproszenie.` after a resend from a scrolled row is readable without scrolling
- Exactly one retry control is on screen for one failure
- The remove modal's error state matches `design-contract.md` verbatim at 1280px and 390px

## Testing Strategy

### Unit Tests:

- `src/lib/staff-status.test.ts` (new) — ACTIVE/INVITED derivation, including the regression case: a
  link exchange stamped `last_sign_in_at` but no password must derive INVITED
- `src/lib/auth-session.test.ts` — pending-token cookie parse (fails closed on malformed input),
  page branch selection; `readLinkOrigin`'s cases (`:118-129`) survive with their subject
- Existing suites unchanged: `access.test.ts`, `auth-messages.test.ts`, `secure-cookies.test.ts`

### Integration Tests:

- `tests/integration/staff.test.ts` — the failed-insert rollback (both arms, partial double failing
  only `.from("profiles").insert`); the orphan-shape repair (`profile === null`); the §1.5(a)
  inversion (clicked-but-never-set → INVITED + mail sent)
- `tests/integration/rpc-execute-grants.test.ts` — anon refused on `list_staff`, `deactivate_staff`
  and `mark_password_set`; anon **admitted** on phase 4's token-lookup RPC (intentionally public,
  lessons.md carve-out (a))
- `tests/integration/reset-password.test.ts` — rewritten against the new gate set, preserving the
  retryability assertions
- `tests/integration/auth-callback.test.ts` — the GoTrue type-confusion probe, retargeted at the POST

### Manual Testing Steps:

1. Force a `profiles` insert failure while adding an employee; confirm the new banner names what
   happened and that `Ponów` completes the account
2. Confirm a genuine network failure still shows the original network banner
3. Add an employee, click the invite link, set no password; confirm the roster shows ZAPROSZONY
4. Re-add that address; confirm an activation mail arrives and the label stays ZAPROSZONY
5. Set a password through the link; confirm the roster flips to AKTYWNY
6. **Bug 2's sequence**: open an invite link, close the tab, reopen the link — the form must render
7. From step 6's first open, navigate to `/dashboard` before setting a password — must redirect to
   sign-in (`research.md` §5.1's defect, closed)
8. Sign in as a colleague, open an invite link — R11 must appear; sign out, reopen — form renders
9. Walk a recovery link end to end from `/auth/forgot-password`

**Throwaway accounts only.** Never complete a reset or invite on `employee@fleetrent.test` or
`admin@fleetrent.test` — it rotates the password `e2e/auth.setup.ts` and the integration suite sign
in with. Mint links for a throwaway address via `generateLink`, which also dodges the hosted
2-emails/hour cap.

## Performance Considerations

Phase 4's token-lookup RPC adds one query to the callback GET, on a hash-indexed column
(`one_time_tokens_token_hash_hash_idx`) at single-tenant scale. `list_staff`'s extra column adds no
join. `mark_password_set()` adds one write per password set. None of these are on a hot path.

The role predicate in any new `SECURITY DEFINER` function must be wrapped as a scalar subquery —
`(select public.current_app_role())` — so it is evaluated once per statement rather than once per
row (`lessons.md` → "Wrap auth calls and role helpers in (select …)"; the pattern is stated at
`20260723194602:34-35`).

## Migration Notes

- Apply with `npx supabase migration up`, **never** `db reset` — four worktrees share one Docker
  stack (`project_id = "10x-astro-starter"`), and a reset reapplies only this worktree's migrations,
  dropping the siblings'. `config.toml` changes need `supabase stop && supabase start`.
- Phase 2's backfill is behaviour-neutral by construction: sourcing `password_set_at` from
  `last_sign_in_at` reproduces today's `wasActive`/`deriveStatus` outcome for every existing row, so
  no live account changes label and nobody is mailed on deploy.
- Both migrations are additive and reversible: dropping the column and the functions restores the
  prior behaviour, provided `list_staff` is recreated with its revoke **and** grant re-stated.
- Prod rollout inherits the S-08 chain — migration, service-role secret, SMTP, Site URL / redirect
  allow-list, and `token_hash` templates. Phase group B changes what the callback does with a
  `token_hash` link but not the template's shape, so the templates need no re-authoring.

## References

- Change brief: `context/changes/invite-journey-fixes/change.md`
- Research: `context/changes/invite-journey-fixes/research.md` (§1.4 option field, §1.5 latent
  defects, §2.3 state table, §4 test reachability, §5.3–5.4 deletion inventory)
- Design contract: `context/changes/invite-journey-fixes/design-contract.md`
- Inherited contract: `context/archive/2026-08-11-auth-surface-hardening/design-contract.md` (§7
  shared elements, §9 Polish copy, §10 entry 14)
- Grant-recreation regression: `supabase/migrations/20260731212650_list_pending_reservations_revoke_anon.sql:1-20`
- OUT-column recreation precedent: `supabase/migrations/20260728120000_list_pending_reservations_add_plate.sql:1-14`
- Two-systems house pattern: `src/lib/services/email-delivery.ts:57-77`,
  `src/pages/api/return-protocols/[id]/pdf.ts:18-21`
- Partial-double precedent: `tests/helpers/context.ts:119-139`, `src/lib/auth-session.test.ts:27-37`
- Invite fixture / `generateLink` prototype: `e2e/fixtures/staff.ts:107-138`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not
> rename step titles. See `references/progress-format.md`.

### Phase 1: Legibility + compensating rollback

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 4552fad
- [x] 1.2 Type checking passes: `npx astro check` — 4552fad
- [x] 1.3 Unit tests pass: `npm test` — 4552fad
- [x] 1.4 Integration tests pass: `npm run test:integration` — 4552fad
- [x] 1.5 New failure-path tests assert no orphaned `auth.users` row survives a rolled-back invite — 4552fad
- [x] 1.6 Existing provisioning coverage still green (`staff.test.ts:49,:72,:82,:117,:146`) — 4552fad
- [x] 1.7 Production build succeeds: `npm run build` — 4552fad

#### Manual

- [x] 1.8 Forced insert failure surfaces the new banner, not the network banner — 4552fad
- [x] 1.9 `Ponów` completes the account and the person appears on the roster — 4552fad
- [x] 1.10 Banner copy matches `design-contract.md` §9 verbatim — 4552fad
- [x] 1.11 Roster renders unchanged against `19-admin-desktop-employees.png` / `25-admin-mobile-employees.jpg` — 4552fad
- [x] 1.12 A genuine network failure still shows the original network banner — 4552fad

### Phase 2: Password-set signal — data layer

#### Automated

- [x] 2.1 Migration applies cleanly: `npx supabase migration up` — cff25da
- [x] 2.2 Generated types in sync: `npx supabase gen types typescript --local` leaves no diff — cff25da
- [x] 2.3 Type checking passes: `npx astro check` — cff25da
- [x] 2.4 Lint passes: `npm run lint` — cff25da
- [x] 2.5 Integration tests pass: `npm run test:integration` — cff25da
- [x] 2.6 `rpc-execute-grants.test.ts` proves anon refused on `list_staff`, `deactivate_staff`, `mark_password_set` — cff25da
- [x] 2.7 Backfill is behaviour-neutral — every seeded account's roster status unchanged — cff25da
- [x] 2.8 `contract-surfaces.md` updated for the schema, RPC, and `CreateEmployeeResult` changes — cff25da

#### Manual

- [x] 2.9 Roster renders identically to before the migration — cff25da
- [x] 2.10 `mark_password_set()` from a non-admin employee stamps only their own row — cff25da

### Phase 3: Wire the signal

#### Automated

- [x] 3.1 Unit tests pass, including new `staff-status.test.ts`: `npm test` — fe7edec
- [x] 3.2 Integration tests pass: `npm run test:integration` — fe7edec
- [x] 3.3 §1.5(a) regression test asserts INVITED + mail sent for a clicked-but-never-set hire — fe7edec
- [x] 3.4 Orphan-shape repair test (`profile === null`) passes — fe7edec
- [x] 3.5 A repair with a failed activation mail returns 200 carrying the mail outcome — fe7edec
- [x] 3.6 Type checking passes: `npx astro check` — fe7edec
- [x] 3.7 Lint passes: `npm run lint` — fe7edec
- [x] 3.8 Production build succeeds: `npm run build` — fe7edec

#### Manual

- [x] 3.9 Setting a password via `/auth/reset-password` stamps the signal; roster flips to AKTYWNY — fe7edec
- [x] 3.10 Changing a password via `/dashboard/account/password` stamps it, caller stays signed in — fe7edec
- [x] 3.11 A hire who clicks but sets no password stays ZAPROSZONY — fe7edec
- [x] 3.12 Re-adding that hire sends an activation mail — fe7edec
- [x] 3.13 Failed-mail repair shows `repairedMailFailed` (error tone, no retry); row still lands, modal still closes — fe7edec
- [x] 3.14 That banner's copy matches `design-contract.md` §9 verbatim — fe7edec

### Phase 4: Deferred exchange — the callback

#### Automated

- [x] 4.1 Migration applies cleanly: `npx supabase migration up` — b3afb07
- [x] 4.2 Generated types in sync: `npx supabase gen types typescript --local` leaves no diff — b3afb07
- [x] 4.3 New unit tests for cookie payload and branch selection pass: `npm test` — b3afb07
- [x] 4.4 `rpc-execute-grants.test.ts` covers the token-lookup RPC in its public block (anon CAN call it) — b3afb07
- [x] 4.5 RPC fails closed on §1's three clauses — wrong `type` → no row, expired → no row, deactivated → null role — b3afb07
- [x] 4.6 Type checking passes: `npx astro check` — b3afb07
- [x] 4.7 Lint passes: `npm run lint` — b3afb07
- [x] 4.8 Integration tests pass: `npm run test:integration` — b3afb07
- [x] 4.9 `contract-surfaces.md` + `known-issues.md` updated (PKCE row, token-lookup RPC, GoTrue coupling) — b3afb07

#### Manual

- [x] 4.10 Opening an invite link creates no session — `/dashboard` still redirects to sign-in — b3afb07
- [x] 4.11 Opening the same link twice renders the form both times — b3afb07
- [x] 4.12 A deactivated staffer's link still gets "Konto jest nieaktywne" before the form — b3afb07
- [x] 4.13 An invalid/expired token lands on the expired screen, never a 500 — b3afb07
- [x] 4.14 A recovery link with `&type=invite` renders recovery copy, never `Witaj we Flocie` — b3afb07

### Phase 5: Submit-time exchange

#### Automated

- [x] 5.1 Integration tests pass: `npm run test:integration` — 048d947
- [x] 5.2 Unit tests pass: `npm test` — 048d947
- [x] 5.3 Type checking passes: `npx astro check` — 048d947
- [x] 5.4 Lint passes: `npm run lint` — 048d947
- [x] 5.5 Production build succeeds: `npm run build` — 048d947
- [x] 5.6 Retryability: token survives a password mismatch and a rejected password — 048d947

#### Manual

- [x] 5.7 Bug 2's sequence — open link, close tab, reopen → form renders — 048d947
- [x] 5.8 Setting a password shows R4 and signs the user out globally — 048d947
- [x] 5.9 Reopening the link after a successful set lands on "Link wygasł" — 048d947
- [x] 5.10 Shared-workstation colleague still gets R11; sign out then reopen works — 048d947
- [x] 5.11 Invite copy renders for invite links, recovery copy for recovery links — 048d947
- [x] 5.12 The account box names the address whose password is changing, with the hire's initials — 048d947
- [x] 5.13 R13/R12 partition holds — signed-out typing the URL → R13, signed-in → R12 — 048d947

### Phase 6: Deletion sweep

#### Automated

- [x] 6.1 `grep -rn "readSessionOrigin\|readAmr\|decodeBase64Url\|SessionOrigin" src tests e2e` returns nothing — 233ad5e
- [x] 6.2 `grep -rn "shouldSecureCookies" src` still returns the four keep-list call sites — 233ad5e
- [x] 6.3 Unit tests pass: `npm test` — 233ad5e
- [x] 6.4 Integration tests pass: `npm run test:integration` — 233ad5e
- [x] 6.5 Retargeted GoTrue type-confusion probe passes against the POST — 233ad5e
- [x] 6.6 Type checking passes: `npx astro check` — 233ad5e
- [x] 6.7 Lint passes: `npm run lint` — 233ad5e
- [x] 6.8 Production build succeeds: `npm run build` — 233ad5e
- [x] 6.9 E2E suite passes on `:4321`: `npm run test:e2e` — 233ad5e

#### Manual

- [x] 6.10 Full invited-hire journey works end to end — 233ad5e
- [x] 6.11 Recovery journey works end to end — 233ad5e
- [x] 6.12 Signing out clears the pending-token cookie — 233ad5e
- [x] 6.13 No auth screen renders differently from before phase group B — 233ad5e

### Phase 7: One-step framing for the provisioning failure

#### Automated

- [x] 7.1 Unit tests pass, including new `staff-banner.test.ts`: `npm test` — c14c745
- [x] 7.2 Both provisioning codes provably render the same sentence — c14c745
- [x] 7.3 Lint passes: `npm run lint` — c14c745
- [x] 7.4 Type checking passes: `npx astro check` — c14c745
- [x] 7.5 Integration tests pass — the API still returns both codes: `npm run test:integration` — c14c745
- [x] 7.6 Production build succeeds: `npm run build` — c14c745

#### Manual

- [x] 7.7 Both failure arms show one message naming the address — c14c745
- [x] 7.8 `repairedMailFailed` names the address and still carries no `Ponów` — address clause DROPPED (owner, 2026-08-21): design-contract §9.2 makes this a phase-8 string and carries no address form of it; only the no-`Ponów` half was verifiable, and it holds — c14c745
- [x] 7.9 Copy matches `design-contract.md` §9 verbatim — c14c745
- [x] 7.10 A long address wraps without breaking the banner row at 390px — c14c745

### Phase 8: Two-step add — create, then invite

#### Automated

- [x] 8.1 Unit tests pass, including the three-state derivation: `npm test` — 6954cfa
- [x] 8.2 Integration proves zero mail on create and exactly one on invite — 6954cfa
- [x] 8.3 Integration proves `inviteUserByEmail` succeeds for an already-created user — 6954cfa
- [x] 8.3a Integration proves `inviteEmployee` refuses a target that already has a password — 6954cfa
- [x] 8.4 Integration tests pass: `npm run test:integration` — 6954cfa
- [x] 8.5 Type checking passes: `npx astro check` — 6954cfa
- [x] 8.6 Lint passes: `npm run lint` — 6954cfa
- [x] 8.7 Production build succeeds: `npm run build` — 6954cfa
- [x] 8.8 E2E suite passes on `:4321`: `npm run test:e2e` — 6954cfa
- [x] 8.9 `contract-surfaces.md` records the invite route and the widened status union — 6954cfa

#### Manual

- [x] 8.10 Adding a person creates a roster row immediately and sends nothing — 6954cfa
- [x] 8.11 `Wyślij zaproszenie` sends the invite; the badge moves to ZAPROSZONY — 6954cfa
- [x] 8.11a A resend to an already-invited hire works, and the previous link stops working — 6954cfa
- [x] 8.11b A hire who already has a password is offered no invite action — 6954cfa
- [x] 8.11c A password-less row offers no `Resetuj hasło`; `repairedMailFailed` names the action it does show — 6954cfa
- [x] 8.11d The divergence from catalog 19's invited-row actions is recorded as a deviation, not silently shipped — 6954cfa
- [x] 8.12 The emailed link still lands on the invite form with the hire's initials — 6954cfa
- [x] 8.13 A failed create shows phase 7's banner and leaves no mail in Mailpit — 6954cfa
- [x] 8.14 The new badge and row action match `design-contract.md` verbatim at both breakpoints — 6954cfa

### Phase 9: Report the add failure where the admin is — inside the modal

#### Automated

- [x] 9.1 Unit tests pass, including the outcome→target table: `npm test`
- [x] 9.2 No arm resolves to a banner-only report while the modal stays open
- [x] 9.3 Lint passes: `npm run lint`
- [x] 9.4 Type checking passes: `npx astro check`
- [x] 9.5 Integration tests pass: `npm run test:integration`
- [x] 9.6 Production build succeeds: `npm run build`
- [x] 9.7 E2E asserts the error is topmost at its own centre, not merely present in the DOM
- [x] 9.8 E2E suite passes on `:4321`: `npm run test:e2e`
- [x] 9.9 `design-contract.md` carries the form-level error entry, its copy, and a §11 diff row

#### Manual

- [x] 9.10 A forced provisioning failure reports inside the modal, values intact
- [x] 9.11 A dropped connection reports inside the modal — the phase-9 defect, closed
- [x] 9.12 Exactly one retry control is on screen for one failure
- [x] 9.13 A 409 duplicate still reports inline under the email field, unchanged
- [x] 9.14 `repairedMailFailed` still closes the modal and reports as a banner
- [x] 9.15 The error state matches `design-contract.md` verbatim at 1280px and 390px

### Phase 10: The roster banner is unreachable from the row that triggers it

#### Automated

- [ ] 10.1 Unit tests pass, including the widened outcome-to-surface table: `npm test`
- [ ] 10.2 No arm resolves to a surface unreachable from the control that triggered it
- [ ] 10.3 Lint passes: `npm run lint`
- [ ] 10.4 Type checking passes: `npx astro check`
- [ ] 10.5 Integration tests pass: `npm run test:integration`
- [ ] 10.6 Production build succeeds: `npm run build`
- [ ] 10.7 E2E asserts in-viewport AND topmost-at-its-own-centre, on a failure and on a success
- [ ] 10.8 E2E suite passes on `:4321`: `npm run test:e2e`
- [ ] 10.9 `design-contract.md` carries the remove-modal entry, the chosen row-action surface, its copy, and §11 rows
- [ ] 10.10 The §1 shape and module-name decisions are recorded, not taken silently
- [ ] 10.11 The §5 body-scroll-lock decision is recorded as in-scope or follow-up

#### Manual

- [ ] 10.12 A failed remove reports inside the remove modal, with the typed confirmation intact
- [ ] 10.13 The remove modal's 200 and 409 (last-admin) arms are unchanged
- [ ] 10.14 A failed invite or reset from a scrolled row is readable without scrolling
- [ ] 10.15 `Wysłano zaproszenie.` after a resend from a scrolled row is readable without scrolling
- [ ] 10.16 Exactly one retry control is on screen for one failure
- [ ] 10.17 The remove modal's error state matches `design-contract.md` verbatim at 1280px and 390px
