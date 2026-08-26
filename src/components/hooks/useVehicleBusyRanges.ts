// core
import * as React from "react";

// others
import type { VehicleBusyRange } from "../../types";

// The manual-reservation modal's availability data path (S-12a). One read per
// vehicle selection — date bounds only, floored to current+future ranges by the
// RPC — replacing the debounced per-keystroke availability GET the panel used to
// lean on (a route S-12a deletes). From Phase 3 the panel resolves locally over
// these ranges, so this hook's `state` IS the panel's `checking` / `error`.
//
// FAILS CLOSED. A non-OK response — including the route's own fail-closed 500 —
// resolves to `error` and never to a `ready` empty list: empty is
// indistinguishable from a genuinely free vehicle, and `resolveAvailability`
// would answer `available` over it and arm the submit button.
//
// The two failures differ in what they leave on screen. A failed FIRST read has
// nothing to show, so it commits empty ranges. A failed RE-read (`refetch`)
// keeps the ranges it already had and only moves `state` to `error` — throwing
// away a good answer would blank the grid the employee is reading from, and the
// `error` state disarms submit either way.
//
// No debounce: this fires on a discrete vehicle selection, not on typing.

export type BusyRangesState = "loading" | "ready" | "error";

export interface VehicleBusyRangesHandle {
  ranges: VehicleBusyRange[];
  state: BusyRangesState;
  /**
   * Re-read the current vehicle on demand, resolving to the fresh ranges (or
   * `null` if the read failed). The create's pre-flight: ranges fetched once per
   * vehicle selection would otherwise be judged against a snapshot as old as the
   * phone call, so the verdict that gates the write is re-read at the moment of
   * the write.
   */
  refetch: () => Promise<VehicleBusyRange[] | null>;
}

function busyRangesUrl(vehicleId: string): string {
  return `/api/vehicles/${encodeURIComponent(vehicleId)}/busy-ranges`;
}

async function readBusyRanges(vehicleId: string, signal?: AbortSignal): Promise<VehicleBusyRange[]> {
  const res = await fetch(busyRangesUrl(vehicleId), {
    // The pre-flight (Phase 3 §4) exists so the answer that gates the write is
    // re-read AT the moment of the write. A cached 200 would satisfy the call
    // and silently reopen the staleness window the whole re-read is there to
    // close — so the read must never be served from cache.
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) {
    throw new Error(`busy-ranges read failed: ${String(res.status)}`);
  }
  const body = (await res.json()) as { ranges: VehicleBusyRange[] };
  return body.ranges;
}

/**
 * What was read, and WHICH VEHICLE it was read for. Stamping the id onto the
 * answer is what makes a superseded response harmless: it is compared against
 * the currently-selected vehicle during render, so an answer that no longer
 * matches is simply not shown.
 */
interface BusyRangesData {
  vehicleId: string;
  ranges: VehicleBusyRange[];
  state: BusyRangesState;
}

export function useVehicleBusyRanges(vehicleId: string): VehicleBusyRangesHandle {
  const [data, setData] = React.useState<BusyRangesData>(() => ({
    vehicleId,
    ranges: [],
    state: vehicleId ? "loading" : "ready",
  }));

  // The whole identity guard, derived rather than reset. An answer for another
  // vehicle is ignored in the same render the selection changed — so the
  // calendar can never paint another vehicle's busy days, and there is no
  // render-phase write of any kind to make it true.
  //
  // This replaces an earlier reset-plus-ref arrangement. The ref had to be
  // assigned DURING RENDER to be early enough (assigning it in the effect left a
  // window: on a switch A→B the reset commits synchronously, but the effect's
  // cleanup — and so `controller.abort()` — only runs when React flushes passive
  // effects, a task later, and a response for A landing in between was neither
  // aborted nor filtered). A render-phase ref write is what `react-hooks/refs`
  // forbids, and rightly. Deriving needs no write at all and closes the same
  // window by construction.
  //
  // One deliberate behaviour change came with dropping the reset: the reset used
  // to blank on EVERY vehicle change, so returning to a vehicle re-showed
  // `loading`. Now A→B→A matches on re-entry and re-shows A's last answer
  // immediately, with no loading beat, while the fresh read runs. That is the
  // right vehicle's data and never another's — and the panel's verdict is only
  // ever advisory anyway: `submit()` re-reads through `refetch` before it POSTs,
  // and the EXCLUDE constraint is the authority on the write.
  const matches = data.vehicleId === vehicleId;
  const ranges = matches ? data.ranges : [];
  const state: BusyRangesState = matches ? data.state : vehicleId ? "loading" : "ready";

  React.useEffect(() => {
    if (!vehicleId) {
      return;
    }

    const controller = new AbortController();
    readBusyRanges(vehicleId, controller.signal)
      .then((fresh) => {
        setData({ vehicleId, ranges: fresh, state: "ready" });
      })
      .catch((error: unknown) => {
        // An abort is a superseded fetch, not a failure — the newer effect run
        // (or the unmount) owns the answer now.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setData({ vehicleId, ranges: [], state: "error" });
      });

    return () => {
      controller.abort();
    };
  }, [vehicleId]);

  const refetch = React.useCallback(async (): Promise<VehicleBusyRange[] | null> => {
    if (!vehicleId) {
      return null;
    }
    try {
      const fresh = await readBusyRanges(vehicleId);
      // Guarded against the reverse order — a re-read for the PREVIOUS vehicle
      // landing after the new one's effect has already answered. `prev.vehicleId`
      // is whatever is on screen, so it only matches while this read is still the
      // relevant one; the render-time derivation handles every other case.
      setData((prev) => (prev.vehicleId === vehicleId ? { vehicleId, ranges: fresh, state: "ready" } : prev));
      return fresh;
    } catch {
      setData((prev) =>
        prev.vehicleId === vehicleId
          ? // `ranges` is deliberately CARRIED OVER — unlike the initial read, a
            // failed re-read already has a good earlier answer on screen, and
            // discarding it would blank the grid the employee is reading from.
            // Nothing is made unsafe by keeping it: `state: "error"` resolves the
            // panel to `error`, and `canCreateReservation` only ever passes
            // `available`, so submit stays disarmed either way.
            { ...prev, state: "error" }
          : prev,
      );
      return null;
    }
  }, [vehicleId]);

  return { ranges, state, refetch };
}
