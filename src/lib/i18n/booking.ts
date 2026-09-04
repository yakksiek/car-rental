// core
import { defineDict } from "./types";

// ---------------------------------------------------------------------------
// The public reservation funnel — the `BookingWidget` on a vehicle page, the
// three-step `/reserve` form, and the `/r/<token>` status page it lands on.
//
// Islands reaching this file: `BookingWidget` and `ReservationForm`. Both use
// `translator(locale, booking)`; neither touches the composed map.
//
// **`Warszawa · Mokotów` appears here AND in `./fleet.ts`.** It is the one fixed
// depot, rendered by both the detail page's trust row and this funnel's summary,
// and the two namespaces are deliberately not shared (see `./fleet.ts`'s header
// for why an island's namespace stays small). Duplicating one label is the
// cheaper of the two costs.
//
// English is authored: the design source's booking screens are Polish-only. The
// glossary's `odbiór`/`wydanie` → "pickup" collapse (§2) is what lets the
// customer-facing "Odbiór" and the staff-facing "Wydania" both read Pickup.
// ---------------------------------------------------------------------------
export const booking = defineDict({
  en: {
    // ── BookingWidget (vehicle detail page) ────────────────────────────────
    // A 24-hour billing unit. The customer-facing suffix is spelled out here
    // rather than in `format.ts`: a unit-arranging helper has no business owning
    // a word a caller could phrase differently.
    perDay: "/day",
    perMonth: "/mo",
    rangeLabel: "Dates",
    pickup: "Pickup",
    return: "Return",
    chooseRange: "Choose your pickup and return dates",
    depositRefundable: "Deposit (refundable)",
    estimate: "Estimated price",
    cta: "Reserve",
    reassurance: "No account needed · free cancellation up to 24 h before pickup",
    // Shown when a completed range collides with a booking on a changeover day.
    changeoverPickupTaken: "That pickup day is unavailable. Choose different dates.",
    changeoverReturnTaken: "That return day is unavailable. Choose different dates.",
    changeoverSpansBooked: "Those dates are unavailable. Choose different ones.",
    // Per-day aria-label suffixes for the two half-available changeover states,
    // so SR/keyboard users get the signal the half-cell cannot convey.
    pickupOnlyLabel: "available as a pickup day only",
    returnOnlyLabel: "available as a return day only",
    // Legend decoding the calendar's grey treatments for sighted users.
    legendBlocked: "unavailable",
    legendPickupOnly: "pickup only",
    legendReturnOnly: "return only",

    // ── /reserve (three-step form) ─────────────────────────────────────────
    reserveTitle: "Your details — Flota",
    eyebrow: "Reserve a vehicle",
    stepDates: "Dates",
    stepDetails: "Your details",
    stepReview: "Review",
    headingDetails: "Your details",
    headingReview: "Review",
    backToVehicle: "Back to the vehicle",
    backToDetails: "Back to your details",
    next: "Next",
    submit: "Send request",
    change: "Change",
    summary: "Your reservation",
    bookingDetails: "Booking details",
    customerDetails: "Customer details",
    duration: "Duration",
    rate: "Rate",
    branch: "Branch",
    branchValue: "Warsaw · Mokotów",
    deposit: "Deposit",
    // The consent checkbox, split so the document itself is the LINK rather
    // than a sentence sitting next to one. Assembled as
    // `termsPrefix` + " " + <a href="/terms">termsLink</a> + `termsSuffix`, with
    // the space supplied by JSX so neither half carries a trailing one. `/terms`
    // exists as of Phase 7 — until then this checkbox asked customers to accept
    // a document that was nowhere in the repo (frame decision 4).
    termsPrefix: "I accept the",
    termsLink: "rental terms",
    termsSuffix: ".",
    // Appended `sr-only`: the link opens in a new tab so a half-filled form is
    // not thrown away, and a screen-reader user gets no other warning of that.
    termsNewTab: "(opens in a new tab)",
    reserveReassurance: "No payment now — we confirm availability by email, usually within the hour.",
    fixFields: "Correct the highlighted fields.",
    genericError: "Something went wrong. Try again.",

    // Field labels. `(opt.)` marks the optional B2B fields, which never block
    // submission. `NIP` keeps its Polish name — glossary §4 records that the
    // label form of the gloss is what the design ships (`VAT ID / NIP`).
    fieldName: "Full name",
    fieldPhone: "Phone",
    fieldEmail: "Email",
    fieldCompany: "Company (opt.)",
    fieldVatId: "VAT ID / NIP (opt.)",
    fieldCompanyShort: "Company",
    fieldVatIdShort: "NIP",
    fieldNotes: "Notes for the team (opt.)",
    fieldNotesShort: "Notes",
    // Honeypot label — visually hidden, read only by bots.
    fieldHoneypot: "Company website",
    notesPlaceholder: "Anything we should know — the load, an extra driver, a preferred pickup time…",

    // No dates carried into `/reserve`.
    noDatesStep: "Step 1 · Dates",
    noDatesTitle: "Pick your dates first",
    noDatesBody: "To reserve this vehicle, choose the pickup and return dates on the vehicle page.",
    noDatesCta: "Pick dates",

    // ── /r/<token> status page ─────────────────────────────────────────────
    // Interpolated with the reservation reference.
    statusTitlePrefix: "Request",
    statusNotFoundTitle: "Request not found",
    statusNotFoundBody:
      "This request does not exist, or the link is wrong. Check the address in your confirmation email.",
    statusReceived: "Request received",
    statusReceivedSub: "No account needed — we confirm everything by email.",
    statusPlusDeposit: "+ deposit",
    // Also used by the booking widget's sticky mobile band.
    // Rendered around the customer's email address.
    statusEmailedBefore: "We have sent the confirmation to",
    stepperHeading: "What happens next",

    // ── The stepper model (`lib/reservation-status.ts`) ────────────────────
    stepPendingLabel: "Waiting for approval",
    stepPendingDesc: "An employee is reviewing your request, usually within a few hours.",
    stepDecisionLabel: "Confirmation by email",
    stepDecisionDesc: "You will get a confirmation — or a suggestion of other dates — by email.",
    stepPickupLabel: "Pickup",
    stepPickupDesc: "Bring your dowód osobisty (Polish national ID card) and driving licence to collect the vehicle.",
    stepRejectedLabel: "Rejected",
    stepRejectedDesc: "Unfortunately we cannot confirm these dates. Send a request for different ones.",
    stepCancelledLabel: "Cancelled",
    stepCancelledDesc: "The request was cancelled.",
  },
  pl: {
    perDay: "/doba",
    perMonth: "/mies",
    rangeLabel: "Termin",
    pickup: "Odbiór",
    return: "Zwrot",
    chooseRange: "Wybierz daty odbioru i zwrotu",
    depositRefundable: "Kaucja (zwrotna)",
    estimate: "Szacunkowa cena",
    cta: "Zarezerwuj",
    reassurance: "Bez konta · darmowa anulacja do 24h przed odbiorem",
    changeoverPickupTaken: "Wybrany dzień odbioru jest niedostępny. Wybierz inny termin.",
    changeoverReturnTaken: "Wybrany dzień zwrotu jest niedostępny. Wybierz inny termin.",
    changeoverSpansBooked: "Wybrany termin jest niedostępny. Wybierz inne daty.",
    pickupOnlyLabel: "dostępny tylko jako dzień odbioru",
    returnOnlyLabel: "dostępny tylko jako dzień zwrotu",
    legendBlocked: "niedostępny",
    legendPickupOnly: "tylko odbiór",
    legendReturnOnly: "tylko zwrot",

    reserveTitle: "Twoje dane — Flota",
    eyebrow: "Zarezerwuj pojazd",
    stepDates: "Daty",
    stepDetails: "Twoje dane",
    stepReview: "Podsumowanie",
    headingDetails: "Twoje dane",
    headingReview: "Podsumowanie",
    backToVehicle: "Wróć do pojazdu",
    backToDetails: "Wróć do danych",
    next: "Dalej",
    submit: "Wyślij zgłoszenie",
    change: "Zmień",
    summary: "Twoja rezerwacja",
    bookingDetails: "Dane rezerwacji",
    customerDetails: "Dane klienta",
    duration: "Czas trwania",
    rate: "Stawka",
    branch: "Oddział",
    branchValue: "Warszawa · Mokotów",
    deposit: "Kaucja",
    termsPrefix: "Akceptuję",
    termsLink: "regulamin wynajmu",
    termsSuffix: ".",
    termsNewTab: "(otwiera się w nowej karcie)",
    reserveReassurance: "Bez płatności teraz — potwierdzimy dostępność e-mailem, zwykle w godzinę.",
    fixFields: "Popraw zaznaczone pola.",
    genericError: "Coś poszło nie tak. Spróbuj ponownie.",

    fieldName: "Imię i nazwisko",
    fieldPhone: "Telefon",
    fieldEmail: "Email",
    fieldCompany: "Firma (opcj.)",
    fieldVatId: "NIP (opcj.)",
    fieldCompanyShort: "Firma",
    fieldVatIdShort: "NIP",
    fieldNotes: "Uwagi dla zespołu (opcj.)",
    fieldNotesShort: "Uwagi",
    fieldHoneypot: "Firmowa strona WWW",
    notesPlaceholder: "Coś, o czym powinniśmy wiedzieć — ładunek, dodatkowy kierowca, preferowana godzina odbioru…",

    noDatesStep: "Krok 1 · Daty",
    noDatesTitle: "Najpierw wybierz daty",
    noDatesBody: "Aby zarezerwować ten pojazd, wybierz termin odbioru i zwrotu na stronie pojazdu.",
    noDatesCta: "Wybierz daty",

    statusTitlePrefix: "Zgłoszenie",
    statusNotFoundTitle: "Nie znaleziono zgłoszenia",
    statusNotFoundBody:
      "To zgłoszenie nie istnieje lub link jest nieprawidłowy. Sprawdź adres z e-maila potwierdzającego.",
    statusReceived: "Zgłoszenie przyjęte",
    statusReceivedSub: "Bez konta — wszystko potwierdzimy e-mailem.",
    statusPlusDeposit: "+ kaucja",
    statusEmailedBefore: "Potwierdzenie wysłaliśmy na",
    stepperHeading: "Co dalej",

    stepPendingLabel: "Oczekuje na akceptację",
    stepPendingDesc: "Pracownik sprawdza Twoje zgłoszenie, zwykle w ciągu kilku godzin.",
    stepDecisionLabel: "Potwierdzenie e-mailem",
    stepDecisionDesc: "Otrzymasz potwierdzenie (lub propozycję innych dat) e-mailem.",
    stepPickupLabel: "Odbiór",
    stepPickupDesc: "Zabierz dowód osobisty i prawo jazdy, aby odebrać pojazd.",
    stepRejectedLabel: "Odrzucone",
    stepRejectedDesc: "Niestety nie możemy potwierdzić tego terminu. Wyślij zgłoszenie na inne daty.",
    stepCancelledLabel: "Anulowane",
    stepCancelledDesc: "Zgłoszenie zostało anulowane.",
  },
});
