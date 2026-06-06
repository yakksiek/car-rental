// core
import { describe, expect, it } from "vitest";

// others
import type { VehicleFilters } from "../types";
import { parseFilters, serializeFilters, validateDateRange } from "./catalog-filters";

describe("parseFilters", () => {
  it("returns the unfiltered default for empty params", () => {
    expect(parseFilters(new URLSearchParams())).toEqual({
      category: null,
      pickup: null,
      return: null,
      minPayload: null,
      sort: null,
    });
  });

  it("reads every valid param", () => {
    const params = new URLSearchParams({
      category: "cargo_van",
      pickup: "2026-07-01",
      return: "2026-07-05",
      minPayload: "1000",
      sort: "price_desc",
    });
    expect(parseFilters(params)).toEqual({
      category: "cargo_van",
      pickup: "2026-07-01",
      return: "2026-07-05",
      minPayload: 1000,
      sort: "price_desc",
    });
  });

  it("drops unknown / malformed values to null instead of throwing", () => {
    const params = new URLSearchParams({
      category: "spaceship",
      pickup: "07/01/2026",
      return: "2026-13-99",
      minPayload: "-5",
      sort: "price_random",
    });
    expect(parseFilters(params)).toEqual({
      category: null,
      pickup: null,
      return: null,
      minPayload: null,
      sort: null,
    });
  });
});

describe("serializeFilters", () => {
  it("emits only the set keys", () => {
    const filters: VehicleFilters = {
      category: "passenger_van",
      pickup: null,
      return: null,
      minPayload: null,
      sort: "price_asc",
    };
    const params = serializeFilters(filters);
    expect(params.get("category")).toBe("passenger_van");
    expect(params.get("sort")).toBe("price_asc");
    expect(params.has("pickup")).toBe(false);
    expect(params.has("minPayload")).toBe(false);
  });

  it("round-trips any valid filters through parse", () => {
    const filters: VehicleFilters = {
      category: "refrigerated_truck",
      pickup: "2026-08-10",
      return: "2026-08-14",
      minPayload: 2000,
      sort: "price_desc",
    };
    expect(parseFilters(serializeFilters(filters))).toEqual(filters);
  });

  it("round-trips the empty filter set", () => {
    const empty: VehicleFilters = { category: null, pickup: null, return: null, minPayload: null, sort: null };
    expect(parseFilters(serializeFilters(empty))).toEqual(empty);
  });
});

describe("validateDateRange", () => {
  const TODAY = "2026-06-06";

  it("accepts an absent range (no date filter)", () => {
    expect(validateDateRange(null, null, TODAY)).toEqual({ ok: true });
  });

  it("accepts a valid future range", () => {
    expect(validateDateRange("2026-07-01", "2026-07-05", TODAY)).toEqual({ ok: true });
  });

  it("allows a pickup of today (same-day start is not a past pickup)", () => {
    expect(validateDateRange(TODAY, "2026-06-10", TODAY)).toEqual({ ok: true });
  });

  it("rejects a half-filled range as incomplete", () => {
    expect(validateDateRange("2026-07-01", null, TODAY).ok).toBe(false);
    expect(validateDateRange(null, "2026-07-05", TODAY).ok).toBe(false);
  });

  it("rejects a past pickup", () => {
    const result = validateDateRange("2026-06-01", "2026-06-10", TODAY);
    expect(result.ok).toBe(false);
  });

  it("rejects a return before the pickup", () => {
    const result = validateDateRange("2026-07-10", "2026-07-05", TODAY);
    expect(result.ok).toBe(false);
  });

  it("rejects a same-day range (empty booking window under the fixed hours)", () => {
    const result = validateDateRange("2026-07-01", "2026-07-01", TODAY);
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed date", () => {
    const result = validateDateRange("2026-7-1", "2026-07-05", TODAY);
    expect(result.ok).toBe(false);
  });
});
