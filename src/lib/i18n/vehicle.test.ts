// core
import { describe, expect, it } from "vitest";

// others
import { categoryLabel, fuelLabel, transmissionLabel, VEHICLE_NOUN_FORMS } from "./vehicle";
import { plural } from "../format";

// The vocabulary that used to live in `format.ts` (and was asserted there, in
// Polish only). Both halves are pinned now: the `Record<Locale, Record<Enum, …>>`
// shape makes a MISSING label a type error, and these assertions pin the WORDING
// so a re-translation is a deliberate edit rather than a silent one.

describe("categoryLabel", () => {
  it("maps every vehicle category in both locales", () => {
    expect(categoryLabel("cargo_van", "pl")).toBe("Furgon");
    expect(categoryLabel("passenger_van", "pl")).toBe("Bus osobowy");
    expect(categoryLabel("car_transporter", "pl")).toBe("Autolaweta");
    expect(categoryLabel("refrigerated_truck", "pl")).toBe("Chłodnia");
    expect(categoryLabel("flatbed_truck", "pl")).toBe("Skrzyniowy");

    expect(categoryLabel("cargo_van", "en")).toBe("Cargo van");
    expect(categoryLabel("passenger_van", "en")).toBe("Passenger van");
    expect(categoryLabel("car_transporter", "en")).toBe("Car transporter");
    expect(categoryLabel("refrigerated_truck", "en")).toBe("Refrigerated");
    expect(categoryLabel("flatbed_truck", "en")).toBe("Flatbed");
  });
});

describe("transmissionLabel", () => {
  it("maps transmissions and is null-safe in both locales", () => {
    expect(transmissionLabel("manual", "pl")).toBe("Manualna");
    expect(transmissionLabel("automatic", "pl")).toBe("Automatyczna");
    expect(transmissionLabel("manual", "en")).toBe("Manual");
    expect(transmissionLabel("automatic", "en")).toBe("Automatic");
    expect(transmissionLabel(null, "pl")).toBe("—");
    expect(transmissionLabel(null, "en")).toBe("—");
  });
});

describe("fuelLabel", () => {
  it("maps known fuel types in both locales", () => {
    expect(fuelLabel("diesel", "pl")).toBe("Diesel");
    expect(fuelLabel("electric", "pl")).toBe("Elektryczny");
    expect(fuelLabel("electric", "en")).toBe("Electric");
    expect(fuelLabel("benzyna", "en")).toBe("Petrol");
    expect(fuelLabel(null, "en")).toBe("—");
  });

  it("falls back to the capitalized raw value, unchanged, in EITHER locale", () => {
    // `fuel_type` is free text, so an unrecognised value is something a person
    // typed. Frame decision 2 says it renders verbatim — never guessed at, and
    // never "translated" by falling through to the other locale's map.
    expect(fuelLabel("wodór", "pl")).toBe("Wodór");
    expect(fuelLabel("wodór", "en")).toBe("Wodór");
  });
});

describe("VEHICLE_NOUN_FORMS", () => {
  it("counts vehicles with the right form in each locale", () => {
    expect(plural(1, "pl", VEHICLE_NOUN_FORMS.pl)).toBe("pojazd");
    expect(plural(3, "pl", VEHICLE_NOUN_FORMS.pl)).toBe("pojazdy");
    expect(plural(7, "pl", VEHICLE_NOUN_FORMS.pl)).toBe("pojazdów");
    expect(plural(1, "en", VEHICLE_NOUN_FORMS.en)).toBe("vehicle");
    expect(plural(7, "en", VEHICLE_NOUN_FORMS.en)).toBe("vehicles");
  });
});
