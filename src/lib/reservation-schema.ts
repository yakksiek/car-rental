// core
import { z } from "zod";

// others
import { validateDateRange } from "./catalog-filters";
import { LOCALES, translator } from "./i18n/types";
import type { Locale } from "./i18n/types";
import { validation } from "./i18n/validation";

// The single server-side contract for the reservation POST body (S-02). The
// ReservationForm island mirrors these rules client-side for inline errors,
// but this schema (validated in POST /api/reservations) is the trust boundary.
// Date semantics delegate to `validateDateRange`, the established third mirror
// of the booking rule (SQL EXCLUDE ↔ availability.ts ↔ here) — past pickups,
// same-day and inverted ranges are rejected with the same messages the catalog
// uses, in the same locale.
//
// **Both schemas are reached through a locale accessor** — `reservationRequestSchema(locale)`
// / `manualReservationSchema(locale)` — because zod bakes messages in at
// construction. Messages resolve through the ISLAND-SAFE `translator`:
// `ReservationForm` and `ManualReservationModal` both import this module.
//
// The PL-specific VALIDATION stays PL-specific in both locales: the phone regex
// and the NIP cap describe a Polish depot's customers, not the reader's language
// (frame decision 3). Only the messages localize.

// Optional B2B field caps (Phase 5). Generous — these only guard against abuse,
// not format; a private customer leaves them empty.
const COMPANY_MAX = 200;
const VAT_ID_MAX = 32;
const NOTES_MAX = 1000;

// PL-friendly phone: optional +prefix, then digits with optional spaces/dashes/
// parentheses, 9–15 digits total (covers `600100200`, `+48 600 100 200`, …).
const PHONE_RE = /^\+?[\d\s\-()]+$/;
const PHONE_DIGITS_MIN = 9;
const PHONE_DIGITS_MAX = 15;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Loose hex-UUID shape (same as the services' guard) — zod's `z.uuid()` is
// strict RFC-4122 and would reject the fixed seed ids (version/variant nibbles).
// Postgres accepts any hex uuid; this only exists to fail fast on garbage.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The vehicle + dates + customer fields both the public funnel and the staff
// manual form share. Kept as one builder so the two schemas below cannot drift
// on what a valid name/e-mail/phone is.
function bookingFields(t: (key: "vehicleId" | "date" | "name" | "email" | "phone") => string) {
  return {
    vehicle_id: z.string(t("vehicleId")).regex(UUID_RE, t("vehicleId")),
    pickup: z.string(t("date")).regex(ISO_DATE_RE, t("date")),
    return: z.string(t("date")).regex(ISO_DATE_RE, t("date")),
    customer_name: z.string(t("name")).trim().min(1, t("name")),
    customer_email: z.email(t("email")),
    customer_phone: z
      .string(t("phone"))
      .regex(PHONE_RE, t("phone"))
      .refine((value) => {
        const digits = value.replace(/\D/g, "").length;
        return digits >= PHONE_DIGITS_MIN && digits <= PHONE_DIGITS_MAX;
      }, t("phone")),
  } as const;
}

// Reuse the catalog's date-range rule (past pickup / same-day / inverted) so no
// booking path can disagree with the picker, the RPC, or the EXCLUDE constraint
// about what a valid range is.
function refineDateRange(locale: Locale) {
  return (value: { pickup: string; return: string }, ctx: z.RefinementCtx): void => {
    const result = validateDateRange(value.pickup, value.return, locale);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error, path: ["return"] });
    }
  };
}

function buildRequest(locale: Locale) {
  const t = translator(locale, validation);
  return z
    .object({
      ...bookingFields(t),
      terms_accepted: z.literal(true, t("terms")),
      // Optional B2B fields (Phase 5, desktop-2). Empty/omitted is valid; only an
      // over-long value is rejected. The service normalizes blanks to null.
      company: z.string().trim().max(COMPANY_MAX, t("company")).optional(),
      vat_id: z.string().trim().max(VAT_ID_MAX, t("vatId")).optional(),
      notes: z.string().trim().max(NOTES_MAX, t("notes")).optional(),
      // Honeypot: a visually-hidden field real users never fill. Non-empty means
      // a bot; the API route short-circuits it to a benign success before this
      // schema runs, so a rejection here is defense-in-depth only.
      company_url: z.string().max(0, t("honeypot")).optional().default(""),
    })
    .superRefine(refineDateRange(locale));
}

// The staff branch (S-12): the same booking fields WITHOUT `terms_accepted`,
// the honeypot, or the B2B extras. An employee entering a phone-in booking is
// not the customer accepting terms, so requiring the literal `true` would be a
// lie in the data; the honeypot guards an anonymous public form, and this route
// is role-gated. Name + e-mail + phone are all required (design contract D1).
// This schema is the trust boundary for POST /api/reservations/manual and the
// modal island mirrors it client-side.
function buildManual(locale: Locale) {
  return z.object(bookingFields(translator(locale, validation))).superRefine(refineDateRange(locale));
}

type RequestSchema = ReturnType<typeof buildRequest>;
type ManualSchema = ReturnType<typeof buildManual>;

const REQUEST_SCHEMAS = Object.fromEntries(LOCALES.map((locale) => [locale, buildRequest(locale)])) as Record<
  Locale,
  RequestSchema
>;
const MANUAL_SCHEMAS = Object.fromEntries(LOCALES.map((locale) => [locale, buildManual(locale)])) as Record<
  Locale,
  ManualSchema
>;

/** The public funnel's POST body contract, with its messages in `locale`. */
export function reservationRequestSchema(locale: Locale): RequestSchema {
  return REQUEST_SCHEMAS[locale];
}

export type ReservationRequestInput = z.infer<RequestSchema>;

/** The staff manual-booking contract, with its messages in `locale`. */
export function manualReservationSchema(locale: Locale): ManualSchema {
  return MANUAL_SCHEMAS[locale];
}

export type ManualReservationSchemaInput = z.infer<ManualSchema>;
