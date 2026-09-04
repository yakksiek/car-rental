import { describe, expect, it } from "vitest";

import { formatLastActive, staffCountLabel, staffInitials } from "./staff-format";

const NOW = Date.parse("2026-07-23T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

// This module's own count-noun selector — a second copy of Polish's 1 / 2–4 /
// rest split — is deleted; `format.ts`'s `plural` (Intl.PluralRules) is the one
// selector now, and
// `format.test.ts` asserts the category table directly. What survives here is the
// LABEL, exercised across the same counts so the swap is visible end to end.
describe("staffCountLabel", () => {
  it("renders the uppercase eyebrow", () => {
    expect(staffCountLabel(5, 1, "pl")).toBe("5 OSÓB · 1 ADMINISTRATOR");
    expect(staffCountLabel(1, 1, "pl")).toBe("1 OSOBA · 1 ADMINISTRATOR");
    expect(staffCountLabel(3, 2, "pl")).toBe("3 OSOBY · 2 ADMINISTRATORZY");
  });

  it("keeps the 12–14 exception the deleted selector hard-coded", () => {
    expect(staffCountLabel(12, 22, "pl")).toBe("12 OSÓB · 22 ADMINISTRATORZY");
  });

  it("renders the English eyebrow from a two-form noun", () => {
    expect(staffCountLabel(5, 1, "en")).toBe("5 PEOPLE · 1 ADMIN");
    expect(staffCountLabel(1, 2, "en")).toBe("1 PERSON · 2 ADMINS");
  });
});

describe("formatLastActive (active)", () => {
  const base = { status: "active" as const, invitedAt: null };
  it("just signed in → przed chwilą", () => {
    expect(formatLastActive({ ...base, lastSignInAt: ago(30_000) }, NOW, "pl")).toBe("przed chwilą");
    expect(formatLastActive({ ...base, lastSignInAt: null }, NOW, "pl")).toBe("przed chwilą");
  });
  it("minutes / hours", () => {
    expect(formatLastActive({ ...base, lastSignInAt: ago(12 * 60_000) }, NOW, "pl")).toBe("12 min temu");
    expect(formatLastActive({ ...base, lastSignInAt: ago(2 * 3_600_000) }, NOW, "pl")).toBe("2 godz. temu");
  });
  it("yesterday / days", () => {
    expect(formatLastActive({ ...base, lastSignInAt: ago(25 * 3_600_000) }, NOW, "pl")).toBe("wczoraj");
    expect(formatLastActive({ ...base, lastSignInAt: ago(3 * 86_400_000) }, NOW, "pl")).toBe("3 dni temu");
  });
});

describe("formatLastActive (invited)", () => {
  it("renders zaproszenie · N dni temu", () => {
    expect(formatLastActive({ status: "invited", lastSignInAt: null, invitedAt: ago(2 * 86_400_000) }, NOW, "pl")).toBe(
      "zaproszenie · 2 dni temu",
    );
    expect(formatLastActive({ status: "invited", lastSignInAt: null, invitedAt: ago(60_000) }, NOW, "pl")).toBe(
      "zaproszenie · dziś",
    );
  });

  it("drops the 'zaproszenie' prefix when invitePrefix is false (next to the badge)", () => {
    const m = { status: "invited" as const, lastSignInAt: null, invitedAt: ago(2 * 86_400_000) };
    expect(formatLastActive(m, NOW, "pl", { invitePrefix: false })).toBe("2 dni temu");
    expect(
      formatLastActive({ status: "invited", lastSignInAt: null, invitedAt: ago(60_000) }, NOW, "pl", {
        invitePrefix: false,
      }),
    ).toBe("dziś");
  });
});

describe("formatLastActive (created — the two-step add's first step)", () => {
  const created = { status: "created" as const, lastSignInAt: null, invitedAt: null };

  it("renders an em dash — nothing has been sent for this account yet", () => {
    expect(formatLastActive(created, NOW, "pl")).toBe("—");
    expect(formatLastActive(created, NOW, "pl", { invitePrefix: false })).toBe("—");
  });

  it("does not fall through to the active branch's 'przed chwilą'", () => {
    // The active branch answers "przed chwilą" for a null lastSignInAt, which
    // would read as a sign-in that never happened.
    expect(formatLastActive(created, NOW, "pl")).not.toBe(
      formatLastActive({ status: "active", lastSignInAt: null, invitedAt: null }, NOW, "pl"),
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
