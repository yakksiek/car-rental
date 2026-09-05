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

export default function MobileNav({ active, locale }: Props) {
  const t = translator(locale, navCopy);
  const [open, setOpen] = React.useState(false);

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
        className="text-foreground bg-background inline-flex size-10 shrink-0 items-center justify-center rounded-[12px]"
      >
        <Menu className="size-[18px]" strokeWidth={2} />
      </button>

      {open && (
        <div className="bg-card fixed inset-0 z-[60] flex flex-col">
          <div className="flex items-center justify-between px-[18px] py-[14px]">
            <a
              href="/"
              onClick={() => {
                setOpen(false);
              }}
              className="flex items-center"
            >
              {/* Same 34 as the mobile bar this drawer opens from, and on the same
                  axis — see `SiteHeader.astro`. The design has no drawer (mobile nav
                  is its `PublicDock`), so the lockup mirrors the header rather than a
                  board of its own; a 2× mark here would jump the moment it opened. */}
              <Brand className="gap-1.5" markClass="w-[34px]" wordmarkClass="text-[18px] tracking-[-0.4px]" />
            </a>
            <button
              type="button"
              aria-label={t("closeMenu")}
              onClick={() => {
                setOpen(false);
              }}
              className="text-foreground bg-background inline-flex size-10 items-center justify-center rounded-[12px]"
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
                  active === item.id ? "text-primary" : "text-foreground hover:text-primary",
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
