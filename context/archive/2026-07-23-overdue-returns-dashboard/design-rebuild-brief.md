# Claude Design — Rebuild Brief: Overdue returns (S-07)

> **Purpose.** Instructions to hand to Claude Design to (re)build the overdue-returns
> surface. The corrected artboards you export from this become the **canonical**
> screenshots for S-07 — drop them into `context/changes/overdue-returns-dashboard/design-review/`.
> The `/10x-plan` design-alignment audit (Step 6) then audits the plan against them.
>
> Source of truth for structure/tokens: `context/foundation/design-system.md`.
> Design project: "Rental car company". Build the app later against tokens in
> `src/styles/global.css` — this brief is design-only.

## 1. The one decision that shapes everything

**Overdue is NOT a new page. Fold it into the existing "Zwroty" (Returns) dashboard.**

The shipped app already flags overdue on `/dashboard/returns`: the returns worklist
fetches every open overdue rental (no lower date bound) and paints a red `Po terminie`
badge + accent on each. So S-07 does **not** re-invent overdue detection — it makes the
existing overdue **navigable, filterable, and legible**. The redesign adds three things
to the current Zwroty surface and nothing else.

## 2. Supersede the old mockups

| Old catalog artboard                                  | Status             | Why                                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `18-admin-desktop-overdue-returns.png`                | **Superseded**     | Depicts a dedicated overdue page with penalty columns + extend/contact actions — not the chosen direction.                                                                           |
| `24-admin-mobile-overdue-returns.jpg`                 | **Superseded**     | Same, mobile.                                                                                                                                                                        |
| The three "Po terminie" mockups reviewed this session | **Reference only** | Their _card treatment_ (row id, vehicle, customer, `OPÓŹNIENIE`) informs the overdue card — but stripped of penalty/extend/contact, and living inside Zwroty, not a standalone page. |

The **baseline to preserve** is the current shipped Zwroty page (its header, the three
stat cards, the returns rows, the mobile tab bar). Redesign _on top of it_.

## 3. What to add (the entire scope of S-07)

1. **Overdue count badge on the "Zwroty" nav item.** A red/danger count badge on the
   sidebar + mobile-tab "Zwroty" entry, showing the number of open overdue rentals.
   Mirror the existing `Wnioski` pending-count badge exactly (same pill shape, size,
   placement; danger tint instead of warning). Hidden when the count is 0.
2. **Clickable top-row stat cards as filters.** The three cards — `Na dziś` /
   `Po terminie` / `Zwrócono` — become filter toggles over the worklist below.
   - Selecting `Po terminie` filters the list to overdue only; `Na dziś` to due-today;
     `Zwrócono` to returned-today; selecting none (or a "Wszystkie/Clear" affordance)
     shows all.
   - Design the **selected state** of a card (ring/fill), and how the list header
     reflects the active filter. Keep the counts live.
3. **Days-overdue label on overdue cards.** Add an `OPÓŹNIENIE` metric to each overdue
   row — e.g. `2 dni po terminie`. Derive from return date vs today (no new data).
   Design its placement + the plural-aware copy (`1 dzień` / `N dni`).

## 4. What to EXCLUDE — record each as a deviation, do not design it

- **`STAWKA KARY` (penalty rate) + `NALICZONE` (accrued penalty).** v1 PRD Non-Goal
  (flag-only, no auto late-fee). Deferred to v2. Omit the money columns entirely.
- **`Extend booking` action.** A separate future slice (a new write capability). Do not
  add an extend button/flow here.
- **`OSTATNI KONTAKT` (last-contact) column + contact logging.** Needs data we don't
  track. If a "Contact" affordance is wanted at all, design it as a plain phone link
  (tap-to-call), with **no** "last contacted" timestamp.

## 5. States & breakpoints to deliver (so the design is complete)

Export **both mobile and desktop** for each state below (incomplete states are the #1
thing the plan's design-audit rejects):

- **Has overdue** — worklist with a mix of overdue + due-today rows; badge shows a count.
- **`Po terminie` filter active** — list filtered to overdue only; the stat card in its
  selected state; header reflects the filter.
- **No overdue (healthy)** — badge hidden; `Po terminie` count is 0; overdue filter
  yields an empty/So-far-so-good state — design that empty copy.
- **Empty worklist** — nothing due, nothing overdue (reuse/extend the existing Zwroty
  empty state).

## 6. Constraints (carry into every artboard)

- **Copy is `pl-PL`, canonical.** Reuse existing strings verbatim (`Zwroty`,
  `Na dziś`, `Po terminie`, `Zwrócono`, `Przyjmij zwrot`). New copy (the overdue label,
  the empty-overdue state, any filter/clear control) must be Polish and final.
- **Reuse existing components/tokens** — the stat cards (`StatCard`/`StatPill`), the
  `Po terminie` badge, the returns row, the nav badge. Don't introduce a new visual
  language; extend the shipped one.
- **Exact values, not ranges.** When you hand this to the plan, every spacing/radius/
  size must be a single value per element (the app's fidelity rule forbids "15–20px").
  Any deliberately responsive/fluid value must be called out as an intentional range.
- **Mobile-first, staff on phones/tablets** (PRD NFR). The mobile tab bar drops
  `Zwrócono` today — decide whether the overdue badge/filter survives that collapse.

## 7. How this feeds planning

1. You rebuild/correct the above in Claude Design.
2. Export the artboards (§5) as PNGs into `context/changes/overdue-returns-dashboard/design-review/`.
3. Run `/10x-plan overdue-returns-dashboard`. Its Step 6 audit will: mark `18`/`24`
   superseded, freshness-check the rest, confirm your new set covers every state,
   distil `design-contract.md` at exact values, and verify each plan phase maps to a
   surface — blocking until aligned.
