# English Localization — Glossary

The recurring domain vocabulary, pinned once so 157 files don't each re-decide it.

**Harvest source**: `STR.EN` / `STR.PL` in the Claude Design project `Rental car company`
(`shared.jsx`) — **486 flattened keys, exact parity in both halves** (re-verified 2026-09-02 by key
diff; the design-contract's "248" counted only the top level). Those terms have already been through
a design pass and match the canonical mockups, so they win over anything invented here. Terms with
no `STR` twin are marked **`authored`** and were decided in this change.

Column 3 cites the `STR` key when one exists.

---

## 1. Brand vs nav — the one identical string with opposite requirements

`Flota` is both the company name and a navigation label. Frame decision 5 splits them, and they live
in **different catalog namespaces** so extraction tooling can never merge them.

| Context                                                    | EN        | PL     | Source                                        |
| ---------------------------------------------------------- | --------- | ------ | --------------------------------------------- |
| **Brand** — wordmark, document title, footer, PDF/email    | **Flota** | Flota  | `STR.EN.brand === STR.PL.brand === 'Flota'`   |
| **Nav item** — public header, landing nav, mobile nav      | **Fleet** | Flota  | `STR.*.fleet` (`'Fleet'` / `'Flota'`)         |
| **Staff sidebar nav item** — the cockpit's vehicle section | **Fleet** | Flota  | authored (the design's staff nav is PL-only)  |
| **Language row label** — the switcher                      | English   | Polski | endonym; never translated (`LOCALE_ENDONYMS`) |

The brand keeps its Polish spelling in English — it is a proper noun, and the domain is `flota.pl`.

---

## 2. Core domain nouns

| PL                 | EN           | Source            | Note                                                                  |
| ------------------ | ------------ | ----------------- | --------------------------------------------------------------------- |
| pojazd             | vehicle      | `vehicle`         | never "car" — the fleet is vans, trucks and transporters              |
| flota              | fleet        | `fleet`           | see §1 for the brand collision                                        |
| najem / wynajem    | rental       | `rentalCost`      | the noun; the verb is "rent"                                          |
| rezerwacja         | reservation  | `reservation`     | the **record**                                                        |
| wniosek            | request      | `requestLabel`    | a _pending_ reservation awaiting staff decision — never "application" |
| doba               | day          | `daily` → `Daily` | a 24h billing unit; "per day" / `/day`, never "24h"                   |
| kaucja             | deposit      | `deposit`         | refundable; qualify as "deposit (refundable)" where the design does   |
| odbiór / wydanie   | pickup       | `pickup`          | see §3 — the two Polish words are one English word                    |
| zwrot              | return       | `return`          | both the event and the protocol                                       |
| protokół           | protocol     | `pickupProtocol`  | not "report" / "handover form" — it is a signed document              |
| uszkodzenie        | damage       | `damage`          | mass noun in EN: "damage", "new damage", never "damages"              |
| przebieg / licznik | odometer     | `odometer`        | the reading; the distance covered is "distance driven" (`kmDriven`)   |
| paliwo             | fuel         | `fuel`            | level → "fuel level" (`fuelLevel`)                                    |
| ładowność          | payload      | `payload`         |                                                                       |
| skrzynia (biegów)  | transmission | `transmission`    |                                                                       |
| klient             | customer     | `customer`        | never "client"                                                        |
| pracownik          | employee     | `roleEmployee`    | the person; the **role chip** is "Staff" (`staffRole`)                |
| oddział            | depot        | `whyFlota3s`      | `branch` in form labels (`vform.branch`), `depot` in prose            |
| po terminie        | overdue      | `overdue`         |                                                                       |

### `odbiór` vs `wydanie` — both are "pickup"

