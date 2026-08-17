---
change_id: staff-search-dashboard-only
title: Global search becomes Pulpit-only and dropdown-only (no results page)
status: implemented
created: 2026-08-11
updated: 2026-08-17
archived_at: null
---

## Notes

Two decisions, one landing. The change_id predates the second one and is now
narrower than the scope — kept as-is so the folder doesn't move.

**Implemented 2026-08-17** across five phases (`56eb8ac`, `f3e7860`, `2b74c2c`,
`885a187`, `89f8350`). Phase 5 was added during the walkthrough: the mobile
overlay's active row was invisible because the design's single `RowShell` active
background is the overlay's own ground (contract D19).

**The vision-diff gate was deliberately skipped (row 4.6).** Owner decision,
2026-08-17. `lessons.md` asks every UI slice to close with a rendered-vs-mockup
diff, so the divergence is recorded here rather than left silent:

- The gate exists because a **prose distillation** of a screenshot is lossy —
  it captures radii and spacing as ranges, which read as implementer license.
  That failure mode did not occur here: every value in `design-contract.md` was
  transcribed from the code-backed JSX via `DesignSync get_file`, which is the
  high-fidelity path the lesson actually asks for. Diffing a render of the app
  against a render of that same source re-verifies the transcription, not the
  design.
- **The gate would have missed this change's only real defect.** The mobile
  active row (D19) is invisible in the mock too — but no mobile screen passes
  `active` (`ScreenSearchLive` sets `active={i === 0}`; `ScreenSearchMobileLive`
  sets it on nothing), so a vision diff renders no active row on either side and
  passes. Reading the JSX found it; comparing renderings could not have.
- Nearly all of this change is **removal** — the results page, the per-screen
  entry points, the tab-bar magnifier. The genuinely new drawing is one row's
  second line, one 44×44 button and a right-group reorder, all walked by hand.
- What this leaves unverified: cumulative metric drift — a value correct in both
  files that renders differently through a cascade collision or inherited
  letter-spacing. Accepted.

The 8 superseded S-13 PNGs were pruned in the same pass (two of them rendered
`ScreenSearchResultsPage`, a screen that exists in neither the app nor the
design). `design-export-request.md` is retained, marked not-run, in case the gate
is wanted later. `design-system.md` catalog rows 09/20 are stale for unrelated
reasons and are still slated for re-export at archive.

