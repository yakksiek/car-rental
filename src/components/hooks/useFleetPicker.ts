// core
import * as React from "react";

// others
import type { PickerVehicle } from "../../types";

// The bookable fleet behind the quick-action menu's "Nowa rezerwacja" row
// (S-12b). Nothing is fetched on page load: the seven-column projection is
// pulled from `GET /api/vehicles` only when a staffer actually picks that row,
// which is why mounting the trigger on every staff page costs no SSR work.

export type FleetPickerState = "idle" | "loading" | "ready" | "error";

export interface FleetPicker {
  vehicles: PickerVehicle[] | null;
  state: FleetPickerState;
  /**
   * Fetch the fleet, resolving to it (or `null` on failure). Idempotent: a call
   * while a request is in flight joins that request, and a call after a success
   * resolves from cache — so opening and closing the menu repeatedly issues
   * exactly one `/api/vehicles` request per page view.
   *
   * Resolving rather than firing an effect is deliberate: it lets the caller
   * open the modal in the same continuation as the pick, with no setState in an
   * effect and no cascading render.
   */
  load: () => Promise<PickerVehicle[] | null>;
}

export function useFleetPicker(): FleetPicker {
  const [vehicles, setVehicles] = React.useState<PickerVehicle[] | null>(null);
  const [state, setState] = React.useState<FleetPickerState>("idle");

  // Refs, not state: `load` is handed to a click handler that can fire twice
  // before React re-renders, and a stale closure over `state` would let the
  // second call through. Both are written synchronously.
  const cached = React.useRef<PickerVehicle[] | null>(null);
  const inFlight = React.useRef<Promise<PickerVehicle[] | null> | null>(null);

  const load = React.useCallback(() => {
    if (cached.current) {
      return Promise.resolve(cached.current);
    }
    if (inFlight.current) {
      return inFlight.current;
    }

    setState("loading");
    const request = (async () => {
      try {
        const res = await fetch("/api/vehicles", { headers: { Accept: "application/json" } });
        if (!res.ok) {
          throw new Error(`GET /api/vehicles → ${String(res.status)}`);
        }
        const body = (await res.json()) as { vehicles: PickerVehicle[] };
        cached.current = body.vehicles;
        setVehicles(body.vehicles);
        setState("ready");
        return body.vehicles;
      } catch {
        // D6 `deviation(error-state)`: surface a retryable failure rather than
        // opening a modal onto an empty picker. Clearing `inFlight` is what
        // makes the next pick a genuine retry.
        setState("error");
        return null;
      } finally {
        inFlight.current = null;
      }
    })();

    inFlight.current = request;
    return request;
  }, []);

  return { vehicles, state, load };
}
