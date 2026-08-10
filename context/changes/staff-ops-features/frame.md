# Frame Brief: Staff-console features — My-account, manual reservation, global search

> Framing step before /10x-plan. Captures what is _actually_ at issue, separated from
> what was initially assumed. Covers three features as one cohort because the mockup
> audit, parallelizability, and roadmap placement are cross-cutting.

## Reported Observation

Add three staff-side features: (1) a **staff account screen**, (2) a **manual "add reservation"**
for phone-in bookings, (3) a **search box in the header** of the staff screens. Plus three meta-asks:
confirm the mockups exist in Claude Design, add the slices to the roadmap, and check whether they
can be built in parallel.

## Initial Framing (preserved)

- **User's stated cause or approach**: three separate slices; mockups already exist in Claude Design;
  buildable in parallel.
- **User's proposed direction**: check mockups → add slices to roadmap → verify parallelizability.
- **Pre-dispatch narrowing**: account = the logged-in employee's **self-service "My account"**
  (not the shipped S-08 admin screen); manual reservation lands **confirmed directly** (skips the
  approval queue); header-search scope = **deferred** to "after we see the mockups" → later chosen
  **full omnisearch as designed**.

## Dimension Map

The framing ("three mockup-backed, independent, parallel slices") could break at:

1. **Design completeness** — do live Claude Design mockups exist for all three? ← framing assumes yes
2. **Scope overlap with shipped work** — account vs S-08; confirmed-create vs the S-02 public-create /
   S-03 approve path.
3. **Reuse vs net-new plumbing** — how much each leans on existing services.
4. **Shared-surface coupling** — do all three edit `StaffShell` / `access.ts` / `types.ts`? ← "parallel" assumes no

## Hypothesis Investigation

| Hypothesis                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Verdict                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **D1 — mockups exist**        | Live project `352d78a6…` has dedicated files: `staff-profile.jsx` (`ScreenStaffProfileMobile/Desktop`), `manual-reservation.jsx` (`ManualResFlow` confirm→form→done, desktop modal + mobile sheet), `search-flow.jsx` (dropdown + full page + ⌘K, mobile). Pulled via DesignSync.                                                                                                                                                                                                        | **STRONG — all three PRESENT**                |
| **D2 — overlap with shipped** | Account is net-new: S-08 = admin-manages-others + email-link _reset_; **no self-service My-account page** exists (`src/pages/dashboard/` has no account route). Confirmed-create does **not** exist: `create_reservation_request` hardcodes `status='pending'` (`…reservation_b2b_fields.sql:71-78`); `decide_reservation` only transitions existing rows.                                                                                                                               | **STRONG — net-new, minimal overlap**         |
| **D3 — reuse vs net-new**     | Account: in-session `updateUser({password})` already used at `api/auth/reset-password.ts:45`; `ResetPasswordForm` to fork. Reservation: overlap `EXCLUDE` + `isVehicleAvailable` reusable, confirmed-email template reusable, **but a new `create_confirmed_reservation` definer RPC is required**. Search: vehicle side reuses `listFleet`+`FleetList` pattern; **reservation search needs a new role-gated RPC** (table SELECT revoked; existing RPCs are pending-only/calendar-only). | **STRONG**                                    |
| **D4 — parallelizable**       | Every staff page renders one shell, `StaffShell.astro`. Only shared code surface = its `NAV` registry (`:38-56`) + `active` union + `NavIcon` glyphs, plus append-only `access.ts` / `types.ts`. `middleware.ts` untouched. Search is the invasive one (no header action slot today; `showHeader={false}` on 4+ pages; search was deliberately deferred — `dashboard.astro:67,88`).                                                                                                      | **STRONG — parallel with light coordination** |

## Narrowing Signals

- The first mockup audit (a subagent) reported Features 1 & 2 **ABSENT/PARTIAL** — but it **could not
  reach DesignSync** and fell back to a **pre-2026-06-18 git snapshot**. A direct live `list_files` +
  `get_file` **overturned** that: `staff-profile.jsx`, `manual-reservation.jsx`, `search-flow.jsx` are
  all present and fully detailed. _Lesson echo: verify "mockup absent" against the live project, never a
  stale snapshot._
