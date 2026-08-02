// core
import * as React from "react";

// Tablet-band contact / booking toggle for the public header (design `InfoHeader`
// `info-toggle`). A segmented pill in a #EAEDF2 track: the active segment expands to a
// link (book → /fleet, phone → tel:), the other collapses to an icon button. Rendered
// only in the tablet band (sm–<lg) where the full phone text + "Zarezerwuj" CTA would
// overflow; the wide-desktop (full phone + CTA) and mobile (<sm, phone-reveal + hamburger)
// headers keep their own chrome. Both segments stay mounted so max-width/padding/gap animate
// smoothly — clicking the inactive one just switches mode (no navigation); clicking the
// active one follows its link. Values (widths, timings) ported verbatim from the source.

const INKD = "#141B2D";
const EASE = "cubic-bezier(.22,1,.36,1)";
const SEG_TRANSITION = `max-width .42s ${EASE}, padding .42s ${EASE}, gap .42s, background .3s ease`;
const LABEL_TRANSITION = `max-width .42s ${EASE}, opacity .28s ease .05s`;

function CalendarGlyph({ color }: { color: string }) {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
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

function PhoneGlyph({ color }: { color: string }) {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export default function HeaderContactToggle() {
  const [mode, setMode] = React.useState<"book" | "phone">("book");
  const book = mode === "book";
  const phone = mode === "phone";

  return (
    <div className="box-border inline-flex items-center gap-1 rounded-full bg-[#EAEDF2] p-1">
      {/* BOOK: active → link to /fleet; inactive → switch to book. */}
      <a
        href="/fleet"
        aria-label={book ? "Zarezerwuj pojazd" : "Pokaż rezerwację"}
        onClick={(event) => {
          if (!book) {
            event.preventDefault();
            setMode("book");
          }
        }}
        className="box-border inline-flex h-[38px] items-center justify-center overflow-hidden rounded-full"
        style={{
          width: book ? "auto" : 38,
          maxWidth: book ? 200 : 38,
          padding: book ? "0 16px" : 0,
          gap: book ? 8 : 0,
          background: book ? INKD : "transparent",
          transition: SEG_TRANSITION,
        }}
      >
        <CalendarGlyph color={book ? "#fff" : "var(--flota-ink-2)"} />
        <span
          className="overflow-hidden text-[14px] font-[650] whitespace-nowrap text-white"
          style={{ maxWidth: book ? 150 : 0, opacity: book ? 1 : 0, transition: LABEL_TRANSITION }}
        >
          Zarezerwuj
        </span>
      </a>

      {/* PHONE: active → tel: link; inactive → switch to phone (reveal number). */}
      <a
        href="tel:+48221002030"
        aria-label={phone ? "Zadzwoń: +48 22 100 20 30" : "Pokaż numer telefonu"}
        onClick={(event) => {
          if (!phone) {
            event.preventDefault();
            setMode("phone");
          }
        }}
        className="box-border inline-flex h-[38px] items-center justify-center overflow-hidden rounded-full"
        style={{
          width: phone ? "auto" : 38,
          maxWidth: phone ? 220 : 38,
          padding: phone ? "0 16px" : 0,
          gap: phone ? 8 : 0,
          background: phone ? "var(--flota-accent)" : "transparent",
          transition: SEG_TRANSITION,
        }}
      >
        <PhoneGlyph color={phone ? "#fff" : "var(--flota-ink-2)"} />
        <span
          className="overflow-hidden text-[14px] font-bold tracking-[-0.2px] whitespace-nowrap text-white"
          style={{ maxWidth: phone ? 210 : 0, opacity: phone ? 1 : 0, transition: LABEL_TRANSITION }}
        >
          +48 22 100 20 30
        </span>
      </a>
    </div>
  );
}
