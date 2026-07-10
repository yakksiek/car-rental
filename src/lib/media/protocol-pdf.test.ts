// core
import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";

// others
import { loadPdfFonts } from "./fonts";
import { buildProtocolPdf } from "./protocol-pdf";
import type { ProtocolPdfData } from "./protocol-pdf";

// The single most important test in this slice.
//
// The 14 standard PDF fonts are WinAnsi (Windows-1252) encoded, and pdf-lib's
// `drawText` THROWS on any character outside that encoding. Of the nine Polish
// diacritics `ą ć ę ł ń ó ś ź ż`, only `ó` is in Windows-1252 — the other eight
// throw. A prototype with fixture data like `"Jan Kowalski"` passes every test
// and dies in production on the first customer named Wąsik.
//
// So every string this fixture feeds into the PDF carries the full diacritic
// set, upper and lower, and the assertion is simply "it does not throw". These
// tests exercise the REAL embedded fonts (`loadPdfFonts` reads the same `?inline`
// data URIs the island ships) rather than a stand-in read off disk — a test that
// proved a *different* font renders Polish would prove nothing at all.

const LOWER = "ąćęłńóśźż";
const UPPER = "ĄĆĘŁŃÓŚŹŻ";

/** Every Polish diacritic, in a string shaped like real data. */
const DIACRITICS = `${LOWER} ${UPPER}`;

/** An 8×8 JPEG. `embedJpg` parses the SOF marker for dimensions, so this must be a real one. */
const JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAA" +
  "CKADAAQAAAABAAAACAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgA" +
  "CAAIAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNR" +
  "YQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeI" +
  "iYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEB" +
  "AQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDTh" +
  "JfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2" +
  "t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgK" +
  "CgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ" +
  "EBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A+mKKKK/Kz/QA/9k=";

/** A 1×1 PNG, standing in for the signature canvas's `toDataURL` output. */
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/**
 * `Buffer.from(…, "base64")` returns a view into node's shared 8 KB pool, and
 * pdf-lib reads `bytes.buffer` while ignoring `byteOffset`. Copy into a tight
 * array so the fixture exercises the same shape a browser's `blob.arrayBuffer()`
 * produces. (`buildProtocolPdf` also defends against this internally.)
 */
function decodeBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

const jpeg = () => decodeBase64(JPEG_BASE64);
const png = () => decodeBase64(PNG_BASE64);

function protocolData(overrides: Partial<ProtocolPdfData> = {}): ProtocolPdfData {
  return {
    reference: "R-2401",
    customerName: `Zażółć Gęślą Jaźń ${DIACRITICS}`,
    vehicle: "Ford Transit (2022)",
    plate: "WX 5519M",
    odometerKm: 128_450,
    fuelEighths: 6,
    signedAt: "2026-07-10T12:08:00.000Z",
    customerAck: true,
    signaturePng: png(),
    photos: [
      { slot: "front", jpeg: jpeg() },
      { slot: "rear", jpeg: jpeg() },
      { slot: "left", jpeg: jpeg() },
      { slot: "right", jpeg: jpeg() },
      { slot: "interior", jpeg: jpeg() },
      { slot: "dashboard", jpeg: jpeg() },
    ],
    damages: [
      {
        type: "scratch",
        location: `zarysowanie lewego błotnika ${DIACRITICS}`,
        size: "15 cm",
        photos: [jpeg(), jpeg()],
      },
      { type: "dent", location: "wgniecenie na tylnej klapie", size: null, photos: [] },
    ],
    ...overrides,
  };
}

/** `%PDF-` — the five bytes every reader looks for at offset 0. */
async function header(pdf: Blob): Promise<string> {
  return new TextDecoder().decode(new Uint8Array(await pdf.slice(0, 5).arrayBuffer()));
}

