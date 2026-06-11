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
} as const;

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

export const reservationRequestSchema = z
  .object({
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
    terms_accepted: z.literal(true, MSG.terms),
    // Honeypot: a visually-hidden field real users never fill. Non-empty means
    // a bot; the API route short-circuits it to a benign success before this
    // schema runs, so a rejection here is defense-in-depth only.
    company_url: z.string().max(0, MSG.honeypot).optional().default(""),
  })
  .superRefine((value, ctx) => {
    // Reuse the catalog's date-range rule (past pickup / same-day / inverted)
    // so the funnel cannot disagree with the picker, the RPC, or the EXCLUDE
    // constraint about what a valid range is.
    const result = validateDateRange(value.pickup, value.return);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error, path: ["return"] });
    }
  });

export type ReservationRequestInput = z.infer<typeof reservationRequestSchema>;
