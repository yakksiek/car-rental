# Claude Design prompt — S-05 issue protocol

> ## ⚠ SUPERSEDED — 2026-07-09. Do not re-send this prompt.
>
> Everything below was **built**. See `design-audit.md` (v2) for what landed:
> `protocol-parts.jsx`, `pickup-protocol.jsx`, `staff-protocol-desktop.jsx`, 17 PL exports.
> Kept only as the record of what was asked for.
>
> **If you need a second design pass, ask for these five things instead** (audit v2 §A–§E):
>
> 1. **Desktop is missing three states mobile has** — photo upload in-progress/failed,
>    validation errors, PDF-generation failed. `DeskPickupBody` already takes an `uploads`
>    prop that no screen passes, and has no `errors` mode.
> 2. **A damage item cannot be deleted** — `PpDamageEditor` offers only `Anuluj` / `Zapisz`.
> 3. **Delivery badge + resend only exist in the post-submit overlay.** Need a badge on the
>    dispatch row, a protocol list, and a view-an-issued-protocol screen with PDF download —
>    the conflict screen's `Otwórz protokół` button already points at a screen that doesn't
>    exist. Dismissing the overlay currently strands a failed protocol.
> 4. **Drop the `W toku` chip** from `ScreenStaffDash` — a protocol is binary (Q7). Or derive
>    it from "pickup due today, no protocol row".
> 5. **Delete the superseded screens** — `ScreenPickupProtocol` + `ScreenPickupSignature`
>    (fake 6-step wizard) and `ScreenStaffPickup` (5-step rail). Also the vestigial `Wstecz`
>    button in `DeskFooter`.

---

> Gaps sourced from `context/changes/issue-protocol/design-audit.md`
> Target project: `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`)
> Paste everything below the rule.

---

## Context

You are extending the **Flota** (FleetRent) design system — a Polish-only,
single-tenant commercial-vehicle rental app. Work inside the existing project
`Rental car company`. Reuse `shared.jsx` tokens, icons and atoms; don't invent new ones.

Files in play:

- `staff-screens.jsx` — staff **mobile**: `ScreenWorkerDash` (Dyspozytornia),
  `ScreenPickupProtocol` ("Krok 3 z 6"), `ScreenPickupSignature` ("Krok 6 z 6"),
  `ScreenReturnProtocol`.
- `staff-desktop.jsx` — staff **desktop**: `ScreenStaffDash` (Harmonogram na dziś),
  `ScreenStaffRequests`, **`ScreenStaffPickup`**, `ScreenStaffReturn`.
- `shared.jsx` — tokens + the `useLang()` EN/PL dictionary.

Polish copy is canonical and the `PL` dictionary in `shared.jsx` is already complete
for this slice — **reuse the existing keys**, add PL for anything genuinely new.

## What I'm building

**S-05 "issue protocol"**: at vehicle pickup an employee records the odometer, fuel
level, damage, photos and the customer's signature. On submit the protocol is emailed
to the customer as a **PDF attachment**. The customer has **no account and no portal** —
email is their only channel and that PDF is their only copy of the evidence, possibly
needed in a dispute months later.

It runs on **both phone and desktop**. Phone is the employee standing at the vehicle.
Desktop is the depot laptop — where photos taken earlier on a phone get **uploaded from
disk**, and where a failed protocol gets retried. Neither is a second-class citizen.

---

# What's wrong today

## 1. The two flows disagree on how many steps exist, and most steps aren't there

- **Mobile** `ScreenPickupProtocol` declares `totalSteps = 6` and opens at
  `useState(3)`, but the body never branches on `step` — `Wstecz`/`Dalej` just slide a
  progress bar across one hardcoded screen. **Steps 1, 2, 4 and 5 do not exist.**
- **Desktop** `ScreenStaffPickup`'s step rail names **five** steps —
  `['Klient', 'Stan techniczny', 'Zdjęcia', 'Podpis', 'E-mail']` — hardcoded to index 1.
  **Klient, Podpis and E-mail do not exist on desktop.**

Six versus five. Please **reconcile them into one flow** that both viewports share, and
design every step in it.

My lean: **mobile = one scrolling form** with section headers (an employee in the rain
should not paginate), **desktop = the existing two-column layout**. If you disagree,
design what you think is right and say why in a note.

## 2. Nothing captures a fuel level, and desktop can't capture a signature

Current state, which I want you to close:

| Control      | Mobile                   | Desktop                                          |
| ------------ | ------------------------ | ------------------------------------------------ |
| Odometer     | static `<span>`          | ✅ real `<input>`                                |
| Fuel level   | static 8-segment bar     | ❌ also static — **no selector exists anywhere** |
| Damage notes | static prose `<div>`     | ✅ real `<textarea>`                             |
| Photos       | tile with `filled: bool` | ✅ drag-drop zone + tiles                        |
| Signature    | decorative path only     | ❌ **no signature screen at all**                |

Please design:

- **Fuel level** — a selector on an **eighths** scale (0/8 … 8/8), matching the existing
  8-segment gauge, with PL notch labels (`pusty`, `1/4`, `1/2`, `3/4`, `pełny`).
  Chip-group, slider or stepper — your call, but it must work with a thumb.
- **Odometer on mobile** — numeric entry, `km`, thousands grouping, numeric keypad, plus
  the invalid state (a reading lower than the previous one).
