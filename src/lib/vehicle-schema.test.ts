// core
import { describe, expect, it } from "vitest";

// others
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

function messagesOf(payload: unknown): string[] {
  const result = vehicleInputSchema.safeParse(payload);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => issue.message);
}

describe("vehicleInputSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = vehicleInputSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it("coerces stringified money to a number ('120.00' → 120)", () => {
    const result = vehicleInputSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.daily_rate).toBe(120);
      expect(result.data.per_extra_km_rate).toBe(1.5);
    }
  });

  it("rejects a non-numeric money string", () => {
    expect(messagesOf({ ...VALID, daily_rate: "abc" })).toContain("Podaj dodatnią kwotę.");
  });

  it("rejects a blank required money field", () => {
    expect(messagesOf({ ...VALID, deposit: "   " })).toContain("Podaj dodatnią kwotę.");
  });

  it("rejects a non-positive required money field (0 and negative)", () => {
    expect(messagesOf({ ...VALID, monthly_rate: "0" })).toContain("Podaj dodatnią kwotę.");
    expect(messagesOf({ ...VALID, per_extra_km_rate: "-5" })).toContain("Podaj dodatnią kwotę.");
  });

  it("rejects a missing name", () => {
    expect(messagesOf({ ...VALID, name: "   " })).toContain("Podaj nazwę pojazdu.");
  });

  // `plate` became required in S-05 (vehicles.plate is not null + unique) — the
  // fleet holds many identical models, so it is the only field telling them apart.
  it("rejects a missing plate", () => {
    expect(messagesOf({ ...VALID, plate: "   " })).toContain("Podaj numer rejestracyjny.");
  });

  it("rejects an unknown category", () => {
    expect(messagesOf({ ...VALID, category: "spaceship" })).toContain("Wybierz kategorię pojazdu.");
  });

  it("normalizes an empty optional number to null (production_year omitted)", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID, production_year: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.production_year).toBeNull();
    }
  });

  it("normalizes an empty optional text field to null", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID, make: "", model: "  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.make).toBeNull();
      expect(result.data.model).toBeNull();
    }
  });

  it("normalizes an empty optional enum (transmission) to null", () => {
    const result = vehicleInputSchema.safeParse({ ...VALID, transmission: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transmission).toBeNull();
    }
  });

  it("rejects an out-of-range production year", () => {
    expect(messagesOf({ ...VALID, production_year: "1949" })).toContain("Podaj poprawny rok produkcji.");
    expect(messagesOf({ ...VALID, production_year: "2101" })).toContain("Podaj poprawny rok produkcji.");
  });

  it("accepts a production year on the boundary", () => {
    expect(vehicleInputSchema.safeParse({ ...VALID, production_year: "1950" }).success).toBe(true);
    expect(vehicleInputSchema.safeParse({ ...VALID, production_year: "2100" }).success).toBe(true);
  });

  it("rejects a non-integer or negative seats value", () => {
    expect(messagesOf({ ...VALID, seats: "2.5" })).toContain("Podaj liczbę całkowitą nie mniejszą niż 0.");
    expect(messagesOf({ ...VALID, seats: "-1" })).toContain("Podaj liczbę całkowitą nie mniejszą niż 0.");
  });

  it("rejects a negative dimension but accepts a fractional one", () => {
    expect(messagesOf({ ...VALID, payload_capacity_kg: "-1" })).toContain("Podaj wartość nie mniejszą niż 0.");
    expect(vehicleInputSchema.safeParse({ ...VALID, cargo_length_cm: "100.5" }).success).toBe(true);
  });

  it("defaults photos to an empty array when omitted", () => {
    const result = vehicleInputSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.photos).toEqual([]);
    }
  });

  it("accepts http(s) photo URLs", () => {
    const result = vehicleInputSchema.safeParse({
      ...VALID,
      photos: ["https://cdn.example/a.jpg", "http://cdn.example/b.jpg"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-http(s) photo schemes (javascript:, data:)", () => {
    expect(messagesOf({ ...VALID, photos: ["javascript:alert(1)"] })).toContain("Podaj poprawny adres URL zdjęcia.");
    expect(messagesOf({ ...VALID, photos: ["data:text/html;base64,PHN2Zz4="] })).toContain(
      "Podaj poprawny adres URL zdjęcia.",
    );
  });
});
