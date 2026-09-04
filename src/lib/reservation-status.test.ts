// core
import { describe, expect, it } from "vitest";

// others
import { LOCALES } from "./i18n/types";
import { stepperFor } from "./reservation-status";

// The STRUCTURE (which steps, in what order, in which state) cannot vary by
// locale, so the structural cases run against the default and the labels come
// from the locale they were asked for. The `renders in the active locale` case
// at the bottom is what proves the split is real rather than a fallback quietly
// serving English to a Polish reader.
describe("stepperFor", () => {
  it("pending: waiting step is current, the rest upcoming", () => {
    expect(stepperFor("pending", "en")).toEqual([
      expect.objectContaining({ key: "pending", label: "Waiting for approval", state: "current" }),
      expect.objectContaining({ key: "decision", label: "Confirmation by email", state: "upcoming" }),
      expect.objectContaining({ key: "pickup", label: "Pickup", state: "upcoming" }),
    ]);
  });

  it("confirmed: decision done, pickup becomes current", () => {
    expect(stepperFor("confirmed", "en")).toEqual([
      expect.objectContaining({ key: "pending", label: "Waiting for approval", state: "done" }),
      expect.objectContaining({ key: "decision", label: "Confirmation by email", state: "done" }),
      expect.objectContaining({ key: "pickup", label: "Pickup", state: "current" }),
    ]);
  });

  it("rejected: terminal branch replaces the decision step, no pickup", () => {
    expect(stepperFor("rejected", "en")).toEqual([
      expect.objectContaining({ key: "pending", label: "Waiting for approval", state: "done" }),
      expect.objectContaining({ key: "decision", label: "Rejected", state: "current" }),
    ]);
  });

  it("cancelled: terminal branch like rejected", () => {
    expect(stepperFor("cancelled", "en")).toEqual([
      expect.objectContaining({ key: "pending", label: "Waiting for approval", state: "done" }),
      expect.objectContaining({ key: "decision", label: "Cancelled", state: "current" }),
    ]);
  });

  it("every step carries a non-empty description in every locale", () => {
    for (const locale of LOCALES) {
      for (const status of ["pending", "confirmed", "rejected", "cancelled"] as const) {
        for (const step of stepperFor(status, locale)) {
          expect(step.description.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("renders its labels in the active locale", () => {
    expect(stepperFor("pending", "pl")).toEqual([
      expect.objectContaining({ key: "pending", label: "Oczekuje na akceptację", state: "current" }),
      expect.objectContaining({ key: "decision", label: "Potwierdzenie e-mailem", state: "upcoming" }),
      expect.objectContaining({ key: "pickup", label: "Odbiór", state: "upcoming" }),
    ]);
    expect(stepperFor("cancelled", "pl")[1]).toEqual(
      expect.objectContaining({ key: "decision", label: "Anulowane", state: "current" }),
    );
  });
});
