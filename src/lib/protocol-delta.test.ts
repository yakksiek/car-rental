// core
import { describe, expect, it } from "vitest";

// others
import { autoTagDamages, computeReturnDeltas } from "./protocol-delta";
import type { AutoTagBaselineDamage, AutoTagCurrentDamage, DeltaBaseline, DeltaCurrent } from "./protocol-delta";

// The full Polish diacritic set threaded through every location fixture, so the
// matcher's normalization is exercised on the characters real data carries
// (lessons.md — Polish text breaks byte-format paths; keep it in the fixtures).
const DIACRITICS = "ąćęłńóśźż";

const baseline: DeltaBaseline = { odometerKm: 42_000, fuelEighths: 8 };

function current(overrides: Partial<DeltaCurrent> = {}): DeltaCurrent {
  return { odometerKm: 42_850, fuelEighths: 4, damages: [], ...overrides };
}

describe("computeReturnDeltas", () => {
  it("computes km driven and fuel change against the baseline", () => {
    const deltas = computeReturnDeltas(baseline, current());
    expect(deltas.kmDriven).toBe(850);
    expect(deltas.fuelDelta).toBe(-4);
  });

  it("flags a fuel shortfall as adverse and a top-up as neutral", () => {
    expect(computeReturnDeltas(baseline, current({ fuelEighths: 4 })).flags.fuelAdverse).toBe(true);
    expect(computeReturnDeltas(baseline, current({ fuelEighths: 8 })).flags.fuelAdverse).toBe(false);
    // Returned fuller than issued: positive delta, still not adverse.
    expect(computeReturnDeltas({ ...baseline, fuelEighths: 4 }, current({ fuelEighths: 6 })).flags.fuelAdverse).toBe(
      false,
    );
  });

  it("counts only unlinked damages as new and flags any new damage as adverse", () => {
    const deltas = computeReturnDeltas(
      baseline,
      current({
        damages: [{ baselineDamageId: "b-1" }, { baselineDamageId: null }, { baselineDamageId: null }],
      }),
    );
    expect(deltas.newDamageCount).toBe(2);
    expect(deltas.flags.damageAdverse).toBe(true);
  });

  it("counts an undefined baseline link as new (the live form passes raw RHF state, not the zod-normalized null)", () => {
    // A freshly-added, un-linked damage row reads back as `undefined` in
    // react-hook-form before the schema's `?? null` transform runs at submit.
    // The count must still treat it as new, or the live comparison under-reports.
    const deltas = computeReturnDeltas(
      baseline,
      current({ damages: [{ baselineDamageId: "b-1" }, { baselineDamageId: undefined }] }),
    );
    expect(deltas.newDamageCount).toBe(1);
    expect(deltas.flags.damageAdverse).toBe(true);
  });

  it("reports no new damage when every return damage links to a baseline item", () => {
    const deltas = computeReturnDeltas(baseline, current({ damages: [{ baselineDamageId: "b-1" }] }));
    expect(deltas.newDamageCount).toBe(0);
    expect(deltas.flags.damageAdverse).toBe(false);
  });

  it.each([
    { label: "negative km", odometerKm: 41_900, expected: -100 },
    { label: "zero km", odometerKm: 42_000, expected: 0 },
  ])("flags $label as odometerSuspect while keeping kmDriven neutral", ({ odometerKm, expected }) => {
    const deltas = computeReturnDeltas(baseline, current({ odometerKm }));
    expect(deltas.kmDriven).toBe(expected);
    expect(deltas.flags.odometerSuspect).toBe(true);
  });

  it("does not flag a plausible positive km as suspect", () => {
    expect(computeReturnDeltas(baseline, current({ odometerKm: 42_001 })).flags.odometerSuspect).toBe(false);
  });

  it("flags a non-finite odometer as suspect instead of silently showing NaN km with no warning", () => {
    // A half-typed live-form odometer (`Number("42a")`) reaches the helper as NaN
    // before the schema coerces it; `NaN <= 0` is false, so a plain `<= 0` guard
    // would leave odometerSuspect off and the display would show "NaN km" unwarned.
    const deltas = computeReturnDeltas(baseline, current({ odometerKm: Number.NaN }));
    expect(deltas.flags.odometerSuspect).toBe(true);
  });
});

