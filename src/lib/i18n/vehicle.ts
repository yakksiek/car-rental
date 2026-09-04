// core
import { defineDict, type Locale } from "./types";

// others
import type { PluralForms } from "../format";
import type { Transmission, VehicleCategory } from "../../types";

// ---------------------------------------------------------------------------
// Vehicle vocabulary — the enum→label dictionaries `format.ts` used to own, plus
// the card chrome that sits around them.
//
// Phase 1 §1 named this file as their destination: they are pure dictionaries
// with no formatting logic (`format.ts:162` was literally
// `return CATEGORY_LABELS_PL[category]`), so injecting a whole map into a
// numeric helper is "import the namespace" with worse ergonomics. Moving them
// out is what lets `format.ts` stay a module no island has to think about.
//
// The three enum maps are NOT `defineDict` namespaces: a
// `Record<Locale, Record<Enum, string>>` is exhaustively checked on BOTH axes,
// which is stronger than the `Dict` parity constraint (that only checks that
// `pl` covers `en`'s keys — it cannot know an enum member is missing from both).
// The `vehicle` dict below carries the free-form chrome, where `Dict` is right.
//
// English labels are harvested from the design source's `STR.EN.types` — see
// `context/changes/english-localization/glossary.md` §5. Polish is unchanged from
// `format.ts`, verbatim.
// ---------------------------------------------------------------------------

const DASH = "—"; // shown for absent values, matching `format.ts`

const CATEGORY_LABELS: Record<Locale, Record<VehicleCategory, string>> = {
  en: {
    cargo_van: "Cargo van",
    passenger_van: "Passenger van",
    car_transporter: "Car transporter",
    refrigerated_truck: "Refrigerated",
    flatbed_truck: "Flatbed",
  },
  pl: {
    cargo_van: "Furgon",
    passenger_van: "Bus osobowy",
    car_transporter: "Autolaweta",
    refrigerated_truck: "Chłodnia",
    flatbed_truck: "Skrzyniowy",
  },
};

/** Label for a vehicle category enum value, in the active locale. */
export function categoryLabel(category: VehicleCategory, locale: Locale): string {
  return CATEGORY_LABELS[locale][category];
}

const TRANSMISSION_LABELS: Record<Locale, Record<Transmission, string>> = {
  en: { manual: "Manual", automatic: "Automatic" },
  pl: { manual: "Manualna", automatic: "Automatyczna" },
};

/** Label for a transmission enum value; dash when absent. */
export function transmissionLabel(transmission: Transmission | null | undefined, locale: Locale): string {
  if (!transmission) {
    return DASH;
  }
  return TRANSMISSION_LABELS[locale][transmission];
}

// `fuel_type` is a FREE-TEXT column (not an enum), so this map is a
// best-effort lookup over the values we seed plus the obvious synonyms; anything
// unrecognised falls through capitalized. That fallback is load-bearing under
// frame decision 2: a Polish value an employee typed by hand renders verbatim
// rather than being guessed at.
const FUEL_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    diesel: "Diesel",
    petrol: "Petrol",
    benzyna: "Petrol",
    gasoline: "Petrol",
    electric: "Electric",
    hybrid: "Hybrid",
    lpg: "LPG",
  },
  pl: {
    diesel: "Diesel",
    petrol: "Benzyna",
    benzyna: "Benzyna",
    gasoline: "Benzyna",
    electric: "Elektryczny",
    hybrid: "Hybryda",
    lpg: "LPG",
  },
};

/** Label for a free-text fuel type; the raw value capitalized when unknown, dash when absent. */
export function fuelLabel(fuel: string | null | undefined, locale: Locale): string {
  if (!fuel) {
    return DASH;
  }
  const key = fuel.trim().toLowerCase();
  return FUEL_LABELS[locale][key] ?? fuel.charAt(0).toUpperCase() + fuel.slice(1);
}

/**
 * The counted noun for vehicles — `1 pojazd` / `2 pojazdy` / `5 pojazdów`, and
 * `1 vehicle` / `2 vehicles`. Lives here rather than beside the count's call
 * sites so the landing hero's eyebrow and the trust card cannot drift apart.
 * Pass to `plural(n, locale, VEHICLE_NOUN_FORMS[locale])`.
 */
export const VEHICLE_NOUN_FORMS: Record<Locale, PluralForms> = {
  en: { one: "vehicle", other: "vehicles" },
  pl: { one: "pojazd", few: "pojazdy", many: "pojazdów", other: "pojazdów" },
};

/**
 * Chrome around a vehicle card, plus the public catalog's search bar.
 *
 * The search labels live HERE rather than in `./landing.ts` on purpose:
 * `vehicle/HeroSearch.tsx` is the landing page's only island, it already imports
 * this module for `categoryLabel`, and `landing` is ~35 keys of marketing prose
 * that has no business in a browser bundle. Six field labels on a
 * type-and-dates search over the fleet are vehicle-catalog vocabulary anyway —
 * `/fleet`'s own `FilterBar` asks for the same words.
 */
export const vehicle = defineDict({
  en: {
    // The "from" prefix on a card's headline rate (`STR.EN.from`).
    from: "from",
    // Rate suffix (`STR.EN.perDay`) — the slash is part of the string so a call
    // site cannot get the spacing wrong.
    perDay: "/day",
    reserve: "Reserve",

    // ── Catalog search bar ─────────────────────────────────────────────────
    searchType: "Type",
    searchTypeAll: "All types",
    searchDates: "Dates",
    searchDatesAny: "Any dates",
    // Single fixed branch — no location concept in the schema yet.
    searchBranch: "Branch",
    searchSubmit: "Search",
  },
  pl: {
    from: "od",
    perDay: "/dzień",
    reserve: "Rezerwuj",

    searchType: "Typ",
    searchTypeAll: "Wszystkie typy",
    searchDates: "Daty",
    searchDatesAny: "Dowolne daty",
    searchBranch: "Oddział",
    searchSubmit: "Szukaj",
  },
});
