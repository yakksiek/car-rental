// core
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";

// others
import { DAMAGE_TYPE_LABELS_PL, PHOTO_SLOT_LABELS_PL, fuelLabelPl } from "../protocol-labels";
import type { PdfFonts } from "./fonts";
import { loadPdfFonts } from "./fonts";
import type { ProtocolDamageType, ProtocolPhotoSlot } from "../../types";

// The issue-protocol PDF (S-05).
//
// The customer has no account and no portal. This document is their ONLY copy of
// the evidence, possibly needed in a dispute months later — so it is generated
// once, attached to an email, and never depends on a link that expires.
//
// **Never use `StandardFonts.*` here.** The 14 standard PDF fonts are WinAnsi
// (Windows-1252) encoded, and of `ą ć ę ł ń ó ś ź ż` only `ó` exists in that
// encoding: `drawText` THROWS on the other eight rather than substituting. A
// prototype with fixture data like `"Jan Kowalski"` passes every test and dies on
// the first customer named Wąsik. `registerFontkit` + an embedded Unicode TTF is
// wired before the first `drawText` below, and `protocol-pdf.test.ts` pins the
// full diacritic set.
//
// Generation is client-side: the free-tier Worker has a 10 ms CPU cap, and this
// takes tens to hundreds of ms. Nothing in this module may be reachable from
// `.astro` frontmatter or SSR module scope, or pdf-lib lands in the Worker bundle
// instead of `dist/client`.

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface ProtocolPdfPhoto {
  slot: ProtocolPhotoSlot;
  /** Compressed JPEG bytes, straight from `compressImage`. */
  jpeg: Uint8Array;
}

export interface ProtocolPdfDamage {
  type: ProtocolDamageType;
  location: string;
  size: string | null;
  /**
   * The persisted `existing | new` link (S-06): a truthy value ⇒ carried over from
   * a baseline item (existing), a falsy one ⇒ new. Read only for return documents
   * (those with a `comparison` block); omitted on issue documents.
   */
  baselineDamageId?: string | null;
  /** Compressed JPEG bytes for this item, if any were captured. */
  photos: Uint8Array[];
}

/**
 * The baseline-vs-current comparison (S-06). Present ⇒ this is a **return**
 * document ("Protokół zwrotu"); absent ⇒ an **issue** document ("Protokół
 * wydania"). The numbers come from `computeReturnDeltas` (src/lib/protocol-delta.ts)
 * — the same pure helper the return form and the email use, so the three cannot
 * disagree. The per-damage `existing | new` tags are read from `data.damages`
 * (each carrying `baselineDamageId`), not duplicated here.
 */
export interface ProtocolPdfComparison {
  /** Odometer at issue time, in km. */
  baselineOdometerKm: number;
  /** Fuel at issue time, in eighths (0–8). */
  baselineFuelEighths: number;
  /** `current − baseline` odometer; may be 0 or negative (a suspect reading). */
  kmDriven: number;
  /** `current − baseline` fuel, in eighths; negative ⇒ returned lower. */
  fuelDelta: number;
  /** Return damages with no baseline link — the "new damage" count. */
  newDamageCount: number;
  /** Fuel returned below pickup level — the customer owes fuel. */
  fuelAdverse: boolean;
  /** At least one new (non-baseline) damage was recorded. */
  damageAdverse: boolean;
  /** Non-positive/NaN km — a soft warning; km still shows neutrally. */
  odometerSuspect: boolean;
}

export interface ProtocolPdfData {
  /** Reservation reference, e.g. `R-2401`. */
  reference: string;
  customerName: string;
  /** Display name, e.g. `"Ford Transit (2022)"`. */
  vehicle: string;
  /** Registration plate — what tells two identical models apart. */
  plate: string;
  odometerKm: number;
  /** Fuel level in eighths, 0–8. */
  fuelEighths: number;
  /** ISO timestamp the customer signed at — a separate fact from the booking's fixed 14:00. */
  signedAt: string;
  customerAck: boolean;
  /** PNG bytes from the signature canvas. */
  signaturePng: Uint8Array;
  photos: ProtocolPdfPhoto[];
  damages: ProtocolPdfDamage[];
  /**
   * When set, renders the return comparison section and switches every document
   * title to "Protokół zwrotu". Its presence is the issue/return discriminator.
   */
  comparison?: ProtocolPdfComparison;
}

