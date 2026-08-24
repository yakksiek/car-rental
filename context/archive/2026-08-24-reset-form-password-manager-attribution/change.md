---
change_id: reset-form-password-manager-attribution
title: The set-password form has no username field, so Chrome offers to overwrite the admin's saved password
status: archived
created: 2026-08-24
updated: 2026-08-24
archived_at: 2026-08-24T18:26:48Z
---

## Notes

Found during the **production** end-to-end invite walk-through on 2026-08-24, immediately after
`invite-journey-fixes` shipped (archived at `context/archive/2026-08-18-invite-journey-fixes/`).
Not a defect that change introduced — it predates it and was simply never exercised by hand before.

### What was observed

An admin, signed in on their own Chrome profile, added a hire, sent the invite, signed out, opened
the invite link, and set the hire's password. Chrome's password manager then prompted — **not** with
the usual "save this new password", but with **"do you want to change the admin password?"**, offering
to replace the admin's stored credential with the password just typed for the hire.

Every other step of the journey behaved correctly (the sign-out prompt, the form, the activation).
This is the only anomaly.

### Diagnosis — verified in the code, not inferred from the symptom

`src/components/auth/ResetPasswordForm.tsx` sets `autoComplete="new-password"` on both password
fields (`:90`, `:112`) — correct — but the form contains **no username field at all**. The target
address IS on screen, rendered by `AccountBox` as **text**, not as an input.

Chrome needs an `autocomplete="username"` input to attribute a new password to an account. With none
present, its heuristic falls back to the credential it already holds for that origin — the admin's,
because that is who had been signed in — and so it offers an _update_ rather than a _save_.

`src/components/account/ChangePasswordForm.tsx` has the same missing-username gap, but it is benign
there: it carries `autoComplete="current-password"` (`:67`), which lets Chrome match the existing
credential, and the person changing the password **is** the account holder. On the invite/recovery
form the two are different people. **That asymmetry is the bug.**

### Why this is more than a cosmetic popup

Accepting the prompt overwrites the **admin's stored password with the hire's**. Nothing changed
server-side, so the admin's next autofill silently produces a wrong password and a failed sign-in
with no visible cause. The shared-workstation case — the exact scenario `/auth/link-conflict`'s R11
card exists for — is both the most likely to hit it and the hardest to diagnose.

Affects **both** modes of the form: invite (`?mode=invite`) and recovery.

### Open decisions for planning — do NOT take these silently

1. **Hidden input, or promote the account box's email to a real field?** The straightforward fix is a
   visually-hidden readonly `<input autocomplete="username">` carrying the target address. But
   `AccountBox` already renders that address on screen, so the deeper question is whether an identity
   currently rendered as text should be a form field. That is a **design** call, and the surface has a
   contract — it needs a `design-contract.md` entry either way.
2. **Not `display: none`.** Chrome skips username fields hidden that way in some heuristics. If the
   hidden route wins, it must be visually hidden but rendered (off-screen / `sr-only`).
3. **Is `ChangePasswordForm` in scope?** Same gap, benign today. Decide in-scope or explicitly
   declined — an unstated omission here is what produced phase 11 of the last change.
4. **Is the fix even wanted?** Worth one paragraph of challenge before planning: the alternative is
   accepting the prompt as a browser-side annoyance. (I think it is worth fixing — the failure mode is
   a silent wrong-credential lockout — but that is the owner's call.)

### Constraint the plan must state rather than discover

**The prompt itself is not automatable.** Playwright can assert the input's presence, its
`autocomplete` value, and that it carries the right address — but Chrome's password-manager UI is
browser chrome, outside the page, and no spec can see it. The verification for the _actual_ symptom
is a **manual** check. The plan must say so plainly instead of implying coverage it cannot have;
a criterion no layer can fail is worse than no criterion (`invite-journey-fixes` design-contract
§10 entry 4 records the same lesson).

### Verified along the way

`src/pages/api/auth/reset-password.ts` reads its fields explicitly — `form.get("password")`,
`form.get("confirm")` (`:118-119`) — rather than parsing the whole body, and its zod schema (`:50-53`)
covers only those two. So an added input **cannot** reach the server or upset validation. The change
is contained to the component.
