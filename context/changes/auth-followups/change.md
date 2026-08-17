---
change_id: auth-followups
title: S-14 review follow-ups — role-gate parity, marker provenance, auth hygiene
status: implementing
created: 2026-08-17
updated: 2026-08-17
archived_at: null
---

## Notes

Follow-ups from the **S-14 (`auth-surface-hardening`) full-plan implementation review**,
2026-08-17. Findings, evidence and line numbers live at
`context/changes/auth-surface-hardening/reviews/impl-review.md`; the queued subset is
restated at `context/changes/auth-surface-hardening/follow-ups/review-fixes.md`.

The review returned **0 critical, 2 warnings, 8 observations**, and confirmed S-14's own
objective behaviourally — an ordinary password session POSTing `/api/auth/reset-password`
gets 403 and the stored password is unchanged. Four findings (F2, F4, F8, F9) were fixed
during triage and shipped in `4c5fd46`. **This change carries the remaining five.**

**F1 (warning) is the only one with user-visible consequence.** `/auth/reset-password`
mirrors four of the route's five gates but not the role check, so a **deactivated** staffer
— `middleware.ts:30` resolves `deactivated_at` to `role = null` — can request a reset,
receive the mail, reach the full "Ustaw hasło" form, submit, and get an unstyled
`Forbidden` from `reset-password.ts:75-77`. The route's 403 is correct and asserted
(`tests/integration/reset-password.test.ts:196-206`); what is missing is the screen that
explains it. The page's own comment already promises this parity.

**F3 (observation)** — `callback.ts:43` ORs an unvalidated `?flow=invite` into the marker's
value. **F5/F6/F7 (observations)** — a missing body guard on `signin.ts`, five new `.astro`
files without the mandated import headers, and a cookie test double that discards its
options so `path`/`secure` can't be asserted.

**Owner decision (2026-08-17):** F1's refusal screen states the deactivation
**explicitly** rather than using neutral copy. The reader already controls the mailbox that
received the link, so the account-state disclosure is narrow, and a real ex-employee is
otherwise left with no explanation.

**Not carried here:** F10 (`/api/auth/signout` runs at supabase-js's default _global_
scope, so signing out one browser revokes every device session). Pre-existing, outside
S-14, and skipped at triage — it needs a product decision, not a code fix. Recorded under
"Not queued" in the follow-ups file.
