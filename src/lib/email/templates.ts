// others
import { estimatedTotal, formatDuration, formatInteger, formatPln, plural, rentalDays } from "../format";
import { email as emailCatalog } from "../i18n/email";
import { rejectionReasonLabel } from "../i18n/reservation";
import { translator } from "../i18n/types";
import type { PluralForms } from "../format";
import type { Locale } from "../i18n/types";
import type { RejectionReason } from "../../types";
import type { EmailContent } from "./index";

// The five transactional templates (S-02 + S-03 + S-05 + S-06). Each is a pure
// function returning EmailContent; the caller addresses and sends it via
// `sendEmail`. Copy lives in `../i18n/email.ts`.
//
// *** `locale` is a REQUIRED parameter on every one of them, and it is the
// RESERVATION's, never the sender's session. *** This file carried an
// `ARTIFACT_LOCALE = "pl"` constant through Phases 1-5 precisely so that the
// day it became a parameter, no call site could quietly default it to whatever
// language the employee happened to be reading. An employee working an English
// cockpit accepting a Polish walk-in's request must still send Polish; the
// resend path has no session at all. `reservations.locale` (Phase 1) is the
// value, and the four RPCs that feed these callers return it (Phase 6).
//
// Free text is NEVER translated, only framed: `rejection_note` below renders
// verbatim inside a localized `Details:` line, per the plan's frame decision 2.
//
// *** Every `{placeholder}` below is filled with a FUNCTION replacer, never a
// string. *** `String.prototype.replace` reads `$&`, "$`", `$'` and `$1` as
// substitution patterns inside a string replacement, so a value carrying one of
// them gets re-interpreted instead of inserted. The customer types their own name
// into the public booking form and nothing filters those characters: measured, a
// customer called "Firma $` SA" received `Dzień dobry Firma Dzień dobry  SA,` —
// the mail's own opening words spliced into their name. A function replacement
// inserts the value literally, with no pattern syntax at all.
//
// Only `{name}` takes free text today; the reference numbers and counts are ours.
// They are all converted anyway, so the next substitution added here inherits the
// safe form rather than the trap.

/** Bind the email copy to one artifact locale. */
function copy(locale: Locale) {
  return translator(locale, emailCatalog);
}

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
  /** `reservations.locale` — the customer's language, captured at submission. */
  locale: Locale;
}

