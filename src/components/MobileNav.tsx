// core
import * as React from "react";
import { HelpCircle, Home, Info, Menu, Receipt, Truck, X } from "lucide-react";

// components
import Brand from "./brand/Brand";

// others
import { cn } from "../lib/utils";

// Mobile chrome for the public header (design `InfoHeaderMobile`): a crimson
// phone-reveal chip + a hamburger that opens a full-screen overlay listing all five
// destinations (icon + label). Hydrated island so it can toggle the reveal, open/close
// the overlay, lock body scroll while open, close on Escape, and reset after a
// navigation (it remounts on each view-transition swap). Renders only below `sm`;
// desktop uses the centered pill nav in <SiteHeader>.

type NavId = "home" | "fleet" | "pricing" | "faq" | "about";

interface Props {
  active?: NavId;
}

const NAV: { id: NavId; label: string; href: string; Icon: typeof Home }[] = [
  { id: "home", label: "Start", href: "/", Icon: Home },
  { id: "fleet", label: "Flota", href: "/fleet", Icon: Truck },
  { id: "pricing", label: "Cennik", href: "/pricing", Icon: Receipt },
  { id: "faq", label: "FAQ", href: "/faq", Icon: HelpCircle },
  { id: "about", label: "O nas", href: "/about", Icon: Info },
];

// II.phone from the design source (exact path); crimson via currentColor.
function PhoneGlyph() {
  return (
    <svg
      width={17}
      height={17}
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

export default function MobileNav({ active }: Props) {
  const [open, setOpen] = React.useState(false);
  const [phoneOpen, setPhoneOpen] = React.useState(false);

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
      <div className="flex items-center gap-[10px]">
        {/* Phone-reveal chip: tap the crimson button to expand the number (a real tel link). */}
        <div className="bg-accent flex h-10 items-center overflow-hidden rounded-[12px]">
          <button
            type="button"
            aria-label={phoneOpen ? "Ukryj numer telefonu" : "Pokaż numer telefonu"}
            aria-expanded={phoneOpen}
            onClick={() => {
              setPhoneOpen((value) => !value);
            }}
            className="text-primary flex size-10 shrink-0 items-center justify-center"
          >
            <PhoneGlyph />
          </button>
          <a
            href="tel:+48221002030"
            tabIndex={phoneOpen ? undefined : -1}
            aria-hidden={phoneOpen ? undefined : "true"}
            className="text-primary block overflow-hidden text-[14px] font-bold whitespace-nowrap"
            style={{
              maxWidth: phoneOpen ? 160 : 0,
              opacity: phoneOpen ? 1 : 0,
              paddingRight: phoneOpen ? 12 : 0,
              transition:
                "max-width .4s cubic-bezier(.4,0,.2,1), opacity .28s ease, padding-right .4s cubic-bezier(.4,0,.2,1)",
            }}
          >
            +48 22 100 20 30
          </a>
        </div>

        {/* Hamburger → full-screen overlay. */}
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => {
            setOpen(true);
          }}
          className="text-foreground bg-background inline-flex size-10 items-center justify-center rounded-[12px]"
        >
          <Menu className="size-[18px]" strokeWidth={2} />
        </button>
      </div>

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
              <Brand className="gap-1.5" markClass="h-[34px]" wordmarkClass="text-[18px] tracking-[-0.4px]" />
            </a>
            <button
              type="button"
              aria-label="Zamknij menu"
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
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
