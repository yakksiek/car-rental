// others
import { estimatedTotal, formatDuration, formatPln, rentalDays } from "../format";
import type { EmailContent } from "./index";

// Polish transactional templates (S-02). Each template is a pure function
// returning EmailContent; the caller addresses and sends it via `sendEmail`.
// S-03 adds the confirm/reject templates alongside this one.

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
