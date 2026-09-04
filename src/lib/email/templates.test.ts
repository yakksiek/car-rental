// core
import { describe, expect, it } from "vitest";

// others
import {
  protocolIssuedEmail,
  protocolReturnedEmail,
  reservationConfirmedEmail,
  reservationReceivedEmail,
  reservationRejectedEmail,
} from "./templates";

// Every template renders in the ARTIFACT's language — `reservations.locale` for
// the three reservation mails, `protocols.locale` for the two protocol ones —
// never the sending employee's session. So each suite below asserts BOTH halves:
// a template that ignored its `locale` argument and returned one language would
// pass a single-locale suite completely.
//
// The customer name keeps its full Polish diacritic set in the `en` cases too.
// That is the point of the locale split: the chrome translates, the customer's
// own name does not, and the byte path downstream (the PDF's embedded font)
// meets exactly the same characters either way.

describe("reservationReceivedEmail", () => {
  const params = {
    reference: "R-1234",
    statusUrl: "https://flota.test/r/abc",
    vehicle: "Mercedes-Benz Sprinter (2022)",
    pickup: "2026-04-02",
    return: "2026-04-09",
    dailyRate: 340,
  } as const;

  it("composes a Polish submit confirmation with the reference, window and status link", () => {
    const { subject, text, html } = reservationReceivedEmail({ ...params, locale: "pl" });
    expect(subject).toBe("Flota — zgłoszenie R-1234 przyjęte");
    expect(text).toContain("od 14:00");
    expect(text).toContain("do 10:00");
    expect(text).toContain("7 dni");
    expect(text).toContain(params.statusUrl);
    expect(html).toContain(`href="${params.statusUrl}"`);
  });

  it("composes the same mail in English", () => {
    const { subject, text } = reservationReceivedEmail({ ...params, locale: "en" });
    expect(subject).toBe("Flota — request R-1234 received");
    expect(text).toContain("from 14:00");
    expect(text).toContain("to 10:00");
    expect(text).toContain("7 days");
    expect(text).toContain(params.statusUrl);
  });
});

describe("reservationConfirmedEmail", () => {
  const params = {
    reference: "R-1234",
    statusUrl: "https://flota.test/r/abc",
    vehicle: "Mercedes-Benz Sprinter (2022)",
    pickup: "2026-04-02",
    return: "2026-04-09",
    dailyRate: 340,
    deposit: 2500,
  } as const;

  it("composes a Polish confirmation with reference, dates, total, deposit, and link", () => {
    const { subject, text, html } = reservationConfirmedEmail({ ...params, locale: "pl" });
    expect(subject).toBe("Flota — rezerwacja R-1234 potwierdzona");
    expect(text).toContain("od 14:00");
    expect(text).toContain("do 10:00");
    expect(text).toContain("7 dni");
    expect(text).toContain("380 zł"); // 340 * 7 = 2 380 (separator is a non-breaking space)
    expect(text).toContain("500 zł"); // deposit 2 500
    expect(text).toContain(params.statusUrl);
    expect(html).toContain(`href="${params.statusUrl}"`);
  });

  it("composes the same confirmation in English, grouped the English way", () => {
    const { subject, text } = reservationConfirmedEmail({ ...params, locale: "en" });
    expect(subject).toBe("Flota — reservation R-1234 confirmed");
    expect(text).toContain("7 days");
    // The amount is the same number; only the grouping separator changes — a
    // comma under `en`, U+00A0 under `pl` (locale lesson: numbers do NOT swap
    // cleanly, and asserting one separator across locales is the trap).
    expect(text).toContain("2,380 zł");
    expect(text).toContain("2,500 zł");
  });
});

