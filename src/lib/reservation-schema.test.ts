// core
import { describe, expect, it } from "vitest";

// others
import type { Locale } from "./i18n/types";
import { reservationRequestSchema } from "./reservation-schema";

// A far-future valid payload: dates never drift into the past, so the
// `validateDateRange` mirror (which compares against the real today) stays
// deterministic without injection.
const VALID = {
  vehicle_id: "11111111-1111-1111-1111-111111111111",
  pickup: "2099-03-24",
  return: "2099-03-27",
  customer_name: "Jan Kowalski",
  customer_email: "jan.kowalski@example.com",
  customer_phone: "+48 600 100 200",
  terms_accepted: true,
  company_url: "",
} as const;

// Structural assertions run against the default locale — a schema's SHAPE cannot
// vary by locale, only its messages can. Message assertions name both halves
// explicitly (`rejects`), which is what proves the split is real.
const schema = (locale: Locale = "en") => reservationRequestSchema(locale);

function messagesOf(payload: unknown, locale: Locale = "en"): string[] {
  const result = schema(locale).safeParse(payload);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => issue.message);
}

/** Assert the same rejection surfaces its own message in each locale. */
function rejects(payload: unknown, en: string, pl: string): void {
  expect(messagesOf(payload, "en")).toContain(en);
  expect(messagesOf(payload, "pl")).toContain(pl);
}

describe("reservationRequestSchema", () => {
  it("accepts a valid payload", () => {
    const result = schema().safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it("accepts a payload without the honeypot field (defaults to empty)", () => {
    const { company_url: _omitted, ...rest } = VALID;
    const result = schema().safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects a malformed vehicle id", () => {
    rejects(
      { ...VALID, vehicle_id: "not-a-uuid" },
      "Invalid vehicle identifier.",
      "Nieprawidłowy identyfikator pojazdu.",
    );
  });

  it("rejects a bad email", () => {
    rejects({ ...VALID, customer_email: "jan@" }, "Enter a valid email address.", "Podaj poprawny adres e-mail.");
  });

  it("rejects an empty name (whitespace included)", () => {
    rejects({ ...VALID, customer_name: "   " }, "Enter a first and last name.", "Podaj imię i nazwisko.");
  });

  it("rejects a phone with letters and a too-short phone", () => {
    const EN = "Enter a valid phone number.";
    const PL = "Podaj poprawny numer telefonu.";
    rejects({ ...VALID, customer_phone: "telefon" }, EN, PL);
    rejects({ ...VALID, customer_phone: "12345" }, EN, PL);
  });

  it("accepts PL phone variants", () => {
    for (const phone of ["600100200", "+48600100200", "+48 600-100-200"]) {
      expect(schema().safeParse({ ...VALID, customer_phone: phone }).success).toBe(true);
    }
  });

  it("rejects terms_accepted !== true", () => {
    rejects({ ...VALID, terms_accepted: false }, "Accept the rental terms.", "Zaakceptuj regulamin wynajmu.");
  });

  it("rejects a non-empty honeypot", () => {
    rejects({ ...VALID, company_url: "https://spam.example" }, "Invalid request.", "Nieprawidłowe zgłoszenie.");
  });

  it("rejects a past pickup", () => {
    rejects(
      { ...VALID, pickup: "2020-01-01", return: "2020-01-05" },
      "The pickup date cannot be in the past.",
      "Data odbioru nie może być w przeszłości.",
    );
  });

  it("rejects a same-day range", () => {
    rejects(
      { ...VALID, return: VALID.pickup },
      "The return date must be later than the pickup date.",
      "Data zwrotu musi być późniejsza niż data odbioru.",
    );
  });

  it("rejects an inverted range", () => {
    rejects(
      { ...VALID, pickup: "2099-03-27", return: "2099-03-24" },
      "The return date must be later than the pickup date.",
      "Data zwrotu musi być późniejsza niż data odbioru.",
    );
  });

  it("rejects a malformed date before the range rule runs", () => {
    rejects({ ...VALID, pickup: "24-03-2099" }, "Invalid date format.", "Nieprawidłowy format daty.");
  });

  it("accepts optional B2B fields when present", () => {
    const result = schema().safeParse({
      ...VALID,
      company: "Trans-Bud Sp. z o.o.",
      vat_id: "000-000-00-00",
      notes: "Dodatkowy kierowca.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty/omitted B2B fields (they are optional)", () => {
    expect(schema().safeParse({ ...VALID, company: "", vat_id: "", notes: "" }).success).toBe(true);
  });

  it("rejects an over-long B2B field", () => {
    rejects({ ...VALID, vat_id: "x".repeat(33) }, "The NIP is too long.", "NIP jest za długi.");
  });
});
