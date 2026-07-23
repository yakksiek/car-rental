# Claude Design brief — align the S-06 Return Protocol screens

> **Paste this into the "Rental car company" Claude Design project.** It instructs Claude to correct the
> existing return screens and add two missing ones so the design fully matches the engineering plan
> (`return-protocol-comparison`) and the product roadmap (slice S-06). Polish copy is canonical. Use the
> project's existing tokens (`shared.jsx` / `tokens.css`) and reuse the existing pickup-protocol components.

---

## Goal (roadmap S-06)

A logged-in employee fills a **return protocol**: the issue-protocol **baseline is shown as read-only
reference**, all current values (odometer, fuel, damage, photos, signature) are **entered fresh**, and the
system **auto-computes and displays deltas** — km driven, fuel change, and new damage. The completed protocol
is emailed to the customer. The return protocol must be **fully usable on a phone/tablet in the field** (NFR).

The return protocol reuses the **shipped pickup-protocol form shape** — it is the same handover form with a
comparison, not a different UX. Mirror `ScreenStaffPickupV2` (desktop, `DeskPickupBody`) and the pickup form's
mobile shape, adapted for return.

---

## Global rules — apply to every return screen

1. **Deltas only — NO money, anywhere.** Remove every monetary figure and charge: delete the fuel refuel cost
   (`"+ 184 zł"`), the km-limit money/verdict (`"w limicie"`, `"300 km/dzień"` as a charge), and any `zł` in
   the comparison or the sent summary. The system surfaces _discrepancies_ (km, fuel, new damage); the
   employee handles any charges manually. (This is a hard product Non-Goal: no automatic cost/late-fee in v1.)
2. **Match the pickup FORM, not a wizard.** The return is a **single scrolling form** on mobile (numbered
   sections, no step rail / no "step 6 of 6" progress) and a **two-column layout** on desktop (left: condition
   - damage; right: photos + signature — packed independently), exactly like the shipped pickup protocol.
     Remove the wizard step-rail and the standalone "review" model.
3. **Baseline is reference; current is entered fresh.** Show each issue-protocol value as a read-only
   reference ("Przy wydaniu"), and make the current value an **editable input** ("Przy zwrocie") that drives a
   **live** delta. Never pre-fill an editable current field with the baseline (the employee must inspect and
   enter fresh).
4. **Structured damage with `existing | new` tags — keep it, add a manual override.** Each current damage the
   employee enters is auto-tagged **Istniejące** (matches a baseline item) or **Nowe** (no match); add a
   per-row control that lets the employee **correct the tag** (pick a baseline item or mark it new). Show the
   baseline damage list as read-only reference.
5. **Soft warnings, never block.** If a current value is implausible (e.g. return odometer **below** the
   pickup odometer → negative km), show an inline warning in the `warning` token — but never disable submit.
6. **Adverse deltas flagged, neutral otherwise.** km driven = neutral; fuel lower than pickup and any new
   damage = flagged with the `warning`/`red` token. No severity grading beyond that.

---

## Screen 1 — Return protocol form, MOBILE (rework `ScreenReturnProtocol`)

Replace the current 6-step wizard comparison screen with a **single scrolling form**, mirroring the mobile
pickup form's numbered sections:

- **Header:** back / "Protokół zwrotu" / close. Context strip: `R-2401 · Anna Nowak · Ford Transit · WX 5519M · Zwrot 10:00`. No progress bar, no step rail.
- **Section 1 — Stan techniczny (with live comparison):**
  - **Licznik**: an odometer **input**. Below it, read-only reference `Przy wydaniu: 48 712 km` and a live
    delta `Przejechano: +1 228 km` (neutral). Soft-warn if the entered value is below the baseline.
  - **Paliwo**: the fuel bar **input**. Reference `Przy wydaniu: 7/8` and live delta `Zmiana paliwa: −4/8`
    (flagged when lower). **No zł.**
- **Section 2 — Zdjęcia pojazdu:** 6 fresh photos captured now (same tiles/behaviour as pickup — camera or
  upload, 0/6 → 6/6).
