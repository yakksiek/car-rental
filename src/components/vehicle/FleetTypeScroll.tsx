// core
import * as React from "react";
import { navigate } from "astro:transitions/client";

// others
import { cn } from "../../lib/utils";
import type { VehicleCategory } from "../../types";

// Mobile category type-pill scroller (design ScreenMobileFleet → FleetTypeScroll): a
// dark rounded-full track where the active pill expands to `{label} · {count}` and the
// rest collapse to 40px icon buttons. Selecting a pill navigates (instant category
// filter, same contract as the desktop anchors) and optimistically expands the tapped
// pill so the swap animates before the view-transition lands. Shown only < sm; the
// desktop/tablet pill bar is hidden there. Each pill is a real <a href>, so the filter
// still works before hydration / with JS off — the labels just don't animate.
//
// The category glyphs mirror the shared Astro <CategoryIcon> (which can't render inside
// a React island). Keep the two path sets in sync if either changes.

interface Pill {
  category: VehicleCategory | null;
  label: string;
  count: number;
  href: string;
}

interface Props {
  pills: Pill[];
  active: VehicleCategory | null;
}

const keyOf = (category: VehicleCategory | null): string => category ?? "all";

function CategoryGlyph({ category, className }: { category: VehicleCategory | null; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {category === null && (
        <>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </>
      )}
      {category === "cargo_van" && (
        <>
          <path d="M14 18V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </>
      )}
      {category === "passenger_van" && (
        <>
          <path d="M8 6v6" />
          <path d="M15 6v6" />
          <path d="M2 12h19.6" />
          <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
          <circle cx="7" cy="18" r="2" />
          <path d="M9 18h5" />
          <circle cx="16" cy="18" r="2" />
        </>
      )}
      {category === "car_transporter" && (
        <>
          <path d="M2 15h15l5-3" />
          <path d="M2 15v-3" />
          <path d="M5 12l2-3h6l3 3" />
          <circle cx="7" cy="18" r="1.7" />
          <circle cx="16" cy="18" r="1.7" />
        </>
      )}
      {category === "refrigerated_truck" && (
        <>
          <line x1="2" x2="22" y1="12" y2="12" />
          <line x1="12" x2="12" y1="2" y2="22" />
          <path d="m20 16-4-4 4-4" />
          <path d="m4 8 4 4-4 4" />
          <path d="m16 4-4 4-4-4" />
          <path d="m8 20 4-4 4 4" />
        </>
      )}
      {category === "flatbed_truck" && (
        <>
          <path d="M16.5 9.4 7.55 4.24" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M3.29 7 12 12l8.71-5" />
          <path d="M12 22V12" />
        </>
      )}
    </svg>
  );
}

export default function FleetTypeScroll({ pills, active }: Props) {
  const [current, setCurrent] = React.useState<string>(keyOf(active));

  function handleSelect(event: React.MouseEvent<HTMLAnchorElement>, pill: Pill) {
    // Let modified clicks (open-in-new-tab, etc.) behave natively.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    setCurrent(keyOf(pill.category));
    void navigate(pill.href);
  }

  return (
    <div className="-mx-5 mb-[22px] px-5 sm:hidden">
      <div className="flex gap-[2px] rounded-full bg-[#0A0A0F] p-[5px] shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
        {pills.map((pill) => {
          const isActive = current === keyOf(pill.category);
          return (
            <a
              key={keyOf(pill.category)}
              href={pill.href}
              onClick={(event) => {
                handleSelect(event, pill);
              }}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-10 items-center overflow-hidden rounded-full transition-all duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)] focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none",
                isActive
                  ? "flex-1 justify-center bg-white pr-4 pl-3 text-[#0A0A0F]"
                  : "w-10 shrink-0 justify-center text-white/70",
              )}
            >
              <CategoryGlyph category={pill.category} className="size-[18px] shrink-0" />
              <span
                className={cn(
                  "overflow-hidden text-[13.5px] font-[650] tracking-[-0.1px] whitespace-nowrap transition-all duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)]",
                  isActive ? "ml-2 max-w-[180px] opacity-100" : "ml-0 max-w-0 opacity-0",
                )}
              >
                {pill.label} · {pill.count}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
