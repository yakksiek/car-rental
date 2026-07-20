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

// ---------------------------------------------------------------------------
// S-05 issue-protocol email — composed after a committed handover, once the PDF
// has been uploaded. The customer has no account and no portal: this mail and
// its PDF attachment are their ONLY copy of the evidence, possibly needed in a
// dispute months later. So the mail carries no link into the app — the PDF is
// the artifact, and the body is a human-readable summary of it.
// ---------------------------------------------------------------------------

export interface ProtocolIssuedParams {
  reference: string;
  customerName: string;
  /** Display name, e.g. `"Ford Transit"`. */
  vehicle: string;
  /** Registration plate, e.g. `"WX 5519M"` — what tells two identical models apart. */
  plate: string;
  odometerKm: number;
  /** Fuel level in eighths, 0–8. */
  fuelEighths: number;
  /** Number of damage items recorded at pickup (`0` reads as "no damage"). */
  damageCount: number;
}

/** `3` → `"3/8"`, with the two ends named the way the form names them. */
function fuelLabel(eighths: number): string {
  if (eighths === 8) {
    return "8/8 (pełny)";
  }
  if (eighths === 0) {
    return "0/8 (pusty)";
  }
  return `${eighths}/8`;
}

/**
 * `0` → `"brak"`, otherwise the count with the Polish plural it takes:
 * 1 → `pozycja`, 2–4 → `pozycje`, everything else → `pozycji`, with the
 * 12–14 exception that makes the teens take the genitive plural.
 */
function damageLabel(count: number): string {
  if (count === 0) {
    return "brak";
  }
  if (count === 1) {
    return "1 pozycja";
  }
  const lastTwo = count % 100;
  const last = count % 10;
  const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return `${count} ${few ? "pozycje" : "pozycji"}`;
}

