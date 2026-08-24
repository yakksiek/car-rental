---
change_id: staff-quick-actions
title: Staff quick-action menu in the shell header — manual reservation + add vehicle
status: implementing
created: 2026-08-21
updated: 2026-08-24
archived_at: null
---

## Notes

Follow-on to **S-12** (`context/archive/2026-08-10-manual-reservation/`) and **S-12a**
(`context/archive/2026-08-18-manual-reservation-date-picker/`), both archived 2026-08-21.
Originally opened as `manual-reservation-entry-point` — a research pass on where the
"Nowa rezerwacja" button lives; renamed 2026-08-24 when the scope grew from _moving one
button_ to _building the quick-action affordance the design actually draws_.

**What this change does.** Replace S-12's single page-owned "Nowa rezerwacja" pill with the
design's `QuickAddButton` — an ink pill in the staff shell's header band that opens a menu, of
which manual reservation is one item. This un-defers **D4** from the S-12 design contract
(`context/archive/2026-08-10-manual-reservation/design-contract.md:84-85`), which cut the
quick-action menu as out of scope.

**Live menu contents** (`MR_MENU`, pulled 2026-08-21 — the archived PNGs showing four items and a
crimson `NOWE` badge are **stale**):

- `Nowa rezerwacja` / `Dodaj wynajem ręcznie` — primary, crimson icon tile
- `Dodaj pojazd` / `Nowy pojazd do floty`

**Decisions taken 2026-08-24 (user):**

- **Reach: every staff page.** Matches the design — `QuickAddButton` is an unguarded child of
  `StaffTopbar`. Requires solving the five `showHeader={false}` pages and the vehicle-list
  plumbing for a global mount.
- **Sequencing: this change owns the `StaffShell` header restructure**; **S-13**
  (`context/changes/staff-global-search/`) rebases onto it and drops its `SearchField` into the
  same right-hand cluster, as the design draws it (`gap: 12`, search then pill). S-13's plan needs
  a refresh regardless — `plan.md:60` still calls S-12 an unmerged sibling branch.

**Known blocker before `/10x-plan` can close its Design Alignment Audit:** the two canonical boards
for the surfaces being built (`MrD_Menu` desktop popover, `MrM_Menu` mobile sheet) have only stale
repo exports. Being re-rendered from the live design project into `design-review/`.

**Collision rule decided 2026-08-24 — "v6", one create affordance per screen on mobile.**

The quick-add menu's second item (`Dodaj pojazd`) duplicates the Flota page's own primary action,
and on Zespół the two `+` circles are unrelated but visually identical. Six comparison boards were
rendered from the live design source (`design-review/variant-qa-v*.png`, mirrored to
`exports/quick-actions/` in the design project) and the rule chosen was:

- **Desktop (≥ md): the quick-add pill is global** — it belongs to the header band on every staff
  board. Board `qa-v5` settled this empirically: the pill sits in the shell topbar (white card, own
  bottom border) while a page action sits in the page row on the grey field — different bands, both
  labelled, no ambiguity. A page owning a create action is **not** a reason to omit it.
- **Mobile (< md): the page's own action wins.** A board that already owns a create action (Flota →
  `Dodaj pojazd`, Zespół → `Dodaj pracownika`) shows only its own circle. Every other mobile staff
  board gets the 40×40 ink quick-add circle.

Rejected, with reasons (do not re-litigate):

- **v1/v4 absorb** — page `+` opens the sheet with the page action as the primary row. Works and
  generalizes, but costs an extra tap on the page whose whole job is that action, and stretches the
  `SZYBKA AKCJA` eyebrow over a page-local action.
- **v2 contextual suppression** — de-duplicates the menu but leaves both circles standing, so it does
  not address the actual ambiguity; and it spends a full scrim + sheet on a single row.
- **v3 hierarchy only** — ranks by colour, but `tokens.red === tokens.accent === #B43638` in this
  system, so a crimson `+` reads as _careful_ rather than _primary_, and it fixes nothing on Zespół
  where there is no duplicate to rank.

v6 wins because it removes the ambiguity rather than annotating it, costs no taps, needs no per-page
sheet composition — and is what the live design already does (its mobile trigger is calendar-only;
the mobile pending-queue board carries no trigger at all).

**This also answers the parked mobile-scope question.** "Every staff page" holds on desktop; on
mobile the rule is per-screen. Note two hard limits found in the app during research: two staff
routes (`pickups/[reservationId]`, `returns/[reservationId]`) do not use `StaffShell` at all, and
below `md` there is no shell header — 8 hand-rolled per-page headers — so the mobile affordance is
per-board work either way.

**Size reconciliation owed.** The design draws the page-action circle via `chrome.iconBtn` = **40×40**,
identical to the quick-add circle; the app ships **48px** (`FleetList.tsx:292`, `StaffList.tsx:591`).
Under v6 the two never appear together, so this is no longer a collision — but the mismatch should
still be settled when the contract is written.

