// core
import { describe, expect, it } from "vitest";

// others
import { reservationsToEvents, vehiclesToResources } from "./map";
import type { CalendarReservation, Vehicle } from "../../types";

function reservation(overrides: Partial<CalendarReservation> = {}): CalendarReservation {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    reference: "R-0001",
    status: "pending",
    customer_name: "Jan Kowalski",
    vehicle_id: "22222222-2222-2222-2222-222222222222",
    vehicle_make: "Volkswagen",
    vehicle_model: "Crafter",
    pickup_date: "2026-04-02",
    return_date: "2026-04-09",
    ...overrides,
  };
}

describe("reservationsToEvents", () => {
  it("places start at 14:00 and end at 10:00 Warsaw time", () => {
    const [event] = reservationsToEvents([reservation()]);
    // CEST (+02:00) in April — wall-clock 14:00 / 10:00 preserved.
    expect(event.start).toContain("T14:00:00");
    expect(event.end).toContain("T10:00:00");
    expect(event.start).toContain("2026-04-02");
    expect(event.end).toContain("2026-04-09");
  });

  it("does not create a false overlap on a same-day turnover", () => {
    // Vehicle returned 2026-04-09 10:00; next pickup 2026-04-09 14:00 — adjacent,
    // not overlapping (the 4h changeover buffer).
    const returning = reservation({ id: "a", pickup_date: "2026-04-02", return_date: "2026-04-09" });
    const next = reservation({ id: "b", pickup_date: "2026-04-09", return_date: "2026-04-12" });
    const [ev1, ev2] = reservationsToEvents([returning, next]);
    expect(new Date(ev1.end).getTime()).toBeLessThan(new Date(ev2.start).getTime());
  });

  it("maps status to distinct colours (pending amber, confirmed green)", () => {
    const [pending] = reservationsToEvents([reservation({ status: "pending" })]);
    const [confirmed] = reservationsToEvents([reservation({ status: "confirmed" })]);
    expect(pending.backgroundColor).not.toBe(confirmed.backgroundColor);
    expect(pending.color).toBe("#B6790E");
    expect(confirmed.color).toBe("#1B9E5A");
  });

  it("carries id/uid/title/resourceId from the reservation", () => {
    const [event] = reservationsToEvents([reservation()]);
    expect(event.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(event.uid).toBe("11111111-1111-1111-1111-111111111111");
    expect(event.title).toBe("Jan Kowalski");
    expect(event.resourceId).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("returns [] for empty input", () => {
    expect(reservationsToEvents([])).toEqual([]);
  });
});

describe("vehiclesToResources", () => {
  function vehicle(): Vehicle {
    return { id: "v1", name: "Pojazd 1", make: "Renault", model: "Master" } as Vehicle;
  }

  it("maps id and a make+model title", () => {
    const [resource] = vehiclesToResources([vehicle()]);
    expect(resource.id).toBe("v1");
    expect(resource.title).toBe("Renault Master");
  });

  it("falls back to name when make/model are absent", () => {
    const [resource] = vehiclesToResources([{ id: "v2", name: "Bus 7", make: null, model: null } as Vehicle]);
    expect(resource.title).toBe("Bus 7");
  });

  it("returns [] for empty input", () => {
    expect(vehiclesToResources([])).toEqual([]);
  });
});
