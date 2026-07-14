---
date: 2026-07-09
auditor: MarcinK (via /10x-plan issue-protocol)
topic: "S-05 issue-protocol — design coverage audit (v2, post-redesign)"
sources:
  - Claude Design project 352d78a6-84fd-49a2-8b38-2fe289691fc3 → protocol-parts.jsx,
    pickup-protocol.jsx, staff-protocol-desktop.jsx, add-vehicle.jsx, shared.jsx (read via DesignSync)
  - 17 new PL exports under exports/pl-{mobile,desktop}-*.png
status: near-complete — 7 residual gaps, none blocking the data model
supersedes: audit v1 (2026-07-09, pre-redesign)
---

# S-05 Design Coverage Audit — v2

The redesign landed. **Every decision from the Q1–Q11 answer sheet was implemented, and
the data model is now fully pinned down.** What remains is a short punch list of missing
_states_ (mostly desktop) and one structural leftover.

New files: `protocol-parts.jsx` (shared `Pp*` components), `pickup-protocol.jsx` (mobile),
`staff-protocol-desktop.jsx` (desktop). Verified by reading source, not screenshots.

## Decisions — all honored

| #   | Decision                                                        | Evidence                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q2  | Mobile = one scrolling form; desktop = two-column; no step rail | `PkBody` renders 4 numbered `PpSection`s (Stan → Zdjęcia → Uszkodzenia → Podpis). `DeskPickupBody` is `gridTemplateColumns: '1.35fr 1fr'`. Both files' headers state "customer is a read-only header, _email_ is what submit does."   |
| Q3  | Hybrid photo model                                              | Six fixed baseline slots + per-damage photos. The old `damage` slot became **`slDash` = "Deska rozdz."** (dashboard) — a genuinely good call: it captures the odometer, and damage evidence moved onto damage items where it belongs. |
| Q4  | Damage item = type · location · size · photos · existing/new    | `PpDamageEditor`: 4 type chips (`Rysa`, `Wgniecenie`, `Pęknięcie`, `Brak części`), free-text location, size, per-item photo strip. **No severity, no cost estimate** — exactly as scoped.                                             |
| Q5  | Re-add plate                                                    | `add-vehicle.jsx`: `<VField label={t.vPlate} ph="WX 0000A" req />` on **both** mobile and desktop, required. Also rendered in `PpContext`, the desktop topbar subtitle, and the conflict card.                                        |
| Q6  | Failure states (minus offline)                                  | `PkOverlay` covers `sent` / `email` / `pdf`; `ScreenProtocolConflict`; `ScreenNoPickups`; `mode="errors"` validation; `PpPhotoSlot` has `empty/uploading/failed/done`. Offline correctly absent.                                      |
| Q7  | Binary — drop `W toku`                                          | ❌ **Not done.** See gap D.                                                                                                                                                                                                           |
| Q8  | Desktop signature = draw in a pad                               | `PpSignaturePad` — a real `<canvas>` with mouse **and** touch handlers, empty prompt (`Poproś klienta o podpis`), `Wyczyść`, signed-by line. Shared by both viewports.                                                                |
| Q9  | Tappable eighths                                                | `PpFuelBar` — 8 `<button>` segments, `aria-label={i}/8`, E/F end labels.                                                                                                                                                              |
| Q10 | Fixed 14:00 / 10:00                                             | `PpContext` prints `t.proto.pickupAt 14:00` / `returnAt 10:00`. Signature carries `at="14:08"` — a separate handover timestamp. Exactly the `signed_at` split.                                                                        |
| Q11 | PL exports                                                      | 17 files: `pl-mobile-01..09`, `pl-desktop-01..08`.                                                                                                                                                                                    |

**Polish copy verified mechanically**: `STR.EN.proto` and `STR.PL.proto` both hold **82
keys, zero asymmetry**, and all **67 keys** referenced across the three screen files exist
in `PL`. No `undefined` will render.

## Why the non-obvious calls were made

The table above records _what_ was decided. These are the ones a future reader will want to
challenge, with the reasoning that settled them (answer sheet, 2026-07-09).

- **No step wizard, on either viewport.** The desktop rail's five steps weren't five steps:
  `Klient` is not data entry (name/email/phone already exist on the confirmed reservation —
  it's a read-only header), and `E-mail` is not a step (it's what submit _does_). What's left
  is three real sections. An employee standing at a vehicle in the rain should not paginate.
- **Damage: no `severity`, no `cost` field.** Severity duplicates what type + size already
  say ("Rysa, 15 cm" _is_ the severity). Cost is a PRD non-goal — v1 has no automatic
  late-fee or damage-charge calculation, staff charge manually — and putting a złoty figure
  on a document the customer signs creates a number we can't stand behind.
- **Damage location is free text, not a body-part picker.** A picker is a large component
  that has to be right on a phone, and the return comparison matches items by identity, not
  by parsing a location string.
- **Offline was cut deliberately.** True offline means local persistence plus a sync queue —
  a subsystem, not a screen. v1 is responsive web, no native app (PRD Non-Goals). Weak signal
  degrades into the upload-failed-and-retry state, which is the honest 90% of it.