- **Section 3 — Uszkodzenia:** show the **baseline damage list read-only as reference** ("Z protokołu
  wydania"), then the employee's fresh current-damage list. Each entered damage row carries the
  **Istniejące / Nowe** tag with a control to change it. New damage uses the `red`/`Dodane` styling; existing
  uses the neutral `greySoft` styling.
- **Section 4 — Podpis:** customer acknowledgement checkbox + signature via the **full-screen signature
  modal** (same component as pickup).
- **Comparison summary** (can sit at the top of Section 1 or as its own card): Przejechano / Zmiana paliwa /
  Nowe uszkodzenia — neutral summary, adverse flagged, **no money**.
- **Submit bar (sticky):** `Potwierdź zwrot i wyślij`.
- **Sent overlay:** success, "wysłano do <email>", the delta summary (km / fuel / new damage — **no zł**), and
  a `Pobierz PDF` download.

Keep the existing `RPCompare` visual (pickup → return → delta) — just make the **return side an input** and
strip the money notes.

---

## Screen 2 — Return protocol form, DESKTOP (rework `ScreenStaffReturn`)

Restructure into the **two-column form** used by `ScreenStaffPickupV2` (`DeskPickupBody`), inside
`StaffShell` + `StaffTopbar title="Protokół zwrotu"`:

- **Left column — condition + damage:**
  - Odometer + fuel as **inputs**, each with the "Przy wydaniu" reference and the live delta beside/under it
    (reuse the `DeskCompare` pickup → return → delta layout, but the **return value is an input** and there is
    **no `zł` / no "w limicie" note**).
  - Damage: baseline reference list (read-only) + the employee's fresh current list with `Istniejące/Nowe`
    tagging + manual override (reuse `PpDamageRow` / the pickup damage editor).
- **Right column — photos + signature:** 6 fresh photo tiles + the signature field (opens the desktop
  signature modal). Keep the compact comparison summary card (km / fuel / new damage — **no money**).
- **Footer:** `Wstecz` + `Zakończ i wyślij`.
- **Failure & edge states** (mirror the pickup desktop modals): email-failed (commit succeeded, resend +
  download available), pdf-failed, and conflict (a return protocol already exists) — reuse
  `ScreenStaffPickupFailed` / `ScreenStaffConflict` patterns with return copy.

---

## Screen 3 — Returns dispatch list, `/dashboard/returns` (NEW)

Clone the pickups queue as a staff worklist:

- **Adds a `Zwroty` tab** to the staff sidebar / mobile tab bar (icon consistent with the nav set).
- **Lists** reservations that were **issued** and are **due today or overdue**, not yet returned. Each row:
  reference, customer, vehicle, plate, return time. **Overdue rows are flagged** (past return date).
- **Action:** `Przyjmij zwrot` → opens the return form (Screen 1/2).
- **Returned rows** stay visible for the day with a **delivery badge** (`Dostarczono` / `E-mail niewysłany` /
  `Błąd PDF`), `Otwórz protokół`, and a resend action — same as the pickups queue.
- **Empty state:** `Brak zwrotów na dziś` + a short helper line.

_Roadmap note:_ overdue flagging is also slice **S-07** (overdue-returns dashboard). Keep them distinct — S-07
_flags_ overdue returns on the dashboard; this returns list is where the employee _processes_ the return. The
staff dashboard already shows today's returns + an overdue stat; this is the dedicated worklist.

---

## Screen 4 — Return protocol view, read-only (NEW)

Mirror the pickup protocol view screen:

- Read-only return protocol: odometer, fuel, photos, damage (with `Istniejące/Nowe` tags), signature.
- The **comparison block** (Przy wydaniu vs Przy zwrocie + deltas — no money).
- `Pobierz PDF` download (`protokół zwrotu`).
- Delivery badge + resend action.

---

## Canonical Polish copy

| Context                  | String                                              |
| ------------------------ | --------------------------------------------------- |
| Screen title             | `Protokół zwrotu`                                   |
| Comparison heading       | `Porównanie`                                        |
| km delta label           | `Przejechano`                                       |
| fuel delta label         | `Zmiana paliwa`                                     |
| new-damage label         | `Nowe uszkodzenia`                                  |
| baseline reference       | `Przy wydaniu`                                      |
| current value            | `Przy zwrocie`                                      |
| existing-damage tag      | `Istniejące`                                        |
| new-damage tag           | `Nowe` (or `Dodane`)                                |
| damage reference heading | `Z protokołu wydania`                               |
| submit                   | `Potwierdź zwrot i wyślij` / `Zakończ i wyślij`     |
| dispatch action          | `Przyjmij zwrot`                                    |
| nav tab                  | `Zwroty`                                            |
| delivery badges          | `Dostarczono` / `E-mail niewysłany` / `Błąd PDF`    |
| dispatch empty           | `Brak zwrotów na dziś`                              |
| PDF download             | `Pobierz PDF`                                       |
| odometer soft-warn       | `Licznik niższy niż przy wydaniu — sprawdź odczyt.` |

**Remove:** `w limicie`, `+ 184 zł`, `300 km/dzień` (as a charge), and every other `zł` on the return screens.

## Tokens

Use the project's existing tokens only (no new palette, no dark theme): crimson `accent` for primary actions,
`warning`/amber for adverse deltas and soft warnings, `greySoft` for the `Istniejące` tag, `redSoft`/`red`
for `Nowe`/adverse, hairlines and card shadows as in the pickup screens. Match the pickup protocol's spacing,
radii, and typography exactly — the return protocol is the same form family.

---

## Acceptance checklist (design is "aligned" when all true)

- [ ] No monetary figure appears on any return screen (no `zł`, no refuel cost, no km-limit verdict).
- [ ] Mobile return is a single scrolling form (no wizard / step rail); desktop is two-column like the pickup.
- [ ] Baseline shows as read-only reference; current values are editable inputs driving live deltas.
- [ ] Damage is structured with `Istniejące/Nowe` tags **and** a manual override control; baseline damage is
      shown as reference.
- [ ] Fresh photo capture + signature are present on the return form (not just a review).
- [ ] Adverse deltas (fuel down, new damage) are flagged; km driven is neutral.
- [ ] A `/dashboard/returns` worklist exists (due + overdue, `Przyjmij zwrot`, delivery badges) with a `Zwroty`
      nav tab.
- [ ] A read-only return-protocol view with the comparison block + `Pobierz PDF` exists.
- [ ] Tokens, spacing, and copy match the shipped pickup protocol.