describe("reservationRejectedEmail", () => {
  const base = {
    reference: "R-5678",
    statusUrl: "https://flota.test/r/def",
    vehicle: "MAN TGE (2021)",
  } as const;

  it("renders the canned reason label in Polish", () => {
    const { subject, text } = reservationRejectedEmail({ ...base, reason: "vehicle_withdrawn", locale: "pl" });
    expect(subject).toBe("Flota — wniosek R-5678 odrzucony");
    expect(text).toContain("Pojazd wycofany");
    expect(text).toContain("alternatywnych dat");
  });

  it("renders the canned reason label in English", () => {
    const { subject, text } = reservationRejectedEmail({ ...base, reason: "vehicle_withdrawn", locale: "en" });
    expect(subject).toBe("Flota — request R-5678 declined");
    expect(text).toContain("Vehicle withdrawn");
    expect(text).toContain("alternative dates");
  });

  it("includes the free-text note when the reason is other", () => {
    const { text } = reservationRejectedEmail({
      ...base,
      reason: "other",
      note: "Wymagana kaucja gotówkowa",
      locale: "pl",
    });
    expect(text).toContain("Inny");
    expect(text).toContain("Szczegóły: Wymagana kaucja gotówkowa");
  });

  it("renders the employee's note VERBATIM under an English label", () => {
    // Free text is never translated (frame decision 2) — only the chrome around
    // it. An English-reading customer's rejection note is whatever the employee
    // actually typed, which on a Polish depot's desk is Polish.
    const { text } = reservationRejectedEmail({
      ...base,
      reason: "other",
      note: "Wymagana kaucja gotówkowa",
      locale: "en",
    });
    expect(text).toContain("Details: Wymagana kaucja gotówkowa");
  });

  it("omits the note line when no note is given", () => {
    const { text } = reservationRejectedEmail({ ...base, reason: "no_category", locale: "pl" });
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
  } as const;

  it("composes a Polish handover summary with the plate, odometer, fuel and damage count", () => {
    const { subject, text, html } = protocolIssuedEmail({ ...params, locale: "pl" });
    expect(subject).toBe("Flota — protokół wydania R-2401");
    expect(text).toContain("WX 5519M");
    expect(text).toContain("Ford Transit");
    expect(text).toContain("6/8");
    expect(text).toContain("2 pozycje");
    expect(html).toContain("<li>Rejestracja: WX 5519M</li>");
  });

  it("composes the same summary in English", () => {
    const { subject, text, html } = protocolIssuedEmail({ ...params, locale: "en" });
    expect(subject).toBe("Flota — pickup protocol R-2401");
    expect(text).toContain("WX 5519M");
    expect(text).toContain("6/8");
    expect(text).toContain("2 items");
    expect(html).toContain("<li>Registration: WX 5519M</li>");
  });

  it.each(["pl", "en"] as const)("carries every Polish diacritic through untouched, in both cases (%s)", (locale) => {
    const lower = protocolIssuedEmail({ ...params, locale });
    for (const char of "ąćęłńóśźż") {
      expect(lower.text + lower.html).toContain(char);
    }
    // Customers do enter their names in caps, and the uppercase forms are a
    // separate set of code points at the font/encoding boundary downstream.
    const upper = protocolIssuedEmail({ ...params, customerName: "ZAŻÓŁĆ GĘŚLĄ JAŹŃ", locale });
    for (const char of "ĄĆĘŁŃÓŚŹŻ") {
      expect(upper.text + upper.html).toContain(char);
    }
  });

  it("names the two fuel extremes rather than leaving a bare fraction", () => {
    expect(protocolIssuedEmail({ ...params, fuelEighths: 8, locale: "pl" }).text).toContain("8/8 (pełny)");
    expect(protocolIssuedEmail({ ...params, fuelEighths: 0, locale: "pl" }).text).toContain("0/8 (pusty)");
    expect(protocolIssuedEmail({ ...params, fuelEighths: 8, locale: "en" }).text).toContain("8/8 (full)");
    expect(protocolIssuedEmail({ ...params, fuelEighths: 0, locale: "en" }).text).toContain("0/8 (empty)");
  });

  it("reads no damage as a word and one as a singular, in each locale's plural rules", () => {
    expect(protocolIssuedEmail({ ...params, damageCount: 0, locale: "pl" }).text).toContain(
      "Uszkodzenia zapisane przy wydaniu: brak",
    );
    expect(protocolIssuedEmail({ ...params, damageCount: 1, locale: "pl" }).text).toContain("1 pozycja");
    expect(protocolIssuedEmail({ ...params, damageCount: 0, locale: "en" }).text).toContain(
      "Damage recorded at pickup: none",
    );
    expect(protocolIssuedEmail({ ...params, damageCount: 1, locale: "en" }).text).toContain("1 item");
  });

  it("carries no link into the app — the PDF attachment is the customer's only artifact", () => {
    const { html, text } = protocolIssuedEmail({ ...params, locale: "en" });
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
  } as const;

  it("composes a Polish return summary with the comparison deltas and the plate", () => {
    const { subject, text, html } = protocolReturnedEmail({ ...params, locale: "pl" });
    expect(subject).toBe("Flota — protokół zwrotu R-2401");
    expect(text).toContain("WX 5519M");
    expect(text).toContain("Ford Transit");
    // The three deltas — the differentiating value over paper — reach the body.
    expect(text).toContain("Przejechano: +850 km");
    expect(text).toContain("Zmiana paliwa: −4/8");
    expect(text).toContain("Nowe uszkodzenia: 1 pozycja");
    expect(html).toContain("<li>Rejestracja: WX 5519M</li>");
  });

  it("composes the same return summary in English", () => {
    const { subject, text, html } = protocolReturnedEmail({ ...params, locale: "en" });
    expect(subject).toBe("Flota — return protocol R-2401");
    expect(text).toContain("Distance driven: +850 km");
    expect(text).toContain("Fuel change: −4/8");
    expect(text).toContain("New damage: 1 item");
    expect(html).toContain("<li>Registration: WX 5519M</li>");
  });

  it.each(["pl", "en"] as const)("carries every Polish diacritic through untouched, in both cases (%s)", (locale) => {
    const lower = protocolReturnedEmail({ ...params, locale });
    for (const char of "ąćęłńóśźż") {
      expect(lower.text + lower.html).toContain(char);
    }
    const upper = protocolReturnedEmail({ ...params, customerName: "ZAŻÓŁĆ GĘŚLĄ JAŹŃ", locale });
    for (const char of "ĄĆĘŁŃÓŚŹŻ") {
      expect(upper.text + upper.html).toContain(char);
    }
  });

  it("reads a signed km delta and names a below-baseline fuel change as adverse", () => {
    // A positive km carries an explicit `+`; a negative one (suspect odometer) its minus.
    expect(protocolReturnedEmail({ ...params, kmDriven: -40, locale: "pl" }).text).toContain("Przejechano: -40 km");
    // Fuel unchanged reads plainly; a rise carries a `+`; a drop a minus.
    expect(protocolReturnedEmail({ ...params, fuelDelta: 0, locale: "pl" }).text).toContain("Zmiana paliwa: bez zmian");
    expect(protocolReturnedEmail({ ...params, fuelDelta: 2, locale: "pl" }).text).toContain("Zmiana paliwa: +2/8");
    expect(protocolReturnedEmail({ ...params, fuelDelta: 0, locale: "en" }).text).toContain("Fuel change: no change");
  });

  it("reads no new damage as a word and pluralizes the count", () => {
    expect(protocolReturnedEmail({ ...params, newDamageCount: 0, locale: "pl" }).text).toContain(
      "Nowe uszkodzenia: brak",
    );
    expect(protocolReturnedEmail({ ...params, newDamageCount: 3, locale: "pl" }).text).toContain(
      "Nowe uszkodzenia: 3 pozycje",
    );
    expect(protocolReturnedEmail({ ...params, newDamageCount: 0, locale: "en" }).text).toContain("New damage: none");
    expect(protocolReturnedEmail({ ...params, newDamageCount: 3, locale: "en" }).text).toContain("New damage: 3 items");
  });

  it("carries no link into the app — the PDF attachment is the customer's only artifact", () => {
    const { html, text } = protocolReturnedEmail({ ...params, locale: "en" });
    expect(html).not.toContain("href=");
    expect(text).not.toContain("http");
  });
});
