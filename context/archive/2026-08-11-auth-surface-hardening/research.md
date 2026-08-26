---
date: 2026-08-11T12:59:55+02:00 (CEST)
researcher: MarcinK
git_commit: f42231a9d1f060411232c8c5304a9f36d914ad29
branch: feature/auth-surface-hardening
repository: fleet-rent-staff-account
topic: "Gating the password-recovery flow end to end — from the sign-in page and from the staff account screen"
tags: [research, codebase, auth, gotrue, supabase, session-origin, amr, csrf, s-14]
status: complete
last_updated: 2026-08-11
last_updated_by: MarcinK
last_updated_note: "Added follow-up research: external validation against OWASP + GoTrue source + upstream Supabase issue; recalibrated R2 severity; revised R3 fix design"
---

# Research: Gating the password-recovery flow end to end

**Date**: 2026-08-11T12:59:55+02:00 (CEST)
**Researcher**: MarcinK
**Git Commit**: `f42231a9d1f060411232c8c5304a9f36d914ad29`
**Branch**: `feature/auth-surface-hardening`
**Repository**: `fleet-rent-staff-account`

## Research Question

> There are problems with gating the recovery password. Check the whole flow — not only from the login page but also from the staff screen where one can manage their own account.

Scope agreed at the start of the session: **full flow audit** (every password-setting path, plus a sweep of the surrounding auth routes for holes beyond the two documented findings) **with a live GoTrue probe** (mint sessions three ways, decode the JWTs, re-verify the F1 reproduction on HEAD).

## Summary

The app has **two** routes that set a password, and they were built to different standards by different slices. The staff-screen route is careful; the recovery route is not; and the recovery route's own comment claims a guarantee it never implements.

|                        | `/api/auth/change-password` (staff screen, S-11) | `/api/auth/reset-password` (recovery + invite, S-08) |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| Reached from           | `/dashboard/account/password`                    | `/auth/reset-password`                               |
| CSRF                   | ✅ `:41-44` → 403                                | ✅ `:21-24` → 302                                    |
| Auth                   | ✅ `:48-51` → 401                                | ⚠️ `:31` — presence of _any_ session                 |
| Role                   | ✅ `:54-56` → 403                                | ❌ **none**                                          |
| Proof of identity      | ✅ `signInWithPassword` reauth `:81-90`          | ❌ **none**                                          |
| Revokes other sessions | ✅ `:105` `signOut({ scope: "others" })`         | ❌ **none**                                          |

**F1 is confirmed exploitable on HEAD** (re-reproduced live during this research, not taken on trust): ordinary password sign-in → one POST to `/api/auth/reset-password` → `302 …?done=1`, old password dead, new password live. No recovery link at any point.

Beyond F1 and F6, this research found **three further defects on the same flow**, none of which appear in `review-fixes.md` or the roadmap:

- **R1 — a password reset revokes nothing.** The forgot-password path is the flow a compromised staffer actually reaches for, and it leaves every other session alive. The staff-screen route fixes this (`change-password.ts:105`) and its own comment explains exactly why it matters — _"without this a stolen cookie outlives the password change — the one remedy a compromised staffer has would not actually remedy anything"_ — and then that fix was applied on only that one path.
- **R2 — `/api/auth/reset-password` has no role check**, so a `role = null` bearer (no profile, or `deactivated_at` set) reaches a working password-set endpoint that every other authenticated route refuses them.
- **R3 — `/auth/callback` is an unauthenticated GET-only session _installer_** with no "am I already signed in?" branch. It is a session-fixation vector, gated only by the attacker needing an account of their own.

On the open unknown that decides the fix design: **GoTrue does give us a discriminator** — `amr[].method` is `"password"` for `signInWithPassword` and `"otp"` for both `verifyOtp` link exchanges, and it survives a token refresh verbatim. But three properties make it insufficient on its own, and the most important is that **the `otp` mark never clears**, so a recovery session keeps set-password privilege for its entire life.

**No existing test would fail** if the gate were removed entirely, so every property below has to be newly asserted.

---

## Detailed Findings

### 1. The recovery flow, end to end (login-page side)

The shipped flow is **`token_hash` + `verifyOtp`**, with PKCE as a fallback — the reverse of what the planning docs describe (see §9).

1. `/auth/forgot-password` → `ForgotPasswordForm.tsx:30-36` → `POST /api/auth/forgot-password`. Origin-checked (`:21-24`), zod-parsed (`:19`), then `resetPasswordForEmail(…, { redirectTo: ${origin}/auth/callback })` (`:26-28`) with errors deliberately swallowed and a constant `?sent=1` reply (`:31`) — no account-existence leak. Correct.
2. The email: `supabase/templates/recovery.html:8` links to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`; the invite twin is `supabase/templates/invite.html:10` with `&type=invite&flow=invite`. Registered at `supabase/config.toml:261-263`.
3. `src/pages/auth/callback.ts:35-39` exchanges it with `verifyOtp({ token_hash, type })`, which writes the session cookie via `src/lib/supabase.ts:20-24`, then redirects to `/auth/reset-password` (+ `?mode=invite` when `flow=invite`/`type=invite`/`type=signup`, `:26-27`, `:51`).
4. `src/pages/auth/reset-password.astro:31,46-47` renders the form on the sole condition `Astro.locals.user != null`.
5. `POST /api/auth/reset-password` → `updateUser({ password })` at `:45`.

**Exactly two things survive step 3 → step 4**: the Supabase auth cookies, and the `?mode=invite` query string. `context.locals` does not survive a redirect — middleware rebuilds it from cookies. **`callback.ts` stamps no marker of any kind.** That is the entire state budget a gate has to work with today, and it is why the guard at `reset-password.ts:31` cannot do what its comment claims.

### 2. F1 — confirmed, and worse than "no current password"

`src/pages/api/auth/reset-password.ts:29-33`:

```ts
// The recovery session must exist (set by the callback exchange). If it is
// gone, the link expired → the R5 screen.
if (!context.locals.user || !context.locals.supabase) {
  return context.redirect("/auth/reset-password");
}
```

`locals.user` is truthy for any authenticated session (`src/middleware.ts:14-17`). Nothing distinguishes provenance.

**Live re-verification on HEAD** (probe script in scratchpad, not committed). With an ordinary password sign-in cookie jar — `amr` decoded from the app's own live cookie as `[{"method":"password"}]`:

```
[signin]         302 -> /dashboard
[reset-password] HTTP 302 Found
[reset-password] Location: /auth/reset-password?done=1