describe("buildProtocolPdf", () => {
  it("renders every Polish diacritic without throwing", async () => {
    const pdf = await buildProtocolPdf(protocolData());

    expect(await header(pdf)).toBe("%PDF-");
    expect(pdf.size).toBeGreaterThan(3000);
  });

  it.each([
    ["a customer name", (value: string) => protocolData({ customerName: value })],
    ["a damage location", (value: string) => protocolData({ damages: [damageWith(value)] })],
    ["a damage size", (value: string) => protocolData({ damages: [damageWith("zderzak", value)] })],
    ["a vehicle name", (value: string) => protocolData({ vehicle: value })],
  ])("accepts the full diacritic set in %s", async (_field, build) => {
    await expect(buildProtocolPdf(build(DIACRITICS))).resolves.toBeInstanceOf(Blob);
  });

  it("returns a Blob typed application/pdf", async () => {
    // The `protocols` bucket's `allowed_mime_types` is checked against the Blob's
    // OWN type, not against storage-js's `contentType` option — an untyped blob
    // uploads as `application/octet-stream` and is rejected outright.
    const pdf = await buildProtocolPdf(protocolData());
    expect(pdf.type).toBe("application/pdf");
  });

  it("renders a protocol with no damages and no photos", async () => {
    const pdf = await buildProtocolPdf(protocolData({ damages: [], photos: [] }));

    expect(await header(pdf)).toBe("%PDF-");
    expect(pdf.size).toBeGreaterThan(3000);
  });

  it("grows when photos are attached", async () => {
    const withoutPhotos = await buildProtocolPdf(protocolData({ photos: [], damages: [] }));
    const withPhotos = await buildProtocolPdf(protocolData());

    // Proves the photos actually reached the document rather than being dropped
    // by the grid's page-break arithmetic.
    expect(withPhotos.size).toBeGreaterThan(withoutPhotos.size);
  });

  it("renders an unacknowledged protocol", async () => {
    // `customerAck: false` cannot reach the API (the schema demands a literal
    // `true`), but the PDF must not silently claim the customer agreed.
    await expect(buildProtocolPdf(protocolData({ customerAck: false }))).resolves.toBeInstanceOf(Blob);
  });

  it("tolerates a Uint8Array that is a view into a larger buffer", async () => {
    // pdf-lib's JpegEmbedder reads `bytes.buffer` and ignores `byteOffset`, so a
    // `.subarray()` view would otherwise throw `SOI not found in JPEG` — or worse,
    // embed the wrong bytes. `buildProtocolPdf` tightens them first.
    const source = jpeg();
    const padded = new Uint8Array(source.length + 8);
    padded.set(source, 8);

    const data = protocolData({ photos: [{ slot: "front", jpeg: padded.subarray(8) }], damages: [] });
    await expect(buildProtocolPdf(data)).resolves.toBeInstanceOf(Blob);
  });

  it("accepts pre-warmed fonts", async () => {
    const fonts = await loadPdfFonts();
    await expect(buildProtocolPdf(protocolData(), fonts)).resolves.toBeInstanceOf(Blob);
  });
});

describe("loadPdfFonts", () => {
  it("decodes both embedded TTFs from their data URIs", async () => {
    const fonts = await loadPdfFonts();

    // `0x00010000` — the TrueType version tag every `.ttf` opens with.
    for (const bytes of [fonts.regular, fonts.bold]) {
      expect(bytes.length).toBeGreaterThan(1000);
      expect([...bytes.subarray(0, 4)]).toEqual([0x00, 0x01, 0x00, 0x00]);
    }
  });

  it("memoizes", async () => {
    expect(await loadPdfFonts()).toBe(await loadPdfFonts());
  });

  // `buildProtocolPdf` not throwing is necessary but NOT sufficient: unlike a
  // standard font, an embedded font renders a character it has no glyph for as
  // `.notdef` (a tofu box) and returns quietly. A subset regenerated with too
  // narrow a unicode range would therefore pass every test above while shipping
  // the customer a name full of boxes. Assert glyph coverage directly.
  it.each([
    ["regular", (fonts: { regular: Uint8Array }) => fonts.regular],
    ["bold", (fonts: { bold: Uint8Array }) => fonts.bold],
  ])("has a real glyph for every Polish diacritic (%s)", async (_weight, pick) => {
    const font = fontkit.create(pick(await loadPdfFonts()));

    const tofu = font
      .layout(DIACRITICS)
      .glyphs.filter((glyph) => glyph.id === 0)
      .map((glyph) => glyph.codePoints);

    expect(tofu).toEqual([]);
  });

  it("reports missing glyphs as .notdef rather than throwing", async () => {
    // Pins the behaviour the assertion above relies on: out-of-subset text does
    // not crash PDF generation, it degrades. That is why the coverage test must
    // exist, and also why a stray Cyrillic character in a damage note costs the
    // customer a tofu box rather than costing the employee their protocol.
    const font = fontkit.create((await loadPdfFonts()).regular);

    expect(font.layout("Привет").glyphs.every((glyph) => glyph.id === 0)).toBe(true);
    await expect(buildProtocolPdf(protocolData({ customerName: "Привет" }))).resolves.toBeInstanceOf(Blob);
  });
});

function damageWith(location: string, size: string | null = null) {
  return { type: "scratch" as const, location, size, photos: [] };
}
