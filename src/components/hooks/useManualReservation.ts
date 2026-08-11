// core
import * as React from "react";

// others
import { classifyAvailabilityInput, type AvailabilityState } from "../../lib/manual-availability";

// The manual-reservation mechanism (S-12), mirroring `useReservationDecision`:
// it owns the two network calls and classifies their responses; no UI here.
//
//   * a DEBOUNCED GET /api/availability whenever vehicle/pickup/return change,
//     driving the availability panel's state,
//   * the POST /api/reservations/manual create, with an in-flight `busy` flag.
//
// The availability answer is advisory — it can go stale between the check and
// the submit — so `create` still classifies a 409 `conflict`. The EXCLUDE
// constraint behind the endpoint is the authority.

// Matches the mockup's 420ms debounce: long enough that typing a date does not
// fire a request per keystroke, short enough that the panel feels live.
const DEBOUNCE_MS = 420;

export type ManualCreateOutcome =
  | { status: "created"; reference: string }
  | { status: "conflict" }
  | { status: "unavailable" }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "error" };

export interface ManualReservationPayload {
  vehicle_id: string;
  pickup: string;
  return: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}

export interface AvailabilityHandle {
  availability: AvailabilityState;
  /**
   * Force the panel to `conflict`. The create is the only other source of truth
   * about this range — a lost race answers 409 long after the GET said "free" —
   * and without this the panel would keep showing the stale green state (and
   * keep the submit button armed for an identical retry).
   */
  markConflict: () => void;
}

/**
 * Debounced availability lookup for the current (vehicle, pickup, return).
 * Returns `idle`/`invalid` without a request when the input cannot be asked
 * about; otherwise goes `checking` → `available`/`conflict`/`error`.
 */
export function useAvailability(vehicleId: string, pickup: string, returnDate: string): AvailabilityHandle {
  const classified = classifyAvailabilityInput(vehicleId, pickup, returnDate);

  // Only the SERVER's answer is stored; `idle` / `invalid` / `checking` are
  // derived below. Keeping the pre-network states out of state is what lets the
  // effect do nothing but fetch — no synchronous setState, no cascading render.
  const [resolved, setResolved] = React.useState<AvailabilityState | null>(null);

  // React's documented "adjust state when the inputs change" pattern: a
  // render-phase reset, so a stale answer is dropped in the same render the
  // inputs changed rather than one paint later.
  const inputKey = `${vehicleId}|${pickup}|${returnDate}`;
  const [lastKey, setLastKey] = React.useState(inputKey);
  if (lastKey !== inputKey) {
    setLastKey(inputKey);
    setResolved(null);
  }

  React.useEffect(() => {
    if (classified.kind !== "check") {
      return;
    }

    // An AbortController alongside the debounce timer: the timer stops a request
    // that has not started, the controller drops one already in flight, so a
    // fast edit can never let a stale answer overwrite a newer one.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ vehicle_id: vehicleId, pickup, return: returnDate });
      fetch(`/api/availability?${query.toString()}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`availability check failed: ${String(res.status)}`);
          }
          const body = (await res.json()) as { available: boolean };
          setResolved(body.available ? { state: "available" } : { state: "conflict" });
        })
        .catch((error: unknown) => {
          // An abort is a superseded check, not a failure — the newer effect run
          // owns the answer now.
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setResolved({ state: "error" });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [vehicleId, pickup, returnDate, classified.kind]);

  // Writes into the SAME slot the fetch resolves into, so there is one source of
  // truth for the panel. No clearing is needed on top: the render-phase reset
  // above drops it the moment vehicle/pickup/return changes, which re-checks.
  const markConflict = React.useCallback(() => {
    setResolved({ state: "conflict" });
  }, []);

  if (classified.kind === "idle") {
    return { availability: { state: "idle" }, markConflict };
  }
  if (classified.kind === "invalid") {
    return { availability: { state: "invalid", message: classified.message }, markConflict };
  }
  // Well-formed input with no answer yet — the debounce or the request is in
  // flight.
  return { availability: resolved ?? { state: "checking" }, markConflict };
}

/**
 * `create(...)` POSTs the booking and returns a typed outcome while tracking an
 * in-flight `busy` flag (so the caller can show the submit button's pending
 * state). The caller decides how to reflect the outcome.
 */
export function useManualReservation() {
  const [busy, setBusy] = React.useState(false);

  const create = React.useCallback(async (payload: ManualReservationPayload): Promise<ManualCreateOutcome> => {
    setBusy(true);
    try {
      const res = await fetch("/api/reservations/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        const body = (await res.json()) as { reference: string };
        return { status: "created", reference: body.reference };
      }
      if (res.status === 409) {
        const body = (await res.json()) as { reason?: string };
        return body.reason === "unavailable" ? { status: "unavailable" } : { status: "conflict" };
      }
      if (res.status === 400) {
        const body = (await res.json()) as { errors?: Record<string, string> };
        return { status: "invalid", errors: body.errors ?? {} };
      }
      return { status: "error" };
    } catch {
      return { status: "error" };
    } finally {
      // Reset even on the success path: the caller swaps to the done panel, so
      // the button unmounts before a stale pending state could be seen.
      setBusy(false);
    }
  }, []);

  return { busy, create };
}
