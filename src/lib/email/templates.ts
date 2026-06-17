// others
import { estimatedTotal, formatDuration, formatPln, rejectionReasonLabelPl, rentalDays } from "../format";
import type { RejectionReason } from "../../types";
import type { EmailContent } from "./index";

// Polish transactional templates (S-02 + S-03). Each template is a pure function
// returning EmailContent; the caller addresses and sends it via `sendEmail`.

export interface ReservationReceivedParams {
  reference: string;
  /** Absolute URL of the tokenized status page, e.g. `https://…/r/<token>`. */
  statusUrl: string;
  /** Display name, e.g. `"Mercedes-Benz Sprinter (2022)"`. */
  vehicle: string;
  /** ISO `YYYY-MM-DD`. */
  pickup: string;
  return: string;
  /** numeric-as-string quirk tolerated, like every money input. */
  dailyRate: string | number;
}

/** Submit-confirmation email: reference, summary, and the status link. */
export function reservationReceivedEmail(params: ReservationReceivedParams): EmailContent {
  const days = rentalDays(params.pickup, params.return);
  const total = formatPln(estimatedTotal(params.dailyRate, days));
  const duration = formatDuration(days);

  const subject = `FleetRent — zgłoszenie ${params.reference} przyjęte`;

  const text = [
    `Dziękujemy! Twoje zgłoszenie rezerwacji ${params.reference} zostało przyjęte.`,
    "",
    `Pojazd: ${params.vehicle}`,
    `Odbiór: ${params.pickup} od 14:00`,
    `Zwrot: ${params.return} do 10:00`,
    `Czas trwania: ${duration}`,
    `Szacunkowa cena: ${total}`,
    "",
    "Status zgłoszenia sprawdzisz w każdej chwili pod adresem:",
    params.statusUrl,
    "",
    "Potwierdzimy dostępność e-mailem — zwykle w godzinę.",
    "Bez płatności teraz.",
  ].join("\n");

  const html = [
    `<p>Dziękujemy! Twoje zgłoszenie rezerwacji <strong>${params.reference}</strong> zostało przyjęte.</p>`,
    "<ul>",
    `<li>Pojazd: ${params.vehicle}</li>`,
    `<li>Odbiór: ${params.pickup} od 14:00</li>`,
    `<li>Zwrot: ${params.return} do 10:00</li>`,
    `<li>Czas trwania: ${duration}</li>`,
    `<li>Szacunkowa cena: ${total}</li>`,
    "</ul>",
    `<p>Status zgłoszenia sprawdzisz w każdej chwili pod adresem:<br/><a href="${params.statusUrl}">${params.statusUrl}</a></p>`,
    "<p>Potwierdzimy dostępność e-mailem — zwykle w godzinę. Bez płatności teraz.</p>",
  ].join("\n");

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// S-03 decision emails — composed after a committed accept/reject.
// ---------------------------------------------------------------------------

export interface ReservationConfirmedParams {
  reference: string;
  /** Absolute URL of the tokenized status page, e.g. `https://…/r/<token>`. */
  statusUrl: string;
  /** Display name, e.g. `"Mercedes-Benz Sprinter (2022)"`. */
  vehicle: string;
  /** ISO `YYYY-MM-DD`. */
  pickup: string;
  return: string;
  /** numeric-as-string quirk tolerated, like every money input. */
  dailyRate: string | number;
  deposit: string | number;
}

/** Acceptance email: the booking is confirmed, with the pickup details + deposit. */
export function reservationConfirmedEmail(params: ReservationConfirmedParams): EmailContent {
  const days = rentalDays(params.pickup, params.return);
  const total = formatPln(estimatedTotal(params.dailyRate, days));
  const duration = formatDuration(days);
  const deposit = formatPln(params.deposit);

  const subject = `FleetRent — rezerwacja ${params.reference} potwierdzona`;

  const text = [
    `Dobra wiadomość! Twoja rezerwacja ${params.reference} została potwierdzona.`,
    "",
    `Pojazd: ${params.vehicle}`,
    `Odbiór: ${params.pickup} od 14:00`,
    `Zwrot: ${params.return} do 10:00`,
    `Czas trwania: ${duration}`,
    `Szacunkowa cena: ${total}`,
    `Kaucja: ${deposit}`,
    "",
    "Szczegóły rezerwacji znajdziesz pod adresem:",
    params.statusUrl,
    "",
    "Do zobaczenia przy odbiorze!",
  ].join("\n");

  const html = [
    `<p>Dobra wiadomość! Twoja rezerwacja <strong>${params.reference}</strong> została potwierdzona.</p>`,
    "<ul>",
    `<li>Pojazd: ${params.vehicle}</li>`,
    `<li>Odbiór: ${params.pickup} od 14:00</li>`,
    `<li>Zwrot: ${params.return} do 10:00</li>`,
    `<li>Czas trwania: ${duration}</li>`,
    `<li>Szacunkowa cena: ${total}</li>`,
    `<li>Kaucja: ${deposit}</li>`,
    "</ul>",
    `<p>Szczegóły rezerwacji znajdziesz pod adresem:<br/><a href="${params.statusUrl}">${params.statusUrl}</a></p>`,
    "<p>Do zobaczenia przy odbiorze!</p>",
  ].join("\n");

  return { subject, html, text };
}

export interface ReservationRejectedParams {
  reference: string;
  /** Absolute URL of the tokenized status page. */
  statusUrl: string;
  /** Display name, e.g. `"Mercedes-Benz Sprinter (2022)"`. */
  vehicle: string;
  /** The canned reason code; rendered as canonical Polish copy. */
  reason: RejectionReason;
  /** Optional free-text note (used when the reason is `other`). */
  note?: string | null;
}

/** Rejection email: the request could not be confirmed, with the canned reason. */
export function reservationRejectedEmail(params: ReservationRejectedParams): EmailContent {
  const reasonLabel = rejectionReasonLabelPl(params.reason);
  const noteLine = params.note ? `Szczegóły: ${params.note}` : null;

  const subject = `FleetRent — wniosek ${params.reference} odrzucony`;

  const text = [
    `Niestety nie mogliśmy potwierdzić Twojego wniosku ${params.reference}.`,
    "",
    `Pojazd: ${params.vehicle}`,
    `Powód: ${reasonLabel}`,
    ...(noteLine ? [noteLine] : []),
    "",
    "Zachęcamy do sprawdzenia innych pojazdów lub alternatywnych dat.",
    "",
    "Status wniosku znajdziesz pod adresem:",
    params.statusUrl,
  ].join("\n");

  const html = [
    `<p>Niestety nie mogliśmy potwierdzić Twojego wniosku <strong>${params.reference}</strong>.</p>`,
    "<ul>",
    `<li>Pojazd: ${params.vehicle}</li>`,
    `<li>Powód: ${reasonLabel}</li>`,
    ...(noteLine ? [`<li>${noteLine}</li>`] : []),
    "</ul>",
    "<p>Zachęcamy do sprawdzenia innych pojazdów lub alternatywnych dat.</p>",
    `<p>Status wniosku znajdziesz pod adresem:<br/><a href="${params.statusUrl}">${params.statusUrl}</a></p>`,
  ].join("\n");

  return { subject, html, text };
}
