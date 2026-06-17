// core
import { describe, expect, it } from "vitest";

// others
import { reservationConfirmedEmail, reservationRejectedEmail } from "./templates";

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
