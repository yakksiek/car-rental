// core
import { describe, expect, it } from "vitest";

// others
import { formatFuelDelta, formatKmDriven, formatNewDamageCount, suggestBaselineDamageId } from "./return-form";
import type { AutoTagBaselineDamage } from "./protocol-delta";

// The design's mono chips use U+2212 MINUS, not a hyphen — assert the exact glyph.
const MINUS = "−";
// The thousands separator `Intl` uses for `pl` (U+00A0). This module used to
// hand-roll grouping with a PLAIN space, one of three spellings in the repo.
const NBSP = "\u00a0";

describe("formatKmDriven", () => {
  it("groups thousands with a Polish space and signs the value", () => {
    expect(formatKmDriven(1228, "pl")).toBe(`+1${NBSP}228 km`);
    expect(formatKmDriven(1228, "en")).toBe("+1,228 km");
    expect(formatKmDriven(120, "pl")).toBe("+120 km");
    expect(formatKmDriven(42_850, "pl")).toBe(`+42${NBSP}850 km`);
  });

  it("shows a below-baseline reading as a negative km (neutral tone is the caller's job)", () => {
    expect(formatKmDriven(-120, "pl")).toBe(`${MINUS}120 km`);
    expect(formatKmDriven(-1500, "pl")).toBe(`${MINUS}1${NBSP}500 km`);
  });

  it("shows zero unsigned and a non-finite live value as an em dash", () => {
    expect(formatKmDriven(0, "pl")).toBe("0 km");
    expect(formatKmDriven(NaN, "pl")).toBe("—");
  });
});

describe("formatFuelDelta", () => {
  it("signs the eighths delta", () => {
    expect(formatFuelDelta(3)).toBe("+3/8");
    expect(formatFuelDelta(-4)).toBe(`${MINUS}4/8`);
    expect(formatFuelDelta(0)).toBe("0/8");
  });

  it("renders an unset (non-finite) fuel as an em dash", () => {
    expect(formatFuelDelta(NaN)).toBe("—");
  });
});

describe("formatNewDamageCount", () => {
  it("prefixes a positive count and shows a bare zero", () => {
    expect(formatNewDamageCount(1)).toBe("+1");
    expect(formatNewDamageCount(3)).toBe("+3");
    expect(formatNewDamageCount(0)).toBe("0");
  });
});

describe("suggestBaselineDamageId", () => {
  // Diacritic-carrying locations exercise the normalized match by default (lessons.md).
  const baseline: AutoTagBaselineDamage[] = [
    { id: "b-1", type: "scratch", location: "Lewy błotnik", size: "15 cm" },
    { id: "b-2", type: "dent", location: "Prawe drzwi — ćwiartka", size: null },
  ];

  it("defaults an unchanged baseline damage to that baseline id (existing)", () => {
    expect(
      suggestBaselineDamageId(baseline, { type: "scratch", location: "  lewy  BŁOTNIK ", size: "15 cm" }, []),
    ).toBe("b-1");
  });

  it("defaults a fresh, unmatched damage to null (new)", () => {
    expect(suggestBaselineDamageId(baseline, { type: "crack", location: "Przednia szyba", size: null }, [])).toBeNull();
  });

  it("does not re-suggest a baseline item already claimed by another row", () => {
    // `b-1` is taken → the same fresh scratch cannot claim it again, so it reads new.
    expect(
      suggestBaselineDamageId(baseline, { type: "scratch", location: "Lewy błotnik", size: "15 cm" }, ["b-1"]),
    ).toBeNull();
  });
});
