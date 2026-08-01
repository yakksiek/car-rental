// others
import { cn } from "../../lib/utils";
import {
  MARK_VIEWBOX,
  MARK_STREAKS,
  MARK_STREAK_STROKE,
  MARK_BODY_PATH,
  MARK_BODY_STROKE,
  MARK_WHEELS,
  MARK_WHEEL_STROKE,
  hasWordmark,
  toneTextClass,
  type BrandTone,
  type BrandVariant,
} from "./mark";

// React twin of `Brand.astro` — same API and output — for the one React island
// that renders the brand (`MobileNav.tsx`). Shares the mark geometry from `mark.ts`
// so the two renderers can't drift. See `Brand.astro` for the prop semantics.

interface BrandProps {
  variant?: BrandVariant;
  tone?: BrandTone;
  markClass?: string;
  wordmarkClass?: string;
  // See `Brand.astro`: set false on a mark that sits beside its own visible
  // "Flota" wordmark, so the mark is decorative and "Flota" isn't announced twice.
  label?: boolean;
  className?: string;
}

export default function Brand({
  variant = "lockup",
  tone = "ink",
  markClass = "h-8",
  wordmarkClass = "text-[17px]",
  label = true,
  className,
}: BrandProps) {
  const toneClass = toneTextClass(tone);
  const isMark = variant === "mark";
  const labelled = isMark && label;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox={MARK_VIEWBOX}
        className={cn("w-auto shrink-0", markClass, toneClass)}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        role={labelled ? "img" : undefined}
        aria-label={labelled ? "Flota" : undefined}
        aria-hidden={labelled ? undefined : true}
      >
        {MARK_STREAKS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={MARK_STREAK_STROKE} />
        ))}
        <path d={MARK_BODY_PATH} strokeWidth={MARK_BODY_STROKE} />
        {MARK_WHEELS.map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} strokeWidth={MARK_WHEEL_STROKE} />
        ))}
      </svg>
      {hasWordmark(variant) && <span className={cn("font-bold tracking-tight", toneClass, wordmarkClass)}>Flota</span>}
    </span>
  );
}
