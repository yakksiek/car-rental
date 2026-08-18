// core
import { useEffect, useRef } from "react";

// Global ⌘K / Ctrl+K (open + focus) and Esc (close) for the staff search island
// (S-13 Phase 2). Two things make this trickier than a plain `useEffect`:
//
//   1. VIEW TRANSITIONS. `<ClientRouter>` is app-wide (Layout.astro), so a staff
//      page swap does not reload the document. The `document` object survives the
//      swap but the React island that owns the handler does not: it is unmounted
//      and a new one is created. Cleanup DOES run (astro-island wires
//      `astro:after-swap` → `unmount()` → `root.unmount()`), which is exactly the
//      problem — a listener added per mount would be torn down with the island that
//      added it. So the listener is a module-scoped singleton that OUTLIVES any one
//      island, installed ONCE and dispatching to whichever handler is currently
//      registered.
//
//   2. THE GUARD SHAPE. StaffShell's signout binder guards per DOM element
//      (`form.dataset.bound`). That pattern CANNOT work here: a `document`-level
//      listener has no element to tag, so a dataset-style guard would add a fresh
//      duplicate handler on every `astro:page-load` — the shortcut would fire twice,
//      then three times, then N times. The guard is therefore a module-scoped
//      singleton flag, and `install()` is idempotent by construction.

export interface GlobalSearchHotkeyHandlers {
  /** ⌘K / Ctrl+K — open the search surface and focus its input. */
  onOpen: () => void;
  /** Esc — close whatever is open. */
  onClose: () => void;
  /**
   * Claim the shortcut on this page? Default `true`. The two vehicle-form
   * sub-screens pass `false`: search is a navigation affordance, and on a page
   * whose whole job is data entry a shortcut that leaves it is a footgun. With
   * this off nothing registers, so the listener below returns early and ⌘K falls
   * through to the browser's own binding.
   */
  enabled?: boolean;
}

let installed = false;
let activeHandlers: GlobalSearchHotkeyHandlers | null = null;

function handleKeyDown(event: KeyboardEvent) {
  const handlers = activeHandlers;
  if (!handlers) {
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    handlers.onOpen();
    return;
  }

  if (event.key === "Escape") {
    handlers.onClose();
  }
}

/** Idempotent: the singleton flag is what keeps every island mount from stacking handlers. */
function install() {
  if (installed) {
    return;
  }
  installed = true;
  document.addEventListener("keydown", handleKeyDown);
}

/**
 * Register this island as the ⌘K target. The latest mounted island wins; an
 * island only clears the registration if it is still the active one, so a
 * view-transition swap (new island mounts before the old one is cleaned up)
 * cannot leave the shortcut pointing at nothing.
 */
export function useGlobalSearchHotkey(handlers: GlobalSearchHotkeyHandlers): void {
  // Keep the handler identity stable while always calling the latest callbacks,
  // so a re-render (every keystroke) does not re-register. The refresh runs in an
  // effect, not during render — writing a ref while rendering is what the React
  // Compiler's "Cannot access refs during render" rule forbids.
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  const enabled = handlers.enabled ?? true;

  useEffect(() => {
    // Rules of hooks: the hook is always CALLED; only the registration is gated.
    //
    // CLEAR rather than merely skip. `activeHandlers` outlives every island, and a
    // view-transition swap mounts the new island BEFORE the outgoing one is cleaned
    // up — so simply returning would leave the previous page's registration alive
    // and ⌘K would keep firing (into a stale handler) on a page that opted out.
    // This branch deliberately registers NO cleanup: by the time one would run, the
    // next page's island may already have claimed the slot, and clearing it then
    // would break that page.
    if (!enabled) {
      activeHandlers = null;
      return;
    }
    const registration: GlobalSearchHotkeyHandlers = {
      onOpen: () => {
        latest.current.onOpen();
      },
      onClose: () => {
        latest.current.onClose();
      },
    };
    activeHandlers = registration;

    install();

    return () => {
      if (activeHandlers === registration) {
        activeHandlers = null;
      }
    };
  }, [enabled]);
}