describe("autoTagDamages", () => {
  const scratch: AutoTagBaselineDamage = {
    id: "base-scratch",
    type: "scratch",
    location: `lewy błotnik ${DIACRITICS}`,
    size: "10 cm",
  };
  const dent: AutoTagBaselineDamage = {
    id: "base-dent",
    type: "dent",
    location: `tylny zderzak ${DIACRITICS}`,
    size: null,
  };

  it("pre-selects an unchanged baseline scratch as existing and a fresh dent as new", () => {
    const currentDamages: AutoTagCurrentDamage[] = [
      { type: "scratch", location: `lewy błotnik ${DIACRITICS}`, size: "10 cm" },
      { type: "dent", location: `prawe drzwi ${DIACRITICS}`, size: "duże" },
    ];
    expect(autoTagDamages([scratch, dent], currentDamages)).toEqual(["base-scratch", null]);
  });

  it("matches despite case and whitespace differences in the location (normalized)", () => {
    const currentDamages: AutoTagCurrentDamage[] = [
      { type: "scratch", location: `  Lewy   Błotnik ${DIACRITICS}  `, size: "10 cm" },
    ];
    expect(autoTagDamages([scratch], currentDamages)).toEqual(["base-scratch"]);
  });

  it("matches despite case and whitespace differences in the size (normalized), not just the location", () => {
    // Size is normalized identically to location; without this case a regression
    // to a raw `size === size` compare would leave every other autoTag test green.
    const currentDamages: AutoTagCurrentDamage[] = [
      { type: "scratch", location: scratch.location, size: "  10   CM " },
    ];
    expect(autoTagDamages([scratch], currentDamages)).toEqual(["base-scratch"]);
  });

  it("treats a different type, location, or size as a near-miss and tags it new", () => {
    const differentType: AutoTagCurrentDamage = { type: "dent", location: scratch.location, size: scratch.size };
    const differentLocation: AutoTagCurrentDamage = {
      type: "scratch",
      location: `prawy błotnik ${DIACRITICS}`,
      size: "10 cm",
    };
    const differentSize: AutoTagCurrentDamage = { type: "scratch", location: scratch.location, size: "20 cm" };
    expect(autoTagDamages([scratch], [differentType, differentLocation, differentSize])).toEqual([null, null, null]);
  });

  it("matches a null-size baseline item to a null-size return item", () => {
    const currentDamages: AutoTagCurrentDamage[] = [{ type: "dent", location: dent.location, size: null }];
    expect(autoTagDamages([dent], currentDamages)).toEqual(["base-dent"]);
  });

  it("claims each baseline item at most once — a duplicate return row reads as new", () => {
    const currentDamages: AutoTagCurrentDamage[] = [
      { type: "scratch", location: scratch.location, size: "10 cm" },
      { type: "scratch", location: scratch.location, size: "10 cm" },
    ];
    expect(autoTagDamages([scratch], currentDamages)).toEqual(["base-scratch", null]);
  });

  it("assigns two identical return rows to two matching baseline items (advances past the claimed one)", () => {
    // The other half of claim-once: a matcher bug that failed to advance past the
    // just-claimed baseline would return ["base-a", null] and over-count new damage.
    const baseA: AutoTagBaselineDamage = {
      id: "base-a",
      type: "scratch",
      location: `maska ${DIACRITICS}`,
      size: "5 cm",
    };
    const baseB: AutoTagBaselineDamage = {
      id: "base-b",
      type: "scratch",
      location: `maska ${DIACRITICS}`,
      size: "5 cm",
    };
    const currentDamages: AutoTagCurrentDamage[] = [
      { type: "scratch", location: `maska ${DIACRITICS}`, size: "5 cm" },
      { type: "scratch", location: `maska ${DIACRITICS}`, size: "5 cm" },
    ];
    expect(autoTagDamages([baseA, baseB], currentDamages)).toEqual(["base-a", "base-b"]);
  });

  it("returns no suggestions when there is no baseline", () => {
    const currentDamages: AutoTagCurrentDamage[] = [{ type: "scratch", location: scratch.location, size: "10 cm" }];
    expect(autoTagDamages([], currentDamages)).toEqual([null]);
  });
});
