// core
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";

// others
import { formatInteger, plural } from "../format";
import { dateTimeCompany } from "../format-date";
import { translator } from "../i18n/types";
import type { Locale } from "../i18n/types";
import { damageTypeLabel, fuelLevelLabel, photoSlotLabel, protocol } from "../i18n/protocol";
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
 * document (`returnTitle`); absent ⇒ an **issue** document (`issueTitle`). The numbers come from `computeReturnDeltas` (src/lib/protocol-delta.ts)
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
   * title to the return wording. Its presence is the issue/return discriminator.
   */
  comparison?: ProtocolPdfComparison;
  /**
   * The language to render this document in — `reservations.locale`, threaded
   * through `ProtocolContext.documentLocale` and stamped onto `protocols.locale`
   * by the same submit that stores these bytes.
   *
   * **Never the employee's session locale.** The customer signs a declaration
   * directly beneath their own signature; a recruiter reading an English cockpit
   * must not make the next walk-in sign one in a language they did not read.
   * Required rather than defaulted for exactly that reason — a default is how a
   * caller silently gets this wrong.
   */
  locale: Locale;
}

// ---------------------------------------------------------------------------
// Page geometry and tokens (mirrors the app's palette; see src/styles/global.css)
// ---------------------------------------------------------------------------

/** Bind the protocol copy to the language this document is being rendered in. */
function copy(locale: Locale) {
  return translator(locale, protocol);
}

/**
 * The company name, on the document metadata and every page footer. NOT a
 * catalog key: it is the brand, identical in both languages — unlike the cockpit
 * nav item spelled the same way, which does translate ("Fleet"). The two are one
 * string with opposite requirements, which is why they live apart.
 */
const BRAND = "Flota";

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

  const t = copy(data.locale);

  // The document kind is the presence of a comparison block: a return carries one,
  // an issue never does. Two labels thread out of it: the short one for the
  // metadata and the page footer, the full one for the H1 and the subject.
  const label = data.comparison ? t("returnTitle") : t("issueTitle");
  const heading = data.comparison ? t("pdfReturnHeading") : t("pdfIssueHeading");

  doc.setTitle(`${label} ${data.reference}`);
  doc.setSubject(heading);
  // The BRAND, and it does not translate — `Flota` in both languages, unlike the
  // cockpit nav item that reads "Fleet" in English (see the plan's brand/nav
  // collision note).
  doc.setCreator(BRAND);

  const w = new Writer(doc, font, fontBold, label, data.locale);

  drawSummary(w, data, heading);
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

function drawSummary(w: Writer, data: ProtocolPdfData, heading: string): void {
  const { locale } = data;
  const t = copy(locale);

  w.text(heading, { size: TITLE_SIZE, bold: true });
  w.gap(4);
  w.text(`${data.reference} · ${t("pdfSigned")} ${formatSignedAt(data.signedAt, locale)}`, {
    size: BODY_SIZE,
    color: MUTED,
  });
  w.gap(16);
  w.rule();
  w.gap(14);

  w.heading(t("conditionTitle"));
  w.field(t("pdfCustomer"), data.customerName);
  w.field(t("pdfVehicle"), data.vehicle);
  w.field(t("pdfPlate"), data.plate, { bold: true });
  w.field(t("pdfOdometer"), `${formatKm(data.odometerKm, locale)} km`);
  w.field(t("fuelLevel"), fuelLevelLabel(data.fuelEighths, locale));
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
  const { locale } = data;
  const t = copy(locale);

  w.heading(t("pdfComparisonHeading"));

  w.field(
    t("atPickup"),
    `${formatKm(c.baselineOdometerKm, locale)} km · ${fuelLevelLabel(c.baselineFuelEighths, locale)}`,
  );
  w.field(t("pdfAtReturn"), `${formatKm(data.odometerKm, locale)} km · ${fuelLevelLabel(data.fuelEighths, locale)}`);
  w.gap(8);

  w.field(t("distanceDriven"), `${signedKm(c.kmDriven, locale)} km`);
  if (c.odometerSuspect) {
    w.text(t("pdfOdometerSuspect"), {
      size: SMALL_SIZE,
      color: WARNING,
      indent: 120,
    });
  }
  w.field(t("fuelChange"), signedEighths(c.fuelDelta, locale), c.fuelAdverse ? { bold: true, color: WARNING } : {});
  w.field(t("comparisonNewDamage"), String(c.newDamageCount), c.damageAdverse ? { bold: true, color: WARNING } : {});
  w.gap(10);

  if (data.damages.length > 0) {
    w.text(t("pdfReturnDamages"), { size: HEADING_SIZE, bold: true });
    w.gap(6);
    for (const [index, damage] of data.damages.entries()) {
      const size = damage.size ? ` (${damage.size})` : "";
      const isNew = !damage.baselineDamageId;
      const tag = isNew ? t("damageNew") : t("damageExisting");
      w.ensure(LINE);
      w.text(`${index + 1}. ${damageTypeLabel(damage.type, locale)} — ${damage.location}${size} — ${tag}`, {
        size: BODY_SIZE,
        color: isNew ? CRIMSON : INK_2,
      });
    }
    w.gap(6);
  }
}

