// core
import { UserPlus } from "lucide-react";
import { describe, expect, it } from "vitest";

// others
import { buildQuickActions, QUICK_ACTIONS, type QuickActionItem } from "./quick-actions";

// The absorb merge (S-12b) — the logic with the most branches and the most call
// sites (desktop popover, mobile sheet, and both absorb boards). The cases below
// pin the two shapes the design's four row-sets reduce to: a NEW promoted key
// grows the menu by one row (Zespół → 3), a COLLIDING one does not (Flota → 2).

const EMPLOYEE: QuickActionItem = {
  key: "employee",
  icon: UserPlus,
  label: "Dodaj pracownika",
  desc: "Zaproś do zespołu",
};

/** Read a canonical row by key, failing the test rather than asserting non-null. */
function canonical(key: string): QuickActionItem {
  const item = QUICK_ACTIONS.find((i) => i.key === key);
  if (!item) {
    throw new Error(`QUICK_ACTIONS has no row with key "${key}"`);
  }
  return item;
}

describe("buildQuickActions", () => {
  it("without `promoted` returns the 2 canonical rows with `res` primary", () => {
    const items = buildQuickActions();

    expect(items.map((i) => i.key)).toEqual(["res", "vehicle"]);
    expect(items.map((i) => i.primary)).toEqual([true, false]);
  });

  it("with a NEW promoted key returns 3 rows, promoted first and primary, canonical rows demoted", () => {
    const items = buildQuickActions(EMPLOYEE);

    expect(items.map((i) => i.key)).toEqual(["employee", "res", "vehicle"]);
    expect(items.map((i) => i.primary)).toEqual([true, false, false]);
    expect(items[0].label).toBe("Dodaj pracownika");
  });

  it("with a COLLIDING promoted key returns 2 rows — promoted first, no duplicate", () => {
    const items = buildQuickActions({ ...canonical("vehicle"), onPick: () => undefined });

    expect(items.map((i) => i.key)).toEqual(["vehicle", "res"]);
    expect(items.map((i) => i.primary)).toEqual([true, false]);
    expect(items.filter((i) => i.key === "vehicle")).toHaveLength(1);
  });

  it("de-duplicates a promoted key colliding with the canonical PRIMARY row (`res`)", () => {
    const items = buildQuickActions({ ...canonical("res") });

    expect(items.map((i) => i.key)).toEqual(["res", "vehicle"]);
    expect(items.filter((i) => i.key === "res")).toHaveLength(1);
    expect(items.map((i) => i.primary)).toEqual([true, false]);
  });

  it("never mutates QUICK_ACTIONS", () => {
    const before = structuredClone(QUICK_ACTIONS.map(({ key, label, desc, href }) => ({ key, label, desc, href })));

    buildQuickActions();
    buildQuickActions(EMPLOYEE);
    buildQuickActions({ ...QUICK_ACTIONS[1] });

    const after = QUICK_ACTIONS.map(({ key, label, desc, href }) => ({ key, label, desc, href }));
    expect(after).toEqual(before);
    // No `primary` flag is ever written back onto the source rows.
    expect(QUICK_ACTIONS.every((i) => !("primary" in i))).toBe(true);
  });
});