after POST — OLD signs in: NO (Invalid login credentials)
after POST — NEW signs in: YES
```

The password changed. Probe user deleted, password restored, repo unmodified.

Note the port: 4321 was held by a sibling worktree (`car-rental`), so the probe ran on 4324. The CSRF check compares `origin` against `context.url.origin`, so the port is immaterial **for this repro** — but it is _not_ immaterial for the e2e specs (§10).

### 3. R1 (NEW) — the reset path revokes nothing

The whole codebase contains exactly two revocation calls:

```
src/pages/api/auth/signout.ts:7            await supabase.auth.signOut();
src/pages/api/auth/change-password.ts:105  await supabase.auth.signOut({ scope: "others" });
```

`reset-password.ts:45-50` updates the password and redirects. Which paths leave a stolen cookie alive:

| Path                                                                | Other sessions after a password change                                                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/forgot-password` → callback → `/api/auth/reset-password` | **alive** ← the self-service "I've been compromised" flow                                                                                |
| `/api/staff/[id]/reset-password` (admin-triggered)                  | **alive** ← admin resetting a suspected-compromised staffer does not evict the intruder                                                  |
| invite-accept (same route, `mode=invite`)                           | alive, but moot — no prior session                                                                                                       |
| `/api/auth/change-password` (staff screen)                          | killed (`:105`)                                                                                                                          |
| `/api/staff/[id]/deactivate`                                        | killed — `src/lib/services/staff.ts:257` `ban_duration`, and `middleware.ts:30` independently resolves `deactivated_at` to `role = null` |

This is the exact trap already written into `context/foundation/lessons.md:100` as the sibling of the `current_password` no-op. It was fixed in S-11 as finding F2 (`context/changes/staff-account/reviews/impl-review.md:49-62`) — on one route. Compounded by the 400-day refresh cookie (§7), a token stolen once persists until deactivation.

### 4. R2 (NEW) — no role check on the reset route

`reset-password.ts:31` is the complete gate. Contrast `change-password.ts:53-56`, which exists precisely to reject a deactivated staffer whose profile resolves to `role = null` while their auth session persists.

There is a concrete window: `src/lib/services/staff.ts:255-260` commits the `deactivate_staff` RPC **first** and then bans. If the ban throws, the user is left `role = null` but unbanned, session intact. Every other authenticated route refuses them; `/api/auth/reset-password` does not.

### 5. R3 (NEW) — `/auth/callback` is an unguarded session installer

`src/pages/auth/callback.ts:16` is `export const GET`. Astro's built-in origin check exempts safe methods (`SAFE_METHODS = ["GET","HEAD","OPTIONS"]` in `astro/dist/core/app/middlewares.js`), and the route has no `if (context.locals.user)` branch — it unconditionally overwrites whatever session is present.

The `token_hash` branch was _deliberately_ built to exchange server-side with no code-verifier (`callback.ts:6-11`) so a recipient in any browser can use the link. That same property means a crafted top-level navigation to `/auth/callback?token_hash=<attacker's own token>&type=recovery` silently switches a victim's browser onto the attacker's account, destroying the victim's session. Staff work done afterwards — protocol photos, signatures, PDFs — lands in the attacker's account.

**Severity calibration — read this before ranking it.** The audit agent rated this HIGH; I am recording it as **Medium-High**, because it has a precondition the agent's write-up understates: the attacker must already hold an account in this Supabase project. Signup is closed three ways (`supabase/config.toml:184` `enable_signup = false`, `src/pages/api/auth/signup.ts:8-11`, and the UI), and GoTrue only issues recovery tokens for addresses that exist. So this is an **insider / lateral** vector — a current or not-yet-deactivated employee against a colleague — not an anonymous internet attack. `config.toml:197` `email_sent = 2` per hour also caps token minting. It is still worth fixing, and the fix is a one-line "already signed in?" branch, but it should not be triaged above F1.

The PKCE `?code=` branch is not exploitable this way (it needs a verifier cookie). Only `token_hash` is — which is the branch the app actually uses.

### 6. The probe — is there a session-origin claim? (decides the fix design)

Environment: GoTrue **v2.188.1** (`public.ecr.aws/supabase/gotrue:v2.188.1`), Supabase CLI 2.98.2, local project at `127.0.0.1:54321`. Method: replicated `callback.ts` exactly — `verifyOtp({ token_hash, type })`, not PKCE.

**Answer: yes — `amr[].method`.**

| Field                            | password     | recovery    | invite      | Discriminates?                                          |
| -------------------------------- | ------------ | ----------- | ----------- | ------------------------------------------------------- |
| `amr[0].method`                  | `"password"` | `"otp"`     | `"otp"`     | **yes** (password vs link); **no** (recovery vs invite) |
| `aal`                            | `aal1`       | `aal1`      | `aal1`      | no                                                      |
| `role` / `aud` / `is_anonymous`  | identical    | identical   | identical   | no                                                      |
| `app_metadata` / `user_metadata` | identical    | identical   | identical   | no                                                      |
| `session_id`                     | opaque UUID  | opaque UUID | opaque UUID | no                                                      |

