// core
import { describe, expect, it } from "vitest";

// others
import { isHeic } from "./heic";

// `heicToJpeg` is not unit-tested: it exists to load `heic2any`, which is wasm
// and browser-only. Its correctness is the manual check "an iPhone HEIC converts
// to a visible JPEG in Chrome" — the failure it guards against (a silently BLANK
// image) is invisible to any byte-level assertion anyway.

/** Box types and brands are ASCII by spec, so a per-UTF-16-unit walk is exact here. */
const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));

/**
 * An ISO-BMFF header: 4 size bytes, `ftyp`, then the 4-byte brand. Everything
 * after byte 12 is irrelevant to the sniff, so the fixture stops there plus a
 * little padding.
 */
function isoBmff(brand: string): File {
  const bytes = new Uint8Array([0, 0, 0, 24, ...ascii("ftyp"), ...ascii(brand), 0, 0, 0, 0]);
  return new File([bytes], `photo.${brand}`, { type: "image/heic" });
}

/** `FF D8 FF E0` — the JPEG SOI marker plus an APP0 segment. */
function jpeg(): File {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...ascii("JFIF"), 0, 1, 1, 0, 0]);
  return new File([bytes], "photo.jpg", { type: "image/jpeg" });
}

/** The 8-byte PNG signature plus the start of the IHDR chunk. */
function png(): File {
  const bytes = new Uint8Array([0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  return new File([bytes], "signature.png", { type: "image/png" });
}

describe("isHeic", () => {
  // Every brand an iPhone emits for a still. `mif1` is the one that catches
  // people out: it is a *generic* HEIF brand, not an HEVC one, so a sniff that
  // only looks for `heic`/`heix` waves it through and Chrome renders a blank.
  it.each(["heic", "heix", "hevc", "hevx", "mif1", "msf1"])("returns true for the %s brand", async (brand) => {
    await expect(isHeic(isoBmff(brand))).resolves.toBe(true);
  });

  it("returns false for a JPEG", async () => {
    await expect(isHeic(jpeg())).resolves.toBe(false);
  });

  it("returns false for a PNG", async () => {
    await expect(isHeic(png())).resolves.toBe(false);
  });

  it("returns false for an ISO-BMFF container that is not a HEIF still", async () => {
    // An MP4 shares the `ftyp` box; only the brand tells them apart. A Live Photo
    // video must not be sent through the HEIC decoder.
    await expect(isHeic(isoBmff("mp42"))).resolves.toBe(false);
  });

  it("ignores a lying extension and file type, and trusts the bytes", async () => {
    const disguised = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0, 0, 0, 0, 0, 0])], "photo.heic", {
      type: "image/heic",
    });
    await expect(isHeic(disguised)).resolves.toBe(false);
  });

  it("falls back to the MIME type when the file is too short to sniff", async () => {
    await expect(isHeic(new File([new Uint8Array([0, 1, 2])], "x.heic", { type: "image/heic" }))).resolves.toBe(true);
    await expect(isHeic(new File([new Uint8Array([0, 1, 2])], "x.jpg", { type: "image/jpeg" }))).resolves.toBe(false);
  });
});
