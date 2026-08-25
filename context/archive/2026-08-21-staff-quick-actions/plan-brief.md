# Staff quick-action menu (S-12b) — Plan Brief

> Full plan: `context/changes/staff-quick-actions/plan.md`
> Design contract: `context/changes/staff-quick-actions/design-contract.md`
> Research: `context/changes/staff-quick-actions/research.md`
> Change log (settled decisions): `context/changes/staff-quick-actions/change.md`

## What & Why

S-12 shipped manual reservation behind a single page-owned pill on `/dashboard/reservations` — the app's
only door into the flow, on one route out of twelve. The design draws something different: a
`QuickAddButton` that lives in the staff shell's header band on every board, opening a menu of which
manual reservation is one row. This change builds that affordance and un-defers **D4** from the S-12
design contract, which cut the quick-action menu as out of scope.

## Starting Point

The trigger lives at `reservations.astro:52`, in its own `mb-4 flex justify-end` row inside `<main>` —
a second right-edge below the shell's header band. That band (`StaffShell.astro:163`) is already a
unit-for-unit match to the design's `StaffTopbar` (`px-8 py-[22px]`, `bg-card`, `border-b`,
`justify-between`) and already carries the two-slot shape — it just renders one child. **The design's
action slot exists in our shell and is empty.** Below `md` there is no shell header at all: 8 hand-rolled
per-page headers in three different shapes. The pill's own pixel values were a faithful, exact port; only
its placement drifted, because its boards were the ones excluded from S-12's vision-diff.

## Desired End State

A staffer on any of the 7 staff pages with a normal title header sees an ink `＋ Nowe ⌄` pill in the
header band (desktop) or a 40×40 ink `＋` circle in the page header's right slot (mobile). It opens the
quick-action menu — a popover on desktop, a **SZYBKA AKCJA** bottom sheet on mobile — offering **Nowa
rezerwacja** and **Dodaj pojazd**. On Flota and Zespół the sheet leads with that page's own action
(**Dodaj pojazd** / **Dodaj pracownika**) as the crimson primary row, so those screens show one `＋`
rather than two. Picking **Nowa rezerwacja** fetches the bookable fleet on demand and opens the existing
modal.

## Key Decisions Made

| Decision              | Choice                                                              | Why                                                                                                                          | Source     |
| --------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Desktop reach         | Global — every page with a normal header                            | The design's `QuickAddButton` is an unconditional child of `StaffTopbar`                                                     | Change log |
| Mobile collision rule | Unified absorb — one `＋` per screen, page action promoted to row 1 | Keeps every action reachable; `v6` (drop on create pages) made manual reservation a dead end from Flota/Zespół               | Change log |
| Desktop absorb        | Never — desktop page actions stay in their own band                 | `qa-v5`: separate bands, both labelled, no ambiguity                                                                         | Change log |
| Which routes get it   | The **7** with a normal title header; **not** the 5 task screens    | Task headers own back/close/submit over unsaved state — a create action there is both a design mismatch and a data-loss path | Plan       |
| Fleet data flow       | Lazy-fetch on pick via new `GET /api/vehicles`                      | Zero added SSR cost and nothing serialized into page HTML, so the console-wide over-fetch never happens                      | Plan       |
| Projection width      | 7 columns, not 23                                                   | The menu reads no vehicle data; the modal reads exactly 7 fields (1183 B vs 4906 B measured)                                 | Plan       |
| Endpoint gate         | Explicit 401 → 403 → 200                                            | The table's read policy is `using (true)`, so this handler fails **open** — it is the only barrier                           | Plan       |
| Circle size           | 40×40 everywhere; Flota/Zespół move 48 → 40                         | One size console-wide, exact to source, consistent with the pill and sheet being ported exact                                | Plan       |
| Empty fleet           | Render the affordance, disable the reservation row                  | S-12's `return null` would erase the pill console-wide, taking `Dodaj pojazd` — the fix for an empty fleet — with it         | Plan       |
| Staff header          | Migrate onto the shell band                                         | The design uses matched full-bleed padding for header and body; staff's 1024px cap diverges from that spec                   | Plan       |
| Sequencing            | Land before `service-read-projections`                              | Lazy-fetch means this no longer multiplies the over-fetch, so the "second pass" concern dissolves                            | Plan       |

## Scope

