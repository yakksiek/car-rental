// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// The five transactional emails (S-02, S-03, S-05, S-06) — the copy half of
// `src/lib/email/templates.ts`.
//
// **These strings render in the RESERVATION's language, never the reader's.**
// The employee who triggers a send is not the recipient: an English cockpit
// still mails a Polish customer in Polish, off `reservations.locale`. That is
// why every template function takes an explicit `locale` argument rather than
// reaching for `Astro.locals` — there is no session here at all on the resend
// path, which runs from a background route.
//
// Server-only, like `templates.ts` itself (an email body has never been near a
// browser bundle), so it could use the composed accessor — it uses the named
// `translator` anyway, because "which accessor" should follow the module's
// domain, not a bundling accident that a later import could quietly reverse.
//
// `{ref}` / `{name}` are substituted by the caller, the same `.replace()` idiom
// `lib/dispatch-board.ts` uses for `staff.scheduleProgress`. They exist only for
// the sentences that interpolate MID-string; a `Label: value` line keeps the
// label here and joins the value in code.
//
// Two things deliberately do NOT live here:
//   * plural noun tables (`Record<Locale, PluralForms>`) stay beside the helper
//     that selects with them, matching `format.ts`'s `DAY_FORMS` and the PDF's
//     `PHOTO_FORMS` — a four-armed CLDR form set is not a flat string and
//     splitting it into `…One`/`…Few`/`…Many`/`…Other` keys would hide the
//     shape the `plural()` call actually needs;
//   * `Flota` — the BRAND, not a nav item, and identical in both halves. It sits
//     inline in the subject lines below for the same reason `Layout.astro` keeps
//     it out of the catalog (see the plan's brand/nav collision note).
// ---------------------------------------------------------------------------