- **Protocol state is binary, not draft/`W toku`.** A draft would mean a half-signed legal
  document persisted in the database, and it would break the `unique (reservation_id)`
  invariant that guarantees one protocol per handover. If a dashboard row needs to look
  different, derive it (pickup due today + no protocol row), don't store it.
- **Desktop signature = draw in a pad; send-to-device deferred to v2.** Pairing tokens, a
  realtime channel and a waiting state that can strand the employee are not worth it for v1.
  The customer is standing at the desk.
- **Fuel = tappable eighths, not a slider or stepper.** It reuses the gauge already on every
  screen, so read and write look identical. Slider snaps are fiddly under a thumb; a stepper
  costs up to eight taps.
- **Fixed 14:00 / 10:00, plus a separate `signed_at`.** The booking's 14:00 is a business
  rule; the moment the customer signed is a fact, and a signed document should say when it
  was signed. The design's per-reservation `09:00` / `10:30` was dropped.
- **`vehicles.plate` is required.** The fleet will hold many identical models (ten Ford
  Transits); `make + model + year` cannot distinguish them on the dispatch list, the calendar,
  or the PDF. The design always assumed it (`vPlate: 'Rejestracja'` predates this change) —
  the shipped S-04 form is what diverged.

## Residual gaps

### A. Desktop is missing three states mobile has

`DeskPickupBody` accepts an `uploads` prop **that no screen ever passes**, and has no
`errors` mode at all.

| State                             | Mobile                      | Desktop                                   |
| --------------------------------- | --------------------------- | ----------------------------------------- |
| Photo upload in-progress / failed | ✅ `ScreenPickupUploads`    | ❌ prop exists, unused; no export         |
| Validation errors                 | ✅ `ScreenPickupValidation` | ❌ no mode, no screen                     |
| PDF generation failed             | ✅ `ScreenPickupPdfFailed`  | ❌ only `ScreenStaffPickupFailed` (email) |

Desktop exports confirm it: `pl-desktop-01..08` has no uploads / validation / pdf-fail.

### B. A damage item cannot be deleted

`PpDamageEditor` offers only `Anuluj` / `Zapisz`. `PpDamageRow` opens the editor. There is
no remove affordance anywhere — but a mistyped damage entry on a signed legal document
must be removable before submit.

### C. Delivery badge + resend exist only in the post-submit overlay

`PkOverlay variant="email"` gives `Wyślij ponownie`. But nothing surfaces a failed delivery
**later**: no badge on a dispatch row, no protocol list, no view-an-issued-protocol screen,
no PDF download. The conflict screen's `Otwórz protokół` button points at a screen that
does not exist.

This matters because the whole point of `email_deliveries` (research Decision 3) is that an
employee who dismissed the overlay — or whose PDF failed — can recover from the dashboard
later. Today, dismissing the overlay strands the protocol.

### D. The `W toku` chip was not removed

`ScreenStaffDash` in `staff-desktop.jsx` still renders `t.inProgress` for the current row.
Q7 settled that a protocol is binary. Either derive that chip from "pickup due today, no
protocol row" or drop it.

### E. Superseded screens still ship

Both old flows remain in the project and will mislead an implementer:

- `staff-screens.jsx` → `ScreenPickupProtocol` (the fake 6-step wizard) + `ScreenPickupSignature`
- `staff-desktop.jsx` → `ScreenStaffPickup` (the 5-step rail)

The new files are canonical. Also vestigial: `DeskFooter` still renders a `Wstecz`
(`t.backStep`) button, though a single-page form has no step to go back to.

### F. The return protocol still uses the old damage model

`ScreenReturnProtocol` / `ScreenStaffReturn` predate `PpDamageRow`. S-06 must consume the
structured list — the `existing` / `new` tag already exists on the item (`PP_DAMAGE`), so
this is a migration, not a redesign. Out of S-05's scope, but the schema must serve it.

### G. Minor

- The desktop dropzone has no drag-hover state (static card).
- `ScreenNoPickups` titles itself with `t.pickupsToday` ("Odbiory dziś") via a
  `|| 'Wydania'` fallback — inconsistent with `t.proto.emptyTitle` ("Brak wydań na dziś").

## Data model — now settled

Everything the schema needs is fixed by the design:

- `vehicles.plate` — text, unique, not null. Backfill the 7 seeded vehicles.
- `protocols` — `reservation_id` (unique), `odometer_km` int, `fuel_eighths` smallint 0–8,
  `signed_at` timestamptz, `signature` (storage object), `customer_ack` boolean.
- `protocol_photos` — 6 baseline slots keyed by an enum
  `front | rear | left | right | interior | dashboard`.
- `protocol_damages` — `type` enum (`scratch | dent | crack | missing`), `location` text,
  `size` text, plus `protocol_damage_photos` (n per item). The `existing | new` tag is
  **derived** at return time by comparing against the issue protocol's list, not stored at pickup.
- `email_deliveries` — per research Decision 3, unchanged.

## Next

Punch list for a second Claude Design pass: **A** (three desktop states), **B** (delete a
damage item), **C** (dashboard delivery badge + resend + a view-protocol screen), **D**
(drop `W toku`), **E** (delete the superseded screens).

None of these block `/10x-plan` — the data model and the happy path are complete. C is the
only one with real product weight; the rest are state coverage and cleanup.
