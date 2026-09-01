// core
import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus } from "lucide-react";

// components
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ManualReservationModal } from "./ManualReservationModal";
import { QuickActionMenu } from "./QuickActionMenu";

// others
import { cn } from "../../lib/utils";
import { useFleetPicker } from "../hooks/useFleetPicker";
import { DEMO_BLOCKED_MESSAGE } from "../../lib/staff-report";
import { buildQuickActions, PROMOTED_ACTIONS, type PromotedActionKey, type ResolvedQuickAction } from "./quick-actions";

// The quick-action trigger (S-12b) — the design's `QuickAddButton`, ported at
// the geometry in design-contract.md Surfaces 1–4.
//
// TWO MOUNTS, NOT ONE BREAKPOINT BRANCH. `mode` is passed explicitly by each
// mount site and never derived at runtime: `useMediaQuery`'s server snapshot is
// `false`, so a runtime branch would SSR the mobile arm on every staff page and
// swap it on hydrate. The desktop pill lives inside `StaffShell`'s band (already
// `hidden … md:flex`) and the mobile circle inside each page's own header
// (already `md:hidden`), so the two containers are mutually exclusive in CSS —
// only one is ever visible and no second copy of an open menu can exist.
//
// E12 IS SUPERSEDED (Phase 6, owner 2026-08-25). The design source's desktop
// branch passes no `promoted`, and this component honoured that until the
// measured consequence surfaced: `Dodaj pojazd` rendered TWICE on
// `/dashboard/vehicles` at md+ (page button + menu row) while `Dodaj pracownika`
// rendered once and was absent from the menu. Desktop now absorbs exactly as
// mobile does — one create affordance per screen at every breakpoint — so the
// page-owned buttons are retired and `promoted` is honoured in BOTH modes.
// Consequence, accepted: D9 (the crimson primary row moves by screen) now
// applies to desktop too; it is no longer fixed there.
//
// BOTH OVERLAYS ARE PORTALLED TO `document.body`. Several mount sites wrap the
// circle in `-translate-y-1/2` to keep a centred title centred, and a transform
// on an ancestor makes `position: fixed` resolve against THAT element instead of
// the viewport — so an un-portalled scrim collapses to the size of the wrapper
// and stops covering the page. Radix already portals the desktop popover; these
// two need it explicitly.

const COPY = {
  pill: "Nowe",
  openMenu: "Szybka akcja",
  eyebrow: "Szybka akcja",
  emptyFleet: "Brak pojazdów do rezerwacji",
  loadError: "Nie udało się pobrać floty. Spróbuj ponownie.",
} as const;

interface QuickAddButtonProps {
  mode: "desktop" | "mobile";
  /**
   * The page's own create action, promoted to the crimson first row. Passed as a
   * KEY, not an object: the desktop pill is mounted from `StaffShell.astro` and
   * Astro serializes island props to JSON, which a `LucideIcon` and an `onPick`
   * closure cannot survive. Resolved through `PROMOTED_ACTIONS`.
   */
  promoted?: PromotedActionKey;
  /**
   * Is the caller the published demo account (`profiles.is_demo`)? Threaded from
   * `Astro.locals.isDemo`. Two rows in this menu reach a demo-gated route:
   * `employee` (`POST /api/staff`, only when promoted) and `res`
   * (`POST /api/reservations/manual`). Both render disabled with the refusal
   * as their hint instead of opening a dialog whose submit the server will 403.
   *
   * `vehicle` stays live — a demo visitor really can add a vehicle, and fencing
   * more than the server fences would understate how much of the cockpit works.
   * `res` is fenced: /api/reservations/manual mails a caller-supplied address,
   * so it is gated server-side like the staff routes.
   */
  isDemo?: boolean;
}

