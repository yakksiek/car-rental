// core
import * as React from "react";

// The manual-reservation create (S-12), mirroring `useReservationDecision`: it
// owns the POST and classifies its response; no UI here.
//
// The availability half used to live alongside it as a DEBOUNCED
// availability GET. S-12a retired both — the route is gone: the panel resolves locally
// from `resolveAvailability` over `useVehicleBusyRanges`, so the only network
// call left on this surface is the create itself (plus that hook's one read per
// vehicle selection, and its pre-flight re-read at submit time).
//
// The pre-flight answer is still advisory — it can go stale between the re-read
// and the write — so `create` still classifies a 409 `conflict`. The EXCLUDE
// constraint inside `create_confirmed_reservation` is the authority.

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
