// HEIC detection and conversion (S-05).
//
// iPhones capture HEIC by default. Safari can draw a HEIC to a canvas;
// Chrome, Firefox and Edge generally cannot — and they do not throw. They hand
// back a decoded-but-empty bitmap, so `createImageBitmap` → `convertToBlob`
// silently yields a **blank JPEG**. The employee sees a photo tile go green, the
// customer's dispute evidence is a white rectangle. This is a correctness bug,
// not a size optimization, which is why detection runs before compression rather
// than being left to the browser.
//
// `heic2any` is megabytes of wasm. It is imported **lazily**, only once a file
// has actually been sniffed as HEIC, so it never enters the initial island
// chunk. This module is island-only: it must never be reachable from `.astro`
// frontmatter or any SSR module scope.

/**
 * ISO-BMFF brands that mean "this is a HEIF/HEIC still image".
 *
 * `mif1` and `msf1` are the generic HEIF brands an iPhone also emits; `heic` /
 * `heix` / `hevc` / `hevx` are the HEVC-coded profiles. All sit at byte offset 8,
 * immediately after the 4-byte box size and the `ftyp` box type at offset 4.
 */
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis", "hevm", "hevs"]);

/** `ftyp` at offset 4 is what makes the following four bytes a brand. */
const FTYP = "ftyp";

const HEADER_BYTES = 12;

const decoder = new TextDecoder("ascii");

/**
 * True when `file` is a HEIF/HEIC still, decided by magic bytes rather than by
 * `file.type` or the extension — both of which an iPhone leaves as `image/heic`
 * only sometimes, and neither of which survives a rename.
 *
 * Falls back to the MIME type when the file is too short to sniff (a truncated
 * read is not evidence of anything).
 */
export async function isHeic(file: Blob): Promise<boolean> {
  if (file.size < HEADER_BYTES) {
    return isHeicMimeType(file.type);
  }

  const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  if (decoder.decode(header.subarray(4, 8)) !== FTYP) {
    // Not an ISO-BMFF container at all — a JPEG (`FF D8 FF`) or a PNG lands here.
    return false;
  }
  return HEIF_BRANDS.has(decoder.decode(header.subarray(8, 12)));
}

/** The MIME types an iPhone or a file picker may report for a HEIF still. */
function isHeicMimeType(type: string): boolean {
  return type === "image/heic" || type === "image/heif";
}

/**
 * Decode a HEIC to a JPEG blob, loading `heic2any` on demand.
 *
 * Quality is left high (0.92): this output is the *input* to `compressImage`,
 * which does the real resize and quality pass. Compressing twice at 0.8 would
 * stack the loss.
 *
 * `heic2any` returns `Blob | Blob[]` — an array for a multi-image HEIC (an
 * iPhone burst or a Live Photo). The first frame is the still the employee saw
 * in the picker.
 */
export async function heicToJpeg(file: Blob): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");

  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(converted) ? converted[0] : converted;

  // The bucket's `allowed_mime_types` reads the Blob's own `type`, so a blob that
  // arrives untyped would upload as `application/octet-stream` and be rejected.
  return blob.type === "image/jpeg" ? blob : new Blob([blob], { type: "image/jpeg" });
}
