// core
import * as React from "react";
import { Home, Menu, Truck, X } from "lucide-react";

// others
import { cn } from "../lib/utils";

// Mobile navigation: a top-right hamburger that opens a full-screen overlay with
// the destinations centered (icon + label). Hydrated island so it can toggle,
// lock body scroll while open, close on Escape, and reset after a navigation (it
// remounts on each view-transition swap). Desktop uses the centered top nav in
// <SiteHeader>; this renders only below `sm`.

interface Props {
  active?: "home" | "fleet";
}

const NAV: { id: "home" | "fleet"; label: string; href: string }[] = [
  { id: "home", label: "Start", href: "/" },
  { id: "fleet", label: "Flota", href: "/fleet" },
];

export default function MobileNav({ active }: Props) {
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
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
        className="text-foreground bg-card inline-flex size-10 items-center justify-center rounded-full border border-[var(--flota-hair)]"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="bg-card fixed inset-0 z-[60] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <a
              href="/"
              onClick={() => {
                setOpen(false);
              }}
              className="flex items-center gap-2.5"
            >
              <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-[10px] text-lg font-normal">
                F
              </span>
              <span className="text-foreground text-[17px] font-bold tracking-tight">Flota</span>
            </a>
            <button
              type="button"
              aria-label="Zamknij menu"
              onClick={() => {
                setOpen(false);
              }}
              className="text-foreground bg-card inline-flex size-10 items-center justify-center rounded-full border border-[var(--flota-hair)]"
            >
              <X className="size-5" />
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
                {item.id === "home" ? <Home className="size-7" /> : <Truck className="size-7" />}
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