- Owner decisions: account = **self-service**; reservation = **confirmed directly** (the mockup's own
  done-state confirms this — _"Termin zablokowany w kalendarzu · Klient dostanie potwierdzenie e-mailem"_,
  tagged **"Ręczna"**); search = **full omnisearch as designed**.

## Cross-System Convention

- Every write across the RLS boundary goes through a `SECURITY DEFINER` RPC with a `current_app_role()`
  gate and revoke-before-grant (project lesson). So both the confirmed-create and the reservation-search
  paths are **new definer RPCs**, not client inserts/selects — a raw insert would also leave `reference`
  NULL and bypass atomic reference minting.
- The design assumes **domain surfaces v1 does not have**, which must be trimmed or deferred at plan time:
  - `staff-profile.jsx`: a **Powiadomienia** (notifications) toggle — no notification system (PRD non-goal);
    an **Oddział** (branch) field — not in the data model. The screen is otherwise \*\*view + change-password
    - logout\*\*, not a full profile editor (editing `full_name` is RLS-blocked for non-admins → needs a
      self-row policy/RPC only if inline edit is wanted).
  - `manual-reservation.jsx`: the quick-action menu also lists **Nowy klient** / **Dodaj pojazd** /
    **Szybkie wydanie** — out of this slice; "new client" implies a **customer database** v1 lacks.
  - `search-flow.jsx`: the **Klienci** group must be **derived from denormalized reservation fields**
    (no customer entity); **Zwroty** = return protocols (S-06).

## Reframed (or Confirmed) Problem Statement

> **The initial framing held.** These are three net-new, mockup-backed staff-console slices that are
> parallelizable with light coordination — not a misframe.

What the investigation _added_ is refinement, not reversal: (a) each feature is net-new and does **not**
overlap shipped work, but leans heavily on existing primitives; (b) the confirmed-create and the global
reservation-search each require **one new `SECURITY DEFINER` RPC**; (c) the mockups assume domain surfaces
v1 lacks (customer DB, notifications, branch), which are the deliberate trims to settle at plan time; and
(d) the header search is the single invasive `StaffShell` change and should be **sequenced last** so the
other two land rebase-free.

## Confidence

- **HIGH** — all three mockups verified present against the _live_ design; the reuse/gap and shared-surface
  findings are file:line-grounded across three independent audits; the one open scope question (search
  breadth) was resolved by the owner (full omnisearch).

## What Changes for /10x-plan

Three separate plans (S-11 `staff-account`, S-12 `manual-reservation`, S-13 `staff-global-search`). Each
plan's Design Alignment Audit runs against its named mockup. Carry these as explicit plan-time scope lines:
the **two new RPCs** (confirmed-create, search), and the **domain trims** (notifications toggle, branch
field, customers-from-reservations, quick-action extras). Sequence search last among the three.

## References

- **Design (live, via DesignSync)** — project `Rental car company` `352d78a6-84fd-49a2-8b38-2fe289691fc3`:
  `staff-profile.jsx`, `manual-reservation.jsx`, `search-flow.jsx` (+ shell `staff-desktop.jsx`).
- **Code** — `src/components/shell/StaffShell.astro`, `src/lib/access.ts:27-45`,
  `src/pages/api/auth/reset-password.ts:45`, `src/lib/services/reservations.ts:40-76`,
  `supabase/migrations/20260613090000_reservation_b2b_fields.sql:71-78`,
  `supabase/migrations/20260603155136_booking_integrity_data.sql:124-129` (EXCLUDE).
- **Investigation tasks**: #3 (design mockup audit), #4 (codebase-reuse audit), #5 (shared-surface audit).
- **Roadmap slices**: S-11 / S-12 / S-13 in `context/foundation/roadmap.md`.
