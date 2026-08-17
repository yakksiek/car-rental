# Auth Surface Hardening (S-14) Implementation Plan

## Overview

`/api/auth/reset-password` currently sets a password for **any** authenticated session. Its guard
checks only that a session exists — nothing asserts the session came from a recovery or invite link.
This plan makes session **origin** a hard, provable precondition for setting a password, revokes
every session on the way out, gives the three refusal cases real designed screens instead of a false
"link expired" message, and stops all auth surfaces rendering text the app did not author.

## Current State Analysis

Two routes set a password, built to different standards by different slices:

|                        | `/api/auth/change-password` (S-11)       | `/api/auth/reset-password` (S-08)    |
| ---------------------- | ---------------------------------------- | ------------------------------------ |
| CSRF                   | ✅ `:41-44` → 403                        | ✅ `:21-24` → 302                    |
| Auth                   | ✅ `:48-51` → 401                        | ⚠️ `:31` — presence of _any_ session |
| Role                   | ✅ `:54-56` → 403                        | ❌ none                              |
| Proof of identity      | ✅ `signInWithPassword` reauth `:81-90`  | ❌ none                              |
| Revokes other sessions | ✅ `:105` `signOut({ scope: "others" })` | ❌ none                              |

**F1 is confirmed exploitable on HEAD**, reproduced twice (2026-08-10, re-verified during research):
ordinary password sign-in → one POST to `/api/auth/reset-password` → `302 …?done=1`, old password
dead, new password live, no recovery link at any point.

The structural cause: **exactly two things survive the `callback.ts:51` redirect** — the Supabase auth
cookies and the `?mode=invite` query string. `context.locals` is rebuilt from cookies by middleware.
`callback.ts` stamps no marker of any kind, so at `/auth/reset-password` there is no state a gate
could read. That is the entire state budget, and it is why the guard at `reset-password.ts:31` cannot
do what its own comment claims.

Four further defects on the same flow, none previously tracked:

- **R1** — a password reset revokes nothing. The self-service "I've been compromised" flow leaves
  every other session alive. `change-password.ts:98-104` fixed this on the sibling route and its
  comment explains exactly why it matters.
- **R2** — `/api/auth/reset-password` has no role check, so a `role = null` bearer reaches a working
  password-set endpoint every other authenticated route refuses them.
- **R3** — `/auth/callback` is an unauthenticated GET-only session _installer_ with no "am I already
  signed in?" branch. Astro exempts safe methods from its origin check, so a crafted top-level
  navigation silently switches a victim's browser onto the attacker's account.
- **F6** — `?error=` is reflected verbatim into `ServerError`'s styled alert on three surfaces. Not
  XSS (both escaping hops verified) but a ready-made phishing lure on a legitimate authenticated URL.
  It also passes GoTrue's raw English (`same_password`, 422) into an all-Polish UI.

**No existing test would fail if the gate were removed entirely** — no test file imports
`/api/auth/reset-password`; the only coverage is two e2e happy paths that arrive with a legitimate
link session, so accepting an additional session type is strictly widening.

### Key Discoveries

- **GoTrue does give us a discriminator**: `amr[].method` is `"password"` for `signInWithPassword`
  and `"otp"` for both `verifyOtp` link exchanges, and it survives a token refresh verbatim
  (probe-verified against GoTrue v2.188.1). `amr` is defined by RFC 8176; `otp` means "proof of
  possession of a one-time code" — which the emailed `token_hash` is.
- **A bare marker cookie is user-forgeable.** Any signed-in staffer can add a cookie via devtools;
  `HttpOnly` blocks JS _reading_, not the user _writing_. So a cookie alone is not a gate. `amr`
  lives inside the GoTrue-signed JWT and cannot be forged. **Requiring both (AND) is sound even with
  an unsigned cookie, because in an AND a cookie can only ever deny, never grant.**
- **`getUser()` does not expose `amr`** (`middleware.ts:16`). The claim is reachable only by decoding
  `session.access_token` from `getSession()`, which does **not** verify the signature — so it must be
  paired with middleware's existing validating `getUser()` call, never trusted alone. `grep -rn