**In scope:** the shell's right action slot + desktop pill; the mobile circle across 7 headers; the
popover and bottom sheet; absorb on Flota and Zespół; `listFleetForPicker` + `GET /api/vehicles` + its
authorization triple; migrating the Pulpit and Zespół header bands; fixing the `vehicles.astro`
duplicate title and the `protocols/[id]` `pendingCount` badge; retiring `NewReservationButton`.

**Out of scope:** the 5 task screens (and therefore any unsaved-work confirm); the 38×38 calendar icon
button (S-13 owns that call); un-capping page bodies; the calendar-cell entry point; narrowing
`listFleet` itself; the `vehicles` RLS policy; any S-13 work.

## Architecture / Approach

Two **separate island mounts in different DOM locations** rather than one component branching on
breakpoint: the pill inside `StaffShell`'s band (already `hidden … md:flex`), the circle inside each
page's mobile header (already `md:hidden`). This is forced — `useMediaQuery`'s server snapshot returns
`false` and its docstring restricts callers to components that mount after hydration, which is true of
the modal but false of a trigger that mounts on page load. Because the two containers are already
mutually exclusive in CSS, nothing double-mounts.

The absorb logic is one pure function (`buildQuickActions`) shared by both surfaces: prepend the promoted
action as primary, append the canonical rows de-duplicated by key and demoted. Flota renders 2 rows and
Zespół 3 from that single path. The desktop branch never passes `promoted`, mirroring the design source
so desktop cannot absorb by accident.

## Phases at a Glance

| Phase                          | What it delivers                                                        | Key risk                                                                        |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1. Fleet picker endpoint       | 7-column projection, `GET /api/vehicles`, the 401/403/200 triple        | The gate is the only barrier — a role-null test that passes with the hole open  |
| 2. Menu components             | Merge logic, pill/popover, circle/sheet, lazy fetch; mounted on Wnioski | Re-fetching per open; the empty-fleet path                                      |
| 3. Shell restructure (desktop) | Action slot, pill on 7 routes, Pulpit + Zespół migrated, 2 header fixes | Shared surface across 10 pages; double-band regressions on the 2 migrated pages |
| 4. Mobile rollout              | Circle on 7 headers, absorb on Flota + Zespół, 48 → 40                  | Header overflow at 360px, worst on Pulpit (title + circle + avatar)             |
| 5. Verification gate           | E2E over the lazy-fetch path, rendered vision-diff                      | Island hydration races in the E2E                                               |

**Prerequisites:** local Supabase running for the integration triple; `npx astro sync` before first
build; the canonical boards in `design-review/` (present and verified current).

**Estimated effort:** ~4 sessions across 5 phases; Phase 3 is the largest and the one to review closely.

## Open Risks & Assumptions

- **Phase 3 is the blast radius.** `StaffShell.astro` is shared by all 10 staff pages, and S-13 plans to
  touch the same band. S-13's plan needs a refresh against the delivered shape regardless — its
  `plan.md:60` still calls S-12 an unmerged sibling branch, though S-12 and S-12a archived 2026-08-21.
- **Staff's title visibly moves** from its 1024px column out to flush `px-8`. Accepted: the underlying
  body-centering deviation is pre-existing, app-wide, and out of scope.
- **Mobile Pulpit is the tightest row** in the change. The design refused a circle there, but for a
  reason (`Dyspozytornia`, 273px unbreakable) that does not transfer to our `Pulpit`. If 360px clips,
  the fallback ships as a recorded deviation rather than an overflow.
- **`vehicles_select_authenticated` is `using (true)`**, so the new endpoint's role check has no RLS
  backstop. `vehicles-read-policy-gate` owns the fix; this change owes the test triple either way.
- Assumes `radix-ui` `Popover` can be driven to the source's `top: 44 / right: 0 / 278px` geometry via
  `align="end"` + `sideOffset` with the wrapper's default `w-72`/`p-4` overridden.

## Success Criteria (Summary)

- A staffer can start a manual reservation from any of the 7 staff pages, on desktop or mobile — not
  just from Wnioski.
- Flota and Zespół show exactly one `＋` on mobile, and every menu action stays reachable from both.
- The endpoint refuses anon and role-null callers and serves staff exactly 7 columns; the rendered
  vision-diff against the canonical boards closes empty but for the recorded deviations.
