// core
import { describe, expect, it } from "vitest";

// others
import { allSlotsFilled, filledSlotCount, formatOdometer, parseOdometer, randomUuid } from "./protocol-form";
import { fuelLabelPl } from "./protocol-labels";
import { PHOTO_SLOTS } from "./protocol-schema";

describe("fuelLabelPl", () => {
  it("names the two ends", () => {
    expect(fuelLabelPl(0)).toBe("0/8 · pusty");
    expect(fuelLabelPl(8)).toBe("8/8 · pełny");
  });

  it("leaves the middle unnamed", () => {
    for (let eighths = 1; eighths <= 7; eighths++) {
      expect(fuelLabelPl(eighths)).toBe(`${eighths}/8`);
    }
  });
});

describe("photo slot completeness", () => {
  const full = Object.fromEntries(PHOTO_SLOTS.map((slot) => [slot, `issue/p/photo-${slot}.jpg`]));

  it("counts only slots carrying a path", () => {
    expect(filledSlotCount({})).toBe(0);
    expect(filledSlotCount({ front: "issue/p/photo-front.jpg" })).toBe(1);
    expect(filledSlotCount(full)).toBe(PHOTO_SLOTS.length);
  });

  it("ignores an empty-string path — an in-flight tile is not a captured one", () => {
    expect(filledSlotCount({ front: "" })).toBe(0);
  });

  it("is complete only with all six baseline shots", () => {
    expect(allSlotsFilled(full)).toBe(true);
    const { dashboard: _missing, ...five } = full;
    expect(allSlotsFilled(five)).toBe(false);
  });
});

describe("randomUuid", () => {
  // The schema pins ids with `z.guid()`, which is `UUID_RE`'s shape.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it("produces a well-formed, unique id", () => {
    const a = randomUuid();
    expect(a).toMatch(UUID_RE);
    expect(randomUuid()).not.toBe(a);
  });

  it("builds a v4 id from getRandomValues when randomUUID is unavailable (insecure context)", () => {
    const real = Object.getOwnPropertyDescriptor(globalThis.crypto, "randomUUID");
    // Simulate a phone on http://<lan-ip>: getRandomValues stays, randomUUID is gone.
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const id = randomUuid();
      expect(id).toMatch(UUID_RE);
      expect(id[14]).toBe("4"); // version nibble
      expect(["8", "9", "a", "b"]).toContain(id[19].toLowerCase()); // variant nibble
    } finally {
      if (real) {
        Object.defineProperty(globalThis.crypto, "randomUUID", real);
      }
    }
  });
});

describe("odometer grouping", () => {
  it("groups thousands and round-trips back to digits", () => {
    expect(formatOdometer("128450")).toBe("128 450");
    expect(formatOdometer("999")).toBe("999");
    expect(formatOdometer("1234567")).toBe("1 234 567");
    expect(parseOdometer("128 450")).toBe("128450");
  });

  it("drops anything that is not a digit", () => {
    expect(formatOdometer("12a3 km")).toBe("123");
    expect(parseOdometer("")).toBe("");
  });
});
