# S-14 implementation-review follow-ups

Queued from the full-plan review on 2026-08-17 (`reviews/impl-review.md`). Each entry is
sized as a phase for `/10x-implement`. Nothing here blocks archiving the slice — the
security objective was met and verified behaviourally (an ordinary password session
POSTing `/api/auth/reset-password` gets 403 and the stored password is unchanged).

Findings fixed during triage and already committed are **not** listed here: F2 (marker
`maxAge` 900 → 3600), F4 (third success card → `AuthPrimaryLink` + `StatusHead`), F8 and
F9 (comment corrections).

---

## 1. Mirror the route's role gate on `/auth/reset-password` (F1)

**Severity**: WARNING · **Files**: `src/pages/auth/reset-password.astro`

The page's own comment promises "The page's refusals mirror the route's gate … so a
rejection is explained here rather than surfacing as a bare 403." It mirrors four of the
five gates — session, origin, marker, done — but **not** (c) role. There is no
`Astro.locals.role` read on the page at all.

Most reachable path is a **deactivated** staffer, not the new-hire race:
`src/middleware.ts:30` resolves a profile with `deactivated_at` set to `role = null`, and
`src/pages/api/auth/forgot-password.ts` sends a reset link to any valid address — it must,
because it deliberately never reveals whether an account exists. So a removed employee
requests a reset, gets the mail, reaches the full "Ustaw hasło" form, types a password,
submits, and receives an unstyled `Forbidden` from `reset-password.ts:75-77`. The route's
403 is correct and asserted (`tests/integration/reset-password.test.ts:196-206`); what is
missing is the screen that explains it.

**Change**: add a role branch between the `origin !== "link"` and `!mode` branches, using
the existing `StatusHead` / `AuthPrimaryLink` card idiom.

**Open question for the copy**: neutral ("skontaktuj się z administratorem") vs. explicitly
naming the deactivation. Needs a design-contract line either way.

---

## 2. Derive the marker's _value_ from the exchange, not the query string (F3)

**Severity**: OBSERVATION · **Files**: `src/pages/auth/callback.ts`, `src/pages/auth/reset-password.astro`

`callback.ts:43` builds `invite` from `?flow` / `?type`, independent of what the token
actually verified as, then stamps that into the marker at `:75`. Appending `&flow=invite`
to a genuine recovery link therefore stamps `flota-link-origin=invite` and the page renders
the invite variant ("Witaj we Flocie", "Aktywuj konto") for what is really a password reset.

Impact is **cosmetic** — the security-relevant bit (link vs. not-link) is genuinely
cookie-and-JWT derived, and the gate does not read the value. But
`reset-password.astro:41-42` claims `mode` comes "from the marker cookie the callback
stamped — NOT from the query string, which any link can set", which overstates it: the
marker's _presence_ is unforgeable by URL, its _value_ is not.

**Change**: derive `invite` from the `verifyOtp` / `exchangeCodeForSession` result, or —
if that is not cleanly available — soften the comment to say presence, not value, is the
trusted part.

---

## 3. Code hygiene: body guard, import headers, cookie test double (F5, F6, F7)

**Severity**: OBSERVATION ×3 · One phase, three independent edits.

**F5 — `src/pages/api/auth/signin.ts:8-10`** is the only auth handler with an unguarded
body read:

```ts
const form = await context.request.formData(); // no try/catch
const email = form.get("email") as string; // can be null; the cast is a lie
const password = form.get("password") as string;
```

A malformed body 500s instead of landing on the designed `generic` error, and two `null`s
reach `signInWithPassword`. Both siblings handle it (`reset-password.ts:96-101`,
`change-password.ts:61-67`). **Change**: mirror the sibling shape — try/catch →
`back("generic")`, and `?? ""` instead of the cast.

**F6 — import-order headers.** Five new `.astro` files omit CLAUDE.md's
`// core` / `// components` / `// others` headers: `src/pages/auth/link-conflict.astro` and
`src/components/auth/{StatusHead,AccountBox,AuthBackLink,AuthPrimaryLink}.astro`. Same at
`src/pages/api/auth/signin.ts` and `signout.ts`, both of which gained imports in this slice.
Context: all 12 non-conforming files repo-wide are in the auth surface, and
`src/pages/dashboard/account/password.astro` one directory over conforms — so this is new
code inheriting a local pocket's drift rather than the project convention. **Change**: add
the headers to the five new files. The pre-existing ones are a separate cleanup.

**F7 — `tests/helpers/context.ts:78-99`.** The cookie double discards its options argument:

```ts
set: (key: string, value: string) => { jar.set(key, value); },
delete: (key: string) => { jar.delete(key); },
```

So `path` — called "load-bearing" at `auth-session.ts:44-46` — and `secure`, which has an
entire module and test file devoted to it, cannot be asserted at the integration level.
Mitigated in practice because `e2e/staff-auth.spec.ts` drives the real flow through a real
browser, which would catch a wrong `path`. **Change**: store `{ value, options }` in the jar
so a future assertion is possible without a rewrite.

---

## Not queued — recorded here so it isn't lost

**F10 — `/api/auth/signout` signs out at GLOBAL scope.** `supabase.auth.signOut()` is called
with no argument, and supabase-js defaults to `{ scope: 'global' }` (verified in
`node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:3173`). So a staffer signing out
of one browser revokes their session on **every** device. This is pre-existing behaviour,
outside S-14's scope, and it is currently written down only in `e2e/e2e-rules.md:73-82` as a
_test_ hazard — the reason Phase 2's spec uses a fresh browser context instead of clicking
the sign-out button. It may well be intended for a shared rental-desk workstation; the point
is that nothing records it as a **product** decision. Skipped at triage on 2026-08-17.
