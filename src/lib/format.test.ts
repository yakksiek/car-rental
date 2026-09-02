// core
import { describe, expect, it } from "vitest";

// others
import {
  categoryLabelPl,
  estimatedTotal,
  formatCargoDims,
  formatDuration,
  formatInteger,
  formatPayloadKg,
  formatPln,
  formatPlnAmount,
  fuelLabelPl,
  plural,
  rentalDays,
  totalDueAtPickup,
  transmissionLabelPl,
} from "./format";
import type { PluralForms } from "./format";

const NBSP = "\u00a0"; // the non-breaking thousands separator `pl` grouping emits

describe("formatPln", () => {
  it("formats a whole-number string (the numeric-as-string quirk) without decimals", () => {
    expect(formatPln("320.00", "pl")).toBe("320 zł");
    expect(formatPln("320.00", "en")).toBe("320 zł");
  });

  it("formats a whole number input without decimals", () => {
    expect(formatPln(249, "pl")).toBe("249 zł");
  });

  // The regression `useGrouping: "always"` exists for. CLDR `pl` sets
  // `minimumGroupingDigits = 2`, so a default `Intl.NumberFormat("pl-PL")` leaves
  // `5900` ungrouped — the app's single most common amount shape.
  it("groups thousands from four digits up, with the separator each locale uses", () => {
    expect(formatPln("5900.00", "pl")).toBe(`5${NBSP}900 zł`);
    expect(formatPln(10800, "pl")).toBe(`10${NBSP}800 zł`);
    expect(formatPln("5900.00", "en")).toBe("5,900 zł");
    expect(formatPln(10800, "en")).toBe("10,800 zł");
  });

  it("shows two decimals for fractional amounts, with each locale's decimal mark", () => {
    expect(formatPln("1.20", "pl")).toBe("1,20 zł");
    expect(formatPln(1.2, "pl")).toBe("1,20 zł");
    expect(formatPln(1.2, "en")).toBe("1.20 zł");
  });

  // `style: "currency"` would render `5900,00 zł` under `pl` (forced two decimals)
  // and `PLN 5,900.00` under `en` (ISO prefix, symbol first). Neither is the shape
  // the screens carry, which is why the amount is composed by hand.
  it("keeps the symbol after the number in both locales, and drops decimals when whole", () => {
    expect(formatPln(5900, "pl").endsWith(" zł")).toBe(true);
    expect(formatPln(5900, "en")).toBe("5,900 zł");
  });

  it("falls back to zero for an unparseable value", () => {
    expect(formatPln("abc", "pl")).toBe("0 zł");
  });
});

describe("formatPlnAmount", () => {
  it("formats the number exactly as formatPln does, minus the currency", () => {
    for (const locale of ["pl", "en"] as const) {
      for (const value of ["320.00", 249, "5900.00", 10800, "1.20", 1.2, "abc"] as const) {
        expect(formatPlnAmount(value, locale)).toBe(formatPln(value, locale).replace(" zł", ""));
      }
    }
  });

  it("keeps the non-breaking thousands separator under pl", () => {
    expect(formatPlnAmount(3000, "pl")).toBe(`3${NBSP}000`);
  });
});

describe("formatInteger", () => {
  // The one grouper: it replaced four hand-rolled ones that spelled the separator
  // U+00A0, U+0020 and U+202F, plus bare `toLocaleString("pl-PL")` calls that
  // dropped grouping below five digits.
  it("groups with U+00A0 under pl and a comma under en", () => {
    expect(formatInteger(128450, "pl")).toBe(`128${NBSP}450`);
    expect(formatInteger(128450, "en")).toBe("128,450");
  });

  it("groups from four digits, where a default pl formatter would not", () => {
    expect(formatInteger(1228, "pl")).toBe(`1${NBSP}228`);
  });

  it("leaves three digits ungrouped and truncates a fractional input", () => {
    expect(formatInteger(999, "pl")).toBe("999");
    expect(formatInteger("1350.00", "pl")).toBe(`1${NBSP}350`);
  });
});

describe("formatCargoDims", () => {
  it("converts cm to metres with two decimals", () => {
    expect(formatCargoDims("440.00", "178.00", "198.00")).toBe("4.40 × 1.78 × 1.98 m");
  });

  it("accepts numeric inputs", () => {
    expect(formatCargoDims(430, 178, 194)).toBe("4.30 × 1.78 × 1.94 m");
  });

  it("renders a dash for an individually absent dimension", () => {
    expect(formatCargoDims("600.00", "210.00", null)).toBe("6.00 × 2.10 × — m");
  });

  it("returns a single dash when every dimension is absent", () => {
    expect(formatCargoDims(null, null, null)).toBe("—");
  });
});

describe("formatPayloadKg", () => {
  it("groups thousands and appends kg", () => {
    expect(formatPayloadKg("1350.00", "pl")).toBe(`1${NBSP}350 kg`);
    expect(formatPayloadKg("1350.00", "en")).toBe("1,350 kg");
  });

  it("returns a dash when absent", () => {
    expect(formatPayloadKg(null, "pl")).toBe("—");
  });
});

