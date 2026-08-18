# auth-followups — queued from the implementation review (2026-08-18)

Full report: `../reviews/impl-review.md`. Everything else in that review was fixed or
dismissed at triage; this file carries what was deliberately deferred, plus item 2 — found by
hand on production after the S-14 merge, not by either review.

## 1. A failed profiles insert leaves an invited hire permanently role-less (impl-review F6)

**Where**: `src/lib/services/staff.ts:192-205`

```ts
192:  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {…});
199:  const userId = invited.user.id;
200:  const { error: insertErr } = await admin
201:    .from("profiles")
202:    .insert({ user_id: userId, role: "employee", full_name: fullName });
203:  if (insertErr) {
204:    throw insertErr;
205:  }
```

The invite at `:192` is already sent and is not undone when `:204` throws. The hire ends up
with an `auth.users` row and no `profiles` row, so `middleware.ts:36` resolves their role to
`null` forever. Consequences, in order of who notices:

1. Their live invite link now renders "Konto jest nieaktywne" — they are told they were
   deactivated, having never been activated.
2. They are denied every `/dashboard` route with a bare `Forbidden` (`middleware.ts:57-59`).
3. They do not appear on the roster, so an admin has no obvious way to see the half-created
   account or repair it — re-adding the same address hits the `existing` branch at
   `staff.ts:186` rather than the net-new one.

**Why it was deferred**: pre-existing, outside the S-14 follow-up scope, and it needs a
product call on the repair path (compensating `deleteUser`, an idempotent retry, or a
"finish provisioning" admin action) rather than a one-line patch.

**Options to weigh when it is picked up**:

- Compensating delete — `admin.auth.admin.deleteUser(userId)` in the insert's failure path.
  Simplest, but the invite mail is already delivered and its link will then 404 rather than
  explain anything.
- Insert the profiles row first, then invite. Reverses the exposure: a failed invite leaves a
  profile with no auth user, which the roster _can_ show and an admin _can_ retry.
- A database trigger or an RPC that does both in one transaction. The only genuinely atomic
  option, and the one that also closes the race window the new refusal card knowingly accepts.

## 2. `/auth/link-conflict` misreads your own half-finished link session as someone else's

**Found**: manually on production, 2026-08-18, immediately after the S-14 deploy. Neither
implementation review caught it — both read the code against its plan, and this page is
correct for the two cases its own header comment names (`link-conflict.astro:6-16`). It is
wrong for a third the plan never considered.

**Where**: `src/pages/auth/link-conflict.astro` (the page), reached from
`src/pages/auth/callback.ts:30`

**The path** — an invited hire, on the most ordinary interruption there is:

1. They open their invite link. `/auth/callback` runs `verifyOtp`, which **consumes the token
   right there** — when the set-password form renders, not when a password is submitted.
2. The exchange mints their session (`amr` = `otp`, so `readSessionOrigin` returns `"link"`)
   and stamps `flota-link-origin=invite` with `maxAge` 3600.
3. They get distracted and close the window. Both cookies persist — nothing is lost.
4. Later they click the same link again. `callback.ts:30` sees `locals.user` and redirects to
   `/auth/link-conflict`.
5. They are told **"Ta przeglądarka jest już zalogowana"**, and to sign out and reopen the link.

**Three things are wrong at step 5:**

- **The copy is false.** It reads `Ten link otworzył się w przeglądarce, gdzie zalogowane jest
inne konto` — a _different_ account. It is the same account. The `AccountBox` rendered
  directly beneath prints the reader's own address, contradicting the sentence above it.
- **The instruction strands them.** Signing out discards the only session they have, and the
  token was spent at step 1, so reopening the link answers "Link wygasł". Their remaining route
  is `/auth/forgot-password`, which sends a **recovery** link — so an invited hire finishes
  through reset copy and never sees the invite welcome at all.
- **The page's stated reasoning does not hold here.** Its comment says "The token was NOT
  consumed on the way here, so the link still works after the sign-out — which is exactly what
  the copy promises." True for the two cases it was written for. False for this one: the token
  was consumed on the _previous_ visit, and nothing on the page checks that.

The user is one navigation from finishing — `/auth/reset-password` still renders the invite
form, because the session is link-origin and the marker is live for an hour. **Verified on
production, 2026-08-18**: after being shown the sign-out card, navigating straight to
`/auth/reset-password` brought the invite form back. So the continue-card fix below is not an
inference from the code — the destination it points at is known to work from exactly this state.
The page simply never offers it.

**Fix (contract)**: branch the page on whether the session standing in the way is _itself_ a
link session — `readSessionOrigin(Astro.locals.supabase) === "link"`, or equivalently the
presence of `LINK_ORIGIN_COOKIE`. When it is, the reader is mid-flow, not in conflict:

- Render a distinct card — title along the lines of `Dokończ ustawianie hasła`, subtitle saying
  the link was already opened in this browser and the session is still valid.
- Primary action `AuthPrimaryLink` → `/auth/reset-password`.
- Keep `SignOutButton` as a demoted secondary, with copy that does **not** promise the link
  will work again.
- Leave the existing card untouched for the genuine-conflict case (session origin `password`,
  or a different account).

Same shape as the role-gate card auth-followups Phase 1 added: branch on state, give each
refusal its own screen. One page, no new component. Needs a design-contract entry (no artboard)
and Polish copy in `design-contract.md` §9, per the project's design rule.

**Test**: e2e is the only layer that can reach it — open an invite link, land on the form
without submitting, discard the page, reopen the same link in the same context, assert the
continue card rather than the sign-out card. `e2e/auth-hardening.spec.ts` already has the
fixtures (`inviteCallbackLink`) and the existing "refused, not consumed" tests to model on.

## Not queued

**F10 (from the S-14 review) — `/api/auth/signout` runs at supabase-js's default _global_
scope**, so signing out one browser revokes every device session. Recorded at
`../../auth-surface-hardening/follow-ups/review-fixes.md`; still needs a product decision.