/** Handover email: the signed protocol, summarized, with the PDF attached. */
export function protocolIssuedEmail(params: ProtocolIssuedParams): EmailContent {
  const odometer = `${params.odometerKm.toLocaleString("pl-PL")} km`;
  const fuel = fuelLabel(params.fuelEighths);
  const damages = damageLabel(params.damageCount);

  const subject = `FleetRent — protokół wydania ${params.reference}`;

  const text = [
    `Dzień dobry, ${params.customerName}!`,
    "",
    `W załączniku przesyłamy podpisany protokół wydania pojazdu (${params.reference}).`,
    "",
    `Pojazd: ${params.vehicle}`,
    `Rejestracja: ${params.plate}`,
    `Stan licznika: ${odometer}`,
    `Poziom paliwa: ${fuel}`,
    `Uszkodzenia zapisane przy wydaniu: ${damages}`,
    "",
    "Prosimy o zachowanie tego dokumentu — będzie podstawą porównania przy zwrocie pojazdu.",
    "",
    "Życzymy szerokiej drogi!",
  ].join("\n");

  const html = [
    `<p>Dzień dobry, ${params.customerName}!</p>`,
    `<p>W załączniku przesyłamy podpisany protokół wydania pojazdu (<strong>${params.reference}</strong>).</p>`,
    "<ul>",
    `<li>Pojazd: ${params.vehicle}</li>`,
    `<li>Rejestracja: ${params.plate}</li>`,
    `<li>Stan licznika: ${odometer}</li>`,
    `<li>Poziom paliwa: ${fuel}</li>`,
    `<li>Uszkodzenia zapisane przy wydaniu: ${damages}</li>`,
    "</ul>",
    "<p>Prosimy o zachowanie tego dokumentu — będzie podstawą porównania przy zwrocie pojazdu.</p>",
    "<p>Życzymy szerokiej drogi!</p>",
  ].join("\n");

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// S-06 return-protocol email — composed after a committed return, once the PDF
// (carrying the comparison section) has been uploaded. Like the issue mail it
// carries no link into the app: the PDF attachment is the customer's only copy.
// The body summarizes the comparison against the issue baseline — the
// differentiating value over paper — using the same delta numbers the form and
// the PDF show, so the three can never disagree (see src/lib/protocol-delta.ts).
// ---------------------------------------------------------------------------

export interface ProtocolReturnedParams {
  reference: string;
  customerName: string;
  /** Display name, e.g. `"Ford Transit"`. */
  vehicle: string;
  /** Registration plate, e.g. `"WX 5519M"`. */
  plate: string;
  /** ISO `YYYY-MM-DD` rental window, for the body's "okres najmu" line. */
  pickup: string;
  return: string;
  /** Odometer at return, in km. */
  odometerKm: number;
  /** Fuel at return, in eighths (0–8). */
  fuelEighths: number;
  /** `current − baseline` odometer; may be 0 or negative (a suspect reading). */
  kmDriven: number;
  /** `current − baseline` fuel, in eighths; negative ⇒ returned lower. */
  fuelDelta: number;
  /** Return damages with no baseline link — the "new damage" number. */
  newDamageCount: number;
}

/** Signed km summary: `+1 228 km` / `−40 km` / `0 km` (pl-PL grouping). */
function kmDrivenLabel(km: number): string {
  const sign = km > 0 ? "+" : "";
  return `${sign}${km.toLocaleString("pl-PL")} km`;
}

/** Signed fuel-eighths change: `bez zmian` / `+2/8` / `−4/8` (a true minus, U+2212). */
function fuelDeltaLabel(delta: number): string {
  if (delta === 0) {
    return "bez zmian";
  }
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)}/8`;
}

/** Return email: the signed return protocol, its comparison summarized, PDF attached. */
export function protocolReturnedEmail(params: ProtocolReturnedParams): EmailContent {
  const odometer = `${params.odometerKm.toLocaleString("pl-PL")} km`;
  const fuel = fuelLabel(params.fuelEighths);
  const kmDriven = kmDrivenLabel(params.kmDriven);
  const fuelChange = fuelDeltaLabel(params.fuelDelta);
  const newDamages = damageLabel(params.newDamageCount);

  const subject = `FleetRent — protokół zwrotu ${params.reference}`;

  const text = [
    `Dzień dobry, ${params.customerName}!`,
    "",
    `W załączniku przesyłamy podpisany protokół zwrotu pojazdu (${params.reference}).`,
    "",
    `Pojazd: ${params.vehicle}`,
    `Rejestracja: ${params.plate}`,
    `Okres najmu: ${params.pickup} – ${params.return}`,
    "",
    "Porównanie ze stanem wydania:",
    `Przejechano: ${kmDriven}`,
    `Zmiana paliwa: ${fuelChange}`,
    `Nowe uszkodzenia: ${newDamages}`,
    "",
    `Stan licznika przy zwrocie: ${odometer}`,
    `Poziom paliwa przy zwrocie: ${fuel}`,
    "",
    "Dziękujemy za skorzystanie z naszych usług!",
  ].join("\n");

  const html = [
    `<p>Dzień dobry, ${params.customerName}!</p>`,
    `<p>W załączniku przesyłamy podpisany protokół zwrotu pojazdu (<strong>${params.reference}</strong>).</p>`,
    "<ul>",
    `<li>Pojazd: ${params.vehicle}</li>`,
    `<li>Rejestracja: ${params.plate}</li>`,
    `<li>Okres najmu: ${params.pickup} – ${params.return}</li>`,
    "</ul>",
    "<p><strong>Porównanie ze stanem wydania:</strong></p>",
    "<ul>",
    `<li>Przejechano: ${kmDriven}</li>`,
    `<li>Zmiana paliwa: ${fuelChange}</li>`,
    `<li>Nowe uszkodzenia: ${newDamages}</li>`,
    "</ul>",
    "<ul>",
    `<li>Stan licznika przy zwrocie: ${odometer}</li>`,
    `<li>Poziom paliwa przy zwrocie: ${fuel}</li>`,
    "</ul>",
    "<p>Dziękujemy za skorzystanie z naszych usług!</p>",
  ].join("\n");

  return { subject, html, text };
}
