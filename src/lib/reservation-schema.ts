// core
import { z } from "zod";

// others
import { validateDateRange } from "./catalog-filters";

// The single server-side contract for the reservation POST body (S-02). The
// ReservationForm island mirrors these rules client-side for inline errors,
// but this schema (validated in POST /api/reservations) is the trust boundary.
// Date semantics delegate to `validateDateRange`, the established third mirror
// of the booking rule (SQL EXCLUDE ↔ availability.ts ↔ here) — past pickups,
// same-day and inverted ranges are rejected with the same Polish messages the
// catalog uses. Polish copy is canonical.

const MSG = {
  vehicleId: "Nieprawidłowy identyfikator pojazdu.",
  date: "Nieprawidłowy format daty.",
  name: "Podaj imię i nazwisko.",
  email: "Podaj poprawny adres e-mail.",
  phone: "Podaj poprawny numer telefonu.",
  terms: "Zaakceptuj regulamin wynajmu.",
  honeypot: "Nieprawidłowe zgłoszenie.",
  company: "Nazwa firmy jest za długa.",
  vatId: "NIP jest za długi.",
  notes: "Uwagi są za długie.",
} as const;

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
// manual form share. Kept as one object so the two schemas below cannot drift
// on what a valid name/e-mail/phone is.
const bookingFields = {
  vehicle_id: z.string(MSG.vehicleId).regex(UUID_RE, MSG.vehicleId),
  pickup: z.string(MSG.date).regex(ISO_DATE_RE, MSG.date),
  return: z.string(MSG.date).regex(ISO_DATE_RE, MSG.date),
  customer_name: z.string(MSG.name).trim().min(1, MSG.name),
  customer_email: z.email(MSG.email),
  customer_phone: z
    .string(MSG.phone)
    .regex(PHONE_RE, MSG.phone)
    .refine((value) => {
      const digits = value.replace(/\D/g, "").length;
      return digits >= PHONE_DIGITS_MIN && digits <= PHONE_DIGITS_MAX;
    }, MSG.phone),
} as const;

// Reuse the catalog's date-range rule (past pickup / same-day / inverted) so no
// booking path can disagree with the picker, the RPC, or the EXCLUDE constraint
// about what a valid range is.
function refineDateRange(value: { pickup: string; return: string }, ctx: z.RefinementCtx): void {
  const result = validateDateRange(value.pickup, value.return);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.error, path: ["return"] });
  }
}

export const reservationRequestSchema = z
  .object({
    ...bookingFields,
    terms_accepted: z.literal(true, MSG.terms),
    // Optional B2B fields (Phase 5, desktop-2). Empty/omitted is valid; only an
    // over-long value is rejected. The service normalizes blanks to null.
    company: z.string().trim().max(COMPANY_MAX, MSG.company).optional(),
    vat_id: z.string().trim().max(VAT_ID_MAX, MSG.vatId).optional(),
    notes: z.string().trim().max(NOTES_MAX, MSG.notes).optional(),
    // Honeypot: a visually-hidden field real users never fill. Non-empty means
    // a bot; the API route short-circuits it to a benign success before this
    // schema runs, so a rejection here is defense-in-depth only.
    company_url: z.string().max(0, MSG.honeypot).optional().default(""),
  })
  .superRefine(refineDateRange);

export type ReservationRequestInput = z.infer<typeof reservationRequestSchema>;

// The staff branch (S-12): the same booking fields WITHOUT `terms_accepted`,
// the honeypot, or the B2B extras. An employee entering a phone-in booking is
// not the customer accepting terms, so requiring the literal `true` would be a
// lie in the data; the honeypot guards an anonymous public form, and this route
// is role-gated. Name + e-mail + phone are all required (design contract D1).
// This schema is the trust boundary for POST /api/reservations/manual and the
// modal island mirrors it client-side.
export const manualReservationSchema = z.object(bookingFields).superRefine(refineDateRange);

export type ManualReservationSchemaInput = z.infer<typeof manualReservationSchema>;
