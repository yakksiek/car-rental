// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// The public catalog and the vehicle detail page — `/fleet`, `/fleet/[id]`, the
// `FilterBar` island and the `VehicleGallery` island.
//
// **Separate from `./vehicle.ts` on purpose.** That namespace is the vehicle
// VOCABULARY (enum labels, card chrome, the landing search bar) and is imported
// by `HeroSearch`, the landing page's only island. Everything here is catalog
// CHROME that only `/fleet` and `/fleet/[id]` need. Keeping them apart is the
// narrow rule `island-baseline.md` records from the Phase 4 near-miss: an island
// imports the smallest namespace that covers it, and a namespace an island
// touches must not accumulate copy that island never renders.
//
// Islands reaching this file: `FilterBar` and `VehicleGallery` (both `/fleet`
// surfaces). Both use `translator(locale, fleet)`, never the composed map.
// ---------------------------------------------------------------------------
export const fleet = defineDict({
  en: {
    // ── /fleet catalog page ────────────────────────────────────────────────
    catalogTitle: "Fleet — browse the vehicles",
    // The "all categories" tab, beside the five per-category tabs.
    tabAll: "All",
    activeFilters: "Active filters:",
    clearAll: "Clear all",
    // Shown instead of results when the chosen range fails `validateDateRange`.
    fixDates: "Adjust the date range to see the available vehicles.",
    emptyTitle: "No vehicles match your criteria",
    emptyBody: "Change the filters or the date range to see more.",
    // Chip prefix on the active minimum-payload filter.
    fromPayload: "from",

    // ── FilterBar island ───────────────────────────────────────────────────
    filters: "Filters",
    dates: "Dates",
    pickDates: "Pick dates",
    payload: "Payload",
    payloadAny: "any",
    sorting: "Sorting",
    sortDefault: "default",
    sortPriceAsc: "Price: low to high",
    sortPriceDesc: "Price: high to low",
    apply: "Apply",
    applying: "Searching…",

    // ── /fleet/[id] detail page ────────────────────────────────────────────
    notFoundEyebrow: "Error 404",
    notFoundTitle: "Vehicle not found",
    notFoundBody: "This vehicle does not exist, or it is no longer available in our fleet.",
    backToFleet: "Back to the fleet",

    specsHeading: "Specification",
    specSeats: "Seats",
    specTransmission: "Transmission",
    specFuel: "Fuel",
    specPayload: "Payload",
    // L×W×H — the cargo bay's internal dimensions.
    specCargo: "Cargo (L×W×H)",
    specKmLimit: "km limit",

    trustPaymentTitle: "Pay on pickup",
    trustPaymentNote: "Cash or card on the day you collect",
    trustInsuranceTitle: "Full insurance",
    trustInsuranceNote: "Third-party and comprehensive on every vehicle",
    trustPickupTitle: "24/7 pickup",
    // The single fixed depot: a Warsaw district. The city translates, the
    // district is a proper noun and does not.
    trustPickupNote: "Warsaw · Mokotów",

    // ── VehicleGallery island ──────────────────────────────────────────────
    // Interpolated with the vehicle name and the 1-based photo index.
    galleryPhotoAlt: "photo",
    galleryCarousel: "carousel",
    galleryPrevious: "Previous photo",
    galleryNext: "Next photo",
    galleryGoTo: "Go to photo",

    // ── VehicleCard footer ─────────────────────────────────────────────────
    // Note this is `/day`, matching `vehicle.perDay` — the card and the detail
    // page have always worded it differently in Polish (`/dzień` vs `/doba`),
    // and the split is preserved rather than silently unified.
    cardPerDay: "/day",
    cardPerMonth: "/mo",
    cardDeposit: "deposit",
  },
  pl: {
    catalogTitle: "Flota — przeglądaj pojazdy",
    tabAll: "Wszystkie",
    activeFilters: "Aktywne filtry:",
    clearAll: "Wyczyść wszystko",
    fixDates: "Popraw zakres dat, aby zobaczyć dostępne pojazdy.",
    emptyTitle: "Brak pojazdów spełniających kryteria",
    emptyBody: "Zmień filtry lub zakres dat, aby zobaczyć więcej.",
    fromPayload: "od",

    filters: "Filtry",
    dates: "Termin",
    pickDates: "Wybierz daty",
    payload: "Ładowność",
    payloadAny: "dowolna",
    sorting: "Sortowanie",
    sortDefault: "domyślne",
    sortPriceAsc: "Cena: rosnąco",
    sortPriceDesc: "Cena: malejąco",
    apply: "Zastosuj",
    applying: "Szukam…",

    notFoundEyebrow: "Błąd 404",
    notFoundTitle: "Nie znaleziono pojazdu",
    notFoundBody: "Ten pojazd nie istnieje lub nie jest już dostępny w naszej flocie.",
    backToFleet: "Wróć do floty",

    specsHeading: "Specyfikacja",
    specSeats: "Miejsca",
    specTransmission: "Skrzynia",
    specFuel: "Paliwo",
    specPayload: "Ładowność",
    specCargo: "Ładunek (D×S×W)",
    specKmLimit: "Limit km",

    trustPaymentTitle: "Płatność przy odbiorze",
    trustPaymentNote: "Gotówką lub kartą w dniu odbioru",
    trustInsuranceTitle: "Pełne ubezpieczenie",
    trustInsuranceNote: "OC + AC w każdym pojeździe",
    trustPickupTitle: "Odbiór 24/7",
    trustPickupNote: "Warszawa · Mokotów",

    galleryPhotoAlt: "zdjęcie",
    galleryCarousel: "karuzela",
    galleryPrevious: "Poprzednie zdjęcie",
    galleryNext: "Następne zdjęcie",
    galleryGoTo: "Przejdź do zdjęcia",

    cardPerDay: "/dzień",
    cardPerMonth: "/mies.",
    cardDeposit: "kaucja",
  },
});