/** Submit-confirmation email: reference, summary, and the status link. */
export function reservationReceivedEmail(params: ReservationReceivedParams): EmailContent {
  const { locale } = params;
  const t = copy(locale);
  const days = rentalDays(params.pickup, params.return);
  const total = formatPln(estimatedTotal(params.dailyRate, days), locale);
  const duration = formatDuration(days, locale);

  const subject = t("receivedSubject").replace("{ref}", () => params.reference);

  const text = [
    t("receivedLead").replace("{ref}", () => params.reference),
    "",
    `${t("vehicle")}: ${params.vehicle}`,
    `${t("pickup")}: ${params.pickup} ${t("pickupFrom")}`,
    `${t("return")}: ${params.return} ${t("returnBy")}`,
    `${t("duration")}: ${duration}`,
    `${t("estimate")}: ${total}`,
    "",
    t("receivedStatusLink"),
    params.statusUrl,
    "",
    t("receivedConfirmSoon"),
    t("receivedNoPayment"),
  ].join("\n");

  const html = [
    `<p>${t("receivedLead").replace("{ref}", () => `<strong>${params.reference}</strong>`)}</p>`,
    "<ul>",
    `<li>${t("vehicle")}: ${params.vehicle}</li>`,
    `<li>${t("pickup")}: ${params.pickup} ${t("pickupFrom")}</li>`,
    `<li>${t("return")}: ${params.return} ${t("returnBy")}</li>`,
    `<li>${t("duration")}: ${duration}</li>`,
    `<li>${t("estimate")}: ${total}</li>`,
    "</ul>",
    `<p>${t("receivedStatusLink")}<br/><a href="${params.statusUrl}">${params.statusUrl}</a></p>`,
    `<p>${t("receivedConfirmSoon")} ${t("receivedNoPayment")}</p>`,
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
  /** `reservations.locale`, off the deciding RPC's payload — not the employee's. */
  locale: Locale;
}

/** Acceptance email: the booking is confirmed, with the pickup details + deposit. */
export function reservationConfirmedEmail(params: ReservationConfirmedParams): EmailContent {
  const { locale } = params;
  const t = copy(locale);
  const days = rentalDays(params.pickup, params.return);
  const total = formatPln(estimatedTotal(params.dailyRate, days), locale);
  const duration = formatDuration(days, locale);
  const deposit = formatPln(params.deposit, locale);

  const subject = t("confirmedSubject").replace("{ref}", () => params.reference);

  const text = [
    t("confirmedLead").replace("{ref}", () => params.reference),
    "",
    `${t("vehicle")}: ${params.vehicle}`,
    `${t("pickup")}: ${params.pickup} ${t("pickupFrom")}`,
    `${t("return")}: ${params.return} ${t("returnBy")}`,
    `${t("duration")}: ${duration}`,
    `${t("estimate")}: ${total}`,
    `${t("deposit")}: ${deposit}`,
    "",
    t("confirmedDetailsLink"),
    params.statusUrl,
    "",
    t("confirmedSeeYou"),
  ].join("\n");

  const html = [
    `<p>${t("confirmedLead").replace("{ref}", () => `<strong>${params.reference}</strong>`)}</p>`,
    "<ul>",
    `<li>${t("vehicle")}: ${params.vehicle}</li>`,
    `<li>${t("pickup")}: ${params.pickup} ${t("pickupFrom")}</li>`,
    `<li>${t("return")}: ${params.return} ${t("returnBy")}</li>`,
    `<li>${t("duration")}: ${duration}</li>`,
    `<li>${t("estimate")}: ${total}</li>`,
    `<li>${t("deposit")}: ${deposit}</li>`,
    "</ul>",
    `<p>${t("confirmedDetailsLink")}<br/><a href="${params.statusUrl}">${params.statusUrl}</a></p>`,
    `<p>${t("confirmedSeeYou")}</p>`,
  ].join("\n");

  return { subject, html, text };
}

export interface ReservationRejectedParams {
  reference: string;
  /** Absolute URL of the tokenized status page. */
  statusUrl: string;
  /** Display name, e.g. `"Mercedes-Benz Sprinter (2022)"`. */
  vehicle: string;
  /** The canned reason code; rendered as canonical copy in `locale`. */
  reason: RejectionReason;
  /** Optional free-text note (used when the reason is `other`). */
  note?: string | null;
  /** `reservations.locale`, off the deciding RPC's payload — not the employee's. */
  locale: Locale;
}

/** Rejection email: the request could not be confirmed, with the canned reason. */
export function reservationRejectedEmail(params: ReservationRejectedParams): EmailContent {
  const { locale } = params;
  const t = copy(locale);
  const reasonLabel = rejectionReasonLabel(params.reason, locale);
  // The employee's own words, rendered VERBATIM. Free text is never translated
  // (frame decision 2) — only the `Details:` label around it localizes.
  const noteLine = params.note ? `${t("details")}: ${params.note}` : null;

  const subject = t("rejectedSubject").replace("{ref}", () => params.reference);

  const text = [
    t("rejectedLead").replace("{ref}", () => params.reference),
    "",
    `${t("vehicle")}: ${params.vehicle}`,
    `${t("reason")}: ${reasonLabel}`,
    ...(noteLine ? [noteLine] : []),
    "",
    t("rejectedSuggestion"),
    "",
    t("rejectedStatusLink"),
    params.statusUrl,
  ].join("\n");

  const html = [
    `<p>${t("rejectedLead").replace("{ref}", () => `<strong>${params.reference}</strong>`)}</p>`,
    "<ul>",
    `<li>${t("vehicle")}: ${params.vehicle}</li>`,
    `<li>${t("reason")}: ${reasonLabel}</li>`,
    ...(noteLine ? [`<li>${noteLine}</li>`] : []),
    "</ul>",
    `<p>${t("rejectedSuggestion")}</p>`,
    `<p>${t("rejectedStatusLink")}<br/><a href="${params.statusUrl}">${params.statusUrl}</a></p>`,
  ].join("\n");

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// S-05 issue-protocol email — composed after a committed handover, once the PDF
// has been uploaded. The customer has no account and no portal: this mail and
// its PDF attachment are their ONLY copy of the evidence, possibly needed in a
// dispute months later. So the mail carries no link into the app — the PDF is
// the artifact, and the body is a human-readable summary of it.
//
// Its `locale` is the PROTOCOL's, not the reservation's: the mail describes an
// already-rendered document and must be written in the language of the bytes it
// attaches. The two agree at issue time and can only diverge if a reservation is
// ever re-stamped, which nothing does today.
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
  /** `protocols.locale` — the language the attached PDF was rendered in. */
  locale: Locale;
}

/** `3` → `"3/8"`, with the two ends named the way the form names them. */
function fuelLabel(eighths: number, locale: Locale): string {
  const t = copy(locale);
  if (eighths === 8) {
    return t("fuelFull");
  }
  if (eighths === 0) {
    return t("fuelEmpty");
  }
  return `${eighths}/8`;
}

// Plural noun forms live beside the selector that uses them, matching
// `format.ts`'s DAY_FORMS and the PDF's PHOTO_FORMS: a four-armed CLDR set is
// not a flat catalog string, and splitting it into one key per arm would hide
// the shape `plural()` needs. The zero-case word IS a flat string, so it sits in
// the catalog (`noDamage`) — it replaces the whole phrase rather than inflecting
// it.
const DAMAGE_ITEM_FORMS: Record<Locale, PluralForms> = {
  en: { one: "item", other: "items" },
  pl: { one: "pozycja", few: "pozycje", many: "pozycji", other: "pozycji" },
};

/**
 * `0` → `none` / `brak`, otherwise the count with the plural form it takes —
 * under `pl` 1 → `pozycja`, 2–4 → `pozycje`, the rest (teens included) →
 * `pozycji`; under `en` simply `item` / `items`.
 *
 * The 12–14 exception used to be spelled out here in modular arithmetic, one of
 * three copies in the repo. `Intl.PluralRules` supplies it now, via the shared
 * `plural`; the words are the only thing this function still owns.
 */
function damageLabel(count: number, locale: Locale): string {
  if (count === 0) {
    return copy(locale)("noDamage");
  }
  return `${count} ${plural(count, locale, DAMAGE_ITEM_FORMS[locale])}`;
}

/** Handover email: the signed protocol, summarized, with the PDF attached. */
export function protocolIssuedEmail(params: ProtocolIssuedParams): EmailContent {
  const { locale } = params;
  const t = copy(locale);
  const odometer = `${formatInteger(params.odometerKm, locale)} km`;
  const fuel = fuelLabel(params.fuelEighths, locale);
  const damages = damageLabel(params.damageCount, locale);
  const greeting = t("greeting").replace("{name}", () => params.customerName);
  const lead = t("issuedLead").replace("{ref}", () => params.reference);

  const subject = t("issuedSubject").replace("{ref}", () => params.reference);

  const text = [
    greeting,
    "",
    lead,
    "",
    `${t("vehicle")}: ${params.vehicle}`,
    `${t("plate")}: ${params.plate}`,
    `${t("odometer")}: ${odometer}`,
    `${t("fuel")}: ${fuel}`,
    `${t("issuedDamages")}: ${damages}`,
    "",
    t("issuedKeep"),
    "",
    t("issuedSafeTravels"),
  ].join("\n");

  const html = [
    `<p>${greeting}</p>`,
    `<p>${t("issuedLead").replace("{ref}", () => `<strong>${params.reference}</strong>`)}</p>`,
    "<ul>",
    `<li>${t("vehicle")}: ${params.vehicle}</li>`,
    `<li>${t("plate")}: ${params.plate}</li>`,
    `<li>${t("odometer")}: ${odometer}</li>`,
    `<li>${t("fuel")}: ${fuel}</li>`,
    `<li>${t("issuedDamages")}: ${damages}</li>`,
    "</ul>",
    `<p>${t("issuedKeep")}</p>`,
    `<p>${t("issuedSafeTravels")}</p>`,
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
  /** ISO `YYYY-MM-DD` rental window, for the body's "rental period" line. */
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
  /** `protocols.locale` — the language the attached PDF was rendered in. */
  locale: Locale;
}

/** Signed km summary: `+1 228 km` / `−40 km` / `0 km`, grouped for the artifact locale. */
function kmDrivenLabel(km: number, locale: Locale): string {
  const sign = km > 0 ? "+" : "";
  return `${sign}${formatInteger(km, locale)} km`;
}

/** Signed fuel-eighths change: `no change` / `+2/8` / `−4/8` (a true minus, U+2212). */
function fuelDeltaLabel(delta: number, locale: Locale): string {
  if (delta === 0) {
    return copy(locale)("noChange");
  }
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)}/8`;
}

/** Return email: the signed return protocol, its comparison summarized, PDF attached. */
export function protocolReturnedEmail(params: ProtocolReturnedParams): EmailContent {
  const { locale } = params;
  const t = copy(locale);
  const odometer = `${formatInteger(params.odometerKm, locale)} km`;
  const fuel = fuelLabel(params.fuelEighths, locale);
  const kmDriven = kmDrivenLabel(params.kmDriven, locale);
  const fuelChange = fuelDeltaLabel(params.fuelDelta, locale);
  const newDamages = damageLabel(params.newDamageCount, locale);
  const greeting = t("greeting").replace("{name}", () => params.customerName);

  const subject = t("returnedSubject").replace("{ref}", () => params.reference);

  const text = [
    greeting,
    "",
    t("returnedLead").replace("{ref}", () => params.reference),
    "",
    `${t("vehicle")}: ${params.vehicle}`,
    `${t("plate")}: ${params.plate}`,
    `${t("rentalPeriod")}: ${params.pickup} – ${params.return}`,
    "",
    t("comparisonHeading"),
    `${t("distanceDriven")}: ${kmDriven}`,
    `${t("fuelChange")}: ${fuelChange}`,
    `${t("newDamage")}: ${newDamages}`,
    "",
    `${t("odometerAtReturn")}: ${odometer}`,
    `${t("fuelAtReturn")}: ${fuel}`,
    "",
    t("returnedThanks"),
  ].join("\n");

  const html = [
    `<p>${greeting}</p>`,
    `<p>${t("returnedLead").replace("{ref}", () => `<strong>${params.reference}</strong>`)}</p>`,
    "<ul>",
    `<li>${t("vehicle")}: ${params.vehicle}</li>`,
    `<li>${t("plate")}: ${params.plate}</li>`,
    `<li>${t("rentalPeriod")}: ${params.pickup} – ${params.return}</li>`,
    "</ul>",
    `<p><strong>${t("comparisonHeading")}</strong></p>`,
    "<ul>",
    `<li>${t("distanceDriven")}: ${kmDriven}</li>`,
    `<li>${t("fuelChange")}: ${fuelChange}</li>`,
    `<li>${t("newDamage")}: ${newDamages}</li>`,
    "</ul>",
    "<ul>",
    `<li>${t("odometerAtReturn")}: ${odometer}</li>`,
    `<li>${t("fuelAtReturn")}: ${fuel}</li>`,
    "</ul>",
    `<p>${t("returnedThanks")}</p>`,
  ].join("\n");

  return { subject, html, text };
}