**Absorb shipped to the design project 2026-08-24.** 10 paths written; both `.jsx` files re-fetched
and byte-compared after upload. `exports/quick-actions/` now holds the full 18-file set.
`export-shot.html` untouched, so all `variant-qa-v0…v6` boards stay registered.

Implementation shape (kept deliberately narrow): **`MR_MENU` is never mutated.** `QuickMenuList` gained
one optional `promoted` prop that prepends the page action, marks it primary, then appends the canonical
rows **de-duplicated by key** and demoted to grey — which is why Flota renders 2 rows and Zespół 3 from
one code path. `QuickAddButton` got a matching pass-through, and **the desktop popover branch was left
un-plumbed on purpose**, so desktop cannot absorb even by accident.

Verified by interaction, not inspection — row order, promoted-tile colour (`accentSoft` `rgb(251,228,225)`),
demoted tiles (`greySoft` `rgb(238,241,245)`) and the `i === 1` divider all measured on four boards; both
paths fire (promoted row opens the real page form, `Nowa rezerwacja` mounts `ManualResFlow`). Regression
guard: all 10 pre-existing boards re-rendered **byte-identical** after editing the shared component.

**Incidental visual delta on Flota/Zespół closed state** — their circle changed from `chrome.iconBtn` to
`QuickAddButton`, so the shadow goes `tokens.shadow1` → `0 2px 6px rgba(10,10,15,0.14)` and the plus glyph
`18px` → `19px`. Same 40×40 ink circle otherwise. Exported closed states so this is visible, not buried.

**The two-tap cost is confirmed, and Flota is its weakest case.** Rendered, the Flota sheet is two rows,
one of which is exactly what the button did before — little work for the tap it costs. Zespół, at three
rows, earns it. Accepted knowingly; revisit only if staff complain.

**The `SZYBKA AKCJA` eyebrow worry is dismissed** — rendered, "SZYBKA AKCJA / Dodaj pojazd" reads
naturally; the eyebrow is generic enough not to claim the rows are global-only.

**Crimson-tile semantics — resolved as consistent, not a defect.** The render raised a concern: the
crimson `accentSoft` tile now moves between rows by screen (Flota → `Dodaj pojazd`, Wnioski →
`Nowa rezerwacja`), so it can't be learned as "means new reservation" — and on desktop it never moves.
On inspection the rule is **not** inconsistent: in the design source `primary: true` marks _the most
likely action_, not a specific one. Crimson has always meant "the primary row". Absorb changes **which
row is primary**, not what the colour means; desktop's primary simply never varies because desktop does
not absorb. Recorded as `deviation(context-primary)` rather than changed. Alternatives considered and
rejected: pinning crimson to `Nowa rezerwacja` (would make the visually loudest row _not_ the first one),
and dropping crimson from the menu entirely (consistent but discards the accent for no gain).

**Housekeeping:** the scratchpad's `admin-mobile.jsx.orig` was a **stale pre-v6 base** — the true base was
`admin-mobile.jsx.v6`. Trusting the filename would have wrongly blocked a safe push. Renamed to
`admin-mobile.jsx.STALE-pre-v6-do-not-use`.

**REVERSED 2026-08-24 — v6 is out, "unified absorb" is in (mobile only).** The rule is now:

> **One `+` per screen. It always opens the quick-action sheet. Where the page owns a create action,
> that action is promoted to the first row.**

- **Flota mobile** — single `+` → sheet: **`Dodaj pojazd`** (primary) then `Nowa rezerwacja`.
- **Zespół mobile** — single `+` → sheet: **`Dodaj pracownika`** (primary), `Nowa rezerwacja`, `Dodaj pojazd`.
- **Boards owning no create action** (Wnioski, Overdue, Kalendarz) — one quick-add circle, canonical
  order with `Nowa rezerwacja` first. Unchanged from the v6 pass.
- **`ScreenWorkerDash`** — still no affordance; the overflow measured under v6 is unaffected by this.
- **Desktop is NOT changed.** `qa-v5` settled that the quick-add pill and a page's labelled action
  coexist fine in separate bands, so the desktop page action is never demoted into a menu.

**Why the reversal.** v6's cost turned out to matter more than its benefit: it made manual reservation
**unreachable from Flota and Zespół on mobile**, which is a real dead end for a staffer already on
those screens. Absorb keeps one `+` per screen — v6's actual win — while keeping every action
reachable. The price, accepted knowingly: the page's own primary action costs **two taps** on the one
page whose job it is, and the `SZYBKA AKCJA` eyebrow sits over what is really a page-local action.

**Standing verdicts that survive the reversal** (do not re-litigate):

