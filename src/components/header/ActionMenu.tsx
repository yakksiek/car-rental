// core
import * as React from "react";

// components
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

// others
import { translator, type Locale } from "../../lib/i18n/types";
import { nav } from "../../lib/i18n/nav";
import { cn } from "../../lib/utils";

// Space-saving contact / booking control for the public header (design
// `shared.jsx` `ActionMenu`): a fixed 40px pill that opens a two-row popover —
// Call · Browse the fleet.
//
// *** This REPLACES the old two-segment contact/booking toggle, it does not extend
// it. *** That switch expanded in place (183px → 227px) against a
// `justify-between` row with no `gap`/`min-w-0`/`truncate` and nav links with no
// `whitespace-nowrap`, so at 768–790px and 840px its phone mode wrapped the nav
// pill's "O nas" onto two lines and grew the bar 86px → 108px while the CTA
// collapsed to an unlabelled icon (measured 2026-09-01; `known-issues.md`). A
// fixed-width trigger opening an overlay cannot reproduce that class of bug — the
// deletion IS the fix, which is why the toggle was not patched.
//
// Deviations from the design source, recorded in `design-contract.md`:
//   • the design's trigger carries `aria-label={t.browseFleet}` ("Browse the
//     fleet") for a menu that is Call · Reserve — we name the menu's real purpose;
//   • the design's first row reads `t.callUs || 'Zadzwoń'`, and `callUs` is in
//     NEITHER `STR` half — so the design renders Polish under EN. The English is
//     authored here from `STR.EN.ret.call`;
//   • the design specifies no keyboard behaviour, so we build on `ui/popover.tsx`
//     (already the header's popover primitive at `QuickAddButton.tsx:205`) for
//     focus trapping and Escape-to-close.

const PHONE_LABEL = "+48 22 100 20 30";
const PHONE_HREF = "tel:+48221002030";

interface Props {
  /** Islands cannot read `Astro.locals`, so the header passes the request locale in. */
  locale: Locale;
  /** `dark` for the landing's over-hero glass chrome. */
  tone?: "light" | "dark";
}

function CalendarGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function PhoneGlyph() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export default function ActionMenu({ locale, tone = "light" }: Props) {
  const t = translator(locale, nav);
  const [open, setOpen] = React.useState(false);
  const dark = tone === "dark";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("contactMenu")}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-[7px] rounded-full px-3.5 text-white",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            dark
              ? "bg-white/15 backdrop-blur-[6px] focus-visible:ring-white/40 focus-visible:ring-offset-transparent"
              : "bg-foreground focus-visible:ring-foreground/30 focus-visible:ring-offset-card",
          )}
        >
          <CalendarGlyph size={17} />
          <svg
            width={11}
            height={11}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("transition-transform duration-200", open && "rotate-180")}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </PopoverTrigger>

      {/* `sideOffset={8}` puts the panel's top 48px below the trigger's top edge
          (40px pill + 8px), which is the design's `top: 48`. */}
      <PopoverContent
        align="end"
        sideOffset={8}
        className="bg-card w-max min-w-[216px] overflow-hidden rounded-[14px] border-[var(--flota-hair)] p-0 shadow-[0_16px_40px_-8px_rgba(14,21,36,0.30)]"
      >
        <a
          href={PHONE_HREF}
          className="hover:bg-background flex items-center gap-[11px] px-[15px] py-[13px] transition-colors"
        >
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--flota-neutral-soft)] text-[var(--flota-ink-2)]">
            <PhoneGlyph />
          </span>
          <span className="min-w-0">
            <span className="text-foreground block text-[13.5px] font-[650] tracking-[-0.15px]">{t("call")}</span>
            <span className="text-muted-foreground mt-px block text-[12px]">{PHONE_LABEL}</span>
          </span>
        </a>
        <a
          href="/fleet"
          className="hover:bg-background flex items-center gap-[11px] border-t border-[var(--flota-hair-2)] px-[15px] py-[13px] transition-colors"
        >
          <span className="bg-foreground flex size-[34px] shrink-0 items-center justify-center rounded-[9px] text-white">
            <CalendarGlyph size={16} />
          </span>
          <span className="text-foreground text-[13.5px] font-[650] tracking-[-0.15px]">{t("browseFleet")}</span>
        </a>
      </PopoverContent>
    </Popover>
  );
}
