---
change_id: invite-journey-fixes
title: Invite journey fixes — provisioning rollback and link-conflict continue flow
status: new
created: 2026-08-18
updated: 2026-08-18
archived_at: null
---

## Notes

Two bugs in the **invited-hire journey**, both surfaced after S-14 shipped. Independent of each
other; either can ship alone. Full write-ups (with contracts) live at
`context/archive/2026-08-17-auth-followups/follow-ups/review-fixes.md` — **that folder is
archived and read-only**, so copy what this change needs rather than planning against it.

### Bug 1 — a failed `profiles` insert leaves an invited hire permanently role-less

`src/lib/services/staff.ts:192-205` sends the GoTrue invite first and inserts the `profiles`
row second. If the insert fails, `:204` throws and **nothing rolls back the invite** — the mail
is already delivered. That hire keeps an `auth.users` row with no `profiles` row, so
`middleware.ts:36` resolves their role to `null` forever. Consequences: their live invite link
renders "Konto jest nieaktywne" (told they were deactivated, having never been activated), every
`/dashboard` route answers a bare `Forbidden`, and they never appear on the roster — so an admin
can't see or repair the half-created account, because re-adding the address hits the `existing`
branch at `staff.ts:186` instead of the net-new one.

**Needs a product decision before planning.** Three options, not equivalent:

1. **Compensating `deleteUser`** in the insert's failure path — simplest, but the invite mail is
   already delivered and its link would then 404 rather than explain anything.
2. **Insert the profile first, then invite** — reverses the exposure into one an admin _can_ see
   and retry (a profile with no auth user shows on the roster).
3. **A transactional RPC / trigger doing both** — the only genuinely atomic option, and the only
   one that also closes the race window the new "Konto jest nieaktywne" card knowingly accepts.

### Bug 2 — `/auth/link-conflict` misreads your own half-finished link session

**Verified on production 2026-08-18**, not inferred. An invited hire opens their invite link;
`/auth/callback` runs `verifyOtp`, which **consumes the token as the set-password form renders**,
not on submit. They close the window without setting a password. Both the session (`amr` = `otp`)
and `flota-link-origin` (maxAge 3600) persist. They reopen the link — `callback.ts:30` sees
`locals.user` and routes them to `/auth/link-conflict`, which says a **different** account is
signed in (the `AccountBox` beneath prints their own address) and tells them to sign out. The
token is spent, so signing out strands them: reopening answers "Link wygasł", and their only
route back is `forgot-password`, which sends a _recovery_ link — so they finish through reset
copy and never see the invite welcome.

They are one navigation from finishing: `/auth/reset-password` still renders the invite form
from that exact state — **confirmed manually on production**. The page never offers it.

Fix shape: branch the page on whether the session in the way is _itself_ a link session
(`readSessionOrigin(...) === "link"`, or the presence of `LINK_ORIGIN_COOKIE`). When it is,
render a continue card (primary → `/auth/reset-password`) and demote `SignOutButton`, with copy
that does not promise the link will work again. Leave the existing card for the genuine-conflict
case. Same shape as the role-gate card in `auth-followups` Phase 1.

User-facing, and there is **no artboard** — so it needs a `design-contract.md` deviation entry
and Polish copy in §9, per the project's design rule. Model on entry 14 of
`context/archive/2026-08-11-auth-surface-hardening/design-contract.md`.

### Operational constraints

- **e2e for bug 2 must run on `:4321`** — GoTrue's allow-list pins emailed links to that port and
  ignores `E2E_BASE_URL`. Fixtures already exist: `inviteCallbackLink` in `e2e/fixtures/staff.ts`,
  and the "refused, not consumed" tests in `e2e/auth-hardening.spec.ts` are the pattern to model.
- Four worktrees share one local Supabase stack — a `db reset` in a sibling drops migrations from
  the others.
- Neither bug is reachable at the integration layer; there is no harness that renders an `.astro`
  page under Vitest.
