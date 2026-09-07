// core
import * as React from "react";
import { createPortal } from "react-dom";
import type { DateRange } from "react-day-picker";

// components
import { Calendar } from "../ui/calendar";

// others
import type { Locale } from "../../lib/i18n/types";

// The mobile shell for the two PUBLIC date pickers — the landing hero search and
// the `/fleet` filter bar. Below 48rem each swaps its popover for this sheet;
// at and above it, each keeps its own `PopoverContent` untouched.
//
// Why a sheet at all. Both pickers opened the same desktop popover at every
// viewport: a 250px overlay with 32px day cells, sitting on top of the card's own
// rows. 32px is under the 44px iOS / 48px Android touch minimum. Here the grid
// fills the card instead of sizing itself, so a day cell is (viewport − 32) ÷ 7 —
// 51.1px at 390.
//
// *** There is no design board for this surface. *** Neither `ScreenHome` nor
// `ScreenFleet` draws what opens when the mobile date control is tapped, and the
// bottom sheet is a STAFF pattern. The whole shell is therefore recorded as
// `deviation(D-15)` in `design-contract.md` Surface 6 — but no value here is
// invented: the layer, scrim, card, handle and eyebrow are ported from
// `dashboard/QuickAddButton.tsx:175-197`, the dismissal behaviour from
// `MobileNav.tsx:47-62`, and the confirm row's metrics from `FilterBar.tsx`.
//
// `ui/calendar.tsx` is NOT edited. Sizing is caller-side, the way Phase 1 did it,
// so the shared calendar's other consumers cannot regress by construction.

interface Props {
  open: boolean;
  onClose: () => void;
  /** The field's own label, drawn as the sheet's uppercase eyebrow. */
  title: string;
  /** Confirm-row copy — `Gotowe` / `Done`, never the card's own CTA word. */
  doneLabel: string;
  selected: DateRange | undefined;
  onSelect: (next: DateRange | undefined) => void;
  /** Islands cannot read `Astro.locals`; the mounting island passes it down. */
  locale: Locale;
}

export default function DateRangeSheet({ open, onClose, title, doneLabel, selected, onSelect, locale }: Props) {
  // Escape closes and the page behind the scrim is frozen, the same way
  // `MobileNav` does it for the public header overlay. Without the lock a scroll
  // over the scrim moves the page underneath the sheet.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  // Portalled rather than rendered in place: `position: fixed` resolves against
  // the nearest transformed ancestor, and the landing hero is a transform-heavy
  // subtree. `QuickAddButton` and `GlobalSearch` take the same escape hatch.
  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-end bg-[rgba(20,18,22,0.5)] backdrop-blur-[6px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => {
          e.stopPropagation();
        }}
        // `max-w-md` is the one addition to the ported shell. The grid fills the
        // card, and the mobile branch runs to 767px, so a full-width card put a
        // 105px day cell on screen at the top of that range. Capped and centred
        // above 28rem the phone case is untouched (390 never reaches the cap)
        // and the wide end stays sane.
        className="bg-card mx-auto w-full max-w-md rounded-t-[26px] px-4 pt-4 pb-[26px] shadow-[0_-10px_40px_rgba(0,0,0,0.2)]"
      >
        <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-[var(--flota-hair)]" />
        <div className="text-muted-foreground px-1.5 pb-1.5 text-[12px] font-bold tracking-[0.4px] uppercase">
          {title}
        </div>

        <Calendar
          mode="range"
          selected={selected}
          onSelect={onSelect}
          numberOfMonths={1}
          disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
          appLocale={locale}
          autoFocus
          // `p-0` hands the horizontal padding to the sheet card, and the root
          // goes full-width so the 7-column division — not `--cell-size` — sets
          // the cell. `--cell-size` stays the shared 32px, where it acts only as
          // a floor: raising it to 44 would stop the row shrinking and overflow
          // the card below a 364px viewport.
          className="w-full bg-transparent p-0"
          // A caller-supplied slot REPLACES the built-in one rather than merging
          // with it (`ui/calendar.tsx:139` spreads `classNames` last), so this
          // drops the default's `w-fit` instead of fighting it. It is the only
          // slot overridden — every other value stays the shared calendar's.
          classNames={{ root: "w-full" }}
        />

        <button
          type="button"
          onClick={onClose}
          className="mt-3 h-[50px] w-full rounded-[13px] bg-[var(--foreground)] text-[15px] font-[650] text-white"
        >
          {doneLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
