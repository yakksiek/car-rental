# S-14 Review Follow-ups Implementation Plan

## Overview

Five findings queued from the S-14 full-plan implementation review (2026-08-17). One is a
user-visible dead-end (a deactivated staffer reaching a bare `Forbidden`); the rest are a
provenance tightening and three hygiene items. No new feature, no schema change, no new
route.

The phases are independent and each ends with the app coherent, so they can be run in any
order or stopped after any one. Phase 1 is the only one with user-facing copy.

## Current State Analysis

Every finding below was verified against the code during the review, with line numbers.
Full evidence: `context/changes/auth-surface-hardening/reviews/impl-review.md`.

| ID  | Severity    | Location                                    | Gap                                                     |
| --- | ----------- | ------------------------------------------- | ------------------------------------------------------- |
| F1  | WARNING     | `src/pages/auth/reset-password.astro:74-91` | Page omits the route's role gate → bare `Forbidden`     |
| F3  | OBSERVATION | `src/pages/auth/callback.ts:43`             | Unvalidated `?flow` decides the marker's value          |
| F5  | OBSERVATION | `src/pages/api/auth/signin.ts:8-10`         | Unguarded `formData()`; `as string` casts can be `null` |
| F6  | OBSERVATION | 5 new `.astro` files                        | Missing `// core` / `// components` / `// others`       |
| F7  | OBSERVATION | `tests/helpers/context.ts:78-99`            | Cookie double drops its options argument                |

### Key Discoveries

- **F1's reachable path is a deactivated staffer, not the new-hire race.**
  `src/pages/api/auth/forgot-password.ts` sends a reset link to any valid address — it must,
  since it deliberately never reveals whether an account exists — and GoTrue knows nothing
  about `profiles.deactivated_at`. So the link is real, the session is real, the page renders
  the full form, and only the POST refuses. The new-hire case (`services/staff.ts:191-205`
  invites first, inserts the `profiles` row second) is a narrower second path to the same
  screen.
- **`?flow` is redundant on the real invite link.** `supabase/templates/invite.html` carries
  **both** `type=invite` and `flow=invite`; `recovery.html` carries only `type=recovery`.
  So dropping the `flow` clause changes nothing for a genuine link.
