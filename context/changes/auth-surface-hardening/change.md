---
change_id: auth-surface-hardening
title: Gate the recovery set-password route and whitelist auth error messages
status: implementing
created: 2026-08-11
updated: 2026-08-14
archived_at: null
---

## Notes

Roadmap slice **S-14** (`context/foundation/roadmap.md`). Both findings come from the
S-11 implementation review — full problem statement, evidence and a scripted
reproduction live at `context/changes/staff-account/follow-ups/review-fixes.md`.

**F1 (critical, reproduced 2026-08-10).** `/api/auth/reset-password` sets a password for
**any** authenticated session. Its guard checks only `!locals.user`, which is true for an
ordinary `signInWithPassword` session — nothing asserts the session came from
`/auth/callback`'s recovery/invite exchange. `/auth/*` is absent from `ROUTE_ROLES`, so
`reset-password.astro` renders the form to any logged-in visitor, and
`supabase/config.toml:232` has `secure_password_change = false` so GoTrue adds no
reauthentication of its own. Reproduction: normal sign-in → one POST to
`/api/auth/reset-password` → `302 ?done=1`, new password works, old one doesn't. This
bypasses the reauthenticate-before-update gate S-11 built at
`src/pages/api/auth/change-password.ts`.

**F6 (warning).** `?error=` is reflected verbatim into `ServerError`'s styled alert on
four auth surfaces, so any link can put arbitrary text in the app's mouth on a legitimate
authenticated URL. Not XSS — both escaping hops verified — but a ready-made phishing lure.
It also passes GoTrue's raw English strings into an all-Polish UI (`same_password`,
status 422).

**Validation constraint — read before running the e2e gate.** The real gate is
`e2e/staff-auth.spec.ts`'s invite-accept and forgot-password specs, and they only work with
this worktree's dev server on **port 4321**: `additional_redirect_urls` allow-lists only
`localhost:4321`, so GoTrue discards a `redirectTo` on any other port and falls back to
`site_url` — the emailed link then points at whatever else is serving 4321. Those specs
also fail identically at `963990d` (pre-S-11), so a red run there is not a regression.

**Open questions for research:** whether local GoTrue populates the JWT `amr` claim
usefully for the recovery exchange, or whether `/auth/callback` must stamp its own
one-shot marker; and whether the invite path (`mode=invite`) can share the same gate given
it legitimately has no current password.
