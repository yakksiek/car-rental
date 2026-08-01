import { describe, expect, it } from "vitest";

import { MARK_BODY_PATH, MARK_STREAKS, MARK_VIEWBOX, MARK_WHEELS, hasWordmark, toneTextClass } from "./mark";

// The rendered `<Brand>` (Astro + React) is a thin shell over this pure logic:
// tone → color class, variant → wordmark presence, and the shared mark geometry.
// The repo's unit project is node-env (`src/**/*.test.ts`, no jsdom), so we verify
// the logic + geometry here rather than mounting the component. Because the mark
// carries no color of its own (stroke is currentColor on the <svg>), tone is
// structurally guaranteed — the geometry holds only coordinates.

describe("brand mark geometry", () => {
  it("keeps the committed viewBox", () => {
    expect(MARK_VIEWBOX).toBe("-6 24 124 60");
  });

  it("has three streaks and two wheels", () => {
    expect(MARK_STREAKS).toHaveLength(3);
    expect(MARK_WHEELS).toHaveLength(2);
  });

  it("holds only geometry, no hardcoded color", () => {
    expect(MARK_BODY_PATH).not.toContain("#");
    expect(JSON.stringify(MARK_STREAKS)).not.toContain("#");
  });
});

describe("toneTextClass", () => {
  it("maps ink to the foreground token", () => {
    expect(toneTextClass("ink")).toBe("text-foreground");
  });

  it("maps inverse to white for dark surfaces", () => {
    expect(toneTextClass("inverse")).toBe("text-white");
  });
});

describe("hasWordmark", () => {
  it("shows the Flota wordmark for the lockup variant", () => {
    expect(hasWordmark("lockup")).toBe(true);
  });

  it("hides the wordmark for the mark-only variant", () => {
    expect(hasWordmark("mark")).toBe(false);
  });
});