export default function QuickAddButton({ mode, promoted, isDemo = false }: QuickAddButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const { vehicles, state, load } = useFleetPicker();

  const emptyFleet = state === "ready" && vehicles?.length === 0;
  const items = buildQuickActions(promoted ? PROMOTED_ACTIONS[promoted] : undefined);

  const disabledKeys: Record<string, { hint?: string; pending?: boolean }> = {};
  if (state === "loading") {
    // D4 `deviation(async-affordance)` — the row is the async action, so it is
    // disabled and spinning until its fetch settles.
    disabledKeys.res = { pending: true };
  } else if (emptyFleet) {
    // D3 `deviation(empty-state)` — the row goes disabled with a hint, but the
    // trigger and "Dodaj pojazd" stay: adding a vehicle is what fixes an empty
    // fleet, so this must not become S-12's whole-component `return null`.
    disabledKeys.res = { hint: COPY.emptyFleet };
  }
  // The demo gate, reusing D3's exact affordance rather than inventing one: the
  // row goes disabled and its description slot carries the reason, which is what
  // makes the fence VISIBLE rather than only discoverable by clicking. The
  // trigger and the other rows stay, for the same reason D3 keeps them — a
  // recruiter should see that staff management exists and is deliberately
  // fenced, which is the point of showing the slice at all.
  if (isDemo) {
    if (promoted === "employee") {
      disabledKeys.employee = { hint: DEMO_BLOCKED_MESSAGE };
    }
    // `res` posts to /api/reservations/manual, which mails the
    // caller-supplied `customer_email`. That route is gated server-side, so
    // the row must not invite a click the server will 403.
    disabledKeys.res = { hint: DEMO_BLOCKED_MESSAGE };
  }

  const pick = (item: ResolvedQuickAction) => {
    if (item.key === "res") {
      // `load()` is idempotent — a pick while in flight joins the same request
      // and a pick after success resolves from cache, so repeated opens issue
      // exactly one `/api/vehicles` request per page view.
      void load().then((fleet) => {
        if (fleet && fleet.length > 0) {
          setOpen(false);
          setModalOpen(true);
        }
      });
      return;
    }
    setOpen(false);
    if (item.onPick) {
      item.onPick();
      return;
    }
    if (item.href) {
      window.location.href = item.href;
    }
  };

  const menu = (
    <>
      <QuickActionMenu items={items} onPick={pick} disabledKeys={disabledKeys} />
      {state === "error" && (
        // D6 `deviation(error-state)` — a failed fetch says so and stays
        // retryable (picking the row again re-requests); it never opens an
        // empty modal.
        <p role="status" className="text-primary px-3 pt-1 text-[11.5px]">
          {COPY.loadError}
        </p>
      )}
    </>
  );

  const modal =
    modalOpen && vehicles !== null
      ? createPortal(
          <ManualReservationModal
            vehicles={vehicles}
            onClose={() => {
              setModalOpen(false);
            }}
          />,
          document.body,
        )
      : null;

  if (mode === "mobile") {
    return (
      <>
        <Button
          type="button"
          aria-label={COPY.openMenu}
          aria-expanded={open}
          onClick={() => {
            setOpen(true);
          }}
          className="bg-foreground hover:bg-foreground/90 size-10 shrink-0 rounded-full p-0 shadow-[0_2px_6px_rgba(10,10,15,0.14)]"
        >
          <Plus className="size-[19px] text-white" />
        </Button>

        {open &&
          createPortal(
            <div
              onClick={() => {
                setOpen(false);
              }}
              className="fixed inset-0 z-[70] flex items-end bg-[rgba(20,18,22,0.5)] backdrop-blur-[6px]"
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="bg-card w-full rounded-t-[26px] px-4 pt-4 pb-[26px] shadow-[0_-10px_40px_rgba(0,0,0,0.2)]"
              >
                <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-[var(--flota-hair)]" />
                <div className="text-muted-foreground px-1.5 pb-1.5 text-[12px] font-bold tracking-[0.4px] uppercase">
                  {COPY.eyebrow}
                </div>
                {menu}
              </div>
            </div>,
            document.body,
          )}

        {modal}
      </>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            className="bg-foreground hover:bg-foreground/90 h-[38px] gap-[7px] rounded-[10px] py-0 pr-3.5 pl-3 text-[13px] font-[650] text-white shadow-none"
          >
            <Plus className="size-[15px]" />
            {COPY.pill}
            <span className={cn("inline-flex transition-transform duration-150", open && "rotate-180")}>
              <ChevronDown className="size-[13px] text-white/70" />
            </span>
          </Button>
        </PopoverTrigger>
        {/* `sideOffset={6}` puts the panel's top 44px below the trigger's top
            edge (38px pill + 6px), which is the source's `top: 44`. */}
        <PopoverContent align="end" sideOffset={6} className="shadow-overlay w-[278px] rounded-[16px] border-none p-2">
          {menu}
        </PopoverContent>
      </Popover>

      {modal}
    </>
  );
}