Polish distinguishes the customer's act (`odbiór`, collecting) from the depot's act (`wydanie`,
issuing). English has one word for the event. `STR.EN` collapses both to **`Pickup`**
(`STR.PL.pickup = 'Odbiór'`, `STR.PL.pickupsToday = 'Wydania'`, both `Pickup(s)` in EN), and this
change follows it. Where the _document_ is meant, the design says **"pickup protocol"**
(`pickupProtocol`) — but note the design's own `ret.*` block calls the same document the
**"issue protocol"** (`ret.fromPickup: 'From issue protocol'`) when contrasting it with the return
protocol. Both are in the harvest; **prefer "pickup protocol"** as the primary name and reserve
"issue protocol" for the return screens' back-references, exactly as the design does.

---

## 3. Screen and section names (staff cockpit)

The staff nav is **`authored`** throughout: the design's `staff-desktop.jsx` hardcodes its nav array
in Polish and never reads `STR`, so nothing was harvestable (design-contract §2 item 9). Where `STR`
carries a plausible key it is cited as corroboration, not as the source.

| PL        | EN             | Basis                                                                       |
| --------- | -------------- | --------------------------------------------------------------------------- |
| Pulpit    | **Dashboard**  | corroborated by `STR.EN.workerDash = 'Dashboard'`                           |
| Wnioski   | **Requests**   | corroborated by `STR.EN.pending = 'Requests'`; matches `wniosek` → request  |
| Wydania   | **Pickups**    | corroborated by `STR.EN.pickupsToday` / `pickupsLabel`                      |
| Zwroty    | **Returns**    | corroborated by `STR.EN.returnsToday` / `ret.title`                         |
| Kalendarz | **Calendar**   | corroborated by `STR.EN.calendar`                                           |
| Flota     | **Fleet**      | `STR.EN.fleet`; see §1                                                      |
| Zespół    | **Team**       | authored — `STR.EN.employees` is "Employees", but the nav item is the group |
| Operacje  | **Operations** | authored (sidebar section heading)                                          |
| Profil    | **Profile**    | `STR.EN.profile`                                                            |
| Wyloguj   | **Sign out**   | `STR.EN.auth.signOut = 'Sign out'`                                          |

"Sign in" / "Sign out" throughout — never "log in" / "log out" (`STR.EN.login.submit`,
`auth.signOut`, `auth.backToLogin: 'Back to sign in'`).

---

## 4. Polish legal and country-specific terms — keep the Polish name + a one-time gloss

Frame decision 3. These name Polish legal instruments that have **no English equivalent**; inventing
one ("tax ID", "national ID card") is wrong, not merely awkward. Keep the Polish term and gloss it
**once per surface**, on first use, in parentheses:

| Term                   | English rendering                                           |
| ---------------------- | ----------------------------------------------------------- |
| NIP                    | **NIP (Polish tax identification number)**                  |
| dowód osobisty         | **dowód osobisty (Polish national ID card)**                |
| prawo jazdy kat. B / C | **prawo jazdy kat. B (Polish driving licence, category B)** |
| faktura VAT            | **faktura VAT (Polish VAT invoice)**                        |

The gloss is one-time: subsequent mentions on the same page use the bare Polish term. Form **labels**
stay short — the design already ships `nipOpt: 'VAT ID / NIP (optional)'`, which is the gloss in
label form; use it verbatim rather than re-glossing in a field label.

`zł` is **not** in this category — it is a currency symbol, not a word, and stays `zł` in both
locales (`format.ts` composes it by hand; see the locale lesson in `context/foundation/lessons.md`).

---

## 5. Vehicle categories (enum → label)

| Enum                 | PL          | EN                  | Source            |
| -------------------- | ----------- | ------------------- | ----------------- |
| `cargo_van`          | Furgon      | **Cargo van**       | `STR.EN.types[0]` |
| `passenger_van`      | Bus osobowy | **Passenger van**   | `STR.EN.types[1]` |
| `car_transporter`    | Autolaweta  | **Car transporter** | `STR.EN.types[2]` |
| `refrigerated_truck` | Chłodnia    | **Refrigerated**    | `STR.EN.types[3]` |
| `flatbed_truck`      | Skrzyniowy  | **Flatbed**         | `STR.EN.types[4]` |

