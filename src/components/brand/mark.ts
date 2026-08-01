// Flota brand mark — the single geometry source for the "motion van" line-art
// mark, shared by both renderers (`Brand.astro` and `Brand.tsx`) so the two can
// never drift. Ported from the committed design asset
// (`context/changes/logo-update/design-review/flota-mark.svg`). The mark carries
// NO color of its own: both renderers set `stroke="currentColor"` on the <svg>, so
// the surface controls tone (ink on light, white on dark). No fill, no container.
//
// Expressed as primitive geometry (not an SVG string) so each renderer maps it into
// real <line>/<path>/<circle> elements — avoids set:html / dangerouslySetInnerHTML
// while keeping one source of truth.

export const MARK_VIEWBOX = "-6 24 124 60";

// Three "speed streak" lines: [x1, y1, x2, y2].
export const MARK_STREAKS: readonly (readonly [number, number, number, number])[] = [
  [6, 36, 30, 36],
  [2, 50, 26, 50],
  [10, 64, 30, 64],
];
export const MARK_STREAK_STROKE = 7;

// Van body silhouette (box + sloped hood).
export const MARK_BODY_PATH = "M 44,66 L 44,34 L 96,34 L 108,50 L 108,66";
export const MARK_BODY_STROKE = 8;

// Two wheels (rings): [cx, cy, r].
export const MARK_WHEELS: readonly (readonly [number, number, number])[] = [
  [60, 66, 8],
  [100, 66, 8],
];
export const MARK_WHEEL_STROKE = 7;

export type BrandTone = "ink" | "inverse";
export type BrandVariant = "lockup" | "mark";

// Tone → text-color utility. The mark strokes are `currentColor`, so this class
// (set on the <svg>) drives the mark color; the wordmark reuses the same class.
export function toneTextClass(tone: BrandTone): string {
  return tone === "inverse" ? "text-white" : "text-foreground";
}

// The "lockup" variant renders the "Flota" wordmark beside the mark; the "mark"
// variant renders the mark alone (for surfaces that supply their own wordmark /
// sublabel — footer, staff shell, auth cards).
export function hasWordmark(variant: BrandVariant): boolean {
  return variant === "lockup";
}
