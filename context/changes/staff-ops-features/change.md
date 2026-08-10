---
change_id: staff-ops-features
title: Staff-console features — self-service account, manual reservation, global search (framing cohort)
status: preparing
created: 2026-08-10
updated: 2026-08-10
archived_at: null
---

## Notes

Framing cohort for three staff-facing features requested together (2026-08-10):

1. **Staff self-service "My account"** — the logged-in employee's own Profil screen (view own
   contact/work details, change own password in-session, log out).
2. **Manual reservation** — staff create a **confirmed** booking by hand for a phone-in customer.
3. **Staff global search** — a header ⌘K omnisearch across reservations / returns / vehicles / customers.

This folder holds the **cohort Frame Brief** (`frame.md`) — the shared mockup audit,
scope decisions, and parallelizability verdict. Each feature becomes its **own roadmap slice**
(**S-11 `staff-account`**, **S-12 `manual-reservation`**, **S-13 `staff-global-search`**), planned
separately via `/10x-new <id>` → `/10x-plan <id>`; they all point back here for the shared design
reference.

**Key outcome:** the framing held — all three have full, detailed **live** Claude Design mockups
(`staff-profile.jsx`, `manual-reservation.jsx`, `search-flow.jsx`), and the three are
**parallelizable with light coordination** on the `StaffShell` nav. Scope decisions taken with the
owner: account = self-service My-account; manual reservation = **confirmed directly**; search =
**full omnisearch as designed**.
