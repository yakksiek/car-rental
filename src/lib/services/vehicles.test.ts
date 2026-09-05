// core
import { describe, expect, it } from "vitest";

// others
import { getCategoryPricing, reduceCategoryPricing } from "./vehicles";

// Unit coverage for the Cennik pricing read path. The reducer is pure, so it is
// tested directly (no DB); the async wrapper is only checked for the null-client
// degrade — the DB path is exercised by the integration suite.

describe("reduceCategoryPricing", () => {
  it("takes the numeric MIN of daily and monthly rate per category", () => {
    const result = reduceCategoryPricing(
      [
        { category: "cargo_van", daily_rate: 300, monthly_rate: 5000 },
        { category: "cargo_van", daily_rate: 219, monthly_rate: 4500 },
      ],
      "pl",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ category: "cargo_van", minDaily: 219, minMonthly: 4500, count: 2 });
  });

  it("parses string-typed rates (the numeric-as-string quirk) before comparing", () => {
    const result = reduceCategoryPricing(
      [
        { category: "passenger_van", daily_rate: "279.00", monthly_rate: "5900.00" },
        { category: "passenger_van", daily_rate: "259.50", monthly_rate: "6100.00" },
      ],
      "pl",
    );
    expect(result[0].minDaily).toBe(259.5);
    expect(result[0].minMonthly).toBe(5900);
  });

  it("excludes categories with no active vehicles", () => {
    const result = reduceCategoryPricing([{ category: "cargo_van", daily_rate: 219, monthly_rate: 4500 }], "pl");
    expect(result.map((row) => row.category)).toEqual(["cargo_van"]);
  });

  it("returns categories in canonical order regardless of input order", () => {
    const result = reduceCategoryPricing(
      [
        { category: "flatbed_truck", daily_rate: 309, monthly_rate: 6600 },
        { category: "cargo_van", daily_rate: 219, monthly_rate: 4500 },
        { category: "refrigerated_truck", daily_rate: 399, monthly_rate: 8400 },
      ],
      "pl",
    );
    expect(result.map((row) => row.category)).toEqual(["cargo_van", "refrigerated_truck", "flatbed_truck"]);
  });

  it("attaches the category label in the requested locale", () => {
    const rows = [{ category: "cargo_van" as const, daily_rate: 219, monthly_rate: 4500 }];
    expect(reduceCategoryPricing(rows, "pl")[0].label).toBe("Furgon");
    expect(reduceCategoryPricing(rows, "en")[0].label).toBe("Cargo van");
  });

  it("returns [] when there are no vehicles", () => {
    expect(reduceCategoryPricing([], "pl")).toEqual([]);
  });
});

describe("getCategoryPricing", () => {
  it("resolves [] when the client is null (Supabase unconfigured)", async () => {
    await expect(getCategoryPricing(null, "pl")).resolves.toEqual([]);
  });
});
