// core
import { describe, expect, it } from "vitest";

// others
import { canCreateReservation, classifyAvailabilityInput } from "./manual-availability";

// The pure half of the manual-reservation availability panel (S-12). What is
// asserted here is the GATE: which inputs are even allowed to reach the server,
// and which are refused locally with a message. The network half lives in the
// hook and is covered by the endpoint's integration suite.

// Far-future so the past-pickup rule never fires by accident as time passes.
const VEHICLE = "11111111-1111-1111-1111-111111111111";

describe("classifyAvailabilityInput", () => {
  it("is idle until vehicle, pickup and return are all present", () => {
    expect(classifyAvailabilityInput("", "2032-04-01", "2032-04-05").kind).toBe("idle");
    expect(classifyAvailabilityInput(VEHICLE, "", "2032-04-05").kind).toBe("idle");
    expect(classifyAvailabilityInput(VEHICLE, "2032-04-01", "").kind).toBe("idle");
  });

  it("is invalid with a message when the return precedes the pickup", () => {
    const result = classifyAvailabilityInput(VEHICLE, "2032-04-10", "2032-04-05");
    expect(result.kind).toBe("invalid");
    expect(result.kind === "invalid" && result.message.length).toBeGreaterThan(0);
  });

  it("is invalid for a same-day range (the half-open window needs start < end)", () => {
    expect(classifyAvailabilityInput(VEHICLE, "2032-04-01", "2032-04-01").kind).toBe("invalid");
  });

  it("is invalid for a pickup in the past", () => {
    expect(classifyAvailabilityInput(VEHICLE, "2020-01-01", "2020-01-05").kind).toBe("invalid");
  });

  it("asks the server once the input is complete and the range is well-formed", () => {
    expect(classifyAvailabilityInput(VEHICLE, "2032-04-01", "2032-04-05").kind).toBe("check");
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
