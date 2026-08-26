// core
import * as React from "react";

/**
 * Subscribes to a CSS media query, so a component can branch its *structure* —
 * not just its styling — on the breakpoint. Reach for this only when Tailwind's
 * responsive variants genuinely cannot express the change: rendering the same
 * subtree in two different places (in flow vs. as an overlay layer) is one such
 * case, since duplicating it under `hidden`/`md:hidden` would mount two live
 * copies of the same interactive widget.
 *
 * The server snapshot answers `false`, so every caller must be a component that
 * only mounts after hydration (the manual-reservation modal opens on a click) —
 * otherwise SSR would paint the non-matching branch and swap it on hydrate.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => {
        mql.removeEventListener("change", onStoreChange);
      };
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
