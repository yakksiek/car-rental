// core
import { UserPlus } from "lucide-react";
import { describe, expect, it } from "vitest";

// others
import { buildQuickActions, quickActions, type QuickActionItem } from "./quick-actions";

// The absorb merge (S-12b) — the logic with the most branches and the most call
// sites (desktop popover, mobile sheet, and both absorb boards). The cases below
// pin the two shapes the design's four row-sets reduce to: a NEW promoted key
// grows the menu by one row (Zespół → 3), a COLLIDING one does not (Flota → 2).
//
// The merge is locale-agnostic — it keys on `key`, never on `label` — so the
// structural cases run under one locale and a separate case pins that the LABELS
// follow the locale.

const EMPLOYEE: QuickActionItem = {
  key: "employee",
  icon: UserPlus,
  label: "Add employee",
  desc: "Invite them to the team",
};

/** Read a canonical row by key, failing the test rather than asserting non-null. */
function canonical(key: string): QuickActionItem {
  const item = quickActions("en").find((i) => i.key === key);
  if (!item) {
    throw new Error(`quickActions("en") has no row with key "${key}"`);
  }
  return item;
}

describe("buildQuickActions", () => {
  it("without `promoted` returns the 2 canonical rows with `res` primary", () => {
    const items = buildQuickActions("en");

    expect(items.map((i) => i.key)).toEqual(["res", "vehicle"]);
    expect(items.map((i) => i.primary)).toEqual([true, false]);
  });

  it("with a NEW promoted key returns 3 rows, promoted first and primary, canonical rows demoted", () => {
    const items = buildQuickActions("en", EMPLOYEE);

    expect(items.map((i) => i.key)).toEqual(["employee", "res", "vehicle"]);
    expect(items.map((i) => i.primary)).toEqual([true, false, false]);
    expect(items[0].label).toBe("Add employee");
  });

  it("with a COLLIDING promoted key returns 2 rows — promoted first, no duplicate", () => {
    const items = buildQuickActions("en", { ...canonical("vehicle"), onPick: () => undefined });

    expect(items.map((i) => i.key)).toEqual(["vehicle", "res"]);
    expect(items.map((i) => i.primary)).toEqual([true, false]);
    expect(items.filter((i) => i.key === "vehicle")).toHaveLength(1);
  });

  it("de-duplicates a promoted key colliding with the canonical PRIMARY row (`res`)", () => {
    const items = buildQuickActions("en", { ...canonical("res") });

    expect(items.map((i) => i.key)).toEqual(["res", "vehicle"]);
    expect(items.filter((i) => i.key === "res")).toHaveLength(1);
    expect(items.map((i) => i.primary)).toEqual([true, false]);
  });

  it("never writes back onto the canonical rows", () => {
    // They are rebuilt per call now, so the old "does not mutate the shared
    // array" property is structural — but the `primary` flag must still land
    // only on the RETURNED rows, never on a row a later call would hand out.
    buildQuickActions("en");
    buildQuickActions("en", EMPLOYEE);
    buildQuickActions("en", { ...quickActions("en")[1] });

    expect(quickActions("en").every((i) => !("primary" in i))).toBe(true);
  });

  it("labels the rows in the requested locale, with the same keys and order", () => {
    const en = buildQuickActions("en");
    const pl = buildQuickActions("pl");

    expect(pl.map((i) => i.key)).toEqual(en.map((i) => i.key));
    expect(en.map((i) => i.label)).toEqual(["New reservation", "Add vehicle"]);
    expect(pl.map((i) => i.label)).toEqual(["Nowa rezerwacja", "Dodaj pojazd"]);
  });
});
