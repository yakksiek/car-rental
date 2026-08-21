// core
import * as React from "react";

// others
import type { VehicleBusyRange } from "../../types";

// The manual-reservation modal's availability data path (S-12a). One read per
// vehicle selection — date bounds only, floored to current+future ranges by the
// RPC — replacing the debounced per-keystroke `GET /api/availability` the panel
// used to lean on. From Phase 3 the panel resolves locally over these ranges, so
// this hook's `state` IS the panel's `checking` / `error`.
//
// FAILS CLOSED. A non-OK response — including the route's own fail-closed 500 —
// resolves to `error` and never to empty ranges: an empty list is
// indistinguishable from a genuinely free vehicle, and `resolveAvailability`
// would answer `available` over it and arm the submit button.
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
  const res = await fetch(busyRangesUrl(vehicleId), signal ? { signal } : undefined);
  if (!res.ok) {
    throw new Error(`busy-ranges read failed: ${String(res.status)}`);
  }
  const body = (await res.json()) as { ranges: VehicleBusyRange[] };
  return body.ranges;
}

export function useVehicleBusyRanges(vehicleId: string): VehicleBusyRangesHandle {
  const [ranges, setRanges] = React.useState<VehicleBusyRange[]>([]);
  const [state, setState] = React.useState<BusyRangesState>(vehicleId ? "loading" : "ready");

  // React's documented "adjust state when the inputs change" pattern, as
  // `useAvailability` uses it: a render-phase reset, so the previous vehicle's
  // greying is dropped in the same render the selection changed rather than one
  // paint later — the calendar must never paint another vehicle's busy days.
  const [lastVehicleId, setLastVehicleId] = React.useState(vehicleId);
  if (lastVehicleId !== vehicleId) {
    setLastVehicleId(vehicleId);
    setRanges([]);
    setState(vehicleId ? "loading" : "ready");
  }

  // The id the UI is currently showing. A response is only committed when it
  // still matches, so a `refetch` in flight across a vehicle switch cannot paint
  // the old vehicle's ranges over the new one's (the effect has an
  // AbortController for that; `refetch` is caller-driven and has none). Assigned
  // in the effect, not during render — `refetch` is only ever called from an
  // event handler, which always runs after the commit that set it.
  const currentId = React.useRef(vehicleId);

  React.useEffect(() => {
    currentId.current = vehicleId;
    if (!vehicleId) {
      return;
    }

    const controller = new AbortController();
    readBusyRanges(vehicleId, controller.signal)
      .then((fresh) => {
        setRanges(fresh);
        setState("ready");
      })
      .catch((error: unknown) => {
        // An abort is a superseded fetch, not a failure — the newer effect run
        // (or the unmount) owns the answer now.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setRanges([]);
        setState("error");
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
      if (currentId.current === vehicleId) {
        setRanges(fresh);
        setState("ready");
      }
      return fresh;
    } catch {
      if (currentId.current === vehicleId) {
        setRanges([]);
        setState("error");
      }
      return null;
    }
  }, [vehicleId]);

  return { ranges, state, refetch };
}
