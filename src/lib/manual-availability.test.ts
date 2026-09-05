// core
import { describe, expect, it } from "vitest";

// others
import { canCreateReservation, resolveAvailability } from "./manual-availability";
import type { VehicleBusyRange } from "../types";

// The whole manual-reservation availability decision (S-12, rewritten in S-12a).
// What is asserted here is the PRECEDENCE: which answer wins when more than one
// could apply, and which states leave the submit button disarmed. The network
// half is one read per vehicle, covered by the route's integration suite.

// Far-future so the past-pickup rule never fires by accident as time passes.
const VEHICLE = "11111111-1111-1111-1111-111111111111";

const NONE: VehicleBusyRange[] = [];
/** A booking 2032-04-10 14:00 → 2032-04-15 10:00 on the vehicle under test. */
const BUSY: VehicleBusyRange[] = [{ pickup_date: "2032-04-10", return_date: "2032-04-15" }];

describe("resolveAvailability", () => {
  it("is idle until vehicle, pickup and return are all present", () => {
    expect(resolveAvailability("", "2032-04-01", "2032-04-05", NONE, "ready", "en").state).toBe("idle");
    expect(resolveAvailability(VEHICLE, "", "2032-04-05", NONE, "ready", "en").state).toBe("idle");
    expect(resolveAvailability(VEHICLE, "2032-04-01", "", NONE, "ready", "en").state).toBe("idle");
  });

  it("is idle even while the ranges are loading — there is nothing to resolve yet", () => {
    expect(resolveAvailability("", "2032-04-01", "2032-04-05", NONE, "loading", "en").state).toBe("idle");
  });

  it("is invalid with a message when the return precedes the pickup", () => {
    const result = resolveAvailability(VEHICLE, "2032-04-10", "2032-04-05", NONE, "ready", "en");
    expect(result.state).toBe("invalid");
    expect(result.state === "invalid" && result.message.length).toBeGreaterThan(0);
  });

  it("is invalid for a same-day range (the half-open window needs start < end)", () => {
    expect(resolveAvailability(VEHICLE, "2032-04-01", "2032-04-01", NONE, "ready", "en").state).toBe("invalid");
  });

  it("is invalid for a pickup in the past", () => {
    expect(resolveAvailability(VEHICLE, "2020-01-01", "2020-01-05", NONE, "ready", "en").state).toBe("invalid");
  });

  it("invalid beats a loading fetch — the range is wrong whatever the vehicle is booked for", () => {
    expect(resolveAvailability(VEHICLE, "2032-04-10", "2032-04-05", NONE, "loading", "en").state).toBe("invalid");
  });

  it("is error when the ranges read failed, and error beats a would-be available answer", () => {
    const result = resolveAvailability(VEHICLE, "2032-04-01", "2032-04-05", NONE, "error", "en");
    expect(result.state).toBe("error");
    // The safe default the whole fail-closed chain exists for: a failed read
    // must never arm the submit button.
    expect(canCreateReservation(result, true)).toBe(false);
  });

  it("is checking while the read is in flight", () => {
    expect(resolveAvailability(VEHICLE, "2032-04-01", "2032-04-05", NONE, "loading", "en").state).toBe("checking");
  });

  it("is available for a free range once the ranges are ready", () => {
    expect(resolveAvailability(VEHICLE, "2032-04-01", "2032-04-05", NONE, "ready", "en").state).toBe("available");
    expect(resolveAvailability(VEHICLE, "2032-04-01", "2032-04-05", BUSY, "ready", "en").state).toBe("available");
  });

  it("is conflict for a range that collides with a busy range", () => {
    // Spans the booking's interior.
    expect(resolveAvailability(VEHICLE, "2032-04-11", "2032-04-13", BUSY, "ready", "en").state).toBe("conflict");
    // Ends on the booking's return day — morning taken (a `pickupOnly` day).
    expect(resolveAvailability(VEHICLE, "2032-04-08", "2032-04-15", BUSY, "ready", "en").state).toBe("conflict");
  });

  it("accepts the half-day changeovers the EXCLUDE window leaves free", () => {
    // Ends on the booking's PICKUP day: the morning is still free.
    expect(resolveAvailability(VEHICLE, "2032-04-06", "2032-04-10", BUSY, "ready", "en").state).toBe("available");
    // Starts on the booking's RETURN day: the afternoon is still free.
    expect(resolveAvailability(VEHICLE, "2032-04-15", "2032-04-18", BUSY, "ready", "en").state).toBe("available");
  });
});

describe("canCreateReservation", () => {
  it("requires BOTH a confirmed-available slot and a valid customer", () => {
    expect(canCreateReservation({ state: "available" }, true)).toBe(true);
    expect(canCreateReservation({ state: "available" }, false)).toBe(false);
  });

  it("refuses every non-available state, even with a valid customer", () => {
    for (const state of [
      { state: "idle" },
      { state: "checking" },
      { state: "conflict" },
      { state: "error" },
    ] as const) {
      expect(canCreateReservation(state, true)).toBe(false);
    }
    expect(canCreateReservation({ state: "invalid", message: "x" }, true)).toBe(false);
  });
});
