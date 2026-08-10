# Staff self-service account (My account) — Plan Brief

> Full plan: `context/changes/staff-account/plan.md`
> Frame brief: `context/changes/staff-ops-features/frame.md` (cohort frame — S-11/S-12/S-13)
> Design contract: `context/changes/staff-account/design-contract.md`

## What & Why

A logged-in employee gets a self-service **Profil** screen: view their own identity (name, role,
work email), change their own password **in-session** (no email round-trip), and sign out. It's the
lowest-risk slice of the staff-console cohort — net-new, but leans almost entirely on shipped
primitives. The confirmed problem statement (frame): three net-new, mockup-backed staff-console
slices, parallelizable with light coordination; this one is _view + change-password_, not a full
editor and not the S-08 admin screen.

## Starting Point

Today the shell's account chip (`StaffShell.astro:121-134`) is display-only, sign-out lives only in
the desktop sidebar (mobile has **no** sign-out at all), and there is no `/dashboard/account` route.
In-session password change already exists as a primitive (`reset-password.ts:45` → `updateUser`), but
with no current-password reauth anywhere.

## Desired End State

From the sidebar account chip (desktop) or a new mobile Profil tab, an employee opens
`/dashboard/account`, sees their name / role / work email, changes their password on a dedicated
sub-page (current password verified before the change), and signs out — the first sign-out path
reachable on a phone.

## Key Decisions Made

| Decision                          | Choice                                              | Why (1 sentence)                                                        | Source           |
| --------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- | ---------------- |
| Scope                             | View + change-password (no editing)                 | `profiles` UPDATE is admin-only; editing is out of scope                | Frame            |
| Migration / RPC                   | None                                                | Identity reads from `Astro.locals.user` + self-readable `profiles` row  | Plan             |
| Telefon / Powiadomienia / Oddział | Trimmed                                             | No `phone` field, no notification system, no branch field               | Frame + Research |
| Profil entry point                | Account chip → link (desktop) + Profil tab (mobile) | Matches the design (chip-as-entry) and fixes the mobile no-sign-out gap | Plan             |
| Password-change surface           | Dedicated sub-route `/dashboard/account/password`   | Mirrors the shipped reset-password page idiom; lowest novelty           | Plan             |
| Current-password reauth           | Required (`signInWithPassword` before `updateUser`) | In-session change lacks the email-link proof the recovery flow has      | Plan             |
| Name source                       | `full_name` ?? humanized email                      | Show the stored name where present; fall back to the shell's helper     | Plan             |

## Scope

**In scope:** the `/dashboard/account` view page; the `/dashboard/account/password` sub-page + form

- a self-gated `/api/auth/change-password` endpoint with reauth; the S-11-owned StaffShell edit
  (chip → link, mobile Profil tab, `active="me"`, one `NavIcon` glyph).

**Out of scope:** profile editing / any self-edit RPC; Telefon / Powiadomienia / Oddział; touching
`staffIdentity` or the chip's `· Warszawa` literal; the header search / quick-add / mobile-header
restructure (S-12 / S-13); removing the existing desktop sign-out button.

## Architecture / Approach

Astro-first: the shell edit and the view page are plain Astro (the only interactive bits are a link
and a native sign-out form). The password flow reuses the app's native-form idiom — a small
three-field React island (fork of `ResetPasswordForm`, plain `useState`) posts to a redirect-shaped,
self-gated endpoint that verifies the current password (`signInWithPassword`) **before**
`updateUser`, then redirects back with `?done` / `?error` query params the host page branches on.

## Phases at a Glance

| Phase                         | What it delivers                                                        | Key risk                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. StaffShell entry point     | Chip → link + mobile Profil tab + `active="me"` + `user` glyph          | Shared-surface edit — must stay confined so S-13 rebases cleanly                         |
| 2. Account view page          | `/dashboard/account` (identity + Kontakt(email) + Konto), trims applied | Design fidelity (vision-diff) + name-source fallback                                     |
| 3. In-session password change | Sub-page + forked form + reauth endpoint                                | Reauth-before-update ordering; clean wrong-password error without disturbing the session |

**Prerequisites:** F-02 (roles/auth) — done; the in-session `updateUser` primitive — shipped.
**Estimated effort:** ~1 session across 3 thin phases (no schema/RPC work).

## Open Risks & Assumptions

- **Shared StaffShell surface.** S-11 owns this nav edit; kept to the `active` union + chip anchor +
  mobile tab append + one glyph so S-12 (off-nav) and S-13 (header restructure, last) don't collide.
- **Reauth session handling.** `signInWithPassword` re-issues a same-user session on the SSR client
  (harmless); a wrong password must error without changing state — covered by the integration test.
- **Name inconsistency (accepted).** The shell chip stays email-derived while the profile page prefers
  `full_name`; aligning the chip is a noted follow-up, not this slice.
- **Canonical screenshots pending.** The exact-values contract is transcribed from the `staff-profile.jsx`
  source; the rendered vision-diff (in `/10x-implement`) needs the mockup PNG dropped into
  `design-review/` — the one outstanding design-gate input.

## Success Criteria (Summary)

- An employee can reach `/dashboard/account` from the chip (desktop) and the Profil tab (mobile), and sign out from it (incl. mobile).
- Changing the password requires the correct current password; a wrong one is rejected with no change; a correct one updates and re-login works.
- Both screens match `staff-profile.jsx` (minus recorded trims) on a rendered vision-diff.