describe("rentalDays", () => {
  it("computes a same-month span (the screens' canonical 3 dni)", () => {
    expect(rentalDays("2026-03-24", "2026-03-27")).toBe(3);
  });

  it("computes a cross-month span", () => {
    expect(rentalDays("2026-03-30", "2026-04-02")).toBe(3);
  });

  it("computes a cross-year span", () => {
    expect(rentalDays("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("is zero for a same-day range (rejected upstream by validation)", () => {
    expect(rentalDays("2026-03-24", "2026-03-24")).toBe(0);
  });
});

describe("estimatedTotal", () => {
  it("multiplies a string daily rate (the numeric-as-string quirk)", () => {
    expect(estimatedTotal("320.00", 3)).toBe(960);
  });

  it("multiplies a number daily rate", () => {
    expect(estimatedTotal(249, 4)).toBe(996);
  });

  it("stays cent-exact for fractional rates", () => {
    expect(estimatedTotal("1.10", 3)).toBe(3.3);
  });

  it("falls back to zero for an unparseable rate", () => {
    expect(estimatedTotal("abc", 3)).toBe(0);
  });
});

describe("totalDueAtPickup", () => {
  it("sums the rental estimate and the deposit (the RAZEM DZIŚ line)", () => {
    // 7 dni × 340 = 2380, + 2500 kaucja = 4880 (the mockup's canonical total)
    expect(totalDueAtPickup("340.00", 7, "2500.00")).toBe(4880);
  });

  it("accepts numeric inputs", () => {
    expect(totalDueAtPickup(320, 3, 2500)).toBe(3460);
  });

  it("stays cent-exact for fractional rates", () => {
    expect(totalDueAtPickup("1.10", 3, "0.50")).toBe(3.8);
  });

  it("falls back to zero parts for unparseable inputs", () => {
    expect(totalDueAtPickup("abc", 3, "xyz")).toBe(0);
  });
});

describe("formatDuration", () => {
  it("uses the singular for one day", () => {
    expect(formatDuration(1, "pl")).toBe("1 dzień");
    expect(formatDuration(1, "en")).toBe("1 day");
  });

  it("uses the plural for everything else", () => {
    expect(formatDuration(3, "pl")).toBe("3 dni");
    expect(formatDuration(5, "pl")).toBe("5 dni");
    expect(formatDuration(21, "pl")).toBe("21 dni");
    expect(formatDuration(3, "en")).toBe("3 days");
  });
});

describe("plural", () => {
  // Kept verbatim from the deleted Polish-only selector's suite, and that is the
  // point:
  // `Intl.PluralRules` supplies these categories now, but only an assertion that
  // predates the swap can prove the swap preserved behaviour rather than quietly
  // changing it. English is asserted alongside to prove the arity is no longer
  // per-language — the same call answers a two-form locale from `other`.
  const POJAZD: PluralForms = { one: "pojazd", few: "pojazdy", many: "pojazdów", other: "pojazdów" };
  const VEHICLE: PluralForms = { one: "vehicle", other: "vehicles" };

  it("uses the genitive (many) form for zero", () => {
    expect(plural(0, "pl", POJAZD)).toBe("pojazdów");
    expect(plural(0, "en", VEHICLE)).toBe("vehicles");
  });

  it("uses the singular for exactly one", () => {
    expect(plural(1, "pl", POJAZD)).toBe("pojazd");
    expect(plural(1, "en", VEHICLE)).toBe("vehicle");
  });

  it("uses the few form for 2–4", () => {
    expect(plural(2, "pl", POJAZD)).toBe("pojazdy");
    expect(plural(4, "pl", POJAZD)).toBe("pojazdy");
    expect(plural(2, "en", VEHICLE)).toBe("vehicles");
  });

  it("uses the many form for 5+", () => {
    expect(plural(5, "pl", POJAZD)).toBe("pojazdów");
  });

  it("uses the few form for 22–24 (mod-10 in 2–4, not a teen)", () => {
    expect(plural(22, "pl", POJAZD)).toBe("pojazdy");
  });

  it("uses the many form for 25", () => {
    expect(plural(25, "pl", POJAZD)).toBe("pojazdów");
  });

  it("uses the many form for the teens 12–14 despite their mod-10 digit", () => {
    expect(plural(12, "pl", POJAZD)).toBe("pojazdów");
    expect(plural(13, "pl", POJAZD)).toBe("pojazdów");
    expect(plural(14, "pl", POJAZD)).toBe("pojazdów");
  });

  it("falls back to `other` when the locale selects a category the caller omitted", () => {
    // A Polish caller that only supplied `{one, other}` still renders something
    // sane for a `few` count rather than `undefined`.
    expect(plural(2, "pl", { one: "dzień", other: "dni" })).toBe("dni");
  });
});

describe("Polish enum labels", () => {
  it("maps every vehicle category", () => {
    expect(categoryLabelPl("cargo_van")).toBe("Furgon");
    expect(categoryLabelPl("passenger_van")).toBe("Bus osobowy");
    expect(categoryLabelPl("car_transporter")).toBe("Autolaweta");
    expect(categoryLabelPl("refrigerated_truck")).toBe("Chłodnia");
    expect(categoryLabelPl("flatbed_truck")).toBe("Skrzyniowy");
  });

  it("maps transmissions and is null-safe", () => {
    expect(transmissionLabelPl("manual")).toBe("Manualna");
    expect(transmissionLabelPl("automatic")).toBe("Automatyczna");
    expect(transmissionLabelPl(null)).toBe("—");
  });

  it("maps known fuel types and falls back to capitalized raw input", () => {
    expect(fuelLabelPl("diesel")).toBe("Diesel");
    expect(fuelLabelPl("electric")).toBe("Elektryczny");
    expect(fuelLabelPl("wodór")).toBe("Wodór");
    expect(fuelLabelPl(null)).toBe("—");
  });
});
