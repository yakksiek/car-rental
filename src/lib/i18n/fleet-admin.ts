// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// The cockpit's fleet-management screens — `FleetList` (the roster + its retire
// flow) and `VehicleForm` (create / edit).
//
// Both are islands, and neither renders queue, protocol or shell copy, so this
// is its own namespace rather than a section of `./dashboard.ts` — the "an
// island imports the smallest namespace that covers it" rule from
// `island-baseline.md`.
//
// The five vehicle-category labels are NOT here: they are enum vocabulary and
// live in `./vehicle.ts`, which both islands already import.
//
// `zł` stays `zł` in the money field labels — it is a currency symbol, not a
// word (glossary §4).
// ---------------------------------------------------------------------------
export const fleetAdmin = defineDict({
  en: {
    // ── FleetList ──────────────────────────────────────────────────────────
    // The eyebrow reads `<count> vehicles`; the count is supplied by the caller.
    eyebrow: "vehicles",
    title: "Fleet management",
    add: "Add vehicle",
    searchPlaceholder: "Make, model…",
    all: "All",
    showRetired: "Show retired",
    active: "Active",
    retired: "Retired",
    edit: "Edit",
    restore: "Restore",
    colVehicle: "Vehicle",
    colStatus: "Status",
    colRate: "Rate",
    // The actions column has no visible header, only an accessible name.
    colActions: "Actions",
    perDay: "/day",
    perMonth: "/mo",
    retireTitle: "Retire this vehicle from the fleet?",
    // Rendered around the vehicle's own name, which is user data and stays
    // verbatim. The typographic quotes match the Polish `„…”` pair's role.
    retireBodyHead: "“",
    retireBodyTail: "” will disappear from the public catalogue. You can restore the vehicle at any time.",
    cancel: "Cancel",
    retireConfirm: "Retire",
    hasReservations: "This vehicle has active reservations — cancel them first.",
    genericError: "Something went wrong. Try again.",
    close: "Close",
    empty: "No vehicles",
    emptyHint: "Change the filters, or add a new vehicle to the fleet.",

    // ── VehicleForm ────────────────────────────────────────────────────────
    formEyebrow: "Fleet management",
    createTitle: "Add vehicle",
    editTitle: "Edit vehicle",
    createSub: "Register a new vehicle in the fleet database.",
    editSub: "Update this vehicle's details.",
    createSubmit: "Add to the fleet",
    editSubmit: "Save changes",
    createPending: "Adding…",
    editPending: "Saving…",
    back: "Back to the fleet",
    secIdentity: "Vehicle details",
    secSpec: "Specification",
    secPricing: "Prices and limits",
    secPhotos: "Photos",
    labelType: "Type",
    labelTransmission: "Transmission",
    transmissionPlaceholder: "Choose a transmission",
    transmissionNone: "Not specified",
    photosLabel: "Photo URLs",
    photosHint: "One URL per line. The first photo is the thumbnail.",
    fixFields: "Correct the highlighted fields.",

    // Field labels. Placeholders are sample data (plate formats, model names)
    // and are identical in both locales, so they stay in the component.
    fieldName: "Name",
    fieldPlate: "Registration",
    fieldMake: "Make",
    fieldModel: "Model",
    fieldYear: "Year",
    fieldFuel: "Fuel",
    fieldSeats: "Seats",
    fieldPayload: "Payload (kg)",
    fieldLength: "Length (cm)",
    fieldWidth: "Width (cm)",
    fieldHeight: "Height (cm)",
    fieldDailyRate: "Rate / day (zł)",
    fieldMonthlyRate: "Rate / month (zł)",
    fieldDeposit: "Deposit (zł)",
    fieldExtraKm: "Per extra km (zł)",
    fieldKmLimit: "km limit",
  },
  pl: {
    eyebrow: "pojazdów",
    title: "Zarządzanie flotą",
    add: "Dodaj pojazd",
    searchPlaceholder: "Marka, model…",
    all: "Wszystkie",
    showRetired: "Pokaż wycofane",
    active: "Aktywny",
    retired: "Wycofany",
    edit: "Edytuj",
    restore: "Przywróć",
    colVehicle: "Pojazd",
    colStatus: "Status",
    colRate: "Stawka",
    colActions: "Akcje",
    perDay: "/doba",
    perMonth: "/mies",
    retireTitle: "Wycofać pojazd z floty?",
    retireBodyHead: "„",
    retireBodyTail: "” zniknie z publicznego katalogu. Możesz przywrócić pojazd w każdej chwili.",
    cancel: "Anuluj",
    retireConfirm: "Wycofaj",
    hasReservations: "Pojazd ma aktywne rezerwacje — najpierw je anuluj.",
    genericError: "Coś poszło nie tak. Spróbuj ponownie.",
    close: "Zamknij",
    empty: "Brak pojazdów",
    emptyHint: "Zmień filtry lub dodaj nowy pojazd do floty.",

    formEyebrow: "Zarządzanie flotą",
    createTitle: "Dodaj pojazd",
    editTitle: "Edytuj pojazd",
    createSub: "Zarejestruj nowy pojazd w bazie floty.",
    editSub: "Zaktualizuj dane pojazdu we flocie.",
    createSubmit: "Dodaj do floty",
    editSubmit: "Zapisz zmiany",
    createPending: "Dodawanie…",
    editPending: "Zapisywanie…",
    back: "Wróć do floty",
    secIdentity: "Dane pojazdu",
    secSpec: "Specyfikacja",
    secPricing: "Ceny i limity",
    secPhotos: "Zdjęcia",
    labelType: "Typ",
    labelTransmission: "Skrzynia",
    transmissionPlaceholder: "Wybierz skrzynię",
    transmissionNone: "Nie określono",
    photosLabel: "Adresy URL zdjęć",
    photosHint: "Po jednym adresie URL w wierszu. Pierwsze zdjęcie jest miniaturą.",
    fixFields: "Popraw zaznaczone pola.",

    fieldName: "Nazwa",
    fieldPlate: "Rejestracja",
    fieldMake: "Marka",
    fieldModel: "Model",
    fieldYear: "Rok",
    fieldFuel: "Paliwo",
    fieldSeats: "Miejsca",
    fieldPayload: "Ładowność (kg)",
    fieldLength: "Długość (cm)",
    fieldWidth: "Szerokość (cm)",
    fieldHeight: "Wysokość (cm)",
    fieldDailyRate: "Stawka / doba (zł)",
    fieldMonthlyRate: "Stawka / mies. (zł)",
    fieldDeposit: "Kaucja (zł)",
    fieldExtraKm: "Za dodatkowy km (zł)",
    fieldKmLimit: "Limit km",
  },
});
