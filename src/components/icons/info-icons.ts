// Exact 24-grid icon geometry for the public info pages (O nas / FAQ / Cennik) and
// the redesigned public shell, ported verbatim from the Claude Design source —
// info-pages.jsx (`II.*`) and shared.jsx (`Icon.*`). Do NOT substitute lucide-react:
// the geometry differs subtly and that is a fidelity loss.
//
// Kept in a plain .ts module (not inline in InfoIcon.astro) so the exported types
// resolve for type-aware ESLint and the Astro frontmatter compiler never sees an
// `export type` (which it mis-parses). Expressed as primitive element descriptors
// (path / rect / circle), matching the Brand mark's convention (brand/mark.ts) — no
// `set:html`. The consumer drives `currentColor` for both stroke and the gauge dot.

export type InfoIconName =
  | "shield"
  | "gauge"
  | "spark"
  | "calendar"
  | "invoice"
  | "headset"
  | "van"
  | "bus"
  | "container"
  | "lift"
  | "crew"
  | "city"
  | "phone"
  | "mail"
  | "pin"
  | "clock"
  | "check"
  | "plus"
  | "chevD"
  | "arrowRight"
  | "menu";

interface IconRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}
interface IconCircle {
  cx: number;
  cy: number;
  r: number;
  // A solid dot (the gauge needle centre); an unfilled circle is a stroked ring.
  fill?: boolean;
}
export interface IconEl {
  path?: string;
  rect?: IconRect;
  circle?: IconCircle;
}

export const ICONS: Record<InfoIconName, IconEl[]> = {
  shield: [{ path: "M12 3l7 3v5c0 4.6-3 8.4-7 9.6C8 19.4 5 15.6 5 11V6z" }, { path: "m9 12 2 2 4-4" }],
  gauge: [{ path: "M4 16a8 8 0 1 1 16 0" }, { path: "M12 16l4-4" }, { circle: { cx: 12, cy: 16, r: 1.2, fill: true } }],
  spark: [{ path: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" }],
  calendar: [{ rect: { x: 3, y: 5, w: 18, h: 16, rx: 2 } }, { path: "M3 10h18M8 3v4M16 3v4" }],
  invoice: [
    { path: "M6 3h9l3 3v15l-2.2-1.3L13.6 21l-2.3-1.3L9 21l-2.4-1.3L4 21V3z" },
    { path: "M8 8h6M8 12h8M8 16h5" },
  ],
  headset: [
    { path: "M5 13v-1a7 7 0 0 1 14 0v1" },
    { rect: { x: 3, y: 13, w: 4, h: 6, rx: 1.4 } },
    { rect: { x: 17, y: 13, w: 4, h: 6, rx: 1.4 } },
    { path: "M19 19a4 4 0 0 1-4 3h-2" },
  ],
  van: [
    { path: "M3 7h11v9H3zM14 10h4l3 3.2V16h-7" },
    { circle: { cx: 7.5, cy: 18, r: 1.8 } },
    { circle: { cx: 17.5, cy: 18, r: 1.8 } },
  ],
  bus: [
    { rect: { x: 4, y: 4, w: 16, h: 12, rx: 2 } },
    { path: "M4 11h16M9 4v7M15 4v7" },
    { circle: { cx: 8, cy: 18.4, r: 1.4 } },
    { circle: { cx: 16, cy: 18.4, r: 1.4 } },
  ],
  container: [{ rect: { x: 3, y: 6, w: 18, h: 12, rx: 1.4 } }, { path: "M7 6v12M11 6v12M15 6v12" }],
  lift: [{ path: "M3 6h10v10H3zM13 16h8M17 16v-4M15 12h4l-2-3z" }, { circle: { cx: 6.5, cy: 18, r: 1.4 } }],
  crew: [
    { circle: { cx: 9, cy: 8, r: 3 } },
    { circle: { cx: 16, cy: 9, r: 2.4 } },
    { path: "M4 20c0-3 2.2-5 5-5s5 2 5 5M14 20c0-2 .8-3.4 2-4.2" },
  ],
  city: [{ path: "M4 21V9l6-3 6 3v12" }, { path: "M20 21V13l-4-2M8 12h.01M12 12h.01M8 16h.01M12 16h.01" }],
  phone: [{ path: "M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" }],
  mail: [{ rect: { x: 3, y: 5, w: 18, h: 14, rx: 2 } }, { path: "m3 7 9 6 9-6" }],
  pin: [{ path: "M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" }, { circle: { cx: 12, cy: 10, r: 2.5 } }],
  clock: [{ circle: { cx: 12, cy: 12, r: 9 } }, { path: "M12 7v5l3 2" }],
  check: [{ path: "m5 12 5 5 9-11" }],
  plus: [{ path: "M12 5v14M5 12h14" }],
  chevD: [{ path: "m6 9 6 6 6-6" }],
  arrowRight: [{ path: "M5 12h14M13 6l6 6-6 6" }],
  menu: [{ path: "M4 7h16M4 12h16M4 17h16" }],
};
