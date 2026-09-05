// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// The staff cockpit's chrome and its Pulpit — `shell/StaffShell.astro`,
// `pages/dashboard.astro`, and the dashboard islands the board is made of.
//
// *** Almost all of this is AUTHORED, not harvested. *** The design source's
// `staff-desktop.jsx` hardcodes its nav array in Polish and never reads `STR`
// (design-contract §2 item 9), so `Pulpit` / `Wnioski` / `Wydania` / `Zwroty` /
// `Kalendarz` / `Flota` / `Operacje` had no English twin to harvest. Where `STR`
// carries a plausible key it corroborates the choice rather than sourcing it —
// see the change's `glossary.md` §3, which records each one.
//
// `navFleet` is "Fleet" while the sidebar wordmark stays "Flota": the same
// brand-vs-nav split as the public header (frame decision 5), and the reason the
// brand lives in `./layout.ts` instead.
// ---------------------------------------------------------------------------
export const staff = defineDict({
  en: {
    // ── Sidebar / tab-bar nav ──────────────────────────────────────────────
    navDash: "Dashboard",
    navRequests: "Requests",
    navPickups: "Pickups",
    navReturns: "Returns",
    navCalendar: "Calendar",
    navFleet: "Fleet",
    navTeam: "Team",
    sectionOperations: "Operations",
    profile: "Profile",
    signOut: "Sign out",
    signingOut: "Signing out…",

    // ── Identity chip (`lib/staff-identity.ts`) ────────────────────────────
    roleAdmin: "Admin",
    roleEmployee: "Employee",

    // ── Locale row (`shell/LangRow.tsx`) ───────────────────────────────────
    // The row's VALUE is the endonym (`LOCALE_ENDONYMS`) and is never
    // translated; only the field label and the control's accessible name are.
    changeLanguage: "Change language",
    languageLabel: "Language",

    // ── Pulpit header ──────────────────────────────────────────────────────
    // Deliberately static, not time-of-day derived: the server runs UTC while
    // the depot lives in Europe/Warsaw (design-contract deviation 3).
    greeting: "Good morning",
    dashSubtitle: "Here’s your day at the Warsaw depot",
    // The depot under the identity chip's role label. The city translates; the
    // depot is single and fixed, like the public site's `Warsaw · Mokotów`.
    depot: "Warsaw",
    search: "Search",

    // ── Stat cards + mobile chips ──────────────────────────────────────────
    today: "Today",
    pendingSub: "Pending",
    overdue: "Overdue",
    urgent: "Urgent",
    chipAll: "All",
    open: "Open",

    // ── Today's schedule ───────────────────────────────────────────────────
    scheduleHeading: "Today’s schedule",
    scheduleDone: "Completed",
    protocol: "Protocol",
    returnAction: "Return",
    emptyPickups: "No pickups today",
    emptyReturns: "No returns today",
    // `{done}` / `{total}` are substituted by `lib/dispatch-board.ts`.
    scheduleProgress: "{done} of {total} completed",

    // ── Need-a-decision panel ──────────────────────────────────────────────
    decisionTitle: "Need a decision",
    decisionEmpty: "No pending requests",
    decisionEmptyHint: "New requests will show up here.",
    approve: "Approve",
    reject: "Reject",
    seeAll: "See all",
    alreadyHandled: "Someone else has already decided this request.",
    genericError: "Something went wrong. Try again.",
    // Fallback when a row carries neither make nor model.
    vehicleFallback: "Vehicle",

    // ── Quick-add (`QuickAddButton` + `quick-actions.ts`) ───────────────────
    quickAddPill: "New",
    quickAction: "Quick action",
    emptyFleet: "No vehicles to book",
    fleetLoadError: "Could not load the fleet. Try again.",
    actionReservation: "New reservation",
    actionReservationDesc: "Add a rental manually",
    actionVehicle: "Add vehicle",
    actionVehicleDesc: "A new vehicle for the fleet",
    actionEmployee: "Add employee",
    actionEmployeeDesc: "Invite them to the team",
  },
  pl: {
    navDash: "Pulpit",
    navRequests: "Wnioski",
    navPickups: "Wydania",
    navReturns: "Zwroty",
    navCalendar: "Kalendarz",
    navFleet: "Flota",
    navTeam: "Zespół",
    sectionOperations: "Operacje",
    profile: "Profil",
    signOut: "Wyloguj",
    signingOut: "Wylogowywanie…",

    roleAdmin: "Administrator",
    roleEmployee: "Pracownik",

    changeLanguage: "Zmień język",
    languageLabel: "Język",

    greeting: "Dzień dobry",
    dashSubtitle: "Oto Twój dzień w oddziale Warszawa",
    depot: "Warszawa",
    search: "Szukaj",

    today: "Dziś",
    pendingSub: "Oczekujące",
    overdue: "Po terminie",
    urgent: "Pilne",
    chipAll: "Wszystko",
    open: "Otwórz",

    scheduleHeading: "Harmonogram na dziś",
    scheduleDone: "Zakończone",
    protocol: "Protokół",
    returnAction: "Zwrot",
    emptyPickups: "Brak wydań na dziś",
    emptyReturns: "Brak zwrotów na dziś",
    scheduleProgress: "{done} z {total} zakończone",

    decisionTitle: "Wymaga decyzji",
    decisionEmpty: "Brak oczekujących wniosków",
    decisionEmptyHint: "Nowe zgłoszenia pojawią się tutaj.",
    approve: "Zatwierdź",
    reject: "Odrzuć",
    seeAll: "Zobacz wszystkie",
    alreadyHandled: "Ten wniosek został już rozpatrzony przez kogoś innego.",
    genericError: "Coś poszło nie tak. Spróbuj ponownie.",
    vehicleFallback: "Pojazd",

    quickAddPill: "Nowe",
    quickAction: "Szybka akcja",
    emptyFleet: "Brak pojazdów do rezerwacji",
    fleetLoadError: "Nie udało się pobrać floty. Spróbuj ponownie.",
    actionReservation: "Nowa rezerwacja",
    actionReservationDesc: "Dodaj wynajem ręcznie",
    actionVehicle: "Dodaj pojazd",
    actionVehicleDesc: "Nowy pojazd do floty",
    actionEmployee: "Dodaj pracownika",
    actionEmployeeDesc: "Zaproś do zespołu",
  },
});
