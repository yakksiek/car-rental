// core
import { describe, expect, it } from "vitest";

// others
import { groupSearchRows } from "./search";
import type { SearchRow } from "../../types";

// Unit suite for the tagged-rows → grouped-results mapper (S-13). `search_staff`
// returns ONE union-shaped row per hit with the columns that don't apply to its
// `kind` left null, and supabase-js types every out-column as non-null — so this
// mapper is the single place that nullability is actually resolved. A row that
// slipped through half-populated would render as a card with an empty name and a
// dead link, which is why incomplete rows are dropped rather than coerced.

function row(overrides: Partial<SearchRow> & Pick<SearchRow, "kind">): SearchRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    reference: "R-0001",
    customer_name: "Krzysztof Wąsik",
    vehicle_id: "22222222-2222-2222-2222-222222222222",
    vehicle_name: "Mercedes Sprinter 315 CDI",
    vehicle_make: "Mercedes-Benz",
    vehicle_model: "Sprinter",
    vehicle_plate: "WX 5519M",
    vehicle_category: "cargo_van",
    pickup_date: "2026-04-02",
    return_date: "2026-04-09",
    status: "confirmed",
    daily_rate: "249.00",
    ...overrides,
  };
}

describe("groupSearchRows", () => {
  it("returns three empty groups for no rows", () => {
    expect(groupSearchRows([])).toEqual({ reservations: [], returns: [], vehicles: [] });
  });

  it("routes each kind into its own group", () => {
    const grouped = groupSearchRows([
      row({ kind: "reservation", id: "a" }),
      row({ kind: "return", id: "b", status: "due" }),
      row({ kind: "vehicle", id: "c", reference: null, customer_name: null, pickup_date: null, return_date: null, status: "active" }), // prettier-ignore
    ]);

    expect(grouped.reservations.map((r) => r.id)).toEqual(["a"]);
    expect(grouped.returns.map((r) => r.id)).toEqual(["b"]);
    expect(grouped.vehicles.map((v) => v.id)).toEqual(["c"]);
  });

  it("preserves the RPC's row order within a group (it already ranked them)", () => {
    const grouped = groupSearchRows([
      row({ kind: "reservation", id: "first" }),
      row({ kind: "vehicle", id: "v", reference: null, customer_name: null, pickup_date: null, return_date: null, status: "active" }), // prettier-ignore
      row({ kind: "reservation", id: "second" }),
    ]);
    expect(grouped.reservations.map((r) => r.id)).toEqual(["first", "second"]);
  });

  it("carries the reservation's fields through unchanged", () => {
    const [reservation] = groupSearchRows([row({ kind: "reservation" })]).reservations;
    expect(reservation).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      reference: "R-0001",
      customer_name: "Krzysztof Wąsik",
      vehicle_id: "22222222-2222-2222-2222-222222222222",
      vehicle_name: "Mercedes Sprinter 315 CDI",
      vehicle_make: "Mercedes-Benz",
      vehicle_model: "Sprinter",
      vehicle_plate: "WX 5519M",
      pickup_date: "2026-04-02",
      return_date: "2026-04-09",
      status: "confirmed",
      daily_rate: "249.00",
    });
  });

  it("keeps both return states", () => {
    const grouped = groupSearchRows([
      row({ kind: "return", id: "due", status: "due" }),
      row({ kind: "return", id: "done", status: "returned" }),
    ]);
    expect(grouped.returns.map((r) => `${r.id}:${r.status}`)).toEqual(["due:due", "done:returned"]);
  });

  it("drops a return row whose status is not one of the two the RPC emits", () => {
    expect(groupSearchRows([row({ kind: "return", status: "confirmed" })]).returns).toEqual([]);
  });

  it("maps a vehicle row's is_active from its status tag", () => {
    const base = { reference: null, customer_name: null, pickup_date: null, return_date: null } as const;
    const grouped = groupSearchRows([
      row({ kind: "vehicle", id: "on", status: "active", ...base }),
      row({ kind: "vehicle", id: "off", status: "inactive", ...base }),
    ]);
    expect(grouped.vehicles.map((v) => `${v.id}:${String(v.is_active)}`)).toEqual(["on:true", "off:false"]);
  });

  it("renames the vehicle row's columns off the union's vehicle_* prefix", () => {
    const [vehicle] = groupSearchRows([
      row({ kind: "vehicle", reference: null, customer_name: null, pickup_date: null, return_date: null, status: "active" }), // prettier-ignore
    ]).vehicles;
    expect(vehicle).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Mercedes Sprinter 315 CDI",
      make: "Mercedes-Benz",
      model: "Sprinter",
      plate: "WX 5519M",
      category: "cargo_van",
      is_active: true,
      daily_rate: "249.00",
    });
  });

  it("drops a reservation-shaped row missing a field its kind promises", () => {
    expect(groupSearchRows([row({ kind: "reservation", customer_name: null })]).reservations).toEqual([]);
    expect(groupSearchRows([row({ kind: "reservation", reference: null })]).reservations).toEqual([]);
    expect(groupSearchRows([row({ kind: "return", status: "due", pickup_date: null })]).returns).toEqual([]);
  });

  it("ignores an unknown kind rather than guessing a group for it", () => {
    expect(groupSearchRows([row({ kind: "customer" })])).toEqual({ reservations: [], returns: [], vehicles: [] });
  });
});