**Phase 6 (`89f8350`'s follow-up) closed the last open item.** The empty header
band on `/dashboard/protocols/{id}` — that page sets `showHeader={false}`, passes
no `header-action`, and since Phase 3 renders no search field, so the always-on
top bar drew an empty strip at `md+`. Introduced by Phase 3, not pre-existing.
The bar is now gated on `showBar = showHeader || search ||
Astro.slots.has("header-action")`; the island is rendered in the else-branch too,
because it owns the ⌘K listener and the mobile overlay and gating it with the bar
would kill both on that page.

**Phase 7** closed a second consequence of the same Phase 3 fallback: ⌘K's
`location.assign` discarded a part-filled `VehicleForm` on `vehicles/new` and
`vehicles/{id}/edit`, with no `beforeunload` guard anywhere in `src`. The form now
guards itself while dirty. Known limit recorded in the plan: `<ClientRouter>` swaps
the DOM without unloading, so in-app link clicks still aren't caught — that needs
its own `astro:before-preparation` guard and is a separate UX decision, as is the
larger option of replacing the ⌘K navigation with an unanchored desktop palette.

## Where things stand

- Worktree: /Users/user/git/przeprogramowani/fleet-rent-staff-global-search
  Branch feature/staff-global-search, 7 commits, NOTHING PUSHED, tip f00ffec.
- S-13 (staff-global-search) is fully implemented and committed:
  context/changes/staff-global-search/{plan.md,change.md,design-contract.md}.
  change.md is `implemented`; every Progress row is ticked with a SHA.
  It ships: search_staff RPC + GET /api/search, an always-on StaffShell top bar
  with <GlobalSearch> on all 10 staff pages, a tab-bar magnifier on mobile,
  the ⌘K listener inside the island, and /dashboard/search.
- The cohort sequences S-13 LAST. Neither sibling has merged
  (feature/staff-account on origin, feature/manual-reservation in a sibling
  worktree), so there is room to land this narrowing BEFORE S-13 ever merges.
  That is the point: don't merge a shell restructure we're about to partly revert.

## The decision

**A. Pulpit-only entry.** Global search is reached from Pulpit ONLY, desktop and
mobile. It is not a per-screen affordance. Reason: an icon inherits its scope
from its container, so a magnifier in a section header reads as "search this
section" — on Flota it would sit above the `Marka, model…` filter. Scoped
filters on Flota and Zespół stay; no scoped search is to be added to the
worklists (Zwroty/Wnioski/Wydania), whose data is deliberately truncated
(today+overdue) and would give false negatives.

**B. Dropdown-only.** There is no dedicated results screen and no results URL.
Everything happens in the dropdown (desktop) and the full-screen search view
(mobile): the user types, the grouped list grows, they **scroll** it, and
clicking — or pressing `↵` on — a row jumps straight to that item. "Zobacz
wszystkie wyniki" ceases to exist as a destination. Filter chips
(`Wszystko / Rezerwacje / Zwroty / Pojazdy`) belonged to the deleted page and do
NOT move into the dropdown — group headers plus scrolling replace them.

Enter never meant "go to the page" in the shipped code anyway: cmdk keeps a row
highlighted and Enter opens it (`↵ otwórz`). The page was reachable only from the
footer link, plus an Enter fallback in the no-results state
(`src/components/search/GlobalSearch.tsx:182-190`). Both go.

**The consequence that isn't cosmetic.** `search_staff` caps each group at
`limit 8` (`supabase/migrations/20260810130000_staff_search.sql:151,185,210`).
That cap was safe only because the results page was the escape hatch. With the
page gone, match #9 is unreachable — exactly the "silently hide matches with no
way to reach them" failure this decision was made to avoid. Needs a new
migration. Open question for the plan: remove the cap or raise it to a bounded
per-group value (~25). Unbounded on a definer RPC is a perf risk; the design
says only that there is no truncation state and no visible per-group cap.

## The design is already updated and verified

Claude Design project 352d78a6-84fd-49a2-8b38-2fe289691fc3 (pull via DesignSync).
Full record of what changed and why: `design-request.md` (status APPLIED).

- `staff-desktop.jsx` → `StaffTopbar({title, sub, search=false, searchQuery,
searchFocused})`; only ScreenStaffDash passes `search`, and it renders
  `<SearchField query="" focused={false} width={520} sx={sx} />` — i.e. 520x44,
  radius 12, 1.5px border, tokens.card, ⌘ K chips.
- `staff-screens.jsx` → ScreenWorkerDash keeps a 44x44 / borderRadius 99 /
  tokens.card / 1px tokens.hair / tokens.shadow1 button with Icon.search s={19},
  `gap: 10` left of the avatar. Sole mobile entry; its TabBar has no search entry.
- `search-flow.jsx` → **substantially rewritten.** `ScreenSearchResultsPage` and
  `ScreenSearchMobilePage` deleted, with `ResultSection` / `SectionLabel` and the
  `showEnter` footer branch. The results panel is now `overflowY: 'auto'` under
  the 460px cap. The `Pojazdy` group is drawn for the first time (VThumb 58×40 /
  r10, name 13.5/600 in `<Highlight>`, muted make+model 12, plate in tokens.mono,
  trailing chevR 16). `SearchTopbarScaffold` now reuses `StaffTopbar`.
- Also applied (the `[OPTIONAL]` block): `Ostatnie wyszukiwania` + divider +
  `recent` key removed from both resting states; `CustomerRow` / `Avatar` /
  `customers` removed. These retire contract deviations **D2** and **D1** — the
  app and the mock now agree, so both become `exact`.
- No other staff screen has any search affordance.

**Blocked dependency:** all 8 PNGs in
`context/changes/staff-global-search/design-review/` are stale (dated 2026-08-10,
two of them render the deleted results page). `design-export-request.md` holds
the ready-to-send request; it cannot be driven through DesignSync. Fire it early
— the vision-diff gate needs it.

## Scope

1. **Delete the results page.** `src/pages/dashboard/search.astro`; the
   `/dashboard/search` entry in `src/lib/access.ts:46`; `"search"` from
   StaffShell's `active` union; the `header-title` slot that exists only for it
   (contract D13); `resultsHref` and the no-results Enter fallback in
   `GlobalSearch.tsx:108,186`; the "Zobacz wszystkie wyniki" footer branch.
2. **Make the dropdown carry the whole result set** — panel scrolls under the
   460px cap, plus the `limit 8` migration described above. No truncation state,
   no "showing 8 of 40".
3. **Mount `<GlobalSearch>` only when the shell renders /dashboard** (a prop on
   StaffShell, not a rip-out) — the other 9 pages lose the field.
4. **Add the mobile search button** to dashboard.astro's `md:hidden` hero, left
   of the initials avatar, at the exact values above. It should dispatch the
   existing `flota:search-open` document event.
5. **Remove the magnifier from StaffShell's mobile floating tab bar**
   (`StaffShell.astro:261-274`). Re-check the 360px density fallback
   (design-contract D10) — it may become unnecessary.
6. **Hoist the ⌘K listener** out of the island into Layout.astro so the shortcut
   still works on the 9 pages that no longer render the field. Keep the
   module-scoped singleton guard + astro:page-load binding
   (src/components/hooks/useGlobalSearchHotkey.ts explains why a dataset guard
   is wrong for a document-level listener).
7. **KEEP the Phase 2 shell restructure** — the always-on top bar and the five
   migrated page headers (dashboard, staff, vehicles/new, vehicles/[id]/edit,
   protocols/[id]). Its original justification goes away but it is now what gives
   every page a consistent title/action bar; reverting would re-fragment five
   headers for no gain. Say so explicitly in the plan.
8. **Update `context/changes/staff-global-search/design-contract.md`** — D1 and
   D2 become `exact`; D13 and D14 delete with the page; D16 loses its
   results-page clause; D10 gets re-measured (may be moot). And update the S-13
   plan's "What We're NOT Doing" plus its change.md.

Tests in the blast radius: `tests/integration/staff-search.test.ts`,
`src/lib/services/search.test.ts`, `src/lib/search-format.test.ts`. No e2e spec
covers global search (the `search` hit in `e2e/staff-auth.spec.ts` is an
unrelated inbox lookup).

## Environment gotchas (all confirmed this session)

- All worktrees SHARE ONE local Supabase (config.toml project_id). A sibling's
  `db reset` drops your migration → PGRST202. Check
  supabase_migrations.schema_migrations before resetting; apply your own file via
  psql + `notify pgrst, 'reload schema'` instead of resetting back.
- :4321 is the car-rental worktree, :4322 is fleet-rent-manual-reservation.
  Start this worktree's dev server on an explicit free port (4325).
- .env and .env.test already exist here (gitignored); node_modules installed.
- Do NOT clear node_modules/.vite while the dev server runs — it re-hashes the
  ?v= query and client:only islands (e.g. the return flow) white-screen while
  still returning 200. Stop the server, clear, restart, hard-reload the tab.
- A brand-new Tailwind class added while dev is running is never generated until
  the server restarts. Check the prod build before blaming your CSS.