function drawDamages(w: Writer, data: ProtocolPdfData): void {
  const { locale } = data;
  const t = copy(locale);

  w.heading(`${t("damageTitle")} (${data.damages.length === 0 ? t("pdfNoDamage") : data.damages.length})`);

  if (data.damages.length === 0) {
    w.text(t("pdfNoDamageBody"), { size: BODY_SIZE, color: INK_2 });
    w.gap(10);
    return;
  }

  for (const [index, damage] of data.damages.entries()) {
    const size = damage.size ? ` (${damage.size})` : "";
    w.ensure(LINE * 2);
    w.text(`${index + 1}. ${damageTypeLabel(damage.type, locale)} — ${damage.location}${size}`, {
      size: BODY_SIZE,
      color: INK,
    });
    if (damage.photos.length > 0) {
      w.text(`${damage.photos.length} ${photoCountWord(damage.photos.length, locale)} ${t("pdfSeePhotos")}`, {
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
  const { locale } = data;
  const t = copy(locale);
  const signature = await doc.embedPng(tighten(data.signaturePng));
  const scaled = fit(signature, 220, 70);

  w.ensure(scaled.height + LINE * 4 + 20);
  w.heading(t("pdfSignatureHeading"));

  // The declaration the customer's signature sits directly beneath — which is
  // the single strongest reason this whole file renders in the DOCUMENT's
  // language and not the reader's.
  if (data.customerAck) {
    w.text(t("ackLabel"), { size: BODY_SIZE, color: INK_2 });
  } else {
    w.text(t("pdfAckRefused"), { size: BODY_SIZE, color: CRIMSON, bold: true });
  }
  w.gap(8);

  w.image(signature, scaled.width, scaled.height);
  w.gap(4);
  w.rule(240);
  w.gap(5);
  w.text(`${data.customerName} · ${formatSignedAt(data.signedAt, locale)}`, { size: SMALL_SIZE, color: MUTED });
}

async function drawPhotoGrid(w: Writer, doc: PDFDocument, data: ProtocolPdfData): Promise<void> {
  const { locale } = data;
  const t = copy(locale);
  const tiles: { label: string; jpeg: Uint8Array }[] = [
    ...data.photos.map((photo) => ({ label: photoSlotLabel(photo.slot, locale), jpeg: photo.jpeg })),
    ...data.damages.flatMap((damage, index) =>
      damage.photos.map((jpeg, n) => ({
        label: t("pdfDamageTile")
          .replace("{n}", String(index + 1))
          .replace("{type}", damageTypeLabel(damage.type, locale))
          .replace("{i}", String(n + 1)),
        jpeg,
      })),
    ),
  ];

  if (tiles.length === 0) {
    return;
  }

  w.newPage();
  w.text(t("pdfPhotoDocumentation"), { size: TITLE_SIZE, bold: true });
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
    /** Document label for the page footer, e.g. `"Pickup protocol"` / `"Protokół zwrotu"`. */
    private docLabel: string,
    /** The DOCUMENT's language — the footer's `page n of m` reads from it. */
    private locale: Locale,
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
    const pageOf = copy(this.locale)("pdfPageOf");
    this.pages.forEach((page, index) => {
      const counter = pageOf.replace("{n}", String(index + 1)).replace("{total}", String(this.pages.length));
      page.drawText(`${BRAND} · ${this.docLabel} · ${counter}`, {
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
 * `12345` → `"12 345"`, grouped for the artifact locale.
 *
 * Shares the app's one grouper, then **pins the separator into the embedded font
 * subset**. Some CLDR versions group with a NARROW no-break space (U+202F), which
 * is outside the subset: `drawText` would either throw or draw a tofu box in the
 * middle of the odometer reading. U+00A0 is in range, so anything narrow is folded
 * onto it. This is the one caller of `formatInteger` that post-processes it, and
 * the reason `format.ts` names the PDF as its exception.
 */
function formatKm(km: number, locale: Locale): string {
  return formatInteger(km, locale).replace(/\u202F/g, "\u00A0");
}

/**
 * Signed, thousands-grouped km: `+1 228` / `-40` / `0`. ASCII `+`/`-` (not the
 * typographic minus U+2212, which is outside the embedded subset and would tofu);
 * `formatKm` groups the magnitude so the sign never lands mid-number.
 */
function signedKm(km: number, locale: Locale): string {
  if (km === 0) {
    return "0";
  }
  return `${km > 0 ? "+" : "-"}${formatKm(Math.abs(km), locale)}`;
}

/** Signed fuel-eighths change: `no change` / `+2/8` / `-4/8` (ASCII sign, subset-safe). */
function signedEighths(delta: number, locale: Locale): string {
  if (delta === 0) {
    return copy(locale)("pdfNoChange");
  }
  return `${delta > 0 ? "+" : "-"}${Math.abs(delta)}/8`;
}

/**
 * The signature instant, in the COMPANY's zone and the document's language —
 * `10 lip 2026, 14:08` / `10 Jul 2026, 14:08`.
 *
 * Two changes from the hand-rolled `DD.MM.YYYY, HH:MM` this replaced. The zone is
 * now pinned rather than the renderer's: a signature is a company-anchored event
 * (locale lesson), and the read-only view already shows it that way through this
 * same `dateTimeCompany` — the PDF and the screen were quietly disagreeing about
 * both the format and the zone. And the separator is folded the way `formatKm`
 * folds its grouping space: some CLDR versions emit a NARROW no-break space
 * (U+202F) around the time, which is outside the embedded font subset and would
 * draw a tofu box in the middle of the timestamp under the customer's signature.
 */
function formatSignedAt(iso: string, locale: Locale): string {
  return dateTimeCompany(new Date(iso), locale).replace(/\u202F/g, "\u00A0");
}

/**
 * `1` → `zdjęcie`, `2–4` → `zdjęcia`, otherwise `zdjęć`; `photo` / `photos` under
 * `en`. The 12–14 exception used to be open-coded here; `Intl.PluralRules`
 * supplies it now via the shared `plural`, which falls back to `other` for the
 * categories a locale does not select — so passing all four arms is right for
 * both languages.
 *
 * The words come from the catalog rather than a table of its own: the damage
 * editor's photo strip counts the same things with the same nouns
 * (`DamageEditor.tsx` `photoCount`), and this document is the customer's copy of
 * what that editor recorded.
 */
function photoCountWord(count: number, locale: Locale): string {
  const t = copy(locale);
  return plural(count, locale, {
    one: t("photoCountOne"),
    few: t("photoCountFew"),
    many: t("photoCountMany"),
    other: t("photoCountOther"),
  });
}