// ---------------------------------------------------------------------------
// Page geometry and tokens (mirrors the app's palette; see src/styles/global.css)
// ---------------------------------------------------------------------------

const A4 = { width: 595.28, height: 841.89 } as const;
const MARGIN = 48;
const CONTENT_WIDTH = A4.width - MARGIN * 2;

const INK = rgb(0.059, 0.09, 0.165); // #0F172A
const INK_2 = rgb(0.2, 0.255, 0.333); // #334155
const MUTED = rgb(0.58, 0.639, 0.722); // #94A3B8
const HAIRLINE = rgb(0.88, 0.89, 0.91);
const CRIMSON = rgb(0.706, 0.212, 0.22); // #B43638
const WARNING = rgb(0.714, 0.475, 0.055); // #B6790E — the app's `warning` token (adverse deltas)

const TITLE_SIZE = 19;
const HEADING_SIZE = 12;
const BODY_SIZE = 10;
const SMALL_SIZE = 8.5;

const LINE = 14;

/** Two photos per row on the grid page. */
const PHOTO_COLUMNS = 2;
const PHOTO_GAP = 14;
const PHOTO_WIDTH = (CONTENT_WIDTH - PHOTO_GAP * (PHOTO_COLUMNS - 1)) / PHOTO_COLUMNS;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Render a committed handover protocol to a PDF.
 *
 * Returns a `Blob` typed `application/pdf`, not raw bytes: the `protocols`
 * bucket's `allowed_mime_types` is checked against the **Blob's own `type`**, not
 * against storage-js's `contentType` option, so an untyped blob uploads as
 * `application/octet-stream` and is rejected.
 *
 * `fonts` is injectable only so a caller can supply pre-warmed bytes; the default
 * is the memoized embedded pair.
 */