- **`type` is the parameter GoTrue actually validates.** `verifyOtp({ token_hash, type })`
  resolves the token by hash _and_ type, so a recovery token presented as `type=invite`
  should be rejected by the exchange itself — which is what makes `type` trustworthy where
  `flow` is not. **This must be probed, not assumed** (`lessons.md` §"A typed, accepted API
  parameter is not evidence that it is enforced"); Phase 2 does exactly that before relying
  on it.
- **The PKCE `?code=` fallback has no type at all.** `exchangeCodeForSession(code)` returns
  no link-kind information, and the custom templates never use that branch. It must default
  to `recovery` — the conservative choice, since mislabelling a recovery as an invite is the
  cosmetic defect F3 is about.
- **There is no harness that renders an `.astro` page under Vitest.**
  `tests/integration/pages-authz.test.ts` drives `src/middleware.ts` with a synthetic
  context; it never renders a page. So F1's branch is covered by e2e or not at all.
- **`AccountBox`, `StatusHead` and `AuthPrimaryLink` already exist** and are exactly the
  idiom F1's new card needs — no new component.

## Desired End State

`/auth/reset-password` explains every one of the route's five refusals on-screen, so no
staff member meets a bare `Forbidden` **on this surface**. The marker cookie's value derives
only from a parameter the exchange validated. `signin.ts` handles a malformed body like its
three siblings. New `.astro` files carry the project's import headers, and the cookie test
double can observe attributes.

Middleware's own 403 (`middleware.ts:57-59`) is untouched and still reachable: a deactivated
staffer meets it on any `/dashboard` route, including immediately after a successful sign-in,
since `signin.ts` never checks role. Different surface, its own fix — see "What We're NOT
Doing".

Verified by: a new e2e spec for the deactivated case; a probe proving GoTrue rejects a
type-mismatched token; the full existing suite staying green.

## What We're NOT Doing

- **Not** changing the route's 403. Hard security rejections keep answering with a status —
  the page mirrors them, it does not replace them (S-14's stated idiom).
- **Not** giving middleware's own 403 a screen. A deactivated staffer who signs in normally
  still lands on a bare `Forbidden` at `/dashboard` — that is every gated route
  (`middleware.ts:57-59`), not this page, and needs its own slice.
- **Not** filtering deactivated accounts in `forgot-password.ts`. It would leak account
  state, which that route deliberately avoids.
- **Not** acting on F10 (global-scope `signOut`). It needs a product decision first; see
  `change.md`.
- **Not** retrofitting import headers onto the seven pre-existing auth files that lack them.
  Only the five this slice introduced. The rest is its own cleanup.
- **Not** adding an integration-level page-render harness. Out of proportion for one branch.

## Phase 1: Role-gate parity on the set-password page (F1)

### Overview

Give the fifth refusal its screen, so the page keeps the promise its own comment makes.

### Changes Required:

#### 1. Role branch on the page

**File**: `src/pages/auth/reset-password.astro`

**Intent**: Mirror gate (c) of `src/pages/api/auth/reset-password.ts`, which the page
currently skips.

**Contract**: Insert **one** branch immediately after the existing `!user` branch, so the
order becomes: done cookie → `!user` → **role insufficient** → `origin !== "link"` →
`!mode` → form. Use `requireRole(Astro.locals, "employee")` from `src/lib/access.ts` — the
same call `reset-password.ts:75` makes, so the page's branch and the gate it mirrors read
identically. (`requireRole` takes `App.Locals`, and `Astro.locals` in a `.astro` file _is_
`App.Locals`; its own doc comment names it the in-handler guard for "pages/API routes".)

**Placement — before the origin check, not after.** A role-sufficient staffer passes this
branch either way, so the ordering decides nothing for them. What it decides is the
deactivated staffer holding an ordinary **password** session: placed after the origin check
they would still get R12, whose CTA is `/dashboard/account/password` — a `/dashboard` path,
so `middleware.ts:57-59` answers them a bare `Forbidden`. That is the exact defect this
phase removes, relocated one click downstream. Placed here, both deactivated paths — password
session and link session — reach this card, and a deactivated staffer never sees "Link
wygasł" either.

#### 2. The refusal card

**File**: `src/pages/auth/reset-password.astro` (inline, matching how the other states are authored)

**Intent**: Tell a deactivated staffer what happened, explicitly (owner decision,
`change.md`).

**Contract**: `StatusHead tone="ink" icon="user"`, then the title/subtitle/CTA idiom the
other four states use (`text-[28px] leading-[1.05] font-bold tracking-[-0.8px]` title,
`text-muted-foreground mt-2 text-sm leading-[1.45]` subtitle, `AuthPrimaryLink`), plus
`AuthBackLink`. Copy:

- title: `Konto jest nieaktywne`
- subtitle: `To konto zostało dezaktywowane, więc nie można ustawić dla niego hasła. Skontaktuj się z administratorem, jeśli to pomyłka.`
- CTA: `Wróć do logowania` → `/auth/signin`

Use the typographic apostrophe/quote conventions already in this file; no ASCII
substitutes.

The copy asserts deactivation, which is exact for the reachable path. The new-hire race
(Key Discoveries) lands on the same branch with `role = null` and would read it as false —
but that window is two sequential awaits wide (`services/staff.ts:191-205`), narrower than
an email round-trip, so it is accepted knowingly rather than genericising the copy for a
case a click cannot fit inside.

#### 3. Register the new state in the design contract

**File**: `context/changes/auth-surface-hardening/design-contract.md`

**Intent**: This is a user-facing surface with no artboard, so it needs a recorded
deviation rather than silently inventing values — the project's design rule.

**Contract**: Add a `deviation(no artboard — refusal state discovered in impl-review)` entry
naming the tone/icon choice and the three copy strings, cross-referencing this plan. Values
are inherited-exact from §7.1/§7.3, so only the _state_ is new, not any dimension.

#### 4. E2E cover

**Files**: `e2e/fixtures/staff.ts`, `e2e/auth-hardening.spec.ts`

**Intent**: There is no way to assert this at the integration layer (see Key Discoveries),
and it is exactly the "screen instead of a raw status" property e2e already covers for R11.

**Contract (fixture)**: `e2e/fixtures/staff.ts` exports no way to deactivate, and its
service-role `admin()` client is module-private on purpose (file header: accounts are
provisioned through it, never by driving the UI). Add one export alongside
`createActiveEmployee` — `deactivateStaffUser(id)`, writing `profiles.deactivated_at`
through that same private client. Not the `deactivate_staff` RPC: it carries self /
last-admin guards a fixture has no reason to satisfy.

**Contract (spec)**: Create an active employee, call `deactivateStaffUser(id)`, mint a
recovery link via the existing `recoveryCallbackLink` fixture, open it **signed-out**, and
assert the page shows `Konto jest nieaktywne` — **not** the password form and not a bare
`Forbidden`. "Signed-out" means a fresh anonymous context,
`browser.newContext({ storageState: { cookies: [], origins: [] } })` — the pattern already
at `auth-hardening.spec.ts:86-87` and `:108-110`. A file-level `test.use` would break the
four existing tests in that file, which need the chromium project's default `employee`
storage state. Unique timestamped fixture email, cleanup in `afterEach`, no
`waitForTimeout`, `waitForIslands` before interacting. Runs on **:4321** (the emailed-link
port constraint applies to any spec touching `/auth/callback`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`
- Full e2e suite passes on port 4321: `npm run test:e2e`

#### Manual Verification:

- A deactivated staffer opening a live recovery link sees `Konto jest nieaktywne`, not the form
- An ordinary signed-in staffer still sees R12 `Zmień hasło w ustawieniach` (the new branch
  did not shadow it)
- A normal recovery link for an active employee still reaches the form and sets a password

---

## Phase 2: Marker value from the validated `type`, not `?flow` (F3)

### Overview

Make the marker's value as trustworthy as its presence.

### Changes Required:

#### 1. Probe the assumption first — as a committed test

**File**: `tests/integration/auth-callback.test.ts` (new)

**Intent**: `lessons.md` §"A typed, accepted API parameter is not evidence that it is
enforced" — do not build on "GoTrue validates `type`" without proving it. Committed rather
than run from a scratch script, because the whole phase rests on this one property: a
throwaway proves it today and pins nothing against a future GoTrue version, and criterion
2.1 has to stay re-runnable.

**Contract**: Mint a **recovery** token with `serviceClient().auth.admin.generateLink`, then
call `anonClient().auth.verifyOtp({ token_hash, type: "invite" })` and assert it **errors**.
Both hops already exist in `tests/helpers/link-session.ts:57-70` — this is that sequence with
a deliberately mismatched `type`, ~10 lines. If the exchange is _accepted_, this phase's
premise is wrong: stop, fall back to softening the comment in `reset-password.astro` instead
(the alternative the review named), and Phase 2's remaining steps do not apply.

#### 2. Drop the `flow` clause

**File**: `src/pages/auth/callback.ts`

**Intent**: `?flow` is attacker-settable and validated by nothing; `type` is resolved
against the token by the exchange.

**Contract**: `const invite = type === "invite" || type === "signup";` — remove the
`url.searchParams.get("flow") === "invite"` clause. The `?flow=invite` param stays on the
invite template's link (harmless, and changing the template is a prod-rollout concern);
nothing reads it any more. In the PKCE `?code=` branch there is no `type`, so `invite`
stays `false` → the marker is stamped `recovery`, the conservative default. Add a comment
recording the probe result from step 1.

#### 3. Correct the overstated comment

**File**: `src/pages/auth/reset-password.astro`

**Intent**: The comment claims more than the code delivers.

**Contract**: State that the marker's presence is unforgeable-by-URL and its value now
derives from the `type` the exchange validated.

### Success Criteria:

#### Automated Verification:

- The probe test in step 1 shows a type-mismatched `verifyOtp` is REJECTED
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Integration tests pass: `npm run test:integration`
- Full e2e suite passes on port 4321: `npm run test:e2e` (both invite and recovery paths)

#### Manual Verification:

- A real invite link still shows `Witaj we Flocie` and the invite subtitle
- A real recovery link still shows the recovery copy
- Appending `&flow=invite` to a recovery link no longer flips it to the invite screen

---

## Phase 3: Hygiene — body guard, import headers, cookie double (F5, F6, F7)

### Overview

Three independent, mechanical edits. No behaviour change except F5's error path.

### Changes Required:

#### 1. Guard the sign-in body (F5)

**File**: `src/pages/api/auth/signin.ts`

**Intent**: It is the only auth handler that can 500 on a malformed body, and its
`as string` casts are false — `form.get` returns `null` for an absent field.

**Contract**: Guard `await context.request.formData()` with try/catch, and replace both
`as string` casts with `?? ""`.

`back(...)` cannot be called from that catch: it is defined below the parse
(`signin.ts:19-20`) and closes over `target`, which is itself read out of the form
(`signin.ts:15-16`). `reset-password.ts:96-101` escapes this only because its `fail()` takes
what it needs as arguments. So the catch redirects directly, on the default target:

```ts
let form: FormData;
try {
  form = await context.request.formData();
} catch {
  const target = encodeURIComponent(safeRedirectPath(null));
  return context.redirect(`/auth/signin?error=generic&redirect=${target}`);
}
```

`generic` is already in the signin table in `auth-messages.ts`, so the page renders "Nie
udało się zalogować. Spróbuj ponownie." — no new copy.

#### 2. Import-order headers (F6)

**Files**: `src/pages/auth/link-conflict.astro`,
`src/components/auth/{StatusHead,AccountBox,AuthBackLink,AuthPrimaryLink}.astro`

**Intent**: CLAUDE.md mandates the headers; `src/pages/dashboard/account/password.astro`
one directory over is the conforming counter-example.

**Contract**: Add `// core` / `// components` / `// others` groups per CLAUDE.md. Only
these five files.

#### 3. Cookie double keeps its options (F7)

**File**: `tests/helpers/context.ts`

**Intent**: `path` is called "load-bearing" in `auth-session.ts` and `secure` has a whole
module, yet neither can be asserted at the integration layer today.

**Contract**: Leave the value jar exactly as it is — live cookies only, so `delete` really
removes the key and `get` / `has` answer as they do today. Record the third argument in a
**second** map, reachable through a typed export:

```ts
import type { AstroCookieSetOptions } from "astro"; // public export

const COOKIE_OPTIONS = new WeakMap<object, Map<string, AstroCookieSetOptions>>();
// in buildCookies: `const options = new Map()`, written by BOTH `set` and `delete`,
// registered via COOKIE_OPTIONS.set(api, options) before the double is returned.

/** The options a handler passed to `cookies.set` / `cookies.delete` for `name`. */
export function cookieOptions(context: APIContext, name: string): AstroCookieSetOptions | undefined {
  return COOKIE_OPTIONS.get(context.cookies)?.get(name);
}
```

The second map is not decoration — a `{ value, options }` jar entry breaks two things:

- **`reset-password.test.ts:154`** asserts `get(LINK_ORIGIN_COOKIE)` is `undefined` after a
  successful POST spends the marker. An entry recording a _delete_'s options leaves the key
  present and turns that red. With the value jar untouched, all four existing cookie
  assertions (154, 155, 238, 249) keep passing — which is what "no existing test changes"
  requires.
- **Type-checking.** `buildApiContext` returns `... as unknown as APIContext`
  (`context.ts:141`), so a test sees Astro's `AstroCookies`, whose `get()` yields
  `{ value, json(), number(), boolean() }` — there is no `options` on that type.
  `tsconfig.json` includes `**/*` and ESLint runs `projectService: true`, so
  `get(X)?.options` fails criteria **3.1 and 3.2**, not just the assertion. Going through
  the exported function needs no cast.

Then add one assertion to `tests/integration/reset-password.test.ts` —
`expect(cookieOptions(context, LINK_ORIGIN_COOKIE)?.path).toBe("/")` — pinning the property
whose breakage would silently disable the gate's freshness half.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration` (including the new `path` assertion)
- Production build succeeds: `npm run build`

#### Manual Verification:

- Submitting the sign-in form with a wrong password still shows correct Polish copy (the
  guard did not change the normal path)

---

## Testing Strategy

### Unit Tests

None required — no new pure function. F7 makes a future unit-level cookie assertion
possible but does not add one.

### Integration Tests

- One new file, `tests/integration/auth-callback.test.ts`: a recovery token presented as
  `type=invite` is rejected by `verifyOtp` — the property Phase 2 rests on.
- One new assertion in `tests/integration/reset-password.test.ts`: the marker cookie is
  written with `path: "/"` (enabled by F7's `cookieOptions`).

### E2E Tests

- One new fixture export in `e2e/fixtures/staff.ts`: `deactivateStaffUser(id)`.
- One new spec in `e2e/auth-hardening.spec.ts`: a deactivated staffer on a live recovery
  link sees the refusal card, not the form and not a bare `Forbidden`.
- Existing invite/recovery specs must stay green — they are the real gate for Phase 2.

### Manual Testing Steps

1. `npm run dev` on **4321**
2. Deactivate a throwaway employee, mint a recovery link, confirm the new card
3. Confirm an active employee's recovery link still reaches the form
4. Append `&flow=invite` to a recovery link and confirm it no longer flips the screen

## Performance Considerations

None. Phase 1 adds one in-memory role comparison to a page that already reads `locals`.
Phase 2 removes a query-string read.

## Migration Notes

No schema change, no data migration, no config change. Nothing in this slice affects the
S-08 production rollout chain.

## References

- Review report: `context/changes/auth-surface-hardening/reviews/impl-review.md`
- Queued findings: `context/changes/auth-surface-hardening/follow-ups/review-fixes.md`
- Parent slice: `context/changes/auth-surface-hardening/plan.md`
- Design contract (inherited): `context/changes/auth-surface-hardening/design-contract.md`
- Governing lesson for Phase 2's probe: `context/foundation/lessons.md` §"A typed, accepted
  API parameter is not evidence that it is enforced"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Role-gate parity on the set-password page (F1)

#### Automated

- [x] 1.1 Type checking passes: `npx astro check`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Unit tests pass: `npm test`
- [x] 1.4 Integration tests pass: `npm run test:integration`
- [x] 1.5 Full e2e suite passes on port 4321

#### Manual

- [x] 1.6 A deactivated staffer on a live recovery link sees `Konto jest nieaktywne`
- [x] 1.7 An ordinary signed-in staffer still sees R12 — the new branch did not shadow it
- [x] 1.8 A normal recovery link still reaches the form and sets a password

### Phase 2: Marker value from the validated `type`, not `?flow` (F3)

#### Automated

- [ ] 2.1 Probe test shows a type-mismatched `verifyOtp` is REJECTED
- [ ] 2.2 Type checking passes: `npx astro check`
- [ ] 2.3 Linting passes: `npm run lint`
- [ ] 2.4 Integration tests pass: `npm run test:integration`
- [ ] 2.5 Full e2e suite passes on port 4321

#### Manual

- [ ] 2.6 A real invite link still shows `Witaj we Flocie` and the invite subtitle
- [ ] 2.7 A real recovery link still shows the recovery copy
- [ ] 2.8 `&flow=invite` on a recovery link no longer flips it to the invite screen

### Phase 3: Hygiene — body guard, import headers, cookie double (F5, F6, F7)

#### Automated

- [ ] 3.1 Type checking passes: `npx astro check`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Unit tests pass: `npm test`
- [ ] 3.4 Integration tests pass, including the new `path: "/"` assertion
- [ ] 3.5 Production build succeeds: `npm run build`

#### Manual

- [ ] 3.6 A wrong sign-in password still shows correct Polish copy
