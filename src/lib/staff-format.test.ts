import { describe, expect, it } from "vitest";

import { formatLastActive, plForm, staffCountLabel, staffInitials } from "./staff-format";

const NOW = Date.parse("2026-07-23T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("plForm (Polish count nouns)", () => {
  it("selects one / few / many by the Polish rule", () => {
    expect(plForm(1, "osoba", "osoby", "osób")).toBe("osoba");
    expect(plForm(2, "osoba", "osoby", "osób")).toBe("osoby");
    expect(plForm(4, "osoba", "osoby", "osób")).toBe("osoby");
    expect(plForm(5, "osoba", "osoby", "osób")).toBe("osób");
    expect(plForm(12, "osoba", "osoby", "osób")).toBe("osób"); // 12–14 stay many
    expect(plForm(22, "osoba", "osoby", "osób")).toBe("osoby");
  });
});

describe("staffCountLabel", () => {
  it("renders the uppercase eyebrow", () => {
    expect(staffCountLabel(5, 1)).toBe("5 OSÓB · 1 ADMINISTRATOR");
    expect(staffCountLabel(1, 1)).toBe("1 OSOBA · 1 ADMINISTRATOR");
    expect(staffCountLabel(3, 2)).toBe("3 OSOBY · 2 ADMINISTRATORZY");
  });
});

describe("formatLastActive (active)", () => {
  const base = { status: "active" as const, invitedAt: null };
  it("just signed in → przed chwilą", () => {
    expect(formatLastActive({ ...base, lastSignInAt: ago(30_000) }, NOW)).toBe("przed chwilą");
    expect(formatLastActive({ ...base, lastSignInAt: null }, NOW)).toBe("przed chwilą");
  });
  it("minutes / hours", () => {
    expect(formatLastActive({ ...base, lastSignInAt: ago(12 * 60_000) }, NOW)).toBe("12 min temu");
    expect(formatLastActive({ ...base, lastSignInAt: ago(2 * 3_600_000) }, NOW)).toBe("2 godz. temu");
  });
  it("yesterday / days", () => {
    expect(formatLastActive({ ...base, lastSignInAt: ago(25 * 3_600_000) }, NOW)).toBe("wczoraj");
    expect(formatLastActive({ ...base, lastSignInAt: ago(3 * 86_400_000) }, NOW)).toBe("3 dni temu");
  });
});

describe("formatLastActive (invited)", () => {
  it("renders zaproszenie · N dni temu", () => {
    expect(formatLastActive({ status: "invited", lastSignInAt: null, invitedAt: ago(2 * 86_400_000) }, NOW)).toBe(
      "zaproszenie · 2 dni temu",
    );
    expect(formatLastActive({ status: "invited", lastSignInAt: null, invitedAt: ago(60_000) }, NOW)).toBe(
      "zaproszenie · dziś",
    );
  });
});

describe("staffInitials", () => {
  it("takes first letters of the first two words, uppercased", () => {
    expect(staffInitials("Piotr Bednarz", "p@x.pl")).toBe("PB");
    expect(staffInitials("Zofia Wróbel", "z@x.pl")).toBe("ZW");
    expect(staffInitials("Madonna", "m@x.pl")).toBe("MA");
    expect(staffInitials(null, "grzegorz@x.pl")).toBe("GR");
  });
});
