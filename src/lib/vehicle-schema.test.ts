// core
import { describe, expect, it } from "vitest";

// others
import type { Locale } from "./i18n/types";
import { vehicleInputSchema } from "./vehicle-schema";

// A minimal valid payload: only the required identity + pricing fields. Money
// fields arrive as strings (form inputs / JSON), so the happy path also exercises
// `coerceNumber`. Optional specification fields are omitted — they normalize to
// `null` (or `[]` for photos).
const VALID = {
  name: "Mercedes Sprinter",
  plate: "WX 1234A",
  category: "cargo_van",
  daily_rate: "120.00",
  monthly_rate: "3000",
  deposit: "1500",
  per_extra_km_rate: "1.50",
} as const;

// Structural assertions run against the default locale; a schema's SHAPE cannot
// vary by locale, only its messages can. Message assertions name both halves
// explicitly (`rejects`), which is what proves the split is real rather than a
// fallback quietly serving English to a Polish reader.
const schema = (locale: Locale = "en") => vehicleInputSchema(locale);

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

describe("vehicleInputSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = schema().safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it("coerces stringified money to a number ('120.00' → 120)", () => {
    const result = schema().safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.daily_rate).toBe(120);
      expect(result.data.per_extra_km_rate).toBe(1.5);
    }
  });

  it("rejects a non-numeric money string", () => {
    rejects({ ...VALID, daily_rate: "abc" }, "Enter a positive amount.", "Podaj dodatnią kwotę.");
  });

  it("rejects a blank required money field", () => {
    rejects({ ...VALID, deposit: "   " }, "Enter a positive amount.", "Podaj dodatnią kwotę.");
  });

  it("rejects a non-positive required money field (0 and negative)", () => {
    rejects({ ...VALID, monthly_rate: "0" }, "Enter a positive amount.", "Podaj dodatnią kwotę.");
    rejects({ ...VALID, per_extra_km_rate: "-5" }, "Enter a positive amount.", "Podaj dodatnią kwotę.");
  });

  it("rejects a missing name", () => {
    rejects({ ...VALID, name: "   " }, "Enter the vehicle name.", "Podaj nazwę pojazdu.");
  });

  // `plate` became required in S-05 (vehicles.plate is not null + unique) — the
  // fleet holds many identical models, so it is the only field telling them apart.
  it("rejects a missing plate", () => {
    rejects({ ...VALID, plate: "   " }, "Enter the registration number.", "Podaj numer rejestracyjny.");
  });

  it("rejects an unknown category", () => {
    rejects({ ...VALID, category: "spaceship" }, "Select a vehicle category.", "Wybierz kategorię pojazdu.");
  });

  it("normalizes an empty optional number to null (production_year omitted)", () => {
    const result = schema().safeParse({ ...VALID, production_year: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.production_year).toBeNull();
    }
  });

  it("normalizes an empty optional text field to null", () => {
    const result = schema().safeParse({ ...VALID, make: "", model: "  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.make).toBeNull();
      expect(result.data.model).toBeNull();
    }
  });

  it("normalizes an empty optional enum (transmission) to null", () => {
    const result = schema().safeParse({ ...VALID, transmission: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transmission).toBeNull();
    }
  });

  it("rejects an out-of-range production year", () => {
    rejects(
      { ...VALID, production_year: "1949" },
      "Enter a valid year of manufacture.",
      "Podaj poprawny rok produkcji.",
    );
    rejects(
      { ...VALID, production_year: "2101" },
      "Enter a valid year of manufacture.",
      "Podaj poprawny rok produkcji.",
    );
  });

  it("accepts a production year on the boundary", () => {
    expect(schema().safeParse({ ...VALID, production_year: "1950" }).success).toBe(true);
    expect(schema().safeParse({ ...VALID, production_year: "2100" }).success).toBe(true);
  });

  it("rejects a non-integer or negative seats value", () => {
    const EN = "Enter a whole number no smaller than 0.";
    const PL = "Podaj liczbę całkowitą nie mniejszą niż 0.";
    rejects({ ...VALID, seats: "2.5" }, EN, PL);
    rejects({ ...VALID, seats: "-1" }, EN, PL);
  });

  it("rejects a negative dimension but accepts a fractional one", () => {
    rejects(
      { ...VALID, payload_capacity_kg: "-1" },
      "Enter a value no smaller than 0.",
      "Podaj wartość nie mniejszą niż 0.",
    );
    expect(schema().safeParse({ ...VALID, cargo_length_cm: "100.5" }).success).toBe(true);
  });

  it("defaults photos to an empty array when omitted", () => {
    const result = schema().safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.photos).toEqual([]);
    }
  });

  it("accepts http(s) photo URLs", () => {
    const result = schema().safeParse({
      ...VALID,
      photos: ["https://cdn.example/a.jpg", "http://cdn.example/b.jpg"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-http(s) photo schemes (javascript:, data:)", () => {
    const EN = "Enter a valid photo URL.";
    const PL = "Podaj poprawny adres URL zdjęcia.";
    rejects({ ...VALID, photos: ["javascript:alert(1)"] }, EN, PL);
    rejects({ ...VALID, photos: ["data:text/html;base64,PHN2Zz4="] }, EN, PL);
  });
});
