// core
import { describe, expect, it } from "vitest";

// others
import {
  categoryLabelPl,
  estimatedTotal,
  formatCargoDims,
  formatDailyRate,
  formatDuration,
  formatPayloadKg,
  formatPln,
  fuelLabelPl,
  pluralPl,
  rentalDays,
  totalDueAtPickup,
  transmissionLabelPl,
} from "./format";

const NBSP = " "; // the non-breaking thousands separator the formatter emits

describe("formatPln", () => {
  it("formats a whole-number string (the numeric-as-string quirk) without decimals", () => {
    expect(formatPln("320.00")).toBe("320 zł");
  });

  it("formats a whole number input without decimals", () => {
    expect(formatPln(249)).toBe("249 zł");
  });

  it("groups thousands with a non-breaking space", () => {
    expect(formatPln("5900.00")).toBe(`5${NBSP}900 zł`);
    expect(formatPln(10800)).toBe(`10${NBSP}800 zł`);
  });

  it("shows two decimals for fractional amounts with a comma separator", () => {
    expect(formatPln("1.20")).toBe("1,20 zł");
    expect(formatPln(1.2)).toBe("1,20 zł");
  });

  it("falls back to zero for an unparseable value", () => {
    expect(formatPln("abc")).toBe("0 zł");
  });
});

describe("formatDailyRate", () => {
  it("appends the per-day suffix", () => {
    expect(formatDailyRate("249.00")).toBe("249 zł/doba");
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
    expect(formatPayloadKg("1350.00")).toBe(`1${NBSP}350 kg`);
  });

  it("returns a dash when absent", () => {
    expect(formatPayloadKg(null)).toBe("—");
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
    expect(formatDuration(1)).toBe("1 dzień");
  });

  it("uses dni for everything else", () => {
    expect(formatDuration(3)).toBe("3 dni");
    expect(formatDuration(5)).toBe("5 dni");
    expect(formatDuration(21)).toBe("21 dni");
  });
});

describe("pluralPl", () => {
  const POJAZD: [string, string, string] = ["pojazd", "pojazdy", "pojazdów"];

  it("uses the genitive (many) form for zero", () => {
    expect(pluralPl(0, POJAZD)).toBe("pojazdów");
  });

  it("uses the singular for exactly one", () => {
    expect(pluralPl(1, POJAZD)).toBe("pojazd");
  });

  it("uses the few form for 2–4", () => {
    expect(pluralPl(2, POJAZD)).toBe("pojazdy");
    expect(pluralPl(4, POJAZD)).toBe("pojazdy");
  });

  it("uses the many form for 5+", () => {
    expect(pluralPl(5, POJAZD)).toBe("pojazdów");
  });

  it("uses the few form for 22–24 (mod-10 in 2–4, not a teen)", () => {
    expect(pluralPl(22, POJAZD)).toBe("pojazdy");
  });

  it("uses the many form for 25", () => {
    expect(pluralPl(25, POJAZD)).toBe("pojazdów");
  });

  it("uses the many form for the teens 12–14 despite their mod-10 digit", () => {
    expect(pluralPl(12, POJAZD)).toBe("pojazdów");
    expect(pluralPl(13, POJAZD)).toBe("pojazdów");
    expect(pluralPl(14, POJAZD)).toBe("pojazdów");
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
