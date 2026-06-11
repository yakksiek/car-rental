// core
import { describe, expect, it } from "vitest";

// others
import { stepperFor } from "./reservation-status";

describe("stepperFor", () => {
  it("pending: waiting step is current, the rest upcoming", () => {
    expect(stepperFor("pending")).toEqual([
      expect.objectContaining({ key: "pending", label: "Oczekuje na akceptację", state: "current" }),
      expect.objectContaining({ key: "decision", label: "Potwierdzenie e-mailem", state: "upcoming" }),
      expect.objectContaining({ key: "pickup", label: "Odbiór", state: "upcoming" }),
    ]);
  });

  it("confirmed: decision done, pickup becomes current", () => {
    expect(stepperFor("confirmed")).toEqual([
      expect.objectContaining({ key: "pending", label: "Oczekuje na akceptację", state: "done" }),
      expect.objectContaining({ key: "decision", label: "Potwierdzenie e-mailem", state: "done" }),
      expect.objectContaining({ key: "pickup", label: "Odbiór", state: "current" }),
    ]);
  });

  it("rejected: terminal branch replaces the decision step, no pickup", () => {
    expect(stepperFor("rejected")).toEqual([
      expect.objectContaining({ key: "pending", label: "Oczekuje na akceptację", state: "done" }),
      expect.objectContaining({ key: "decision", label: "Odrzucone", state: "current" }),
    ]);
  });

  it("cancelled: terminal branch like rejected", () => {
    expect(stepperFor("cancelled")).toEqual([
      expect.objectContaining({ key: "pending", label: "Oczekuje na akceptację", state: "done" }),
      expect.objectContaining({ key: "decision", label: "Anulowane", state: "current" }),
    ]);
  });

  it("every step carries a non-empty Polish description", () => {
    for (const status of ["pending", "confirmed", "rejected", "cancelled"] as const) {
      for (const step of stepperFor(status)) {
        expect(step.description.length).toBeGreaterThan(0);
      }
    }
  });
});
