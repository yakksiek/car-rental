// core
import * as React from "react";
import { HelpCircle, Home, Info, Menu, Receipt, Truck, X } from "lucide-react";

// components
import Brand from "./brand/Brand";

// others
import { translator, type Locale } from "../lib/i18n/types";
import { nav as navCopy } from "../lib/i18n/nav";
import { cn } from "../lib/utils";

// Mobile nav overlay for the public header: a hamburger that opens a full-screen
// overlay listing all five destinations (icon + label). Hydrated island so it can
// open/close the overlay, lock body scroll while open, close on Escape, and reset
// after a navigation (it remounts on each view-transition swap). Renders only below
// `md`; from there up <SiteHeader> shows the centered pill nav.
//
// *** Two tones, one island. *** <SiteHeader> mounts it light on the eight info
// pages. <LandingNav> mounts it `tone="dark"` so it can sit on the landing's dark
// hero. Same `tone` contract as <ActionMenu> and <LangToggle>: optional prop,
// default light, one `dark` boolean, surface classes swap and nothing else does.
//
// Each tone's header row mirrors THE BAR IT OPENS FROM, on purpose. Light is
// 14/18px padding with a 34px-wide mark (<SiteHeader>'s mobile bar); dark is 16px
// padding with the landing's 18px-tall mark (`LandingNav.astro`). Sharing one set
// of numbers would move the brand on one of the two headers the moment the menu
// opened. See `context/changes/public-mobile-nav-alignment/design-contract.md`.
//
// The overlay is a modal dialog: `role="dialog"`, `aria-modal`, and an accessible
// name. It closes on Escape and on the close chip. There is no focus trap — the
// shared popover primitive is not used here. Recorded as a deviation in the
// contract above.
//
// *** The crimson phone-reveal chip that used to sit beside the hamburger is GONE. ***
// The design's `InfoHeaderMobile` right cluster is <LangToggle> + <ActionMenu>, and
// <ActionMenu>'s first row IS the phone — keeping the chip would have shipped the
// number twice in a 360px-wide bar. The hamburger stays because this app has no
// `PublicDock`, so it is mobile's only route to the other four pages.

type NavId = "home" | "fleet" | "pricing" | "faq" | "about";

interface Props {
  active?: NavId;
  /** Islands cannot read `Astro.locals`, so <SiteHeader> passes the request locale in. */
  locale: Locale;
  /** `dark` for the landing's over-hero glass chrome. */
  tone?: "light" | "dark";
}

// Same nav model as <SiteHeader>, keyed rather than literal: the `fleet` NAV
// ITEM translates to "Fleet" while <Brand> below keeps the untranslated brand.
const NAV: { id: NavId; key: "home" | "fleet" | "pricing" | "faq" | "about"; href: string; Icon: typeof Home }[] = [
  { id: "home", key: "home", href: "/", Icon: Home },
  { id: "fleet", key: "fleet", href: "/fleet", Icon: Truck },
  { id: "pricing", key: "pricing", href: "/pricing", Icon: Receipt },
  { id: "faq", key: "faq", href: "/faq", Icon: HelpCircle },
  { id: "about", key: "about", href: "/about", Icon: Info },
];

export default function MobileNav({ active, locale, tone = "light" }: Props) {
  const t = translator(locale, navCopy);
  const [open, setOpen] = React.useState(false);
  const dark = tone === "dark";

  // The hamburger and the close chip are the same 40px control in two tones. The
  // dark one borrows the glass treatment its neighbours already use (<ActionMenu>,
  // <LangToggle>); the light one is unchanged from what the eight info pages ship.
  const chipClass = cn(
    "inline-flex size-10 shrink-0 items-center justify-center rounded-[12px]",
    dark
      ? "bg-white/15 text-white backdrop-blur-[6px] transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-transparent focus-visible:outline-none"
      : "text-foreground bg-background",
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Hamburger → full-screen overlay. */}
      <button
        type="button"
        aria-label={t("menu")}
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
        className={chipClass}
      >
        <Menu className="size-[18px]" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("menu")}
          className={cn("fixed inset-0 z-[60] flex flex-col", dark ? "bg-[#0A0D14]" : "bg-card")}
        >
          <div className={cn("flex items-center justify-between", dark ? "px-4 py-4" : "px-[18px] py-[14px]")}>
            <a
              href="/"
              onClick={() => {
                setOpen(false);
              }}
              className="flex items-center"
            >
              {/* Same lockup as the mobile bar this drawer opens from, and on the
                  same axis — see `SiteHeader.astro` and `LandingNav.astro`. The
                  design has no drawer (mobile nav is its `PublicDock`), so the
                  lockup mirrors the header rather than a board of its own; a 2x
                  mark here would jump the moment it opened. */}
              {dark ? (
                <Brand tone="inverse" markClass="h-[18px]" wordmarkClass="text-[19px]" />
              ) : (
                <Brand className="gap-[5px]" markClass="w-[34px]" wordmarkClass="text-[18px] tracking-[-0.4px]" />
              )}
            </a>
            <button
              type="button"
              aria-label={t("closeMenu")}
              onClick={() => {
                setOpen(false);
              }}
              className={chipClass}
            >
              <X className="size-[18px]" strokeWidth={2} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col items-center justify-center gap-8">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={() => {
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 text-3xl font-bold tracking-tight transition-colors",
                  active === item.id
                    ? "text-primary"
                    : dark
                      ? "hover:text-primary text-white"
                      : "text-foreground hover:text-primary",
                )}
              >
                <item.Icon className="size-7" />
                {t(item.key)}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