- **v2 contextual suppression** — leaves both circles standing, so it never addressed the ambiguity;
  a full scrim + sheet for one row.
- **v3 hierarchy only** — `tokens.red === tokens.accent === #B43638`, so a crimson `+` reads as
  _careful_, not _primary_; and it ranks nothing on Zespół, which has no duplicate.
- **v6 drop-on-create-pages** — the dead end described above. Boards kept at
  `design-review/variant-qa-v6-*.png` as the record of a considered option.
- **Desktop coexistence (v5)** — settled, unchanged.

**Superseded implementation record — v6 implemented in the design project 2026-08-24.** 15 paths written (5 `.jsx`/`.html` + 10 PNGs to
`exports/quick-actions/`), each re-fetched and byte-compared after upload. `export-shot.html` patched
additively (17→18 script tags, 84→92 `SCREENS` entries) so the eight variant boards are now renderable
in the project — previously `quick-actions-variants.jsx` was uploaded but inert, registered nowhere.

Where the rule landed:

| Board                                              | Owns a create action? | Outcome                                                  |
| -------------------------------------------------- | --------------------- | -------------------------------------------------------- |
| `ScreenFleetMgmt` (desktop)                        | yes                   | quick-add pill added — desktop is global                 |
| `ScreenOverdue` (desktop)                          | no                    | quick-add pill added                                     |
| `ScreenPendingQueue` (mobile)                      | no                    | quick-add circle added (36px spacer → 40px circle)       |
| `ScreenAdminOverdueMobile`                         | no                    | quick-add circle added (had no `right` prop at all)      |
| `ScreenAdminFleetMobile` / `ScreenAdminTeamMobile` | yes                   | unchanged — correct under v6                             |
| `ScreenAdminCalMobile`                             | —                     | unchanged, already compliant                             |
| `ScreenWorkerDash` (mobile Pulpit)                 | no                    | **refused — see below**                                  |
| Protocol/detail flows                              | —                     | unchanged; their right slot is `close` / `call customer` |

Evidence the edits were additive: all nine boards in the two touched files were rendered before and
after; the seven unintended boards came out **byte-identical PNGs**.

**`ScreenWorkerDash` was refused, and it exposes a pre-existing defect in the mockup.** Its title
`t.workerDash` = **"Dyspozytornia"** is a 273px unbreakable word at `fontSize: 40`; the row is 346px
and the existing search+avatar cluster already runs to **x=393.3 on a 390px artboard**, so the "PB"
avatar is clipped at the right edge _before_ any change and the title/cluster gap is **0**. A third
40px circle would push it 50px further off-screen. This overflow is not caused by this change and
should be fixed on its own terms; until then the mobile Pulpit has no quick-add.

**Two premises corrected during implementation** (recorded so they are not re-asserted):

1. "`ScreenOverdue` was never exported, so it was unrenderable" — **wrong rationale**. `function`
   declarations in these Babel-transpiled scripts land in global scope, so it rendered fine before.
   It was added to the file's `Object.assign` for convention, not as a fix.
2. `context/foundation/design/screenshots/09-staff-mobile-dashboard.png` and
   `10-staff-mobile-pending-queue.png` are **stale exports of the shipped app, not design-project
   renders** — different data, different chrome, English copy, and a filter button where the project
   now has an empty spacer. They are unusable as a design baseline; `design-system.md` rows 09/10
   present them as `staff-screens.jsx` sources, which is misleading. Worth correcting in the index.

**One desktop instance is weaker than v5 promised.** On `ScreenFleetMgmt` the header is a _single_
band, so `＋ Dodaj pojazd` and `＋ Nowe ⌄` sit adjacent as two ink pills and read as a matched pair.
Readable — the labels differ — but heavier than v5. Note this is an artifact of the design's admin
desktop shell: **our app's `/dashboard/vehicles` has two bands** (the `StaffShell` header plus
`FleetList`'s own header inside `<main>`), which is the v5 case, so the app should not inherit this.
Related pre-existing app bug to fix alongside: `vehicles.astro` renders the title twice at `md+`
(shell band + `FleetList`'s own `<h1>`), which the new right-slot affordance will make more visible.

**Split out 2026-08-24 — two findings surfaced here became their own changes:**

- `context/changes/service-read-projections/` — the `listFleet` `select("*")` over-fetch.
- `context/changes/vehicles-read-policy-gate/` — `vehicles_select_authenticated` is `USING (true)`,
  so this change's new `GET /api/vehicles` role check is the only barrier, with no RLS backstop.
  Whatever that change decides, this one's endpoint test still owes the explicit
  anon-401 / role-null-403 / employee-200 triple.

Sequencing matters for the first: this change multiplies that payload across ~10 staff pages, so
if it lands first the projection work becomes a second pass over the same code.

Research: `research.md`
