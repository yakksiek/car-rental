// core
import * as React from "react";

// Tablet-band contact / booking toggle for the public header (design `InfoHeader`
// `info-toggle`). A segmented pill in a #EAEDF2 track: the active segment expands to a
// link (book → /fleet, phone → tel:), the other collapses to an icon button. Rendered
// only in the tablet band (md–<lg) where the full phone text + "Zarezerwuj" CTA would
// overflow; the wide-desktop (full phone + CTA) and mobile (<md, phone-reveal + hamburger)
// headers keep their own chrome. Clicking the inactive segment switches mode (no navigation);
// clicking the active one follows its link.
//
// Animation: the label reveal is a `max-width: 0 ↔ N` transition on a `min-w-0 overflow-hidden`
// wrapper (N per segment, just above the label's measured width so the FULL number always shows
// — grid-template-columns:1fr under-sizes the column in some engines and clips the number). The
// icon sits in a fixed 38px holder (never moves) and the segment is content-sized, so it grows/
// shrinks smoothly with no width/padding/gap snapping (the design's original jank). Only max-width,
// background, opacity, and color (via currentColor) transition. SSR-safe: N is a static value, so
// the default (book) segment renders open with no hydration flash.

const INKD = "#141B2D";
const EASE = "cubic-bezier(.4, 0, 0.2, 1)";
const REVEAL_MS = 420;

function CalendarGlyph() {
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
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

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

interface SegmentProps {
  active: boolean;
  href: string;
  ariaLabel: string;
  activeBackground: string;
  fontWeight: number;
  label: string;
  // Revealed width (px) when active — a touch above the label's measured width so it never clips.
  revealWidth: number;
  onActivate: () => void;
  children: React.ReactNode;
}

function Segment({
  active,
  href,
  ariaLabel,
  activeBackground,
  fontWeight,
  label,
  revealWidth,
  onActivate,
  children,
}: SegmentProps) {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!active) {
          event.preventDefault();
          onActivate();
        }
      }}
      className="flex h-[38px] items-center overflow-hidden rounded-full"
      style={{
        background: active ? activeBackground : "transparent",
        color: active ? "#fff" : "var(--flota-ink-2)",
        transition: "background .3s ease, color .3s ease",
      }}
    >
      <span className="flex size-[38px] shrink-0 items-center justify-center">{children}</span>
      <span
        className="min-w-0 overflow-hidden"
        style={{ maxWidth: active ? revealWidth : 0, transition: `max-width ${REVEAL_MS}ms ${EASE}` }}
      >
        <span
          className="block pr-4 pl-0.5 text-[14px] whitespace-nowrap"
          style={{ fontWeight, opacity: active ? 1 : 0, transition: "opacity .28s ease" }}
        >
          {label}
        </span>
      </span>
    </a>
  );
}

export default function HeaderContactToggle() {
  const [mode, setMode] = React.useState<"book" | "phone">("book");

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-[#EAEDF2] p-1">
      <Segment
        active={mode === "book"}
        href="/fleet"
        ariaLabel={mode === "book" ? "Zarezerwuj pojazd" : "Pokaż rezerwację"}
        activeBackground={INKD}
        fontWeight={650}
        label="Zarezerwuj"
        revealWidth={112}
        onActivate={() => {
          setMode("book");
        }}
      >
        <CalendarGlyph />
      </Segment>

      <Segment
        active={mode === "phone"}
        href="tel:+48221002030"
        ariaLabel={mode === "phone" ? "Zadzwoń: +48 22 100 20 30" : "Pokaż numer telefonu"}
        activeBackground="var(--flota-accent)"
        fontWeight={700}
        label="+48 22 100 20 30"
        revealWidth={150}
        onActivate={() => {
          setMode("phone");
        }}
      >
        <PhoneGlyph />
      </Segment>
    </div>
  );
}