"getSession" src/` returns zero hits today: this is the app's first token-claim read, and F-02
  explicitly chose the `profiles` lookup over JWT claims
  (`context/archive/2026-06-04-employee-admin-roles/plan.md:45`). That argues for reading the claim in
  exactly one helper rather than inline.
- **The `otp` mark never clears.** After `updateUser({ password })` a recovery session keeps
  `amr = [{method:"otp"}]` for its entire life. An `amr` gate alone is necessary but not sufficient —
  which is what the one-shot marker and the post-set global sign-out are for.
- **R2's blocking caveat resolves in our favour.** `src/lib/services/staff.ts:200-202` inserts the
  `profiles` row with `role: "employee"` immediately after `inviteUserByEmail`, so an invited hire
  already has a role when they accept. A role check will **not** lock out new hires.
- **`callback.ts` is the only choke point** — the sole place a recovery/invite session is created, it
  already computes `invite`, and it already returns a redirect it fully controls.
- **The upstream platform gap is real and open.** `supabase/supabase` issue #45210 reports this exact
  defect ("the resulting session carries no marker distinguishing it from a normal login session"),
  asking for a scoped or deferred session. Open, no maintainer response. Supabase's own
  [password guide](https://supabase.com/docs/guides/auth/passwords) documents callback → `verifyOtp`
  → `updateUser` with **no** origin check and **no** post-update sign-out — our code is a faithful
  implementation of the documented flow, and the documented flow is the gap.
- **The community workarounds are all weaker than ours.** `onAuthStateChange` →
  `PASSWORD_RECOVERY` is client-side only (and buggy upstream: supabase/auth#1948, supabase#18158);
  a `raw_user_meta_data` flag is user-level not session-level; "logout on unmount" is client-side.
  The one correct shape — verify identity without minting a session — is impossible with GoTrue,
  because `verifyOtp` mints a full session by design.
- **The standard backs every remedy here.** OWASP: invalidate all other sessions on reset; renew the
  session on any privilege change; don't leave the user holding a live session after a reset.
- **The design's copy has already been reconciled at source.** Live `STR.PL.auth` matches what ships
  for every existing screen (`Sprawdź skrzynkę`, `Wyślij link resetujący`, `E-mail służbowy`, the
  reworded subtitles were all reverted), `openMail`/`sentResend` are deleted to match the app, and
  `login.forgot` is already the neutral `Nie pamiętasz hasła?`. A full refresh is therefore cheap.
- **The S-08 design contract already reconciled the auth-card shell**
  (`context/archive/2026-07-23-employee-account-management/design-contract.md:329-345`): title
  `text-[28px]`, subtitle `mt-2 text-sm leading-[1.45]`, primary action = `SubmitButton`'s dark-ink
  `h-[52px] rounded-[13px] text-[15px] font-[650]`. Those are approved and are **not** re-litigated
  here. The shipped R4/R5 CTAs (`bg-primary h-12 rounded-xl text-sm font-semibold`) diverge from that
  approved contract — a fidelity bug this plan corrects.
- **Harness gap**: every authenticated integration context is minted by `signInWithPassword`
  (`tests/helpers/clients.ts:47`) — by construction the exact session type the new gate must reject.
  Nothing in `tests/helpers/**` calls `verifyOtp`, `generateLink`, or `exchangeCodeForSession`, and
  `buildApiContext` has no `cookies` at all.
- **Port 4321 is a hard constraint.** `supabase/config.toml:158-168` allow-lists only
  `localhost:4321` / `127.0.0.1:4321`; templates build links from `{{ .SiteURL }}` and the specs
  `page.goto()` that absolute link, leaving `baseURL` entirely. Config reloads only on
  `supabase stop && supabase start`, never `db reset`.

## Desired End State

A password can be set through `/api/auth/reset-password` only by a caller who holds **all** of: a
session whose JWT `amr` records a link exchange, a fresh unspent server-set marker from
`/auth/callback`, and a staff role. On success every session for that user is revoked and the user is
sent to sign in fresh. `/auth/callback` refuses to install a session over an existing one. Every auth
surface renders only Polish messages the app itself authored, resolved from short codes. The
set-password page tells the truth in all four of its states.

Verified by: the reproduction script from `review-fixes.md` failing to change the password; the two
existing e2e invite/recovery specs still green on :4321; new integration assertions covering both the
negative and positive cases; and a manual walkthrough of every state in the live local app.

## What We're NOT Doing

- **Not** flipping `secure_password_change = true`. It would demand a `current_password` from
  recovery and invite, which by definition have none — and `lessons.md:97-102` records that the
  parameter is a silent no-op while the flag is `false`.
- **Not** adding `/auth/*` to `ROUTE_ROLES`. An anonymous recovery recipient must reach the page; the
  gate belongs in the route, not the map.
- **Not** building a custom 404 page. Designs exist (`exports/error-pages/`) but it is a public-shell
  polish item needing its own design + copy round; folding it into an auth slice would bury it. Only
  the one-line `/auth` → `/auth/signin` redirect rides along.
- **Not** changing `httpOnly: false` on the Supabase cookies. It is a knowing product trade
  (`src/components/protocol/storage.ts:15-19` — the browser client reads the JWT for Storage
  uploads). Recorded as a deviation, not fixed here.
- **Not** adding explicit CSRF checks to `signin` / `signout` / `signup`. Not currently exploitable —
  Astro 6.3.1 defaults `security.checkOrigin: true` with `output: "server"` — and it widens the diff
  on routes this slice otherwise doesn't touch. Recorded in `known-issues.md` instead.
- **Not** adding rate limiting to the password-update path, or a CSP / `X-Frame-Options`. Both are
  real gaps found during research; both are their own slices.
- **Not** tightening the zod schema to the design's "10 znaków" checklist. That is S-08 deviation 7 —
  the checklist is illustrative UI, the enforced minimum stays 6 (`config.toml:190`).

## Implementation Approach

The gate is built from two signals that guard different dimensions and are required together:

- **`amr[].method === "otp"`** — unforgeable proof of _provenance_, read from the GoTrue-signed JWT.
- **a one-shot marker cookie stamped by `/auth/callback`** — _freshness and scope_, which `amr`
  structurally cannot provide because the `otp` mark never clears.

Neither alone is sufficient: cookie-only is forgeable, `amr`-only grants set-password rights for the
session's whole life. Together, an unsigned cookie is safe because it can only narrow.

Because a successful set now ends in `signOut({ scope: "global" })`, the success screen can no longer
key on "has a session". The route swaps the spent marker for a short-lived one-shot **done** cookie
and the page consumes it — the same mechanism twice rather than a second invention. That also fixes
the `?done=1` forgery (anyone typing the URL currently gets the success card).

The claim read lives in exactly one helper so the JWT-claim precedent is contained and unit-testable.

Phases are ordered so that each one ends with the app in a coherent, demoable state on
`http://localhost:4321` — the critical is fixed and its refusal screens are correct at the end of
Phase 1, rather than leaving a gate whose refusal shows the wrong copy.

## Critical Implementation Details

**Ordering — the marker must outlive a failed submit.** The marker cookie is deleted only on a
_successful_ `updateUser`. A zod failure (passwords don't match, too short) must leave it intact or
the user cannot retry, and would be bounced to R5 "Link wygasł" after a typo. This is the single
easiest thing to get wrong in Phase 1.

**`getSession()` does not validate.** It decodes the cookie without checking the signature. The
helper must be documented and used as a _supplement_ to middleware's `getUser()`, which does validate
against GoTrue. Reading `amr` without a prior validated `getUser()` would be trusting an unverified
token — the opposite of what `middleware.ts:14-16` gets right today.

**Cookie `path` must be `/`, not `/auth`.** The page lives at `/auth/reset-password` but the form
POSTs to `/api/auth/reset-password`. A `/auth`-scoped cookie would be invisible to the handler.

**`secure` must be derived per-request, not from a build flag.** Local dev runs over
`http://localhost`; a blanket `secure: true` breaks every session locally. Derive from
`context.url.protocol === "https:"` so it is correct in dev, preview, and behind Workers.

## Phase 1: Session-origin gate + the four-state set-password page

### Overview

Close F1, R1 and R2, and give `/auth/reset-password` a state machine that tells the truth. At the end
of this phase the reproduced critical is fixed and every refusal renders its designed screen.

### Changes Required:

#### 1. Session-origin helper (new)

**File**: `src/lib/auth-session.ts`

**Intent**: One place that answers "how was this session minted?", so the app's first JWT-claim read
is contained, documented and unit-testable rather than inlined into a route.

**Contract**: `readSessionOrigin(supabase: SupabaseClient): Promise<"link" | "password" | "unknown">`.
Reads `getSession()`, base64url-decodes the access token's payload segment, and inspects the `amr`
array: any entry with `method === "otp"` → `"link"`; `method === "password"` → `"password"`; absent,
malformed, or no session → `"unknown"` (fail-closed). No JWT library — `atob` plus base64url→base64
normalization, since workerd provides `atob`. The module doc comment must state that this reads an
**unverified** token and is only valid alongside middleware's validating `getUser()`.

Also export the marker-cookie contract so `callback.ts` and the reset route cannot drift:

```ts
export const LINK_ORIGIN_COOKIE = "flota-link-origin"; // value: "recovery" | "invite"
export const PW_SET_DONE_COOKIE = "flota-pw-set-done"; // value: "1"
export const LINK_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 900,
} as const; // `secure` is added per-request by the caller (see Phase 5)
```

#### 2. Stamp the marker at the only choke point

**File**: `src/pages/auth/callback.ts`

**Intent**: After a successful `verifyOtp`/`exchangeCodeForSession`, record that _this_ navigation
came from a link, carrying the mode so the downstream page no longer depends on the attacker-settable
`?mode=invite` query string for anything.

**Contract**: On success only, `context.cookies.set(LINK_ORIGIN_COOKIE, invite ? "invite" : "recovery", {...LINK_COOKIE_OPTIONS, secure})` before returning the existing redirect. The
`?mode=invite` query param stays on the redirect URL for now (Phase 2 leaves it; nothing reads it for
security). Failure branches stamp nothing.

#### 3. The gate itself

**File**: `src/pages/api/auth/reset-password.ts`

**Intent**: Replace the "a session exists" guard with a real precondition set, add the missing role
check, and revoke everything on success.

**Contract**: Self-gate in this order, matching `change-password.ts`'s idiom (hard security
rejections answer with a status; recoverable user states redirect to the page):

1. CSRF `origin !== context.url.origin` → `403`
2. `!locals.user || !locals.supabase` → `401`
3. `!requireRole(locals, "employee")` → `403` _(R2)_
4. `await readSessionOrigin(locals.supabase) !== "link"` → `403` — unreachable from the real form,
   because the page refuses to render it _(F1)_
5. marker cookie absent → `context.redirect("/auth/reset-password")`, which renders R5. Reachable
   legitimately via double-submit or the back button, so it must not be a status.
6. zod parse → redirect with `?error=<code>` (+ `&mode=invite`). **Marker survives.**
7. `updateUser({ password })` error → redirect with `?error=<code>`. **Marker survives.**
8. success → delete the marker, set `PW_SET_DONE_COOKIE`, `await supabase.auth.signOut({ scope: "global" })` _(R1)_, redirect `/auth/reset-password?done=1`.

`mode` is now read from the marker cookie, not the form body — drop the `mode` field from the zod
schema and the hidden input. Error strings become codes in Phase 3; for this phase keep the existing
Polish strings so the phase is independently shippable.

#### 4. Four-state set-password page

**File**: `src/pages/auth/reset-password.astro`

**Intent**: Stop asserting a false history. A cold visitor has not had a link expire; a normally
signed-in staffer needs pointing at the account screen, not a reset form.

**Contract**: Branch in this exact order, reading `Astro.cookies` and `readSessionOrigin`:

1. `PW_SET_DONE_COOKIE` present → **R4** success (delete the cookie as it renders). Replaces the
   forgeable `?done=1` check.
2. `!user` → **R13** `Nie ma tu nic do ustawienia` → `Poproś o link do resetu` → `/auth/forgot-password`
3. session origin `!== "link"` → **R12** `Zmień hasło w ustawieniach` → `Przejdź do ustawień konta`
   → `/dashboard/account/password`, with the account box showing the signed-in email
4. marker cookie absent → **R5** `Link wygasł` (existing copy, now semantically accurate)
5. otherwise → the form, `mode` from the marker cookie

#### 5. New Polish copy for the refusal states

**File**: `src/pages/auth/reset-password.astro` (inline, matching how R4/R5 are authored today)

**Intent**: Port the design's canonical strings verbatim.

**Contract**: `noLinkTitle` / `noLinkSub` / `noLinkCta` and `inAppTitle` / `inAppSub` / `inAppCta` /
`authedAs` exactly as they appear in `STR.PL.auth`. `inAppSub` uses Polish typographic quotes
`„Zmień hasło”` — not ASCII `"`.

#### 6. Integration harness: cookies + link-minted sessions

**File**: `tests/helpers/context.ts`, `tests/helpers/link-session.ts` (new)

**Intent**: The suite cannot currently mint the session type the gate must accept, nor carry a
cookie. Both are prerequisites for asserting the gate at all.

**Contract**: `buildApiContext` gains a `cookies?: Record<string, string>` option and returns a
minimal `AstroCookies` stub over a `Map` supporting `get` (returning `{ value }` or `undefined`),
`set`, `delete` and `has`, so a handler's reads and writes are both observable. New helper
`linkSessionContext({ type, email, ... })`: `serviceClient().auth.admin.generateLink({ type })` →
take `properties.hashed_token` → `anonClient().auth.verifyOtp({ token_hash, type })` → feed the
resulting client, user and role into `buildApiContext` with the marker cookie pre-set.

#### 7. Tests

**File**: `src/lib/auth-session.test.ts` (new, unit), `tests/integration/reset-password.test.ts` (new)

**Intent**: `lessons.md:97-102` requires the negative case be asserted deterministically against the
real backend, not inferred. Today zero tests touch this route.

**Contract**: Unit — `readSessionOrigin` over fixture tokens: `otp` → `"link"`, `password` →
`"password"`, missing `amr` / malformed payload / no session → `"unknown"`. Integration — an ordinary
`signInWithPassword` context is refused **and the password is unchanged**; a recovery-link context
with the marker succeeds; an invite-link context succeeds (the new-hire path); a link context with no
marker redirects rather than setting; a `norole` context is refused; cross-origin and absent-`Origin`
are refused; and after a success the caller's other refresh token no longer refreshes (R1).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`
- Both existing e2e specs still green on port 4321: `npm run test:e2e -- staff-auth`

#### Manual Verification:

- Signed in normally, visiting `/auth/reset-password` shows R12 `Zmień hasło w ustawieniach`, and its
  CTA lands on `/dashboard/account/password`
- Signed out, visiting `/auth/reset-password` shows R13 `Nie ma tu nic do ustawienia` — **not** "Link
  wygasł"
- A real recovery link still reaches the form, sets the password, and lands on `Hasło zaktualizowane`
- After that success the browser is signed out (visiting `/dashboard` redirects to sign-in), and the
  **new** password signs in
- Re-opening the same already-used recovery link shows R5 `Link wygasł`
- Mistyping the confirmation shows the field error and the form is still submittable afterwards — the
  marker was not spent
- The `review-fixes.md` reproduction (sign in → POST `/api/auth/reset-password`) no longer changes the
  password

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation from the human before proceeding.

---

## Phase 2: `/auth/callback` refuses an already-signed-in browser

### Overview

Close R3. A link must not silently replace whoever is signed in. OWASP treats session renewal on
privilege change as mandatory; refusing the link when a session already exists satisfies it directly
and is simpler than an interstitial.

### Changes Required:

#### 1. Guard clause before the exchange

**File**: `src/pages/auth/callback.ts`

**Intent**: Do not exchange, and critically **do not consume** the token, when a session is already
present — so the link stays usable after the user signs out.

**Contract**: `if (context.locals.user) return context.redirect("/auth/link-conflict")` placed before
the `code` / `tokenHash` branches. Dropping the token on the redirect is the designed behaviour: the
copy tells the reader to reopen the link from the message.

#### 2. The R11 refusal screen

**File**: `src/pages/auth/link-conflict.astro` (new)

**Intent**: Name the account that is in the way and offer the one action that unblocks it. Serves two
real cases — a signed-in staffer clicking their own recovery link, and a shared rental-desk
workstation where a new hire opens their invite in a colleague's session.

**Contract**: `AuthShell` + status head + `authedTitle` / `authedSub` verbatim, the account box
labelled `Zalogowano jako` showing `Astro.locals.user.email`, and the sign-out island. If no session
is present (someone typed the URL) redirect to `/auth/signin` — the screen has nothing to say.

#### 3. Sign-out island with pending state

**File**: `src/components/auth/SignOutButton.tsx` (new)

**Intent**: The project rule is that any button triggering an async action shows a pending state; the
design ships a dedicated `ScreenAuthAuthedBusyD` artboard for exactly this.

**Contract**: A native `<form method="POST" action="/api/auth/signout">` with `SubmitButton`
(`pendingText="Wylogowywanie…"`, label `Wyloguj się`, trailing arrow), driven by an explicit
`submitting` flag — `useFormStatus` does not report pending for a URL-posting form. Keep the pending
state through the redirect; reset only on error.

#### 4. E2E cover for the refusal

**File**: `e2e/auth-hardening.spec.ts` (new)

**Intent**: `e2e/staff-auth.spec.ts` sets `test.use({ storageState: { cookies: [], origins: [] } })` at
file scope, so a spec needing an authenticated session cannot live there.

**Contract**: Using the default employee storage state — a signed-in browser opening a freshly
generated recovery link lands on `/auth/link-conflict` showing `Ta przeglądarka jest już zalogowana`;
signing out from that screen and re-opening the same link reaches the set-password form, proving the
token was not consumed. Unique timestamped fixture emails, cleanup in `afterEach`, no
`waitForTimeout`, `waitForIslands` before interacting.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Integration tests pass: `npm run test:integration`
- New and existing e2e specs green on port 4321: `npm run test:e2e`

#### Manual Verification:

- Signed in as user A, opening user B's invite link shows R11 naming **A's** email — and A's session
  is intact (navigating to `/dashboard` still works)
- The sign-out button shows the spinner and `Wylogowywanie…` while in flight
- After signing out from R11, re-opening that same link reaches the set-password form — the token was
  not burned
- Visiting `/auth/link-conflict` directly while signed out redirects to `/auth/signin`

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: Error-code whitelist across the auth surfaces

### Overview

Close F6. No Polish sentence travels in a URL any more, so a crafted link cannot put words in the
app's mouth even if it guesses a valid code — and GoTrue's English stops reaching a Polish UI.

### Changes Required:

#### 1. Shared code → message resolver

**File**: `src/lib/auth-messages.ts` (new)

**Intent**: One table per surface, resolved server-side, so islands keep receiving a plain resolved
string and `ServerError.tsx` needs no change.

**Contract**: An exported record of short codes → Polish strings, plus
`resolveAuthError(surface, code: string | null): string | null` returning `null` for anything
unrecognised. Codes cover: `invalidCredentials`, `rateLimited`, `unconfigured`, `signupClosed`,
`wrongCurrent`, `tooShort`, `mismatch`, `samePassword`, `weakPassword`, `generic`. Also
`gotrueErrorCode(error): string` mapping GoTrue's `error.code` (`same_password`, `weak_password`, …)
and `error.status` (429 → `rateLimited`) to a local code, defaulting to `generic` — `error.message` is
never forwarded.

#### 2. Producers emit codes

**File**: `src/pages/api/auth/{signin,reset-password,change-password,signup}.ts`

**Intent**: Stop the raw-GoTrue passthroughs — `change-password.ts:95` and `reset-password.ts:47`
forward English _after_ a successful gate, which is how `same_password` reaches the UI.

**Contract**: Every `?error=` redirect carries a code from the table above. `change-password.ts`'s
local `MSG` map is replaced by the shared one; both `updateUser` failure paths route through
`gotrueErrorCode`.

#### 3. Surfaces resolve codes

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/reset-password.astro`,
`src/pages/dashboard/account/password.astro`

**Intent**: An unknown code renders nothing at all.

**Contract**: Each page calls `resolveAuthError(<surface>, Astro.url.searchParams.get("error"))` and
passes the result to its island's existing `serverError` prop. `/auth/forgot-password` has **no**
`?error=` sink (verified — it reads only `?sent=1` / `?expired=1`); record that as checked-clean
rather than adding one.

#### 4. Update the assertions the change breaks

**File**: `tests/integration/change-password.test.ts`, `src/lib/auth-messages.test.ts` (new, unit)

**Intent**: Three existing assertions (`:110`, `:160`, `:170-172`) compare full redirect URLs
containing Polish text and will fail by construction.

**Contract**: Those three compare against the code form. New unit tests: a known code resolves to its
Polish string; an unknown code, an empty string and an injected sentence all resolve to `null`; and
`gotrueErrorCode` maps `same_password` and a 429 correctly.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Integration tests pass: `npm run test:integration`

#### Manual Verification:

- `/auth/signin?error=Twoje%20konto%20zablokowano,%20zadzwoń%20pod%20500123456` renders **no** alert
- The same injected text on `/auth/reset-password?error=…` and
  `/dashboard/account/password?error=…` renders no alert
- Signing in with a wrong password still shows a correct Polish message
- Reusing your current password on `/dashboard/account/password` shows Polish copy, **not** "New
  password should be different from the old password."

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Copy refresh, account box, and card-state chrome

### Overview

Bring the app's auth copy fully into line with the design project, add the account box that lets a
human catch what the server structurally cannot, and give the state cards the status head the design
specifies — so the three new screens don't sit visually apart from their neighbours.

### Changes Required:

#### 1. Copy refresh

**File**: `src/components/auth/SignInForm.tsx`, `src/components/auth/ResetPasswordForm.tsx`

**Intent**: Adopt the design's canonical strings. Verified against live `shared.jsx` — every other
`STR.PL.auth` / `STR.PL.login` string already matches what ships, so this is the whole delta.

**Contract**: `SignInForm.tsx:116` `Zapomniałeś hasła?` → `Nie pamiętasz hasła?` (gender-neutral).
`ResetPasswordForm.tsx:57` `Witaj w Flocie` → `Witaj we Flocie` (euphonic `we`). `ResetPasswordForm`
gains a distinct invite subtitle — `Masz zaproszenie do zespołu dyspozytorni. Utwórz hasło, aby
aktywować konto.` — instead of reusing the recovery `setSub` for both modes.

#### 2. `e2e/staff-auth.spec.ts:88` follows the copy

**File**: `e2e/staff-auth.spec.ts`

**Intent**: That line asserts `Witaj w Flocie` verbatim and fails the moment the string changes.

**Contract**: Update the assertion to `Witaj we Flocie` in the same commit as the string.

#### 3. `setFor` account box on the set-password screen

**File**: `src/components/auth/ResetPasswordForm.tsx`, `src/pages/auth/reset-password.astro`

**Intent**: Server-side, "Anna clicked her own link" and "Anna clicked Bartek's link" are identical
requests — nothing can separate them. Printing the target address is the one mitigation, and it lets
the human catch what the server cannot.

**Contract**: `Ustawiasz hasło dla` + `Astro.locals.user.email`, passed as a prop, rendered on both
R3/R9 and R6/R10. Same account-box component as R11/R12 (extract it once rather than three copies).

#### 4. Status head + CTA alignment on the state cards

**File**: `src/components/auth/StatusHead.astro` (new), `src/pages/auth/reset-password.astro`,
`src/pages/auth/forgot-password.astro`, `src/pages/auth/link-conflict.astro`

**Intent**: The design gives every state card a 56px tinted icon tile; the shipped R2/R4/R5 lack it.
Adopting it only on the new screens would make them the odd ones out, so it goes on all of them. The
shipped R4/R5 CTAs also diverge from the S-08 contract's own approved primary-action spec
(`design-contract.md:340`) — correct them to the `SubmitButton` ink idiom.

**Contract**: Per the design, `size-14 rounded-[16px] mb-5` with a 27px icon, tones: `ink` =
`bg-secondary` + `text-foreground/80`, `green` = `bg-success/10` + `text-success`, `red` =
`bg-destructive/10` + `text-destructive`. Applied as: sent → `ink`/mail, success → `green`/shield,
expired → `red`/warning, authed → `ink`/user, inApp → `ink`/gear, noLink → `ink`/info. CTAs move to
`bg-foreground text-background h-[52px] w-full rounded-[13px] text-[15px] font-[650]`.

#### 5. `?done=1` and `/auth` polish

**File**: `src/pages/auth/reset-password.astro`, `src/pages/auth/index.astro` (new)

**Intent**: Two loose ends in the same family.

**Contract**: The `?done=1` forgery is already closed by Phase 1's done-cookie branch — this step only
removes the now-dead `?done` query read. New `src/pages/auth/index.astro` returns
`Astro.redirect("/auth/signin")` so `/auth` stops serving Astro's unstyled default.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- All e2e specs green on port 4321: `npm run test:e2e`

#### Manual Verification:

- Sign-in page reads `Nie pamiętasz hasła?`
- An invite link shows `Witaj we Flocie` and the invite-specific subtitle
- The set-password screen shows `Ustawiasz hasło dla <email>` in both recovery and invite modes
- R2/R4/R5/R11/R12/R13 all show a status icon tile and a dark-ink full-width CTA
- `/auth/reset-password?done=1` typed directly by a signed-out visitor shows R13, **not** the success
  card
- `/auth` redirects to `/auth/signin`
- Vision-diff each surface against its canonical mockup at both breakpoints (see design contract)

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 5: Cookie `Secure` attribute + full-suite verification

### Overview

Close the cookie-posture deviation found during research, then run every gate together on the pinned
port.

### Changes Required:

#### 1. Per-request `secure` on the session cookies

**File**: `src/lib/supabase.ts`, `src/middleware.ts`, `src/pages/api/auth/signin.ts`,
`src/pages/api/auth/signout.ts`

**Intent**: `createServerClient` is called with no `cookieOptions`, so `@supabase/ssr`'s
`DEFAULT_COOKIE_OPTIONS` applies — and it contains **no `secure` key at all**, so the attribute is
never emitted. OWASP marks it mandatory.

**Contract**: `createClient` gains an optional third argument `{ secure?: boolean }`, forwarded as
`cookieOptions: { secure }`. All three call sites pass `context.url.protocol === "https:"`. Derive it
per-request rather than from `import.meta.env.PROD` so local `http://localhost` keeps working and
preview/Workers are correct without a second knob. Apply the same `secure` to the two S-14 cookies.

`httpOnly: false` stays — it is a knowing trade (`storage.ts:15-19`); record it as a deviation.

#### 2. Record what was deliberately deferred

**File**: `context/foundation/known-issues.md`

**Intent**: That file has **no auth entries at all**, so there is nowhere for this slice's deferrals
to land.

**Contract**: New entries, each symptom → cause → scope → decision: the 400-day cookie `maxAge`; the
absence of any rate limit on `updateUser({ password })`; `signin`/`signout`/`signup` depending on
Astro's `security.checkOrigin` default as their only CSRF protection; and the absent CSP /
`X-Frame-Options`, which compounds `httpOnly: false`.

#### 3. Full-suite run

**Intent**: The two e2e invite/recovery specs are the real gate for this slice and only work on 4321.

**Contract**: `supabase stop && supabase start` (config reloads only there), dev server on 4321,
then the whole integration suite and the whole e2e suite.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Full integration suite passes: `npm run test:integration`
- Full e2e suite passes on port 4321: `npm run test:e2e`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Local dev over `http://localhost:4321` still signs in and holds the session — `secure` did not
  break it
- In `npm run preview`, `Set-Cookie` on the auth cookies carries `Secure`
- End-to-end walkthrough one more time: forgot → email → set → signed out → sign in with the new
  password
- End-to-end invite walkthrough: admin invites → email → `Witaj we Flocie` → activate → sign in

---

## Testing Strategy

### Unit Tests

- `readSessionOrigin`: `otp` → `link`, `password` → `password`; missing `amr`, malformed payload,
  absent session → `unknown` (fail-closed)
- `resolveAuthError`: known code → Polish; unknown code, empty string, injected sentence → `null`
- `gotrueErrorCode`: `same_password` → `samePassword`; status 429 → `rateLimited`; unknown → `generic`

### Integration Tests

The new `linkSessionContext` helper is the enabling piece — the suite currently cannot mint anything
but a `signInWithPassword` session.

- **Negative (the property that matters)**: an ordinary password session POSTing
  `/api/auth/reset-password` is refused **and the password is unchanged** — asserted by signing in
  with both the old and the proposed password afterwards, not merely by the response status
- **Positive**: a recovery-link context with the marker succeeds; an invite-link context succeeds
- Marker absent on a link session → redirect, password unchanged
- `norole` context → 403; cross-origin → 403; absent `Origin` → 403 (fail closed, matching
  `change-password.test.ts:185`)
- R1: after a successful set, a refresh token captured beforehand no longer refreshes

### E2E Tests

Reserved for what crosses email → link → session, per `playwright.config.ts`.

- Existing: self-service reset, invite-accept (both must stay green — they are the real gate)
- New: signed-in browser opening a recovery link → R11; sign out from R11 → same link still works

### Manual Testing Steps

1. `supabase stop && supabase start`, then `npm run dev` on **4321**
2. Walk the four `/auth/reset-password` states: cold visit (R13), signed-in visit (R12), used link
   (R5), live link (form)
3. Run the `review-fixes.md` reproduction and confirm the password does not change
4. Invite a new employee end to end and confirm they can set their first password
5. Try the `?error=` injection on all three sinks
6. Confirm `Secure` appears on the auth cookies under `npm run preview`

## Performance Considerations

`readSessionOrigin` adds one `getSession()` call — a cookie read plus a local base64 decode, no
network round trip — on the reset route and the reset page only. Middleware is untouched, so no
per-request cost is added to the rest of the app. The marker cookie is a few dozen bytes on `/`,
present only during the ~15-minute reset window.

## Migration Notes

No schema change, no data migration. Sessions minted before deploy keep working; the only behavioural
change for an existing session is that it can no longer set a password through the recovery route —
which is the point. `supabase/config.toml` is unchanged, so no `supabase stop && start` is required
for the change itself (only for the test run, and only if config was touched for other reasons).

**Production rollout inherits the S-08 chain** (`context/archive/2026-07-23-employee-account-management/plan.md:421`,
`docs/reference/contract-surfaces.md:43-48`): the prod origin must be in `additional_redirect_urls`,
or emailed links point at localhost and the flow silently breaks. Nothing in this slice changes that,
but the post-deploy check is the same: request a reset in prod and confirm the emailed link resolves
to the prod origin.

## References

- Research: `context/changes/auth-surface-hardening/research.md`
- Problem statement + scripted reproduction: `context/changes/staff-account/follow-ups/review-fixes.md`
- Roadmap slice: `context/foundation/roadmap.md` §S-14
- The reference gate to mirror: `src/pages/api/auth/change-password.ts:39-107`
- Approved auth-card shell: `context/archive/2026-07-23-employee-account-management/design-contract.md:329-345`
- Governing lesson: `context/foundation/lessons.md:97-102`
- Upstream platform gap: https://github.com/supabase/supabase/issues/45210
- OWASP Forgot Password / Session Management cheat sheets

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Session-origin gate + the four-state set-password page

#### Automated

- [x] 1.1 Type checking passes: `npx astro check` — d1a7d25
- [x] 1.2 Linting passes: `npm run lint` — d1a7d25
- [x] 1.3 Unit tests pass: `npm test` — d1a7d25
- [x] 1.4 Integration tests pass: `npm run test:integration` — d1a7d25
- [x] 1.5 Both existing e2e specs still green on port 4321 — d1a7d25

#### Manual

- [x] 1.6 Signed in normally, `/auth/reset-password` shows R12 and its CTA reaches the account screen — d1a7d25
- [x] 1.7 Signed out, `/auth/reset-password` shows R13 — not "Link wygasł" — d1a7d25
- [x] 1.8 A real recovery link reaches the form, sets the password, shows "Hasło zaktualizowane" — d1a7d25
- [x] 1.9 After success the browser is signed out and the new password signs in — d1a7d25
- [x] 1.10 Re-opening a used recovery link shows R5 "Link wygasł" — d1a7d25
- [x] 1.11 A mistyped confirmation leaves the form retryable — the marker was not spent — d1a7d25
- [x] 1.12 The `review-fixes.md` reproduction no longer changes the password — d1a7d25

### Phase 2: `/auth/callback` refuses an already-signed-in browser

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — 061b832
- [x] 2.2 Linting passes: `npm run lint` — 061b832
- [x] 2.3 Integration tests pass: `npm run test:integration` — 061b832
- [x] 2.4 New and existing e2e specs green on port 4321 — 061b832

#### Manual

- [x] 2.5 Signed in as A, opening B's invite link shows R11 naming A's email; A's session is intact — 061b832
- [x] 2.6 The sign-out button shows the spinner and "Wylogowywanie…" — 061b832
- [x] 2.7 After signing out from R11, the same link still reaches the set-password form — 061b832
- [x] 2.8 `/auth/link-conflict` while signed out redirects to `/auth/signin` — 061b832

### Phase 3: Error-code whitelist across the auth surfaces

#### Automated

- [x] 3.1 Type checking passes: `npx astro check`
- [x] 3.2 Linting passes: `npm run lint`
- [x] 3.3 Unit tests pass: `npm test`
- [x] 3.4 Integration tests pass: `npm run test:integration`

#### Manual

- [x] 3.5 An injected `?error=` sentence renders no alert on `/auth/signin`
- [x] 3.6 The same on `/auth/reset-password` and `/dashboard/account/password` renders no alert
- [x] 3.7 A wrong sign-in password still shows correct Polish copy
- [x] 3.8 Reusing your current password shows Polish copy, not GoTrue's English

### Phase 4: Copy refresh, account box, and card-state chrome

#### Automated

- [ ] 4.1 Type checking passes: `npx astro check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Unit tests pass: `npm test`
- [ ] 4.4 All e2e specs green on port 4321

#### Manual

- [ ] 4.5 Sign-in page reads "Nie pamiętasz hasła?"
- [ ] 4.6 An invite link shows "Witaj we Flocie" and the invite-specific subtitle
- [ ] 4.7 The set-password screen shows "Ustawiasz hasło dla <email>" in both modes
- [ ] 4.8 R2/R4/R5/R11/R12/R13 show a status icon tile and a dark-ink full-width CTA
- [ ] 4.9 `/auth/reset-password?done=1` typed by a signed-out visitor shows R13
- [ ] 4.10 `/auth` redirects to `/auth/signin`
- [ ] 4.11 Vision-diff each surface against its canonical mockup at both breakpoints

### Phase 5: Cookie `Secure` attribute + full-suite verification

#### Automated

- [ ] 5.1 Type checking passes: `npx astro check`
- [ ] 5.2 Linting passes: `npm run lint`
- [ ] 5.3 Unit tests pass: `npm test`
- [ ] 5.4 Full integration suite passes
- [ ] 5.5 Full e2e suite passes on port 4321
- [ ] 5.6 Production build succeeds: `npm run build`

#### Manual

- [ ] 5.7 Local dev over `http://localhost:4321` still holds a session
- [ ] 5.8 `npm run preview` emits `Secure` on the auth cookies
- [ ] 5.9 Full recovery walkthrough: forgot → email → set → signed out → sign in with the new password
- [ ] 5.10 Full invite walkthrough: invite → email → "Witaj we Flocie" → activate → sign in