Mechanism confirmed in the DB: `auth.mfa_amr_claims.authentication_method` holds `password` / `otp` per `session_id`.

**Four caveats, in descending importance:**

1. **The `otp` mark never clears.** After `updateUser({ password })` on a recovery session, `amr` remains `[{method:"otp"}]` — before and after a refresh. A recovery session therefore retains set-password privilege for its whole life. An `amr` gate alone is necessary but **not sufficient**; it wants a forced sign-out once the password is set, and/or a freshness check on `amr[].timestamp`.
2. **`getUser()` does not expose `amr`.** `context.locals.user` (`src/middleware.ts:16`) cannot carry the gate. The claim is reachable only by decoding `session.access_token` from `getSession()` — which does **not** verify the signature. It must be paired with the middleware's existing `getUser()` call (which does validate against GoTrue) rather than trusted alone. Today `grep -rn "getSession" src/` returns zero hits: the app has never read a raw token.
3. **`otp` is broader than "recovery link"** — magic-link and signup-confirmation exchanges mint the same value (both verified). Unreachable today, but a future magic-link login would silently inherit set-password rights.
4. **Recovery and invite are indistinguishable** — both `otp`. The existing `?mode=invite` query param is the only signal, and it is attacker-settable (`reset-password.ts:27` reads it from the form body). Fine for copy selection; unusable as a security input.

**`amr` survives refresh verbatim** — forced `refreshSession()` on all three sessions preserved both method and original timestamp (`iat`/`exp` advance, `session_id` unchanged). So the gate does not decay minutes later. This retires the "does it survive refresh?" risk.

**Not discriminators**: `recovery_sent_at` / `invited_at` are sticky _user_-level timestamps that persist after the link is consumed — any user who ever did one recovery would pass such a check forever.

### 7. Session and cookie posture

`src/lib/supabase.ts:12-26` calls `createServerClient` with **no `cookieOptions`**, so `@supabase/ssr`'s defaults apply verbatim: `path:"/"`, `sameSite:"lax"`, **`httpOnly:false`**, `maxAge: 400 days`, and **no `secure` key at all**.

`httpOnly:false` is deliberate and documented at `src/components/protocol/storage.ts:15-19` (the browser client picks up the JWT with no token plumbing). The trade was made knowingly. What compounds it: there is no CSP and no `X-Frame-Options` anywhere in the repo, and per R1 an exfiltrated refresh token cannot be revoked by any reset path.

