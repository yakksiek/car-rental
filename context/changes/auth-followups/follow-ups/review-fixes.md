# auth-followups — queued from the implementation review (2026-08-18)

Full report: `../reviews/impl-review.md`. Everything else in that review was fixed or
dismissed at triage; this file carries only what was deliberately deferred.

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

## Not queued

**F10 (from the S-14 review) — `/api/auth/signout` runs at supabase-js's default _global_
scope**, so signing out one browser revokes every device session. Recorded at
`../../auth-surface-hardening/follow-ups/review-fixes.md`; still needs a product decision.
