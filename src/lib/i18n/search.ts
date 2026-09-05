// core
import { defineDict } from "./types";

// Global staff search (S-13) — `search/GlobalSearch.tsx`, `search/SearchRows.tsx`
// and the relative-day wording in `lib/search-format.ts`.
//
// Its own namespace rather than part of `./staff.ts`: <GlobalSearch> mounts on
// every staff page as a SEPARATE island from the cockpit board, so keeping the
// two apart is what stops each chunk carrying the other's dictionary.
//
// Authored — the design's `search-flow.jsx` is Polish-only, like the staff nav.
export const search = defineDict({
  en: {
    // The inactive-vehicle pill on a fleet result row.
    retired: "Retired",
    placeholder: "Search reservations, vehicles, plates…",
    ariaLabel: "Search",
    clear: "Clear",
    cancel: "Cancel",
    quickJumps: "Quick jumps",
    pending: "Pending reservations",
    overdue: "Overdue",
    dueToday: "Returns due today",
    reservations: "Reservations",
    returns: "Returns",
    vehicles: "Vehicles",
    noResults: "No results for",
    noResultsHint: "Check the spelling, or search by reservation number, surname or plate.",
    // Keyboard-hint footer, rendered lowercase beside its key glyphs.
    navigate: "navigate",
    open: "open",
    close: "close",

    // Return-row pills.
    returned: "Returned",
    dueTodayPill: "Due today",

    // `relativeDayPl`'s three relative words. They stay hand-written rather than
    // coming from `Intl.RelativeTimeFormat` because its `pl` wording for day 0 is
    // `dzisiaj` where the design board says `dziś` — which makes them a COPY
    // choice, not grammar, so the catalog is where they belong.
    dayToday: "today",
    dayYesterday: "yesterday",
    dayTomorrow: "tomorrow",
  },
  pl: {
    retired: "Wycofany",
    placeholder: "Szukaj rezerwacji, pojazdu, rejestracji…",
    ariaLabel: "Szukaj",
    clear: "Wyczyść",
    cancel: "Anuluj",
    quickJumps: "Szybkie przejścia",
    pending: "Oczekujące rezerwacje",
    overdue: "Przeterminowane",
    dueToday: "Dzisiejsze zwroty",
    reservations: "Rezerwacje",
    returns: "Zwroty",
    vehicles: "Pojazdy",
    noResults: "Brak wyników dla",
    noResultsHint: "Sprawdź pisownię lub szukaj po numerze rezerwacji, nazwisku lub rejestracji.",
    navigate: "nawigacja",
    open: "otwórz",
    close: "zamknij",

    returned: "Zwrócono",
    dueTodayPill: "Na dziś",

    dayToday: "dziś",
    dayYesterday: "wczoraj",
    dayTomorrow: "jutro",
  },
});