**What the auth layer gets right** (worth recording so a fix doesn't regress it): `middleware.ts:14-16` uses `getUser()`, which validates against the auth server — the app never trusts an unverified JWT. Role comes only from a DB read (`middleware.ts:25-30`), never from a header, body, or cookie.

### 8. F6 — `?error=` reflection, including on the staff screen

Confirmed as **text injection, not XSS** — `src/components/auth/ServerError.tsx:11-13` renders `{message}` as a React child, so it is escaped. The risk is a phishing lure inside an authentic-looking destructive alert on a real authenticated URL.

Sinks: `signin.astro:11` → `SignInForm.tsx:120`; `reset-password.astro:12` → `ResetPasswordForm.tsx:106`; `dashboard/account/password.astro:16` → `ChangePasswordForm.tsx:125`.

Sources: `signin.ts:16` (relays GoTrue's raw English `error.message`), `reset-password.ts:42` and `:47`, `change-password.ts:37`, `signup.ts:10`.

**The staff-screen instance is the subtle one.** `change-password.ts:30-34`'s `MSG` map is the pattern `review-fixes.md` says to extend — but `change-password.ts:95` still forwards raw GoTrue text on the _update_ failure, bypassing `MSG` entirely. That is the `same_password` case (`code: "same_password"`, status 422), so reusing your current password on the staff account screen prints _"New password should be different from the old password."_ in an all-Polish product. The three integration assertions that exist all target the `MSG` constants, never the `:95` passthrough.

One more, adjacent: `reset-password.astro:18` checks `?done=1` **first**, so anyone — signed in or not — who types `/auth/reset-password?done=1` gets the "Hasło zaktualizowane" success card. Cosmetic, but it is the same "put words in the app's mouth" family.

### 9. Planning docs vs. shipped code — a divergence a fix must not inherit

The archived S-08 plan states the flow is _"purely PKCE `?code=`"_ with _"No custom GoTrue email templates … GoTrue defaults are used"_ (`context/archive/2026-07-23-employee-account-management/plan.md:14,48`). **The shipped code is the opposite**: custom templates exist (`supabase/templates/{recovery,invite}.html`), are registered (`config.toml:257-263`), and link with `?token_hash=&type=`, which `callback.ts:35-39` exchanges via `verifyOtp` — PKCE demoted to a fallback. `callback.ts:4-11` explains the switch (the default `{{ .ConfirmationURL }}` flow drops the invite session into a URL fragment the server never sees).

This matters twice over: a gate designed off the plan docs would target the wrong exchange call, and `token_hash`-vs-PKCE is exactly what makes R3 reachable.

### 10. Test coverage — nothing would catch any of this

**No test in the repo would fail if `/api/auth/reset-password` accepted an ordinary password session.** Evidence: no test file imports the module (the integration suite imports only reservations/vehicles/protocols/return-protocols handlers plus `change-password`, `tests/integration/change-password.test.ts:5`); the only coverage is two e2e happy paths that arrive with a legitimate link session (`e2e/staff-auth.spec.ts:39`, `:80`), so accepting an additional session type is strictly widening.

Symmetrically, **no test would fail if that route lost its CSRF check, its session check, or its confirm-match check** either. `/auth/callback`, `/api/auth/signin`, `/api/auth/signout` and `/api/auth/forgot-password` have no tests of any kind. `tests/integration/api-authz.test.ts` builds a full anon/norole/employee/admin matrix — with no row for any `/api/auth/*` route except `change-password`, and none for `/api/staff/*`.

Every password property asserted in the deterministic layer targets `/api/auth/change-password` (`change-password.test.ts:104,117,129,154,164,176,185,197,210`). Zero target `/api/auth/reset-password`.

**Harness limitation that will bite.** Every authenticated integration context is minted by `signInWithPassword` (`tests/helpers/clients.ts:47`) — by construction the exact session type the new gate must reject. Nothing in `tests/helpers/**` calls `verifyOtp`, `generateLink`, or `exchangeCodeForSession`. Asserting the new property needs a new helper: `serviceClient().auth.admin.generateLink({ type })` → `anonClient().auth.verifyOtp({ token_hash, type })` → feed into `buildApiContext` (`tests/helpers/context.ts:72`). Related: S-11's F10 recorded that the suite drives routes with `anonClient()` (`persistSession: false`), **not** the SSR cookie client — which is precisely the layer a session-origin gate lives in (`context/changes/staff-account/reviews/impl-review.md:151-157`).

**Three assertions break under a message whitelist**, all comparing full redirect URLs: `change-password.test.ts:110`, `:160`, `:170-172`.

**The port-4321 constraint is real and is not in the specs.** The pin is `supabase/config.toml:158-168` — `site_url` plus an `additional_redirect_urls` allow-list containing only `localhost:4321` / `127.0.0.1:4321` (and two prod hosts). Templates build links from `{{ .SiteURL }}`, and the specs `page.goto()` that absolute link, leaving `baseURL` entirely. Setting `E2E_BASE_URL` to another port breaks both specs. Config reloads only on `supabase stop && supabase start`, never `db reset`.

### 11. Remaining gating observations

- **`signin.ts`, `signout.ts`, `signup.ts` self-gate not at all** — no origin check, no zod; `signin.ts:7-8` casts form values unchecked. Not currently exploitable: Astro 6.3.1 defaults `security.checkOrigin: true`, `astro.config.mjs` sets no `security` key, and `output: "server"` is set, so the framework 403s cross-site form POSTs. The finding is the _dependency_ — an implicit framework default is the sole CSRF protection on login and logout, while all 15 other mutation routes carry their own check, and no test would notice if it changed.
- **No rate limit on the password-update path at all.** `config.toml:195-209` covers `email_sent`, `sms_sent`, `anonymous_users`, `token_refresh`, `sign_in_sign_ups`, `token_verifications`, `web3` — nothing throttles `updateUser({ password })`. Captcha is commented out (`:211-215`). Separately, `sign_in_sign_ups = 30` per IP behind Workers is one bucket shared by the whole tenant, as `change-password.ts:86-88` already notes.
- **`secure_password_change = false`** (`config.toml:232`) — the one server-side knob that would have blocked F1 independently of app code. Flipping it is still the wrong fix: it would demand a `current_password` from recovery and invite, which by definition have none.

**Checked and clean** (negative results worth keeping): no open redirect (`src/lib/safe-redirect.ts:19,25` rejects non-`/`, `//`, `/\`, and any `/auth*` target); no route trusts a client-supplied id or email (`staff/[id]/reset-password.ts:55`, `deactivate.ts:74-80`, `change-password.ts:46-48`); no role check reads a client-controllable value; no path-normalization gap in `matchesPrefix` (trailing slash, case, encoding, `//` all verified); all 15 non-auth API routes self-gate in the required order; `/api/reservations` is anon-reachable by design with origin check + honeypot + zod.

---

## Code References

- `src/pages/api/auth/reset-password.ts:29-33` — the guard whose comment and code disagree (F1)
- `src/pages/api/auth/reset-password.ts:45-50` — `updateUser` then redirect; no role check, no revocation (R1, R2)
- `src/pages/api/auth/change-password.ts:39-107` — the reference gate: CSRF → session → role → zod → reauth → update → revoke
- `src/pages/api/auth/change-password.ts:95` — raw GoTrue English bypasses the `MSG` map (F6, staff screen)
- `src/pages/auth/callback.ts:16,35-39,51` — unguarded GET session installer; `verifyOtp`; the only choke point where a marker could be stamped (R3)
- `src/pages/auth/reset-password.astro:18,31,46-47` — `?done=1` first; form renders on `locals.user` alone
- `src/lib/access.ts:27-45` — `ROUTE_ROLES`: `/dashboard*` only; no `/auth`, no `/api`
- `src/middleware.ts:14-16,42-54` — `getUser()` validation; the single route gate
- `src/lib/supabase.ts:12-26` — `createServerClient` with no `cookieOptions`
- `src/lib/services/staff.ts:255-260,278` — deactivate ordering window; admin-triggered recovery mail
- `supabase/config.toml:158-168,184,190,197,204-207,232,257-263` — redirect allow-list, signup, password policy, rate limits, `secure_password_change`, templates
- `supabase/templates/recovery.html:8`, `invite.html:10` — the `token_hash` links
- `tests/integration/change-password.test.ts:104-210` — every password property the suite asserts, all on the staff-screen route
- `tests/helpers/clients.ts:47`, `tests/helpers/context.ts:72,118` — the harness that can only mint password sessions
- `e2e/staff-auth.spec.ts:39,80` — the two specs that are the real gate

## Architecture Insights

- **The asymmetry is the story.** S-08 built the recovery surface and explicitly deferred in-app password change (`plan.md:44`). S-11 later added it and, having no sibling to match, built it properly. The two routes now encode different security models on the same operation, and the older one is the weaker — while its comment borrows the newer one's guarantee.
- **A claim-reading gate would be an architectural first.** F-02 explicitly rejected JWT custom claims in favour of the `profiles` lookup (`context/archive/2026-06-04-employee-admin-roles/plan.md:45`), and `grep -rn "getSession" src/` is empty. An `amr` gate introduces the first token-claim read in the app. That is not a blocker, but it is a real precedent, and it argues for reading the claim in exactly one helper rather than inline.
- **`callback.ts` is the only choke point.** It is the sole place a recovery/invite session is created, it already computes `invite`, and it already returns a redirect it fully controls. A one-shot marker cookie set there is entirely under our control and depends on no provider behaviour — which is what `context/foundation/lessons.md:97-102` argues for ("prefer an explicit in-app check you can test over a provider flag you cannot see"). `amr` is the cheaper option and is genuinely available; the two are not exclusive, and the lesson's "when both exist, keep the explicit one as defence in depth" applies directly.
- **Fail-closed on absent Origin is already the house pattern** (`change-password.test.ts:185`); a new gate should match, and should return the _designed refusal screen_, not a silent redirect.
- **"Not gated by middleware" is not a bug per se** — middleware runs on `/api/*` and populates `locals`; what is absent is a `ROUTE_ROLES` entry. Adding `/auth/*` to that map would break the flow (an anonymous recovery recipient must reach the page), so the gate belongs in the route, not the map.

## Historical Context (from prior changes)

- `context/archive/2026-07-23-employee-account-management/plan.md:283` — S-08 wrote the conflation into the plan itself: _"Page **requires `locals.user` (the recovery session)**"_. The parenthetical equates "a session exists" with "a recovery session exists"; it propagated into `design-contract.md:380` and then verbatim into the shipped route comment. **A session-origin gate was never considered and rejected — it was never considered at all.**
- `context/archive/2026-06-04-employee-admin-roles/plan.md:45` — F-02: _"No JWT custom-claims / auth-hook — explicitly chosen against in favor of the profiles-table read."_
- `context/changes/staff-account/plan.md:28-30` — S-11's Current State Analysis: _"It does not verify a current password (the recovery/invite link is the proof)."_ This is the premise F1 invalidated.
- `context/changes/staff-account/reviews/impl-review.md:49-62` — S-11 finding F2: the revocation fix, applied to `change-password.ts` only. R1 above is that same defect, unfixed on the sibling route.
- `context/changes/staff-account/follow-ups/review-fixes.md:73-74` — the constraint that makes this non-trivial: _"The invite-acceptance path (`mode=invite`) keeps working — it legitimately has no current password."_
- `context/foundation/known-issues.md` — **no auth entries at all** (four entries, none touching auth/sessions/passwords). If S-14 defers any part of this, that file has no auth section to defer into.
- `context/foundation/lessons.md:97-102` — the governing lesson, written _from_ this surface: prove a security property fails closed against the real backend; assert the negative case in the integration suite.
- Prod rollout constraints for auth email are recorded but thin: `context/archive/2026-07-23-employee-account-management/plan.md:421` and `docs/reference/contract-surfaces.md:43-48` (service-role secret, project SMTP, prod origin in `additional_redirect_urls`); `context/archive/2026-05-29-deployment/deployment-plan.md:101` (Site URL / Redirect URLs, _"otherwise confirmation emails link back to localhost … and the flow silently breaks"_).

**Two doc-accuracy notes.** `context/archive/2026-08-01-testing-quality-gates-wiring/research.md` records CI starting Supabase with `-x …,inbucket`; the current verified CI exclude list keeps the mail service **in**, because the S-08 invite tests use real GoTrue SMTP. And `supabase/config.toml:223-224`'s comment cites "line 171" for the top-level `enable_signup`; the actual line is 184 (171 is `jwt_expiry`).

## Related Research

Neither S-08 nor S-11 has a `research.md` — both were planned straight from `/10x-plan`. Nearest prior art:

- `context/archive/2026-06-30-testing-api-boundary-authz/research.md:41-63` — the authoritative authz model: two-layer `profiles.role`, no JWT/metadata roles, `/api/*` outside the middleware gate, the per-route matrix, and the 401-vs-403 inconsistency
- `context/archive/2026-06-27-rls-auth-initplan/research.md:32-37` — `auth.uid()` / `current_app_role()` inside RLS policies (DB layer; says nothing about session provenance)
- `context/archive/2026-08-01-testing-quality-gates-wiring/research.md:83-86,260-262` — the integration suite's ~80 real `signInWithPassword` calls; in-process email faking
- `context/archive/2026-07-09-issue-protocol/research.md:267-271,311` — workerd/SMTP impossibility; Supabase custom SMTP is auth-emails-only

## Open Questions

1. **Gate design: `amr` claim, a `callback`-stamped one-shot cookie, or both?** The probe makes `amr` viable, so this is now a real choice rather than a blocker. The lesson at `lessons.md:97-102` pushes toward the explicit marker as primary, with `amr` as defence in depth. Either way the gate must read `getSession().access_token` _alongside_ the validating `getUser()` — never alone.
2. **Does the gate expire, and how?** The `otp` mark never clears, so "came from a link" is permanent for the session's life. Options: consume a one-shot cookie on first successful set; check `amr[].timestamp` freshness against `otp_expiry = 3600`; force `signOut` after a successful set (which also fixes R1). Needs a decision, because "gate on `amr` only" leaves a recovery session privileged indefinitely.
3. **What does a refused ordinary session actually see?** R5 "Link wygasł" is the only drawn refusal screen and its copy is wrong for this case. There is **no approved Polish string** for "you are signed in normally — use Zmień hasło instead", and it should link to `/dashboard/account/password`. This is a genuine copy gap, not a translation task; S-08's copy was approved and closed (`design-contract.md:10-13`), so this needs new sign-off.
4. **Do R1/R2/R3 ride along in S-14 or split out?** R1 (revocation) is one line next to the F1 fix and shares its tests. R2 (role check) is one line. R3 (callback session installer) is a different threat model with an insider precondition — arguably its own slice.
5. **Scope check on the reset-route error passthrough.** F6's stated fix is a whitelist per surface, but `change-password.ts:95` and `reset-password.ts:47` forward raw GoTrue text _after_ a successful gate. Whitelisting those means enumerating GoTrue failure codes (`same_password` at minimum) — is that in S-14, or does the slice only whitelist the URL-reflected `?error=` reads?
6. **Copy conflict — REGRESSED 2026-08-12, action needed on BOTH sides.** The design originally specified
   the gender-neutral `Nie pamiętasz hasła?`; the app ships `Zapomniałeś hasła?`
   (`src/components/auth/SignInForm.tsx:116`), which addresses the reader as male. This was reported as a
   divergence and then "fixed" the wrong way: `STR.PL.login.forgot` was changed **to match the app**, so
   both sides now carry the masculine form and the neutral wording is gone.
   **Correct target: `Nie pamiętasz hasła?` in both places** — restore it in the design project and change
   the app. Every other string in `STR.PL.login` matches what ships; this is the block's only divergence.
   **Lesson for the plan:** the "revert design to shipped" rule adopted for the `auth` block does NOT apply
   here — it was scoped to strings where the app was already correct.

---

## Follow-up Research 2026-08-11 — external validation

Checked the proposed remedies against published guidance and against GoTrue's own source, because
several of them are security properties we would otherwise be asserting from first principles.

### Verdicts

| Finding                     | Proposed remedy                               | External verdict                                                                                                                                       |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1 — no revocation on reset | `signOut({ scope: "others" })`                | **Confirmed by standard.** OWASP: _"whenever a successful password reset occurs, all other sessions should be invalidated."_                           |
| F1 — session-origin gate    | app-level gate on the reset route             | **Confirmed as the only available option.** The platform gap is filed upstream and unresolved; a middleware-enforced gate is the community workaround. |
| `amr` as the discriminator  | read `amr[].method === "otp"`                 | **Works, but is coarser than it looks** — see below. Argues for our own marker as primary.                                                             |
| R3 — session fixation       | refuse the link when a session already exists | **Confirmed by standard.** OWASP treats session renewal on privilege change as mandatory.                                                              |
| Cookie posture              | (not previously proposed)                     | **New deviation found** — the `Secure` attribute is absent, which OWASP marks mandatory.                                                               |

### The root cause has a name, and we cannot fully comply

OWASP's Forgot Password cheat sheet: _"Don't automatically log the user in, as this introduces
additional complexity to the authentication and session handling code, and increases the likelihood
of introducing vulnerabilities."_

That is precisely this architecture. `/auth/callback` logs the user in as the _mechanism_ for letting
them set a password, and F1 and R3 are both direct consequences. But **the ideal is not reachable
with GoTrue**: `verifyOtp` mints a full session by design — there is no "verified identity without a
session" mode. So the standard's preferred design is off the table, and the gate + revoke pair are
compensating controls, not the first-choice answer. Worth stating plainly in the plan so a future
reviewer doesn't re-litigate it.

Also from the same sheet, and not currently true of our flow: after a reset the user should be sent
to sign in fresh rather than left holding a live session. Doing that would close F1's residual
window (the `otp` mark never clears) as a side effect.

### This is a known, open platform gap — not a local mistake

`supabase/supabase` issue **#45210**, _"Auth: invite and recovery links create a persistent
authenticated session before password is set"_, reports our exact defect against upstream:

> "The `type=recovery` / `type=invite` marker only exists in the URL **at the moment of the
> callback**. The resulting session carries no marker distinguishing it from a normal login session."

It asks for one of: a **scoped session** (JWT restricted to `updateUser({ password })`), a **deferred
session** (verified identity with no session until the password is set), or a **documented pattern**.
Status: **open, no maintainer response**, labelled for auth. It also notes most adopters find the gap
only after an incident.

Two consequences for the plan: (a) the S-14 gate is the right call and should not wait on upstream;
(b) whatever we build should be easy to retire if GoTrue later ships a scoped session.

### Why `amr` is coarser than the upstream ask — explained by the source

GoTrue's `AuthenticationMethod` enum has **distinct** `Recovery`, `Invite`, `MagicLink`,
`EmailSignup`, `PasswordGrant`, `OTP` and `TokenRefresh` constants
(`supabase/auth`, `internal/models/factor.go`), and the access token carries
`AuthenticationMethodReference` as the `amr` claim (`internal/tokens/service.go`). But the emitted
string collapses the link-borne methods to `"otp"` — which is exactly what the probe observed, and
exactly what #45210 is asking to change (it requests `amr: ["recovery"]`).

So: `amr` is real and usable **today** for password-vs-link, its value is a coarsening of information
GoTrue already holds, and upstream intends to make it more specific. That is a good reason to treat
`amr` as **defence in depth** behind our own `/auth/callback` marker rather than as the primary gate —
the marker is stable and ours; the claim's granularity is in flux. Consistent with
`context/foundation/lessons.md:97-102`.

Note also `AuthenticationMethod.TokenRefresh` exists as a distinct method — consistent with the probe
finding that a refresh preserves the original entry rather than replacing it, but a reason to assert
the refresh-survival property in a test rather than trust it.

### R3 — the standard backs the simpler fix

OWASP Session Management cheat sheet: _"The session ID must be renewed or regenerated by the web
application after any privilege level change within the associated user session"_ — described as
mandatory to prevent session fixation. And: _"If a user submits a session ID through a different
exchange mechanism, such as a URL parameter, the web application should avoid accepting it as part of
a defensive strategy to stop session fixation."_

One precision worth recording so this isn't over-applied: our `?token_hash=` is **not** a session ID
in a URL. It is a single-use credential _exchanged_ for a freshly minted session, which is the
pattern the Forgot Password sheet itself endorses. What we actually violate is the first sentence —
we let a link change who the session belongs to without renewal or consent. **Refusing the link
whenever a session already exists satisfies the standard directly**, and is simpler than the
POST-interstitial design first sketched here (that design is withdrawn).

### New deviation: the `Secure` cookie attribute is absent

OWASP marks both `Secure` and `HttpOnly` mandatory. `src/lib/supabase.ts:12` passes no
`cookieOptions`, so `@supabase/ssr`'s defaults apply — and `DEFAULT_COOKIE_OPTIONS`
(`node_modules/@supabase/ssr/dist/main/utils/constants.js`) contains **no `secure` key at all**,
so the attribute is never emitted.

- `httpOnly: false` is a **knowing product trade** (`src/components/protocol/storage.ts:15-19` — the
  browser client reads the JWT for Storage uploads). Leave it; note the deviation.
- **`secure` is not a trade — it is an unset default**, and it is cheap to fix. Caveat for the
  implementer: set it per-environment, since local dev runs over `http://localhost`.
- The 400-day `maxAge` also sits well outside any session-timeout guidance and compounds R1.

### Recalibrations to the body of this document

- **R2 severity: MEDIUM-HIGH → MEDIUM.** Re-read of `src/lib/services/staff.ts:251-261` confirms the
  ordering window is real, but a `role = null` bearer gains only the ability to set a password on an
  account they already hold — every consequential surface refuses them. The value of the fix is
  consistency (this is the one authenticated route that never asks who you're allowed to be), not
  blast radius. **Implementation caveat**: verify whether an invited hire's profile row exists with a
  role _at the moment they accept_, or the check locks every new hire out of their first password —
  the failure mode `context/foundation/roadmap.md:358-360` warns about.
- **R3 fix design: revised, and the split recommendation reversed.** The POST-interstitial is
  withdrawn. The fix is a guard clause in `callback.ts` — if `locals.user` exists, do not exchange and
  do not consume the token; render a refusal that names the signed-in account and offers sign-out
  (_"Jesteś zalogowany jako …; wyloguj się, aby użyć tego linku"_). The legitimate cases this must
  serve are real: a signed-in staffer clicking their own recovery link (they cannot use the staff
  screen — it demands the current password they've forgotten), and a shared rental-desk workstation
  where a new hire opens their invite in a colleague's session. Silent ignoring breaks both with no
  explanation. At this size R3 can ride along with S-14 rather than becoming its own slice; it needs
  only new Polish copy for the refusal screen.
- **Cheap mitigation for the irreducible branch.** When no session exists, the token _is_ the
  credential and must be honoured — server-side, "Anna clicked her own link" and "Anna clicked
  Bartek's link" are identical requests. Nothing can separate them. `src/pages/auth/reset-password.astro`
  currently never shows **whose** account is being set; printing the target email there is a one-line
  mitigation that lets the human catch what the server cannot.

### Two surface findings from manual prod checking (2026-08-11, user)

1. **`/auth/reset-password` tells a cold visitor their link expired.** `src/pages/auth/reset-password.astro:31`
   branches on `!user` → the R5 "Link wygasł / Linki resetujące są ważne 60 minut" screen. Someone who
   simply navigates there never had a link, so the page asserts a false history. Not a security issue;
   it is a **copy gap in the same state machine S-14 is already reopening** — the page will now need
   four states (done / no-link-no-session / signed-in-refusal / the form), not three. Fold into the
   same copy round as the R3 refusal screen. _(Screenshot pending from the user — if the observed
   render was anything other than R5, re-open this.)_
2. **No custom 404 page exists anywhere in the app.** `src/pages/404.astro` is absent, so every bad URL
   serves Astro's unstyled default — this is what `https://wujcar.com/auth` returns (there is also no
   `src/pages/auth/index.astro`, which is correct in itself). **Out of scope for S-14**: it is a public-shell
   polish item needing its own design + Polish copy, and folding it into an auth-hardening slice would
   bury it. User is commissioning layouts from Claude Design; track as its own change. A one-line
   `/auth` → `/auth/signin` redirect may ride along with S-14.

### Planning consequence: S-14 is now a UI-touching slice

R3's refusal screen plus the copy gap above mean this slice creates user-facing surface, so
`/10x-plan`'s terminal **Design Alignment Audit** applies (`context/foundation/lessons.md:82-88`) and
planning cannot close without canonical screenshots + verbatim Polish copy. Surfaces needing design:
the signed-in refusal state, the no-link/no-session state, and (optional) the target-email line on the
set-password screen. All should match the existing auth card shell
(`context/archive/2026-07-23-employee-account-management/design-contract.md:329-345`).

### Canonical Polish copy for the new screens (pulled from the live design project)

Source: `shared.jsx` → `STR.PL.auth` in Claude Design project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`), consumed by `password-reset.jsx` via `useLang()`.
Mockups: `design-review/auth-{authed,authed-busy,inapp,nolink}-{d,m}.png`, indexed in
`design-review/index.md`.

**New strings — port these verbatim:**

| Key           | Polish                                                                                                                                     | Used by                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `authedTitle` | `Ta przeglądarka jest już zalogowana`                                                                                                      | R11                                 |
| `authedSub`   | `Ten link otworzył się w przeglądarce, gdzie zalogowane jest inne konto. Najpierw wyloguj się, a potem otwórz link ponownie z wiadomości.` | R11                                 |
| `authedAs`    | `Zalogowano jako`                                                                                                                          | R11, R12 (account box label)        |
| `signOut`     | `Wyloguj się`                                                                                                                              | R11 button                          |
| `signingOut`  | `Wylogowywanie…`                                                                                                                           | R11 pending state                   |
| `inAppTitle`  | `Zmień hasło w ustawieniach`                                                                                                               | R12                                 |
| `inAppSub`    | `Ta sesja jest aktywna, więc nie ma tu linku do resetu. Otwórz Konto → „Zmień hasło" — najpierw potwierdzisz obecne hasło.`                | R12                                 |
| `inAppCta`    | `Przejdź do ustawień konta`                                                                                                                | R12 button                          |
| `noLinkTitle` | `Nie ma tu nic do ustawienia`                                                                                                              | R13                                 |
| `noLinkSub`   | `Aby ustawić hasło, potrzebujesz linku do resetu. Poproś o niego, a wyślemy go e-mailem.`                                                  | R13                                 |
| `noLinkCta`   | `Poproś o link do resetu`                                                                                                                  | R13 button                          |
| `setFor`      | `Ustawiasz hasło dla`                                                                                                                      | account box on R3/R9 **and** R6/R10 |

Note `inAppSub` uses Polish typographic quotes `„…"` around _Zmień hasło_ — keep them; they are not ASCII `"`.

**⚠ The design project's copy for the EXISTING screens has drifted from what ships.** Several
strings differ from both the shipped app and the approved S-08 contract
(`context/archive/2026-07-23-employee-account-management/design-contract.md:547-576`), e.g.
`sentTitle` `Sprawdź skrzynkę` → `Sprawdź e-mail`; `forgotSubmit` `Wyślij link resetujący` →
`Wyślij link`; `email` `E-mail służbowy` → `Służbowy e-mail`; `openMail` `Otwórz aplikację e-mail`
→ `Otwórz pocztę`; plus reworded `forgotSub`, `sentSub`, `setSub`, `expiredSub`, `inviteSub`.

**Recommendation: adopt ONLY the twelve new strings above.** Porting the refreshed set would reword
five already-shipped screens that S-14 has no business touching, widening the diff and re-opening
copy that `design-contract.md:10-13` recorded as approved and closed. If the reword is wanted, it is
its own change. Decision needed before the plan's Design Alignment Audit closes.

**Three copy defects to raise with design rather than port:**

1. **`inviteKick: 'Witaj w Flota'` is ungrammatical.** Polish requires the locative after `w` — the
   approved contract says `WITAJ W FLOCIE` (`design-contract.md:573`) and the shipped
   `ResetPasswordForm` renders `Witaj w Flocie`. The design file is the outlier; **do not port it**.
2. **Gendered copy.** `authedTitle` / `inAppSub` use `zalogowany` and `inviteSub` now reads
   `Zostałeś zaproszony` — both masculine, addressed to staff of any gender. The previous
   `inviteSub` (`Masz zaproszenie do zespołu dyspozytorni`) was gender-neutral and is the better
   pattern. Neutral rephrasings exist for the others (e.g. addressing the session/device rather than
   the person). Worth fixing at source so the neutral form is canonical.
3. **`passPh` / `rule1` say `Co najmniej 10 znaków`** while the enforced minimum is
   `minimum_password_length = 6` (`supabase/config.toml:190`). This is a **known, deliberate
   deviation** (S-08 `design-contract.md:592-594`, deviation 7) — the checklist is illustrative UI
   only. Do NOT tighten the zod schema to match it.

### ✅ All copy issues above were RESOLVED in the design project (2026-08-11)

The three defects and the drift are **fixed at source** — verified by re-reading `shared.jsx` →
`STR.PL.auth`. The paragraphs above are kept as the record of what was decided and why; the current
canonical values are the ones in the table, plus:

- `inviteKick` is now **`Witaj we Flocie`** (was the ungrammatical `Witaj w Flota`). Note the euphonic
  **`we`** — this supersedes the shipped `Witaj w Flocie` at `src/components/auth/ResetPasswordForm.tsx:57`,
  so **S-14 must update that string in code**. It is one of two places where design leads and the app follows.
- The second: `src/components/auth/SignInForm.tsx:116` ships `Zapomniałeś hasła?` (masculine). The neutral
  **`Nie pamiętasz hasła?`** is the correct target, but as of 2026-08-12 the design project was edited to
  match the app instead, so **both sides now need changing** — see Open Question 6. Same one-line-edit
  shape as the eyebrow; both belong in S-14 since it already touches this surface.
- All three gendered strings are neutral: `inviteSub` restored to `Masz zaproszenie do zespołu
dyspozytorni…`, `authedTitle` → `Ta przeglądarka jest już zalogowana`, `inAppSub` → `Ta sesja jest
aktywna, …`. The entire PL auth block is now gender-neutral; keep it that way for new copy.
- All seven drifted strings were reverted to the shipped wording, so design and app agree again. No
  app-side change needed for those.

**R2/R8 („Sprawdź skrzynkę") was also restructured**: the account box, `Otwórz aplikację e-mail` and
`Wyślij link ponownie` were removed from `AuthCard mode="sent"`, and the `openMail` / `sentResend` keys
deleted. Those three affordances all required the submitted email address, which the screen cannot have —
`POST /api/auth/forgot-password:31` redirects with only `?sent=1`, and carrying the address would mean a
staff email in the URL (history, logs, referrers) or the flash cookie S-11 rejected. The mockup now
matches the app. Also added upstream: a `forceBusy` prop + `ScreenAuthAuthedBusyD` artboard, so R11's
pending state is a deterministic capture rather than a timed click.

**Outstanding (design side):** the copy change touches visible text on seven screens — forgot, sent, set,
invite, expired, authed (+busy), inapp — so their PNGs need re-exporting. `success` and `nolink` are
unaffected. Export freshness cannot be verified through `list_files` (filenames unchanged, no
timestamps), so confirm before relying on any of them at the vision-diff gate.

### Sources

- OWASP Forgot Password Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP WSTG, Testing for Weak Password Change or Reset Functionalities — https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/09-Testing_for_Weak_Password_Change_or_Reset_Functionalities
- supabase/supabase issue #45210 — https://github.com/supabase/supabase/issues/45210
- GoTrue source (`supabase/auth`): `internal/models/factor.go`, `internal/models/amr.go`, `internal/tokens/service.go` — via Context7
