// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// The employees roster — `StaffList`, the one island on `/dashboard/staff`.
//
// Its own namespace rather than a section of `./staff.ts` (the shell chrome) or
// `./dashboard.ts` (the worklists), for the reason `island-baseline.md` records:
// an island imports the smallest namespace that covers it, and `StaffList`
// already carries the shell namespace for the role chip.
//
// **The banner MESSAGES are not here.** `mutationError`, `inviteSent`,
// `resetSent`, `repairedMailFailed` and the two invite-action labels live in
// `lib/staff-report.ts` alongside the outcome→surface routing that places them —
// `repairedMailFailedMessage` has to NAME whichever button that row shows, so
// splitting the words from the routing is what the design first got wrong
// (design-contract §9.2). Only the roster's own chrome lives here.
//
// The uppercase role and status tokens are the design's own treatment, not
// shouting: they are rendered in a `text-[10px] tracking-wide` badge.
// ---------------------------------------------------------------------------
export const staffAdmin = defineDict({
  en: {
    title: "Employees",
    titleMobile: "Team",
    searchPlaceholder: "Name or email…",
    add: "Add employee",

    // ── Desktop filter tabs ────────────────────────────────────────────────
    tabAll: "Everyone",
    tabActive: "Active",
    tabInvited: "Invited",
    tabCreated: "Added",
    tabAdmin: "Admin",

    // ── Table ──────────────────────────────────────────────────────────────
    colName: "Full name",
    colRole: "Role",
    colStatus: "Status",
    colLastActive: "Last active",
    // The actions column has no visible header, only an accessible name.
    colActions: "Actions",
    selfSuffix: "· You",
    roleAdmin: "ADMIN",
    roleEmployee: "EMPLOYEE",
    statusActive: "ACTIVE",
    statusInvited: "INVITED",
    statusCreated: "ADDED",
    reset: "Reset password",
    removeAria: "Remove employee",
    resetAria: "Reset password",
    footerBold: "You cannot remove yourself.",
    footerRest: " Ask another admin to remove your account.",

    // ── Add modal (step 1 of two) ──────────────────────────────────────────
    // The subtitle and the CTA both stopped promising an email when the add
    // stopped sending one (design-contract §9.2): the CTA names what the button
    // does, and the send moved to the row action that really sends.
    addTitle: "Add employee",
    addSubtitle: "The account is created straight away. You send the invitation in the next step.",
    labelName: "FULL NAME",
    labelEmail: "EMAIL ADDRESS",
    cancel: "Cancel",
    addConfirm: "Add",
    adding: "Adding…",
    sending: "Sending…",
    close: "Close",

    // ── Remove modal ───────────────────────────────────────────────────────
    removeTitle: "Remove this employee?",
    // Rendered after the person's name.
    removeBodyTail: " — They lose access immediately. Completed protocols stay in the archive.",
    confirmLabel: "TYPE THE EMAIL TO CONFIRM",
    remove: "Remove",

    lastAdminTitle: "The last admin cannot be removed",
    lastAdminBody: "At least one admin has to remain. Promote someone else first.",

    // ── Empty states ───────────────────────────────────────────────────────
    emptyTitle: "No employees",
    emptyHint: "Add the first person — you send the invitation in the next step.",
    noResultsTitle: "No results",
    noResultsHint: "No employee matches that search. Try a different name or email.",

    retry: "Retry",

    // ── Mobile ─────────────────────────────────────────────────────────────
    chipActive: "Active",
    chipInvited: "Invited",
    chipCreated: "Added",
    chipAdmin: "Admins",
    roleAdminMobile: "ADMIN",
    statusActiveMobile: "Active",
    statusInvitedMobile: "Invited",
    statusCreatedMobile: "Added",
    footerMobile: "Employees can also reset their own password from the sign-in screen.",

    // The page-level demo note (design-contract §4.1). Scoped to THIS screen, so
    // it names only what this screen fences. NOT the same string as
    // `demoBlockedMessage(locale)`: that one answers "why is THIS button dead",
    // this one answers "what is fenced" for the screen.
    demoNote: "Adding and removing accounts and resetting passwords are disabled in demo mode.",
  },
  pl: {
    title: "Pracownicy",
    titleMobile: "Zespół",
    searchPlaceholder: "Imię lub e-mail…",
    add: "Dodaj pracownika",

    tabAll: "Wszyscy",
    tabActive: "Aktywny",
    tabInvited: "Zaproszony",
    tabCreated: "Dodany",
    tabAdmin: "Administrator",

    colName: "Imię i nazwisko",
    colRole: "Rola",
    colStatus: "Status",
    colLastActive: "Ostatnia aktywność",
    colActions: "Akcje",
    selfSuffix: "· Ty",
    roleAdmin: "ADMINISTRATOR",
    roleEmployee: "PRACOWNIK",
    statusActive: "AKTYWNY",
    statusInvited: "ZAPROSZONY",
    statusCreated: "DODANY",
    reset: "Resetuj hasło",
    removeAria: "Usuń pracownika",
    resetAria: "Resetuj hasło",
    footerBold: "Nie możesz usunąć siebie.",
    footerRest: " Poproś innego administratora o usunięcie Twojego konta.",

    addTitle: "Dodaj pracownika",
    addSubtitle: "Konto powstanie od razu. Zaproszenie wyślesz w kolejnym kroku.",
    labelName: "IMIĘ I NAZWISKO",
    labelEmail: "ADRES E-MAIL",
    cancel: "Anuluj",
    addConfirm: "Dodaj",
    adding: "Dodawanie…",
    sending: "Wysyłanie…",
    close: "Zamknij",

    removeTitle: "Usunąć tego pracownika?",
    removeBodyTail: " — Utraci dostęp natychmiast. Zakończone protokoły pozostają w archiwum.",
    confirmLabel: "WPISZ E-MAIL, ABY POTWIERDZIĆ",
    remove: "Usuń",

    lastAdminTitle: "Nie można usunąć ostatniego administratora",
    lastAdminBody: "Musi pozostać co najmniej jeden administrator. Najpierw awansuj inną osobę.",

    emptyTitle: "Brak pracowników",
    emptyHint: "Dodaj pierwszą osobę — zaproszenie wyślesz w kolejnym kroku.",
    noResultsTitle: "Brak wyników",
    noResultsHint: "Żaden pracownik nie pasuje do wyszukiwania. Spróbuj innego imienia lub e-maila.",

    retry: "Ponów",

    chipActive: "Aktywni",
    chipInvited: "Zaproszeni",
    chipCreated: "Dodani",
    chipAdmin: "Administratorzy",
    roleAdminMobile: "ADMIN",
    statusActiveMobile: "Aktywny",
    statusInvitedMobile: "Zaproszony",
    statusCreatedMobile: "Dodany",
    footerMobile: "Pracownicy mogą też zresetować swoje hasło z ekranu logowania.",

    demoNote: "Dodawanie i usuwanie kont oraz reset hasła są w trybie demo wyłączone.",
  },
});