export const email = defineDict({
  en: {
    // ── Shared field labels (every template renders `Label: value` lines) ────
    vehicle: "Vehicle",
    pickup: "Pickup",
    return: "Return",
    duration: "Duration",
    estimate: "Estimated price",
    deposit: "Deposit",
    plate: "Registration",
    odometer: "Odometer",
    fuel: "Fuel level",
    reason: "Reason",
    details: "Details",
    rentalPeriod: "Rental period",

    // The booking's fixed hotel-style hours — a property of the rental, not of
    // the signature time, which is why they are copy and not a formatted date.
    pickupFrom: "from 14:00",
    returnBy: "to 10:00",

    // The two named fuel extremes. The parenthetical form is the email's own —
    // the form's fuel bar names the same two ends with a middot
    // (`i18n/protocol.ts` `fuelLevelLabel`), and both wordings are deliberate.
    fuelFull: "8/8 (full)",
    fuelEmpty: "0/8 (empty)",

    // ── S-02 submit confirmation ────────────────────────────────────────────
    receivedSubject: "Flota — request {ref} received",
    receivedLead: "Thank you! Your reservation request {ref} has been received.",
    receivedStatusLink: "You can check the status of your request at any time at:",
    receivedConfirmSoon: "We will confirm availability by e-mail — usually within the hour.",
    receivedNoPayment: "No payment now.",

    // ── S-03 acceptance ─────────────────────────────────────────────────────
    confirmedSubject: "Flota — reservation {ref} confirmed",
    confirmedLead: "Good news! Your reservation {ref} has been confirmed.",
    confirmedDetailsLink: "You will find the reservation details at:",
    confirmedSeeYou: "See you at pickup!",

    // ── S-03 rejection ──────────────────────────────────────────────────────
    rejectedSubject: "Flota — request {ref} declined",
    rejectedLead: "Unfortunately we could not confirm your request {ref}.",
    rejectedSuggestion: "Do take a look at our other vehicles, or at alternative dates.",
    rejectedStatusLink: "You will find the status of your request at:",

    // ── S-05 handover ───────────────────────────────────────────────────────
    issuedSubject: "Flota — pickup protocol {ref}",
    greeting: "Hello {name}!",
    issuedLead: "Attached is the signed vehicle pickup protocol ({ref}).",
    issuedDamages: "Damage recorded at pickup",
    issuedKeep: "Please keep this document — it is what the vehicle's condition is compared against on return.",
    issuedSafeTravels: "Safe travels!",

    // ── S-06 return ─────────────────────────────────────────────────────────
    returnedSubject: "Flota — return protocol {ref}",
    returnedLead: "Attached is the signed vehicle return protocol ({ref}).",
    comparisonHeading: "Compared with the pickup condition:",
    distanceDriven: "Distance driven",
    fuelChange: "Fuel change",
    newDamage: "New damage",
    odometerAtReturn: "Odometer at return",
    fuelAtReturn: "Fuel level at return",
    returnedThanks: "Thank you for renting with us!",
    // Zero fuel delta — a word, so the line never reads a bare "0/8".
    noChange: "no change",
    // Zero damage items. Sits here rather than in the plural table beside it:
    // it is a replacement for the whole "<n> items" phrase, not a form of it.
    noDamage: "none",
  },
  pl: {
    vehicle: "Pojazd",
    pickup: "Odbiór",
    return: "Zwrot",
    duration: "Czas trwania",
    estimate: "Szacunkowa cena",
    deposit: "Kaucja",
    plate: "Rejestracja",
    odometer: "Stan licznika",
    fuel: "Poziom paliwa",
    reason: "Powód",
    details: "Szczegóły",
    rentalPeriod: "Okres najmu",

    pickupFrom: "od 14:00",
    returnBy: "do 10:00",

    fuelFull: "8/8 (pełny)",
    fuelEmpty: "0/8 (pusty)",

    receivedSubject: "Flota — zgłoszenie {ref} przyjęte",
    receivedLead: "Dziękujemy! Twoje zgłoszenie rezerwacji {ref} zostało przyjęte.",
    receivedStatusLink: "Status zgłoszenia sprawdzisz w każdej chwili pod adresem:",
    receivedConfirmSoon: "Potwierdzimy dostępność e-mailem — zwykle w godzinę.",
    receivedNoPayment: "Bez płatności teraz.",

    confirmedSubject: "Flota — rezerwacja {ref} potwierdzona",
    confirmedLead: "Dobra wiadomość! Twoja rezerwacja {ref} została potwierdzona.",
    confirmedDetailsLink: "Szczegóły rezerwacji znajdziesz pod adresem:",
    confirmedSeeYou: "Do zobaczenia przy odbiorze!",

    rejectedSubject: "Flota — wniosek {ref} odrzucony",
    rejectedLead: "Niestety nie mogliśmy potwierdzić Twojego wniosku {ref}.",
    rejectedSuggestion: "Zachęcamy do sprawdzenia innych pojazdów lub alternatywnych dat.",
    rejectedStatusLink: "Status wniosku znajdziesz pod adresem:",

    issuedSubject: "Flota — protokół wydania {ref}",
    greeting: "Dzień dobry, {name}!",
    issuedLead: "W załączniku przesyłamy podpisany protokół wydania pojazdu ({ref}).",
    issuedDamages: "Uszkodzenia zapisane przy wydaniu",
    issuedKeep: "Prosimy o zachowanie tego dokumentu — będzie podstawą porównania przy zwrocie pojazdu.",
    issuedSafeTravels: "Życzymy szerokiej drogi!",

    returnedSubject: "Flota — protokół zwrotu {ref}",
    returnedLead: "W załączniku przesyłamy podpisany protokół zwrotu pojazdu ({ref}).",
    comparisonHeading: "Porównanie ze stanem wydania:",
    distanceDriven: "Przejechano",
    fuelChange: "Zmiana paliwa",
    newDamage: "Nowe uszkodzenia",
    odometerAtReturn: "Stan licznika przy zwrocie",
    fuelAtReturn: "Poziom paliwa przy zwrocie",
    returnedThanks: "Dziękujemy za skorzystanie z naszych usług!",
    noChange: "bez zmian",
    noDamage: "brak",
  },
});
