// core
import { describe, expect, it } from "vitest";

// others
import {
  protocolIssuedEmail,
  protocolReturnedEmail,
  reservationConfirmedEmail,
  reservationRejectedEmail,
} from "./templates";

describe("reservationConfirmedEmail", () => {
  const params = {
    reference: "R-1234",
    statusUrl: "https://fleetrent.test/r/abc",
    vehicle: "Mercedes-Benz Sprinter (2022)",
    pickup: "2026-04-02",
    return: "2026-04-09",
    dailyRate: 340,
    deposit: 2500,
  };

  it("composes a Polish confirmation with reference, dates, total, deposit, and link", () => {
    const { subject, text, html } = reservationConfirmedEmail(params);
    expect(subject).toContain("R-1234");
    expect(subject).toContain("potwierdzona");
    expect(text).toContain("od 14:00");
    expect(text).toContain("do 10:00");
    expect(text).toContain("7 dni");
    expect(text).toContain("380 zł"); // 340 * 7 = 2 380 (separator is a non-breaking space)
    expect(text).toContain("500 zł"); // deposit 2 500
    expect(text).toContain(params.statusUrl);
    expect(html).toContain(`href="${params.statusUrl}"`);
  });
});

describe("reservationRejectedEmail", () => {
  const base = {
    reference: "R-5678",
    statusUrl: "https://fleetrent.test/r/def",
    vehicle: "MAN TGE (2021)",
  };

  it("renders the canned reason label", () => {
    const { subject, text } = reservationRejectedEmail({ ...base, reason: "vehicle_withdrawn" });
    expect(subject).toContain("R-5678");
    expect(subject).toContain("odrzucony");
    expect(text).toContain("Pojazd wycofany");
    expect(text).toContain("alternatywnych dat");
  });

  it("includes the free-text note when the reason is other", () => {
    const { text } = reservationRejectedEmail({ ...base, reason: "other", note: "Wymagana kaucja gotówkowa" });
    expect(text).toContain("Inny");
    expect(text).toContain("Szczegóły: Wymagana kaucja gotówkowa");
  });

  it("omits the note line when no note is given", () => {
    const { text } = reservationRejectedEmail({ ...base, reason: "no_category" });
    expect(text).not.toContain("Szczegóły:");
    expect(text).toContain("Brak wymaganej kategorii");
  });
});

describe("protocolIssuedEmail", () => {
  // The full Polish diacritic set, both cases. Every fixture on a path that ends
  // in a font/encoding boundary carries it — the PDF built from this same data
  // throws on eight of these nine characters unless a Unicode TTF is embedded
  // (see lessons.md). A fixture named "Jan Kowalski" would hide that.
  const params = {
    reference: "R-2401",
    customerName: "Zażółć Gęślą Jaźń Wąsik",
    vehicle: "Ford Transit",
    plate: "WX 5519M",
    odometerKm: 128450,
    fuelEighths: 6,
    damageCount: 2,
  };

  it("composes a Polish handover summary with the plate, odometer, fuel and damage count", () => {
    const { subject, text, html } = protocolIssuedEmail(params);
    expect(subject).toContain("R-2401");
    expect(subject).toContain("protokół wydania");
    expect(text).toContain("WX 5519M");
    expect(text).toContain("Ford Transit");
    expect(text).toContain("6/8");
    expect(text).toContain("2 pozycje");
    expect(html).toContain("<li>Rejestracja: WX 5519M</li>");
  });

  it("carries every Polish diacritic through untouched, in both cases", () => {
    const lower = protocolIssuedEmail(params);
    for (const char of "ąćęłńóśźż") {
      expect(lower.text + lower.html).toContain(char);
    }
    // Customers do enter their names in caps, and the uppercase forms are a
    // separate set of code points at the font/encoding boundary downstream.
    const upper = protocolIssuedEmail({ ...params, customerName: "ZAŻÓŁĆ GĘŚLĄ JAŹŃ" });
    for (const char of "ĄĆĘŁŃÓŚŹŻ") {
      expect(upper.text + upper.html).toContain(char);
    }
  });

  it("names the two fuel extremes rather than leaving a bare fraction", () => {
    expect(protocolIssuedEmail({ ...params, fuelEighths: 8 }).text).toContain("8/8 (pełny)");
    expect(protocolIssuedEmail({ ...params, fuelEighths: 0 }).text).toContain("0/8 (pusty)");
  });

  it("reads no damage as `brak` and one as a singular", () => {
    expect(protocolIssuedEmail({ ...params, damageCount: 0 }).text).toContain(
      "Uszkodzenia zapisane przy wydaniu: brak",
    );
    expect(protocolIssuedEmail({ ...params, damageCount: 1 }).text).toContain("1 pozycja");
  });

  it("carries no link into the app — the PDF attachment is the customer's only artifact", () => {
    const { html, text } = protocolIssuedEmail(params);
    expect(html).not.toContain("href=");
    expect(text).not.toContain("http");
  });
});

