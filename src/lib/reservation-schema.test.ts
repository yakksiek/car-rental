// core
import { describe, expect, it } from "vitest";

// others
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

function messagesOf(payload: unknown): string[] {
  const result = reservationRequestSchema.safeParse(payload);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => issue.message);
}

describe("reservationRequestSchema", () => {
  it("accepts a valid payload", () => {
    const result = reservationRequestSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it("accepts a payload without the honeypot field (defaults to empty)", () => {
    const { company_url: _omitted, ...rest } = VALID;
    const result = reservationRequestSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects a malformed vehicle id", () => {
    expect(messagesOf({ ...VALID, vehicle_id: "not-a-uuid" })).toContain("Nieprawidłowy identyfikator pojazdu.");
  });

  it("rejects a bad email", () => {
    expect(messagesOf({ ...VALID, customer_email: "jan@" })).toContain("Podaj poprawny adres e-mail.");
  });

  it("rejects an empty name (whitespace included)", () => {
    expect(messagesOf({ ...VALID, customer_name: "   " })).toContain("Podaj imię i nazwisko.");
  });

  it("rejects a phone with letters and a too-short phone", () => {
    expect(messagesOf({ ...VALID, customer_phone: "telefon" })).toContain("Podaj poprawny numer telefonu.");
    expect(messagesOf({ ...VALID, customer_phone: "12345" })).toContain("Podaj poprawny numer telefonu.");
  });

  it("accepts PL phone variants", () => {
    for (const phone of ["600100200", "+48600100200", "+48 600-100-200"]) {
      expect(reservationRequestSchema.safeParse({ ...VALID, customer_phone: phone }).success).toBe(true);
    }
  });

  it("rejects terms_accepted !== true", () => {
    expect(messagesOf({ ...VALID, terms_accepted: false })).toContain("Zaakceptuj regulamin wynajmu.");
  });

  it("rejects a non-empty honeypot", () => {
    expect(messagesOf({ ...VALID, company_url: "https://spam.example" })).toContain("Nieprawidłowe zgłoszenie.");
  });

  it("rejects a past pickup", () => {
    expect(messagesOf({ ...VALID, pickup: "2020-01-01", return: "2020-01-05" })).toContain(
      "Data odbioru nie może być w przeszłości.",
    );
  });

  it("rejects a same-day range", () => {
    expect(messagesOf({ ...VALID, return: VALID.pickup })).toContain(
      "Data zwrotu musi być późniejsza niż data odbioru.",
    );
  });

  it("rejects an inverted range", () => {
    expect(messagesOf({ ...VALID, pickup: "2099-03-27", return: "2099-03-24" })).toContain(
      "Data zwrotu musi być późniejsza niż data odbioru.",
    );
  });

  it("rejects a malformed date before the range rule runs", () => {
    expect(messagesOf({ ...VALID, pickup: "24-03-2099" })).toContain("Nieprawidłowy format daty.");
  });

  it("accepts optional B2B fields when present", () => {
    const result = reservationRequestSchema.safeParse({
      ...VALID,
      company: "Trans-Bud Sp. z o.o.",
      vat_id: "000-000-00-00",
      notes: "Dodatkowy kierowca.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty/omitted B2B fields (they are optional)", () => {
    expect(reservationRequestSchema.safeParse({ ...VALID, company: "", vat_id: "", notes: "" }).success).toBe(true);
  });

  it("rejects an over-long B2B field", () => {
    expect(messagesOf({ ...VALID, vat_id: "x".repeat(33) })).toContain("NIP jest za długi.");
  });
});
