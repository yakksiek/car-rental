# Rendered vision-diff — S-12b quick-action menu

> Phase 5 gate. Renders of the **running app** in `renders/`, diffed against the canonical boards in
> this folder. Per `lessons.md`, the comparison is against the _mockup_, never a baseline of our own
> render. Captured 2026-08-24 at the boards' own breakpoints (1320×820 desktop, 390px mobile).

## Pairs compared

| App render                                                             | Canonical board                           | Verdict |
| ---------------------------------------------------------------------- | ----------------------------------------- | ------- |
| `renders/app-desktop-pill-closed.png`, `app-desktop-band-closed.png`   | `desktop-overdue-with-quickadd.png`       | match   |
| `renders/app-desktop-popover-open.png`, `app-desktop-popover-only.png` | `desktop-01-quick-action-menu.png`        | match   |
| `renders/app-mobile-pending-queue-closed.png`                          | `mobile-pending-queue-with-quickadd.png`  | match   |
| `renders/app-mobile-pending-queue-sheet.png`                           | `mobile-01-quick-action-sheet.png`        | match   |
| `renders/app-mobile-flota-absorb-{closed,sheet}.png`                   | `mobile-flota-absorb-{closed,sheet}.png`  | match   |
| `renders/app-mobile-zespol-absorb-{closed,sheet}.png`                  | `mobile-zespol-absorb-{closed,sheet}.png` | match   |

## Measured, not eyeballed

Every figure below was read off the running app with `getComputedStyle` / `getBoundingClientRect`,
because a screenshot cannot settle a 1px radius or a 0.5px letter-spacing.

| Spec (design-contract.md)    | Expected                                               | Measured                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop pill                 | 38px tall, radius 10, `tokens.ink`, 13px/650           | `102x38`, `10px`, `rgb(15,23,42)`, `13px / 650`                                                                                          |
| Band action cluster gap      | 12                                                     | `12px` (computed gap **and** the rendered 12px between the calendar button's right edge and the pill's left)                             |
| Calendar button (Pulpit, D7) | 38×38, left of the pill                                | `38x38`, left of the pill                                                                                                                |
| Popover                      | width 278, radius 16, padding 8, `top: 44`, `right: 0` | `278`, `16px`, `8px`, top offset from trigger top `44`, right-edge delta `0`                                                             |
| Mobile circle                | 40×40, `0 2px 6px rgba(10,10,15,0.14)`, 19px glyph     | `40x40`, `rgba(10,10,15,0.14) 0px 2px 6px`, `19px`                                                                                       |
| Menu row                     | padding `11px 12px`, radius 12, gap 12                 | `11px 12px`, `12px`, `12px`                                                                                                              |
| Divider (E13)                | `borderTop` on index 1 **only**, `paddingTop: 13`      | row 0 `0px` / row 1 `1px` + `13px 12px 11px` / row 2 `0px` (Zespół)                                                                      |
| Tile — primary               | `tokens.accentSoft` `#FBE4E1`                          | `rgb(251, 228, 225)`                                                                                                                     |
| Tile — non-primary           | `tokens.greySoft` `#EEF1F5`                            | `rgb(238, 241, 245)`                                                                                                                     |
| Row sets                     | desktop 2 · Flota 2 · Zespół 3                         | 2 / 2 / 3, promoted first and crimson on both absorb boards                                                                              |
| E12 — desktop never absorbs  | canonical rows on every page                           | verified on all 7 routes: `Nowa rezerwacja` (crimson) then `Dodaj pojazd` (grey), including `/dashboard/vehicles` and `/dashboard/staff` |
| Centred titles (4.8)         | stay optically centred                                 | 0px offset on Kalendarz, Wydania, Wnioski                                                                                                |
| 360px density                | no clipping, no h-scroll                               | all 7 headers: one circle, `scrollWidth === viewport`                                                                                    |

## Punch-list

Empty of component divergences. Two entries, neither a defect:

1. **Scrim tint in the mobile renders** — the top of the blurred backdrop reads pink in
   `app-mobile-*-sheet.png`. That is the dev-only _"Resend nie jest skonfigurowany"_ banner
   (`src/lib/config-status.ts`) showing through the blur, not a scrim colour divergence. The scrim
   itself is `rgba(20,18,22,0.5)` + `blur(6px)` as specified, and the banner is absent wherever
   Resend is configured.
2. **No 38×38 calendar button beside the pill except on Pulpit** — recorded deviation **D7**
   (`deviation(scope)`); adding it console-wide belongs to `staff-global-search`.

Deviations D3–D10 stand as recorded in `design-contract.md` and were not re-flagged.

## Icon note

The contract is silent on the menu rows' icons, so they were taken from the design source pulled live
(`manual-reservation.jsx` `MR_MENU`, `quick-actions-variants.jsx` `QAV_EMPLOYEE`):
`Icon.calendar` → lucide `CalendarDays`, `Icon.truck` → `Truck`, `Icon.user` → `User`. Note this
overrides `plan.md`'s Phase 4 line, which named `UserPlus` for the promoted Zespół row — the canonical
board draws a plain person glyph, and the board is the tiebreaker.