export async function buildProtocolPdf(data: ProtocolPdfData, fonts?: PdfFonts): Promise<Blob> {
  const { regular, bold } = fonts ?? (await loadPdfFonts());

  const doc = await PDFDocument.create();
  // Must precede every `embedFont` of a custom TTF, and therefore every
  // `drawText` in this file. Without it pdf-lib cannot parse the TTF at all.
  doc.registerFontkit(fontkit);

  const font = await doc.embedFont(regular, { subset: true });
  const fontBold = await doc.embedFont(bold, { subset: true });

  // The document kind is the presence of a comparison block: a return carries one,
  // an issue never does. One title string threads through the metadata, the H1,
  // and the page footer.
  const title = data.comparison ? "Protokół zwrotu" : "Protokół wydania";

  doc.setTitle(`${title} ${data.reference}`);
  doc.setSubject(`${title} pojazdu`);
  doc.setCreator("FleetRent");

  const w = new Writer(doc, font, fontBold, title);

  drawSummary(w, data, title);
  if (data.comparison) {
    drawComparison(w, data, data.comparison);
  }
  drawDamages(w, data);
  await drawSignature(w, doc, data);
  await drawPhotoGrid(w, doc, data);

  w.finish();

  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function drawSummary(w: Writer, data: ProtocolPdfData, title: string): void {
  w.text(`${title} pojazdu`, { size: TITLE_SIZE, bold: true });
  w.gap(4);
  w.text(`${data.reference} · podpisano ${formatDateTime(data.signedAt)}`, { size: BODY_SIZE, color: MUTED });
  w.gap(16);
  w.rule();
  w.gap(14);

  w.heading("Stan techniczny");
  w.field("Klient", data.customerName);
  w.field("Pojazd", data.vehicle);
  w.field("Rejestracja", data.plate, { bold: true });
  w.field("Stan licznika", `${formatKm(data.odometerKm)} km`);
  w.field("Poziom paliwa", fuelLabelPl(data.fuelEighths));
  w.gap(10);
}

/**
 * The return document's comparison section (S-06) — the differentiating value
 * over paper. Baseline (issue) vs current (return) odometer/fuel, the three
 * deltas, and the `existing | new` damage list read from `data.damages`. Adverse
 * deltas (fuel dropped, new damage, a suspect odometer) render in the `warning`
 * token; km is always neutral (a below-baseline reading shows a negative number
 * plus the suspect note, never a hard block — soft warnings only, per FR).
 */
function drawComparison(w: Writer, data: ProtocolPdfData, c: ProtocolPdfComparison): void {
  w.heading("Porównanie ze stanem wydania");

  w.field("Przy wydaniu", `${formatKm(c.baselineOdometerKm)} km · ${fuelLabelPl(c.baselineFuelEighths)}`);
  w.field("Przy zwrocie", `${formatKm(data.odometerKm)} km · ${fuelLabelPl(data.fuelEighths)}`);
  w.gap(8);

  w.field("Przejechano", `${signedKm(c.kmDriven)} km`);
  if (c.odometerSuspect) {
    w.text("Licznik nie jest wyższy niż przy wydaniu — sprawdź odczyt.", {
      size: SMALL_SIZE,
      color: WARNING,
      indent: 120,
    });
  }
  w.field("Zmiana paliwa", signedEighths(c.fuelDelta), c.fuelAdverse ? { bold: true, color: WARNING } : {});
  w.field("Nowe uszkodzenia", String(c.newDamageCount), c.damageAdverse ? { bold: true, color: WARNING } : {});
  w.gap(10);

  if (data.damages.length > 0) {
    w.text("Uszkodzenia przy zwrocie", { size: HEADING_SIZE, bold: true });
    w.gap(6);
    for (const [index, damage] of data.damages.entries()) {
      const size = damage.size ? ` (${damage.size})` : "";
      const isNew = !damage.baselineDamageId;
      const tag = isNew ? "Nowe" : "Istniejące";
      w.ensure(LINE);
      w.text(`${index + 1}. ${DAMAGE_TYPE_LABELS_PL[damage.type]} — ${damage.location}${size} — ${tag}`, {
        size: BODY_SIZE,
        color: isNew ? CRIMSON : INK_2,
      });
    }
    w.gap(6);
  }
}

function drawDamages(w: Writer, data: ProtocolPdfData): void {
  w.heading(`Uszkodzenia (${data.damages.length === 0 ? "brak" : data.damages.length})`);

  if (data.damages.length === 0) {
    w.text("Nie zapisano żadnych uszkodzeń przy wydaniu pojazdu.", { size: BODY_SIZE, color: INK_2 });
    w.gap(10);
    return;
  }

  for (const [index, damage] of data.damages.entries()) {
    const size = damage.size ? ` (${damage.size})` : "";
    w.ensure(LINE * 2);
    w.text(`${index + 1}. ${DAMAGE_TYPE_LABELS_PL[damage.type]} — ${damage.location}${size}`, {
      size: BODY_SIZE,
      color: INK,
    });
    if (damage.photos.length > 0) {
      w.text(`${damage.photos.length} ${photoCountWord(damage.photos.length)} — patrz dokumentacja zdjęciowa`, {
        size: SMALL_SIZE,
        color: MUTED,
        indent: 12,
      });
    }
    w.gap(4);
  }
  w.gap(6);
}

async function drawSignature(w: Writer, doc: PDFDocument, data: ProtocolPdfData): Promise<void> {
  const signature = await doc.embedPng(tighten(data.signaturePng));
  const scaled = fit(signature, 220, 70);

  w.ensure(scaled.height + LINE * 4 + 20);
  w.heading("Podpis klienta");

  if (data.customerAck) {
    w.text("Klient potwierdza stan pojazdu i warunki najmu.", { size: BODY_SIZE, color: INK_2 });
  } else {
    w.text("Klient NIE potwierdził stanu pojazdu.", { size: BODY_SIZE, color: CRIMSON, bold: true });
  }
  w.gap(8);

  w.image(signature, scaled.width, scaled.height);
  w.gap(4);
  w.rule(240);
  w.gap(5);
  w.text(`${data.customerName} · ${formatDateTime(data.signedAt)}`, { size: SMALL_SIZE, color: MUTED });
}

async function drawPhotoGrid(w: Writer, doc: PDFDocument, data: ProtocolPdfData): Promise<void> {
  const tiles: { label: string; jpeg: Uint8Array }[] = [
    ...data.photos.map((photo) => ({ label: PHOTO_SLOT_LABELS_PL[photo.slot], jpeg: photo.jpeg })),
    ...data.damages.flatMap((damage, index) =>
      damage.photos.map((jpeg, n) => ({
        label: `Uszkodzenie ${index + 1} — ${DAMAGE_TYPE_LABELS_PL[damage.type]} (${n + 1})`,
        jpeg,
      })),
    ),
  ];

  if (tiles.length === 0) {
    return;
  }

  w.newPage();
  w.text("Dokumentacja zdjęciowa", { size: TITLE_SIZE, bold: true });
  w.gap(4);
  w.text(`${data.reference} · ${data.plate}`, { size: BODY_SIZE, color: MUTED });
  w.gap(16);

  for (let i = 0; i < tiles.length; i += PHOTO_COLUMNS) {
    const row = tiles.slice(i, i + PHOTO_COLUMNS);
    // `embedJpg` copies the JPEG bytes verbatim into a `DCTDecode` stream rather
    // than re-decoding them, which is why `compressImage` hands us JPEG.
    const images = await Promise.all(row.map((tile) => doc.embedJpg(tighten(tile.jpeg))));
    const heights = images.map((image) => fit(image, PHOTO_WIDTH, PHOTO_WIDTH).height);
    const rowHeight = Math.max(...heights);

    w.ensure(rowHeight + LINE + 10);
    const top = w.cursor;

    images.forEach((image, column) => {
      const scaled = fit(image, PHOTO_WIDTH, PHOTO_WIDTH);
      const x = MARGIN + column * (PHOTO_WIDTH + PHOTO_GAP);
      w.page.drawImage(image, { x, y: top - scaled.height, width: scaled.width, height: scaled.height });
      w.page.drawText(row[column].label, {
        x,
        y: top - rowHeight - 11,
        size: SMALL_SIZE,
        font: w.font,
        color: MUTED,
      });
    });

    w.cursor = top - rowHeight - LINE - 8;
  }
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
  indent?: number;
}

/**
 * A top-down cursor over a growing list of pages, with a page footer stamped on
 * each. pdf-lib is bottom-up (`y = 0` is the page's bottom edge), which is a
 * reliable source of off-by-a-page bugs, so every call site here works in
 * "distance from the top" and this class does the flip once.
 */
class Writer {
  page: PDFPage;
  cursor: number;
  private pages: PDFPage[] = [];

  constructor(
    private doc: PDFDocument,
    readonly font: PDFFont,
    readonly fontBold: PDFFont,
    /** Document label for the page footer, e.g. `"Protokół wydania"` / `"Protokół zwrotu"`. */
    private docLabel: string,
  ) {
    this.page = this.addPage();
    this.cursor = A4.height - MARGIN;
  }

  private addPage(): PDFPage {
    const page = this.doc.addPage([A4.width, A4.height]);
    this.pages.push(page);
    return page;
  }

  newPage(): void {
    this.page = this.addPage();
    this.cursor = A4.height - MARGIN;
  }

  /** Break to a new page unless `height` still fits above the bottom margin. */
  ensure(height: number): void {
    if (this.cursor - height < MARGIN + 24) {
      this.newPage();
    }
  }

  gap(height: number): void {
    this.cursor -= height;
  }

  text(value: string, options: TextOptions = {}): void {
    const size = options.size ?? BODY_SIZE;
    const font = options.bold ? this.fontBold : this.font;
    const indent = options.indent ?? 0;
    const lines = wrap(value, font, size, CONTENT_WIDTH - indent);

    for (const line of lines) {
      this.ensure(size + 4);
      this.cursor -= size;
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.cursor,
        size,
        font,
        color: options.color ?? INK,
      });
      this.cursor -= 4;
    }
  }

  heading(value: string): void {
    this.ensure(LINE * 3);
    this.text(value.toUpperCase(), { size: HEADING_SIZE, bold: true });
    this.gap(6);
  }

  /** A label/value row: muted label in a fixed gutter, value beside it. */
  field(label: string, value: string, options: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}): void {
    const gutter = 120;
    this.ensure(LINE + 4);
    this.cursor -= BODY_SIZE;
    this.page.drawText(label, { x: MARGIN, y: this.cursor, size: BODY_SIZE, font: this.font, color: MUTED });
    this.page.drawText(value, {
      x: MARGIN + gutter,
      y: this.cursor,
      size: BODY_SIZE,
      font: options.bold ? this.fontBold : this.font,
      color: options.color ?? INK,
    });
    this.cursor -= 6;
  }

  rule(width: number = CONTENT_WIDTH): void {
    this.page.drawLine({
      start: { x: MARGIN, y: this.cursor },
      end: { x: MARGIN + width, y: this.cursor },
      thickness: 0.75,
      color: HAIRLINE,
    });
  }

  image(image: PDFImage, width: number, height: number): void {
    this.ensure(height);
    this.cursor -= height;
    this.page.drawImage(image, { x: MARGIN, y: this.cursor, width, height });
  }

  /** Stamp `n / total` on every page. Only correct once no more pages will be added. */
  finish(): void {
    this.pages.forEach((page, index) => {
      page.drawText(`FleetRent · ${this.docLabel} · strona ${index + 1} z ${this.pages.length}`, {
        x: MARGIN,
        y: MARGIN - 14,
        size: SMALL_SIZE,
        font: this.font,
        color: MUTED,
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Greedy word wrap against the font's real metrics. Long unbroken tokens overflow rather than hang. */
function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = value.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Copy `bytes` into an array that owns its buffer, unless it already does.
 *
 * pdf-lib's `JpegEmbedder` builds its `DataView` from `imageData.buffer` and
 * **ignores `byteOffset`**, so any `Uint8Array` that is a *view* into a larger
 * buffer is read from the wrong offset. A node `Buffer` (pooled) and anything
 * produced by `.subarray()` are both such views. The symptom is a thrown
 * `SOI not found in JPEG` if you are lucky, and a garbled image if you are not.
 * `new Uint8Array(await blob.arrayBuffer())` is already tight, so this is a no-op
 * on the browser path — it exists so a future caller cannot reintroduce the bug.
 */
function tighten(bytes: Uint8Array): Uint8Array {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : new Uint8Array(bytes);
}

/** Scale an image to fit a box, preserving aspect ratio. Never upscales. */
function fit(image: PDFImage, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  return { width: image.width * ratio, height: image.height * ratio };
}

/**
 * `12345` → `"12 345"` with a non-breaking space.
 *
 * Hand-rolled rather than `toLocaleString("pl-PL")`: some engines group with a
 * NARROW no-break space (U+202F), which is outside the embedded subset and would
 * render as a tofu box in the middle of the odometer reading. U+00A0 is in range.
 */
function formatKm(km: number): string {
  return String(Math.trunc(km)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
}

/**
 * Signed, thousands-grouped km: `+1 228` / `-40` / `0`. ASCII `+`/`-` (not the
 * typographic minus U+2212, which is outside the embedded subset and would tofu);
 * `formatKm` groups the magnitude so the sign never lands mid-number.
 */
function signedKm(km: number): string {
  if (km === 0) {
    return "0";
  }
  return `${km > 0 ? "+" : "-"}${formatKm(Math.abs(km))}`;
}

/** Signed fuel-eighths change: `bez zmian` / `+2/8` / `-4/8` (ASCII sign, subset-safe). */
function signedEighths(delta: number): string {
  if (delta === 0) {
    return "bez zmian";
  }
  return `${delta > 0 ? "+" : "-"}${Math.abs(delta)}/8`;
}

/** ISO → `DD.MM.YYYY, HH:MM` in the viewer's local time (the depot's, in practice). */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `1` → `zdjęcie`, `2–4` → `zdjęcia`, otherwise `zdjęć` (with the 12–14 exception). */
function photoCountWord(count: number): string {
  if (count === 1) {
    return "zdjęcie";
  }
  const lastTwo = count % 100;
  const last = count % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "zdjęcia" : "zdjęć";
}
