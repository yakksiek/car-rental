// core
import { describe, expect, it } from "vitest";

// others
import { stepperFor } from "./reservation-status";

describe("stepperFor", () => {
  it("pending: waiting step is current, the rest upcoming", () => {
    expect(stepperFor("pending")).toEqual([
      { key: "pending", label: "Oczekuje na akceptację", state: "current" },
      { key: "decision", label: "Potwierdzenie e-mailem", state: "upcoming" },
      { key: "pickup", label: "Odbiór", state: "upcoming" },
    ]);
  });

  it("confirmed: decision done, pickup becomes current", () => {
    expect(stepperFor("confirmed")).toEqual([
      { key: "pending", label: "Oczekuje na akceptację", state: "done" },
      { key: "decision", label: "Potwierdzenie e-mailem", state: "done" },
      { key: "pickup", label: "Odbiór", state: "current" },
    ]);
  });

  it("rejected: terminal branch replaces the decision step, no pickup", () => {
    expect(stepperFor("rejected")).toEqual([
      { key: "pending", label: "Oczekuje na akceptację", state: "done" },
      { key: "decision", label: "Odrzucone", state: "current" },
    ]);
  });

  it("cancelled: terminal branch like rejected", () => {
    expect(stepperFor("cancelled")).toEqual([
      { key: "pending", label: "Oczekuje na akceptację", state: "done" },
      { key: "decision", label: "Anulowane", state: "current" },
    ]);
  });
});