describe("protocolReturnedEmail", () => {
  // Same encoding-boundary discipline as the issue mail: the customer name carries
  // the full diacritic set so the byte path is exercised, and the return PDF built
  // from the same data throws on eight of these nine glyphs without an embedded TTF.
  const params = {
    reference: "R-2401",
    customerName: "Zażółć Gęślą Jaźń Wąsik",
    vehicle: "Ford Transit",
    plate: "WX 5519M",
    pickup: "2026-07-01",
    return: "2026-07-10",
    odometerKm: 42850,
    fuelEighths: 4,
    kmDriven: 850,
    fuelDelta: -4,
    newDamageCount: 1,
  };

  it("composes a Polish return summary with the comparison deltas and the plate", () => {
    const { subject, text, html } = protocolReturnedEmail(params);
    expect(subject).toContain("R-2401");
    expect(subject).toContain("protokół zwrotu");
    expect(text).toContain("WX 5519M");
    expect(text).toContain("Ford Transit");
    // The three deltas — the differentiating value over paper — reach the body.
    expect(text).toContain("Przejechano: +850 km");
    expect(text).toContain("Zmiana paliwa: −4/8");
    expect(text).toContain("Nowe uszkodzenia: 1 pozycja");
    expect(html).toContain("<li>Rejestracja: WX 5519M</li>");
  });

  it("carries every Polish diacritic through untouched, in both cases", () => {
    const lower = protocolReturnedEmail(params);
    for (const char of "ąćęłńóśźż") {
      expect(lower.text + lower.html).toContain(char);
    }
    const upper = protocolReturnedEmail({ ...params, customerName: "ZAŻÓŁĆ GĘŚLĄ JAŹŃ" });
    for (const char of "ĄĆĘŁŃÓŚŹŻ") {
      expect(upper.text + upper.html).toContain(char);
    }
  });

  it("reads a signed km delta and names a below-baseline fuel change as adverse", () => {
    // A positive km carries an explicit `+`; a negative one (suspect odometer) its minus.
    expect(protocolReturnedEmail({ ...params, kmDriven: -40 }).text).toContain("Przejechano: -40 km");
    // Fuel unchanged reads plainly; a rise carries a `+`; a drop a minus.
    expect(protocolReturnedEmail({ ...params, fuelDelta: 0 }).text).toContain("Zmiana paliwa: bez zmian");
    expect(protocolReturnedEmail({ ...params, fuelDelta: 2 }).text).toContain("Zmiana paliwa: +2/8");
  });

  it("reads no new damage as `brak` and pluralizes the count", () => {
    expect(protocolReturnedEmail({ ...params, newDamageCount: 0 }).text).toContain("Nowe uszkodzenia: brak");
    expect(protocolReturnedEmail({ ...params, newDamageCount: 3 }).text).toContain("Nowe uszkodzenia: 3 pozycje");
  });

  it("carries no link into the app — the PDF attachment is the customer's only artifact", () => {
    const { html, text } = protocolReturnedEmail(params);
    expect(html).not.toContain("href=");
    expect(text).not.toContain("http");
  });
});