The Polish labels stay exactly as `format.ts` shipped them — the design's plural forms
(`Furgony`, `Busy osobowe`) are its filter-chip wording, not our singular enum label.

## 6. Transmission, fuel, reservation status

| Enum                 | PL           | EN            | Source                   |
| -------------------- | ------------ | ------------- | ------------------------ |
| `manual`             | Manualna     | **Manual**    | authored                 |
| `automatic`          | Automatyczna | **Automatic** | authored                 |
| `diesel`             | Diesel       | **Diesel**    | authored                 |
| `petrol` / `benzyna` | Benzyna      | **Petrol**    | authored (en-GB; see §8) |
| `electric`           | Elektryczny  | **Electric**  | authored                 |
| `hybrid`             | Hybryda      | **Hybrid**    | authored                 |
| `lpg`                | LPG          | **LPG**       | authored                 |

| Status      | PL           | EN            | Source                                       |
| ----------- | ------------ | ------------- | -------------------------------------------- |
| `pending`   | Oczekuje     | **Pending**   | `STR.EN.status.pending`                      |
| `confirmed` | Potwierdzone | **Confirmed** | authored (`STR` says `Approved` for the act) |
| `rejected`  | Odrzucone    | **Rejected**  | `STR.EN.status.rejected`                     |
| `cancelled` | Anulowane    | **Cancelled** | authored (en-GB double-l; see §8)            |

Rejection reasons (`STR.EN.reason1-4`): **Dates no longer available** / **Missing licence category** /
**Vehicle withdrawn** / **Other**.

---

## 7. Actions

| PL                 | EN                 | Source              |
| ------------------ | ------------------ | ------------------- |
| Zarezerwuj         | Reserve now        | `reserveNow`        |
| Rezerwuj           | Reserve            | `reserve`           |
| Przeglądaj flotę   | Browse the fleet   | `browseFleet`       |
| Sprawdź dostępność | Check availability | `checkAvailability` |
| Zatwierdź          | Approve            | `approve`           |
| Odrzuć             | Reject             | `reject`            |
| Otwórz             | Open               | `openItem`          |
| Zapisz             | Save               | `saveBtn`           |
| Anuluj             | Cancel             | `vform.cancel`      |
| Usuń               | Remove             | `removeAction`      |
| Edytuj             | Edit               | `editAction`        |
| Wyczyść            | Clear              | `clearSig`          |
| Zadzwoń            | Call               | `ret.call`          |
| Wstecz             | Back               | `backStep`          |
| Zamknij            | Close              | `closeBtn`          |

---

## 8. Conventions

- **English variant: en-GB.** `format-date.ts` and `format.ts` already format `en` as `en-GB`
  (day-first dates, 24h clock — the depot is in Warsaw and prints `14:00`, not `2:00 PM`). Copy
  follows: **licence** (not license), **cancelled**, **organisation**, **petrol** (not gasoline).
  `STR.EN` is already en-GB (`licence`, `cancellation`).
- **Sentence case for headings and buttons**, never Title Case — matches every `STR.EN` value
  (`'Browse the fleet'`, `'Reset your password'`, `'Add vehicle'`).
- **Typographic apostrophes** (`’`) in English prose, as `STR.EN` uses them
  (`Couldn’t send the email`, `You’ve been invited`).
- **`·` as the inline separator** in both locales (`Secure connection · staff only`).
- **Never machine-translate human-typed free text** (frame decision 2) — `protocol_damages.location`,
  `reservations.rejection_note`, `reservations.notes`, `vehicles.fuel_type` render verbatim. English
  chrome around Polish free text is the correct outcome, not a defect.
- **Seeded fixture data is ours to rewrite** — vehicle `name` values read English, except two rows
  deliberately retained in Polish so the hybrid-document behaviour above stays visible and testable
  (Phase 4 §5).
