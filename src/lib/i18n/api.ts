// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// Error copy for `/api` route handlers — every `MSG` map that used to sit at the
// top of a route file (Phase 1 seeded the two `POST /api/locale` needs; Phase 5
// folded in the other 17 routes plus the two that carried inline literals).
//
// Collecting them here is not merely tidiness: the four gate messages
// (`badOrigin` / `badBody` / `unauthenticated` / `forbidden`) and `demoBlocked`
// were duplicated verbatim across up to nine files, with comments in three of
// them apologising for the duplication. One namespace ends that.
//
// SERVER-ONLY — API handlers read `context.locals.locale` and resolve through
// the composed `useTranslations`, so no island ever reaches this file.
//
// The self-gating ORDER is unchanged (CSRF → auth → role → zod → DB, per the API
// lesson); only the message bodies localize.
// ---------------------------------------------------------------------------
export const api = defineDict({
  en: {
    // ── The shared self-gating rejections ──────────────────────────────────
    badOrigin: "Invalid request origin.",
    badBody: "Invalid request.",
    // `reservations/[id].ts` words its Polish differently ("żądanie" rather than
    // "zgłoszenie"); the distinction has no English twin, so the two keys share
    // one English string rather than inventing a difference.
    badRequest: "Invalid request.",
    unauthenticated: "Sign-in required.",
    forbidden: "You don’t have permission.",
    demoBlocked: "This action is disabled on the demo account.",
    unconfigured: "Account management isn’t configured.",

    // ── Reservations (public funnel + staff decision + manual booking) ─────
    reservationNotFound: "Reservation not found.",
    bookingConflict: "That vehicle has just been booked for those dates. Change the dates and try again.",
    vehicleUnavailable: "This vehicle is no longer available.",
    manualConflict: "That vehicle is already booked on those days.",
    createReservationFailed: "Couldn’t create the reservation.",
    alreadyDecided: "This request has already been decided.",
    invalidReason: "Select a valid rejection reason.",
    // The decide-route schema's own refine, which fires before the RPC gate above.
    chooseRejectionReason: "Select a rejection reason.",
    badDateRange: "Invalid date range.",

    // ── Fleet ──────────────────────────────────────────────────────────────
    vehicleNotFound: "Vehicle not found.",
    duplicatePlate: "A vehicle with that registration number already exists.",
    hasActiveReservations: "This vehicle has active reservations — cancel them first.",
    badQuery: "Invalid query parameters.",
    availabilityFailed: "Couldn’t check availability.",

    // ── Protocols (issue + return) ─────────────────────────────────────────
    protocolNotFound: "Protocol not found.",
    reservationNotConfirmed: "The reservation isn’t confirmed.",
    protocolConflict: "This reservation already has a pickup protocol.",
    noBaseline: "This reservation has no pickup protocol.",
    returnConflict: "This reservation has already been returned.",
    badPath: "Invalid file path.",
    noPdf: "This protocol has no stored PDF file.",
    // The resend path can recover, so its wording points at the remedy.
    noPdfRegenerate: "This protocol has no stored PDF file — generate it again.",

    // ── Team ───────────────────────────────────────────────────────────────
    staffNotFound: "Employee not found.",
    duplicateEmail: "An employee with that email address already exists.",
    hasPassword: "This person already has a password — no invitation is needed.",
    sendFailed: "Couldn’t send the invitation.",
    provisionFailed: "The invitation was sent, but the account couldn’t be completed.",
    confirmMismatch: "The email address you typed doesn’t match.",
    self: "You can’t remove your own account.",
    lastAdmin: "This is the only admin — they can’t be removed.",

    // ── Search ─────────────────────────────────────────────────────────────
    queryTooLong: "The search query is too long.",
  },
  pl: {
    badOrigin: "Nieprawidłowe źródło żądania.",
    badBody: "Nieprawidłowe zgłoszenie.",
    badRequest: "Nieprawidłowe żądanie.",
    unauthenticated: "Wymagane logowanie.",
    forbidden: "Brak uprawnień.",
    demoBlocked: "Ta akcja jest wyłączona na koncie demo.",
    unconfigured: "Zarządzanie kontami nie jest skonfigurowane.",

    reservationNotFound: "Nie znaleziono rezerwacji.",
    bookingConflict: "Pojazd właśnie został zarezerwowany w wybranym terminie. Zmień daty i spróbuj ponownie.",
    vehicleUnavailable: "Ten pojazd nie jest już dostępny.",
    manualConflict: "Ten pojazd ma już rezerwację w wybranych dniach.",
    createReservationFailed: "Nie udało się utworzyć rezerwacji.",
    alreadyDecided: "Ten wniosek został już rozpatrzony.",
    invalidReason: "Wybierz prawidłowy powód odrzucenia.",
    chooseRejectionReason: "Wybierz powód odrzucenia.",
    badDateRange: "Nieprawidłowy zakres dat.",

    vehicleNotFound: "Nie znaleziono pojazdu.",
    duplicatePlate: "Pojazd o tym numerze rejestracyjnym już istnieje.",
    hasActiveReservations: "Pojazd ma aktywne rezerwacje — najpierw je anuluj.",
    badQuery: "Nieprawidłowe parametry zapytania.",
    availabilityFailed: "Nie udało się sprawdzić dostępności.",

    protocolNotFound: "Nie znaleziono protokołu.",
    reservationNotConfirmed: "Rezerwacja nie jest potwierdzona.",
    protocolConflict: "Dla tej rezerwacji wydano już protokół.",
    noBaseline: "Brak protokołu wydania dla tej rezerwacji.",
    returnConflict: "Dla tej rezerwacji przyjęto już zwrot.",
    badPath: "Nieprawidłowa ścieżka pliku.",
    noPdf: "Protokół nie ma zapisanego pliku PDF.",
    noPdfRegenerate: "Protokół nie ma zapisanego pliku PDF — wygeneruj go ponownie.",

    staffNotFound: "Nie znaleziono pracownika.",
    duplicateEmail: "Pracownik z tym adresem e-mail już istnieje.",
    hasPassword: "Ta osoba ma już hasło — zaproszenie nie jest potrzebne.",
    sendFailed: "Nie udało się wysłać zaproszenia.",
    provisionFailed: "Zaproszenie zostało wysłane, ale konta nie udało się dokończyć.",
    confirmMismatch: "Wpisany adres e-mail nie zgadza się.",
    self: "Nie możesz usunąć własnego konta.",
    lastAdmin: "To jedyny administrator — nie można go usunąć.",

    queryTooLong: "Zapytanie jest za długie.",
  },
});
