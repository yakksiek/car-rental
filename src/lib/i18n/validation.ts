// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// Every zod message in the app, in one namespace.
//
// The five schema modules (`vehicle-schema`, `reservation-schema`,
// `protocol-schema`, `return-protocol-schema`, plus `catalog-filters`'s date
// rule) used to each own a module-level `MSG` const. They are grouped here
// rather than split per domain for the reason the schemas themselves are
// shared: one schema is the single validation source for the island AND the API
// route that re-checks it (the RHF lesson), so a message has exactly one home
// no matter which of the two surfaces renders it.
//
// This is an ISLAND-REACHABLE namespace — `VehicleForm`, `ReservationForm`,
// `ProtocolForm`, `ReturnProtocolForm` and `ManualReservationModal` all import a
// schema. Each schema module therefore resolves through `translator(locale,
// validation)`, never through the composed `useTranslations`.
//
// Polish is verbatim from the `MSG` maps it replaces — these strings are what
// the existing unit suites assert, and the PL half must stay behaviour-identical.
// ---------------------------------------------------------------------------
export const validation = defineDict({
  en: {
    // ── Shared identifiers / paths ─────────────────────────────────────────
    id: "Invalid identifier.",
    vehicleId: "Invalid vehicle identifier.",
    path: "Invalid file path.",

    // ── Dates (`catalog-filters.validateDateRange`, mirrored by the funnel) ─
    date: "Invalid date format.",
    dateIncomplete: "Select a pickup date and a return date.",
    datePastPickup: "The pickup date cannot be in the past.",
    dateReturnBeforePickup: "The return date must be later than the pickup date.",

    // ── Customer fields (public funnel + staff manual booking) ─────────────
    name: "Enter a first and last name.",
    email: "Enter a valid email address.",
    // `services/staff.ts` states the fault rather than the remedy — an admin
    // typing a colleague's address, not a customer typing their own.
    emailInvalid: "Invalid email address.",
    phone: "Enter a valid phone number.",
    // The manual-booking modal's customer-language field. It is a two-option
    // segmented control with a default, so this can only be reached by a crafted
    // payload — the schema is still the trust boundary.
    language: "Choose the customer's language.",
    // The rental terms live at `/terms`, which Phase 7 creates.
    terms: "Accept the rental terms.",
    honeypot: "Invalid request.",
    company: "The company name is too long.",
    // NIP keeps its Polish name — frame decision 3, glossary §4. The gloss is
    // carried by the form label, so the error message uses the bare term.
    vatId: "The NIP is too long.",
    notes: "The notes are too long.",

    // ── Vehicle form (`vehicle-schema`) ────────────────────────────────────
    vehicleName: "Enter the vehicle name.",
    plate: "Enter the registration number.",
    category: "Select a vehicle category.",
    rate: "Enter a positive amount.",
    transmission: "Select a transmission.",
    year: "Enter a valid year of manufacture.",
    intNonNeg: "Enter a whole number no smaller than 0.",
    numNonNeg: "Enter a value no smaller than 0.",
    url: "Enter a valid photo URL.",

    // ── Protocol forms (issue + return share every message below) ──────────
    odometer: "Enter the odometer reading.",
    fuel: "Select the fuel level.",
    ack: "The customer has to confirm the vehicle’s condition.",
    signature: "A signature is required.",
    signedAt: "Invalid signature date.",
    photos: "Take all six vehicle photos.",
    damageType: "Select the damage type.",
    damageLocation: "Enter the damage location.",
    damageLocationMax: "A damage description can be at most 60 characters.",
  },
  pl: {
    id: "Nieprawidłowy identyfikator.",
    vehicleId: "Nieprawidłowy identyfikator pojazdu.",
    path: "Nieprawidłowa ścieżka pliku.",

    date: "Nieprawidłowy format daty.",
    dateIncomplete: "Wybierz datę odbioru i datę zwrotu.",
    datePastPickup: "Data odbioru nie może być w przeszłości.",
    dateReturnBeforePickup: "Data zwrotu musi być późniejsza niż data odbioru.",

    name: "Podaj imię i nazwisko.",
    email: "Podaj poprawny adres e-mail.",
    emailInvalid: "Nieprawidłowy adres e-mail.",
    phone: "Podaj poprawny numer telefonu.",
    language: "Wybierz język klienta.",
    terms: "Zaakceptuj regulamin wynajmu.",
    honeypot: "Nieprawidłowe zgłoszenie.",
    company: "Nazwa firmy jest za długa.",
    vatId: "NIP jest za długi.",
    notes: "Uwagi są za długie.",

    vehicleName: "Podaj nazwę pojazdu.",
    plate: "Podaj numer rejestracyjny.",
    category: "Wybierz kategorię pojazdu.",
    rate: "Podaj dodatnią kwotę.",
    transmission: "Wybierz skrzynię biegów.",
    year: "Podaj poprawny rok produkcji.",
    intNonNeg: "Podaj liczbę całkowitą nie mniejszą niż 0.",
    numNonNeg: "Podaj wartość nie mniejszą niż 0.",
    url: "Podaj poprawny adres URL zdjęcia.",

    odometer: "Podaj stan licznika.",
    fuel: "Wybierz poziom paliwa.",
    ack: "Klient musi potwierdzić stan pojazdu.",
    signature: "Wymagany podpis.",
    signedAt: "Nieprawidłowa data podpisu.",
    photos: "Wykonaj wszystkie sześć zdjęć pojazdu.",
    damageType: "Wybierz rodzaj uszkodzenia.",
    damageLocation: "Podaj lokalizację uszkodzenia.",
    damageLocationMax: "Opis uszkodzenia może mieć maksymalnie 60 znaków.",
  },
});
