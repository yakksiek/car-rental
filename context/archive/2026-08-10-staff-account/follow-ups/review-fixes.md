# Follow-ups from the S-11 implementation review (2026-08-10)

Two findings from `/10x-impl-review staff-account` were triaged as **out of scope for the
S-11 PR** and routed to their own roadmap slice. Both live on the **S-08 auth surface**,
which S-11 only consumes — neither is a regression introduced by `feature/staff-account`.

They are written up together because they share one file set, one test surface (the
invite/recovery e2e specs), and one round of validation. Split them if F1 needs to ship
sooner than F6.

---

## F1 — `/auth/reset-password` changes any signed-in user's password without the current one

**Severity: CRITICAL. Reproduced end-to-end on 2026-08-10 against local Supabase.**

### What happens

`src/pages/api/auth/reset-password.ts:29-33` guards the set-password call with:

```ts
// The recovery session must exist (set by the callback exchange). If it is
// gone, the link expired → the R5 screen.
if (!context.locals.user || !context.locals.supabase) {
  return context.redirect("/auth/reset-password");
}
```

The comment states the intent correctly; the code does not implement it. `locals.user` is
truthy for **any** authenticated session — nothing distinguishes a session minted by
`/auth/callback`'s recovery-code exchange from one minted by an ordinary
`signInWithPassword`. `src/pages/api/auth/reset-password.ts:45` then calls
`updateUser({ password })` unconditionally.

The page is reachable to match: `/auth/*` has no entry in `ROUTE_ROLES`
(`src/lib/access.ts:27-45`), so middleware never gates it, and
`src/pages/auth/reset-password.astro:31,46-47` renders the set-password form to any
logged-in visitor. `supabase/config.toml:232` has `secure_password_change = false`, so
GoTrue imposes no reauthentication of its own.

### Reproduction

Ordinary password sign-in, then one POST. No recovery link is involved at any point:

```
1. POST /api/auth/signin           (email + password)  -> 302 /dashboard
2. POST /api/auth/reset-password   (password, confirm) -> 302 /auth/reset-password?done=1
3. new password signs in: true     old password signs in: false
```

In a browser it is: sign in normally → navigate to `/auth/reset-password` → type a new
password twice → submit.

### Why it matters

This is the exact threat `src/pages/api/auth/change-password.ts:8-11` was written to
defend against — "someone who walked up to an unlocked session". S-11 spent a whole phase
on a reauthenticate-before-update endpoint, and that gate is bypassable in two clicks via
a sibling route. The S-11 integration suite's "password left unchanged on a wrong current
password" property is real, but it holds **only for `/api/auth/change-password`**.

It also invalidates a premise written into the S-11 plan's Current State Analysis — _"It
does not verify a current password (the recovery/invite link is the proof)"_. Nothing
verifies that a recovery link was ever involved.

### What "done" looks like

- A session's **origin** is asserted before `/api/auth/reset-password` will set a password —
  not merely that a session exists. Candidates: read the AMR claim from the JWT
  (`amr` contains `recovery`/`otp` for a link-exchanged session), or have `/auth/callback`
  stamp a short-lived one-shot marker the reset route consumes.
- `/auth/reset-password` (page + endpoint) refuses an ordinary password session, and says so.
- The invite-acceptance path (`mode=invite`) keeps working — it legitimately has no current
  password. This is the constraint that makes the fix non-trivial.
- Regression cover: extend `tests/integration/` with a case proving an ordinary
  password session **cannot** drive `/api/auth/reset-password`, plus the existing
  `e2e/staff-auth.spec.ts` invite + recovery specs still green.

### Known unknowns

- Whether local GoTrue populates `amr` usefully for the recovery exchange — needs a probe.
- Whether flipping `secure_password_change = true` is a viable alternative. It is
  **probably not**: it would force a `current_password` on the recovery and invite flows,
  which by definition don't have one. Verified separately that `current_password` is a
  silent no-op while that flag is `false` (see the lesson below).

---

## F6 — `?error=` is attacker-controlled and rendered verbatim in an app alert

**Severity: WARNING. Not XSS — both escaping hops verified.**

### What happens

Every auth surface reflects an error message through the query string and renders it
without validating that the app produced it:

- `src/pages/dashboard/account/password.astro:16` → `ChangePasswordForm` → `ServerError`
- `src/pages/auth/reset-password.astro:12`
- `src/pages/api/auth/signin.ts:16` (`back()`)

So `…/dashboard/account/password?error=<any text>` renders that text inside the styled
destructive alert, on a legitimate authenticated URL, with correct branding.

**No script executes** — Astro escapes island props and React escapes the text child;
`?error=<b>x</b>` renders as literal characters. The risk is **content injection**: a
phishing lure ("Twoje konto zostało zablokowane, zadzwoń pod…") delivered on the real
domain, on a real page of the app, is far more credible than the same text in an email.

Second-order, and reachable without an attacker: the endpoints forward Supabase's raw
`error.message`, so reusing your current password shows _"New password should be different
from the old password."_ — English copy in an all-Polish product. GoTrue returns
`code: "same_password"`, `status: 422` for that case (probe-verified 2026-08-10).

### Why it matters

`ServerError`'s entire visual job is to assert "the application is telling you this". Any
stranger with a link can put words in the application's mouth. The fix is small; the
reason it is a slice rather than a one-line patch is that it should be applied to all
four auth surfaces at once, and two of them sit on the invite/recovery flows that need
their e2e specs re-run.

### What "done" looks like

- Each surface renders `?error` **only** when it matches a known message key; anything
  else renders nothing (or a generic fallback).
- The known set is Polish and lives next to the route that produces it — the `MSG` map at
  `src/pages/api/auth/change-password.ts:30-34` is the pattern to extend.
- `same_password` gets real Polish copy instead of passing GoTrue's English through.
- Applied consistently to `/dashboard/account/password`, `/auth/signin`,
  `/auth/reset-password`, `/auth/forgot-password`.

### Alternative considered

A one-shot flash cookie removes the parameter entirely and makes the message unforgeable
rather than merely unrecognised. Rejected as the default because it diverges from the
Post/Redirect/Get shape every auth route in this app uses; worth revisiting if a third
surface needs it.

---

## Also worth recording as a lesson (not yet written to `lessons.md`)

**`current_password` on `updateUser` is a silent no-op unless `secure_password_change` is
enabled.** Probe-verified against local GoTrue on 2026-08-10: calling
`updateUser({ password, current_password: "<wrong>" })` with
`supabase/config.toml:232 secure_password_change = false` returned **no error and changed
the password anyway**. The parameter is present in the `@supabase/auth-js` types
(`UserAttributes.current_password`), so it type-checks and reads as a verification — which
makes it a trap: adopting it as a "safer" replacement for an explicit
`signInWithPassword` reauth silently removes the verification. This nearly shipped during
the S-11 review.