- **Signature on desktop** — this is the interesting one. Signing with a trackpad is
  miserable. Show me how you'd handle it: a larger pad? a "hand the laptop over" framing?
  a "sign on the phone instead" handoff? Or argue it's genuinely out of scope for desktop
  and the desktop flow should stop before `Podpis`.
- **Signature on mobile** — empty state with a "sign here" affordance, stroke-in-progress,
  `Wyczyść`, and a too-short/invalid state.
- **Photo tiles**, all states, both viewports: empty · uploading (progress) ·
  uploaded · **upload failed + retry** · remove/retake. Mobile opens the rear camera;
  desktop keeps the drag-drop zone (multi-select + a drop-hover state).

## 3. The damage model contradicts itself — this is the one that blocks me

| Where                             | Damage is…                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| mobile condition + desktop pickup | **free text** — a prose blob / `<textarea>`, footer "2 uwagi · auto-zapis"                                                                        |
| mobile signature summary          | **countable** — "2 uwagi"                                                                                                                         |
| both return screens               | **structured items** — "Rysa — lewy tylny zderzak (15 cm)", each with its own photos ("2 zdjęcia · zwrot 10:34") and an `istniejące` / `nowe` tag |

The return protocol's whole reason to exist is auto-comparing new damage against the
issue baseline. **You cannot diff a prose blob.** Please **commit to structured damage
items** and design:

- A **damage list**: empty → one item → several items.
- A **damage-item editor**: short title, description, location on the vehicle, optional
  severity, and **photos attached to that specific item**.
- Add / edit / delete an item, on both phone and desktop.
- How an item later gets tagged `istniejące` vs `nowe` in the return protocol.

Then reconcile it with the six-slot photo grid (see §5).

## 4. Every failure path is undesigned

All of these are committed behaviours with no surface:

- **Email delivery failed.** The protocol saved; the customer got nothing. Design a badge
  on the protocol / dispatch row and a **`Wyślij ponownie`** action. States: `wysłano` ·
  `błąd wysyłki` · `oczekuje`.
- **PDF generation failed.** The handover physically happened, so the protocol still
  commits — but no email goes out and it must be badged for a later retry.
- **Upload failed / offline** at the vehicle.
- **Protocol already exists** for this reservation (one protocol per reservation).
- **Per-field validation errors**, and scroll-to-first-error on submit.
- **Empty state**: "no pickups today" on both dashboards.
- A **failure twin** for the two existing sent-overlays (`ScreenPickupSignature`'s bottom
  sheet and `ScreenStaffReturn`'s centered modal). Both are success-only today.

## 5. Confirm the photo model

Six fixed labeled slots (`Przód, Tył, Lewy, Prawy, Wnętrze, Uszkodz.`) with a `4 z 6`
counter — but the return screens attach photos **per damage item**. Pick one:

- exactly six fixed slots, or
- six fixed slots **plus** arbitrary extras, or
- photos belong to damage items, and the six slots are just the required baseline.

Show the counter, which slots are required vs optional, and what happens at submit when a
required one is empty.

## 6. Nice to have, if there's room

- A **view-an-issued-protocol** screen (read-only) with a **PDF download**, so a protocol
  can be reopened months later during a dispute. The PDF-failure recovery path assumes an
  employee retries from a desktop — but there is currently nowhere to retry _from_.
- A protocol **history** list.

---

## Data constraints

**Registration plate — keep using it, and use it more.** The design already carries
`plate` on every `VEHICLES` record and `vPlate: 'Rejestracja'` in the add-vehicle form.
The database doesn't have the column yet; I'm adding it. The fleet will hold **many
identical models** (ten Ford Transits), so the plate is the only practical way to tell
one vehicle from another. Please surface it wherever a vehicle is identified — the
dispatch rows, the protocol header, and prominently on the PDF.

**Don't rely on these** — no such fields exist and inventing them creates work I may not do:

- Per-reservation pickup/return **times** (`09:00`, `10:30`). Pickup is a fixed 14:00 and
  return a fixed 10:00 by business rule; dates carry no time-of-day. Tell me if the
  protocol genuinely needs a real timestamp of the handover itself (as opposed to the
  booking) — that one I would add.
- Driver licence category / expiry — not in the product spec; assume out of scope.
- A `Opłata za paliwo` złoty amount — there is no refuel-rate field.
- The `W toku` chip on both dashboards implies a **draft / half-finished protocol**. Tell
  me if the design truly needs a draft state; otherwise a protocol is binary (it exists or
  it doesn't) and that chip should go.

## Deliverables

1. Updated `staff-screens.jsx` (mobile) and `staff-desktop.jsx` (desktop), sharing one
   reconciled step model.
2. New PL entries in `shared.jsx` for anything new. The existing protocol keys are already
   translated — reuse them.
3. **Exported screenshots with `T.lang = "PL"`** (the current exports were captured in
   English). Include the three screens that were _never_ exported: `ScreenStaffPickup`,
   `ScreenStaffReturn`, and both sent-overlays. Cover: the protocol form on both
   viewports, the damage-item editor, photo upload states incl. desktop drag-and-drop,
   the signature step, the success overlay, and each failure surface.
4. A short note explaining your calls on: the step count (§1), desktop signature (§2),
   and the photo model (§5).
