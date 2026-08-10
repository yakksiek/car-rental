// others
import { validateDateRange } from "./catalog-filters";

// The manual-reservation availability panel's state, and the pure part of the
// decision that drives it (S-12).
//
// Split out of `useManualReservation` because everything except the fetch is a
// pure function of (vehicle, pickup, return): whether we can even ask the server,
// and what to show while we cannot. Keeping it here makes the state machine
// unit-testable without a DOM or a network stub.

export type AvailabilityState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "invalid"; message: string }
  | { state: "available" }
  | { state: "conflict" }
  | { state: "error" };

/**
 * What the panel should show BEFORE any network call.
 *
 * - `idle` — the form is incomplete, so there is nothing to ask about.
 * - `invalid` — the range itself is wrong (past pickup / same-day / inverted);
 *   carries the message from `validateDateRange`, the app's single source for
 *   that rule (shared with the picker, the schema and the EXCLUDE constraint).
 * - `check` — the input is well-formed; the caller may query the server.
 */
export function classifyAvailabilityInput(
  vehicleId: string,
  pickup: string,
  returnDate: string,
): { kind: "idle" } | { kind: "invalid"; message: string } | { kind: "check" } {
  if (!vehicleId || !pickup || !returnDate) {
    return { kind: "idle" };
  }

  const range = validateDateRange(pickup, returnDate);
  if (!range.ok) {
    return { kind: "invalid", message: range.error };
  }

  return { kind: "check" };
}

/** Can the booking be submitted? Availability must be confirmed AND the form valid. */
export function canCreateReservation(availability: AvailabilityState, customerValid: boolean): boolean {
  return availability.state === "available" && customerValid;
}
