// core
import { describe, expect, it } from "vitest";

// others
import { protocolIssuedEmail, reservationConfirmedEmail, reservationRejectedEmail } from "./templates";

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
