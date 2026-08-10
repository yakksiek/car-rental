---
change_id: staff-account
title: Staff self-service account (My account) — view profile + in-session password change
status: implementing
created: 2026-08-10
updated: 2026-08-10
archived_at: null
---

## Notes

Roadmap slice **S-11** (`context/foundation/roadmap.md`). Framing cohort:
`context/changes/staff-ops-features/frame.md`.

Self-service "My account" for a logged-in employee: view own profile (read-only
identity display over `App.Locals.user`), change own password **in-session** (no
email round-trip — reuses `updateUser({ password })` at
`src/pages/api/auth/reset-password.ts:45`), and log out. **Not** a full profile
editor; **not** the S-08 admin screen.

Design mockup: `staff-profile.jsx` (live in Claude Design `Rental car company`
`352d78a6-84fd-49a2-8b38-2fe289691fc3`; pull via DesignSync). Trim the mockup's
**Powiadomienia** (no notification system in v1) and **Oddział** (branch — not in
the data model) rows.

Shared-surface coordination (cohort S-11/S-12/S-13): **S-11 owns the "Profil" nav
entry in `StaffShell.astro`.** S-12 stays off the nav; S-13 does the shell
restructure last.
