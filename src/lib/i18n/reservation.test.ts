// core
import { describe, expect, it } from "vitest";

// others
import { rejectionReasonLabel, reservationStatusLabel } from "./reservation";

describe("reservationStatusLabel", () => {
  it("maps every status in both locales", () => {
    expect(reservationStatusLabel("pending", "pl")).toBe("Oczekuje");
    expect(reservationStatusLabel("confirmed", "pl")).toBe("Potwierdzone");
    expect(reservationStatusLabel("rejected", "pl")).toBe("Odrzucone");
    expect(reservationStatusLabel("cancelled", "pl")).toBe("Anulowane");

    expect(reservationStatusLabel("pending", "en")).toBe("Pending");
    expect(reservationStatusLabel("confirmed", "en")).toBe("Confirmed");
    expect(reservationStatusLabel("rejected", "en")).toBe("Rejected");
    expect(reservationStatusLabel("cancelled", "en")).toBe("Cancelled");
  });
});

describe("rejectionReasonLabel", () => {
  it("maps every canned reason in both locales", () => {
    expect(rejectionReasonLabel("dates_unavailable", "pl")).toBe("Daty już niedostępne");
    expect(rejectionReasonLabel("no_category", "pl")).toBe("Brak wymaganej kategorii");
    expect(rejectionReasonLabel("vehicle_withdrawn", "pl")).toBe("Pojazd wycofany");
    expect(rejectionReasonLabel("other", "pl")).toBe("Inny");

    expect(rejectionReasonLabel("dates_unavailable", "en")).toBe("Dates no longer available");
    expect(rejectionReasonLabel("no_category", "en")).toBe("Missing licence category");
    expect(rejectionReasonLabel("vehicle_withdrawn", "en")).toBe("Vehicle withdrawn");
    expect(rejectionReasonLabel("other", "en")).toBe("Other");
  });
});
