---
change_id: invite-journey-fixes
title: Invite journey fixes — provisioning rollback and deferred link exchange
status: implementing
created: 2026-08-18
updated: 2026-08-24
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

> **Corrected by research (2026-08-18) — do not plan against the last clause.** The `existing`
> branch **is** the repair path (`staff.ts:162-183`, shipped `00863c8` 2026-07-23): it upserts the
> profile, unbans, and returns `reactivated`. Reproduced by hand 2026-08-20. What survives is
> **invisibility, not irreparability** — the orphan can't be discovered, and the admin's banner
> blames the network. See `research.md` §1.2–1.3.

**Needs a product decision before planning.** The original three options, as re-scored by research:

1. **Compensating `deleteUser`** in the insert's failure path — simplest, but the invite mail is
   already delivered and its link would then 404 rather than explain anything. _Viable; pair it with
   a distinguishable admin-facing error (research's "Option 4"), which is the higher-value half._
2. **Insert the profile first, then invite** — ~~reverses the exposure into one an admin _can_ see
   and retry (a profile with no auth user shows on the roster)~~. **Not implementable as written**:
   `profiles.user_id` is PK **and** FK to `auth.users(id)`, and `list_staff` INNER-joins, so the
   claimed roster benefit doesn't exist either. Survives only as **2a** — `generateLink` (no mail) →
   insert → then send our own mail. See `research.md` §1.4.
3. **A transactional RPC / trigger doing both** — ~~the only genuinely atomic option~~. **Closed on
   evidence.** The RPC form is not constructible (no HTTP extension; GoTrue is a separate service),
   and the trigger form reverses the stated fail-closed invariant at
   `20260604153139_employee_admin_roles.sql:22-24`. See `research.md` §1.4.

**Also in Bug 1's scope, confirmed by probe 2026-08-20:** GoTrue stamps `last_sign_in_at` on the
`verifyOtp` link exchange, so `staff.ts:180`'s `wasActive` reads a hire who merely _clicked_ their
link as already having a password. The repair path then sends them nothing and lists them
**AKTYWNY**. Not orphan-specific. `staff.ts:180-183` must key off password-set. `research.md` §1.5(a).

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

> **The continue card is DROPPED (decision 2026-08-20) — do not build it.** The two paragraphs above
> describe it; they are kept as the record of an option considered and rejected, not as scope. Phase
> group B (option C, below) fixes this bug by making the link idempotent, so the state the card
> explains becomes unreachable and the card would be deleted work. Its design-contract entry, its
> Polish copy, and the `SignOutButton` demotion all fall away with it. **The bug itself is not
> dropped** — its scenario becomes phase group B's acceptance test. If B is later abandoned, the card
> is the fallback and `research.md` Part 2 still carries its full contract.

> **Corrected by research (2026-08-18).** The predicate above is offered as
> `readSessionOrigin(...) === "link"` _or equivalently_ the marker cookie. **They are not
> equivalent** — origin outlives the marker (>1h), and the marker outlives the origin (signout never
> deletes it). The predicate must be the **conjunction**, plus `requireRole(..., "employee")` as a
> third conjunct. Also: "demote `SignOutButton`, no new component" is understated — `SignOutButton`
> takes no props and `SubmitButton` hard-codes the primary style. See `research.md` §2.1, §2.5.

### Scope decision (2026-08-20) — one change, two phase groups

Both bugs share one root: **an irreversible act happens before the thing it commits to is done.**
Bug 1 sends the mail before the profile lands; Bug 2 spends the token when the form _renders_
rather than when the password is _submitted_.

A third instance was measured on 2026-08-20 (curl against local, fully provisioned invited hire,
password never set): `GET /auth/callback` → `GET /dashboard` answers **200** (`<title>Pulpit —
Flota</title>`), `/dashboard/reservations` 200, `/dashboard/staff` 403. **Clicking the invite link
alone grants a working employee session.** The roster still labels that person ZAPROSZONY — so it
misreports in both directions (see §1.5(a) for the AKTYWNY case).

That points at **option C — defer the exchange to submit-time**: `/auth/callback` validates and
stamps a short-lived httpOnly cookie carrying `token_hash` + `type` but does **not** call
`verifyOtp`; the POST does `verifyOtp` + set-password as one operation. The link becomes idempotent,
so **Bug 2 stops existing rather than getting a continue card**, and no session is minted until a
password exists.

**Decision (owner, 2026-08-20): both bugs stay in THIS change, planned as two phase groups. The
continue card is dropped; option C replaces it.**

- **Phase group A — Bug 1.** Compensating `deleteUser`, a distinguishable admin-facing error (the
  legibility fix, which is the higher-value half), `staff.ts:180` off `last_sign_in_at`, the
  swallowed `resetPasswordForEmail` error, plus the missing unit + orphan-shape integration tests.
- **Phase group B — option C.** Defer the exchange to submit-time. Fixes Bug 2 and the
  password-less-session finding above, and carries the deletion inventory (`research.md` §5.3–5.4).

**Hard rule for the plan: A must not depend on B.** A is a service-layer bugfix; B is a redesign of
an auth surface hardened in S-14 and reviewed twice. A ships and merges on its own, so if B turns out
worse than it looks once planned, it can be dropped without stranding A.

_Why one change rather than two_ — an earlier draft here proposed C as a separate slice, on the
grounds that its risk profile differs. Rejected: this change's own research is the input C needs, and
splitting would archive that research first, leaving C to plan against a read-only archived folder —
the exact friction recorded at the top of these notes. Risk isolation is a **phasing** concern, and
phases already provide it (cf. `auth-followups` Phase 1). Both bugs also share one root, so the
change boundary should follow that seam rather than cut across it.

**C's known costs — decide these in phase group B** (`research.md` §5):

- The **role refusal (R14 "Konto jest nieaktywne") can no longer run before the form**. The link
  carries only `token_hash` + `type` — no identity — so with no exchange on GET there is no
  `locals.user` and no role to check. It moves after the exchange, where the token is already spent.
  Tolerable for that population (they are meant to be stopped), but it is a real trade against the
  screen `auth-followups` Phase 1 just built.
- Conflict handling shrinks but does not vanish — `verifyOtp` at POST still replaces a signed-in
  colleague's session on a shared workstation.
- The `?code=` PKCE arm needs a keep-or-drop decision; our own templates never use it.

**Removal discipline — a hard requirement of phase group B.** C obsoletes machinery that exists only
to compensate for the current timing. Leaving it half-present is worse than either design. The
plan must carry an explicit deletion inventory with a verified-dead check per symbol; the
evidence-based inventory (every call site, and — importantly — what must **not** be deleted, such
as `shouldSecureCookies`, which `middleware.ts`/`signin.ts`/`signout.ts` share) is in
`research.md` §5.3–5.4.

### Operational constraints

- **e2e for bug 2 must run on `:4321`** — GoTrue's allow-list pins emailed links to that port and
  ignores `E2E_BASE_URL`. Fixtures already exist: `inviteCallbackLink` in `e2e/fixtures/staff.ts`,
  and the "refused, not consumed" tests in `e2e/auth-hardening.spec.ts` are the pattern to model.
- Four worktrees share one local Supabase stack — a `db reset` in a sibling drops migrations from
  the others.
- Neither bug is reachable at the integration layer; there is no harness that renders an `.astro`
  page under Vitest.
