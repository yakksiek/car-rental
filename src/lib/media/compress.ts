// others
import { heicToJpeg, isHeic } from "./heic";

// Client-side image compression (S-05).
//
// This is load-bearing twice over, and is not an optimization:
//
//  1. It protects the upload path — six baseline photos plus per-damage photos
//     straight off a modern phone camera are ~2 MB each.
//  2. It protects pdf-lib's peak memory on that phone. Eight full-size photos
//     plus a PDF copy is a 35–50 MB peak, and iOS Safari's per-tab ceiling is
//     undocumented. The bytes must shrink *before* pdf-lib ever sees them.
//
// Zero dependencies: `createImageBitmap` + `OffscreenCanvas` are native. EXIF
// orientation is applied by the browser by default (`imageOrientation: "from-image"`),
// so a portrait photo does not land sideways in the PDF.
//
// Island-only — never reachable from `.astro` frontmatter or SSR module scope.

/** Long edge, in pixels. Enough to read a plate or a scratch; small enough to upload over a weak signal. */
const MAX_EDGE = 1600;

const QUALITY = 0.8;

/** The one MIME type this module ever produces, and one of the bucket's allowed types. */
const JPEG = "image/jpeg";

/**
 * Compress an image file to a JPEG blob, resized to `MAX_EDGE` on its long edge.
 *
 * HEIC input is converted first: Chrome, Firefox and Edge cannot draw a HEIC to
 * a canvas and yield a **blank** image rather than an error (see `./heic`).
 *
 * Throws if the browser cannot decode the file. That is deliberate — the photo
 * tile paints its `failed` state and offers `Ponów`, which is strictly better
 * than uploading a blank rectangle the customer later needs as dispute evidence.
 */
export async function compressImage(file: File | Blob): Promise<Blob> {
  const source = (await isHeic(file)) ? await heicToJpeg(file) : file;

  const decoded = await decode(source);
  // Only an `ImageBitmap` owns GPU/native memory that must be released; an
  // `HTMLImageElement` (the createImageBitmap-free fallback) does not.
  const bitmap = typeof ImageBitmap !== "undefined" && decoded instanceof ImageBitmap ? decoded : null;
  try {
    const srcWidth = bitmap ? bitmap.width : (decoded as HTMLImageElement).naturalWidth;
    const srcHeight = bitmap ? bitmap.height : (decoded as HTMLImageElement).naturalHeight;
    const { width, height } = scaleToFit(srcWidth, srcHeight, MAX_EDGE);
    return await drawToJpeg(decoded, width, height);
  } finally {
    bitmap?.close();
  }
}

/**
 * Decode a blob to an `ImageBitmap`, resilient to mobile-browser quirks.
 *
 * `createImageBitmap` is the fast, memory-lean path, but the `imageOrientation`
 * option is a compatibility trap: older iOS Safari only accepted `"none"` /
 * `"flipY"` and **throws a `TypeError`** on `"from-image"`, and a portrait phone
 * photo is exactly where orientation matters. So: try with the option, fall back
 * to no option, and finally fall back to an `<img>` decode for any engine whose
 * `createImageBitmap` cannot handle the source at all. The browser applies EXIF
 * orientation by default in all three paths.
 */
async function decode(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(source, { imageOrientation: "from-image" });
    } catch {
      // Ignore — older Safari rejects the `imageOrientation` option; retry without it.
    }
    try {
      return await createImageBitmap(source);
    } catch {
      // `createImageBitmap` exists but cannot decode/allocate here. A Chrome with
      // no working GPU (hardware acceleration disabled, GPU blocklisted, a VM /
      // remote desktop, or a driver fault) throws "The ImageBitmap could not be
      // allocated" on *every* createImageBitmap call — so retrying it is pointless.
      // Fall through to the `<img>` path, which never touches createImageBitmap.
    }
  }
  return decodeViaImage(source);
}

/**
 * Last-resort decode that **never calls `createImageBitmap`**: a fully-decoded
 * `<img>` element, handed to `ctx.drawImage` directly. This is the path that keeps
 * working when createImageBitmap cannot allocate at all (a GPU-less / hardware-
 * acceleration-disabled Chrome, or headless) — the failure mode that otherwise
 * makes every photo upload impossible. The browser applies EXIF orientation to the
 * `<img>` by default, so a portrait photo still draws upright.
 */
async function decodeViaImage(source: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    // `decode()` resolves once the image is fully decoded (and rejects on a format
    // the browser cannot read), so the object URL is safe to revoke right after —
    // the element keeps its decoded pixels for the later `drawImage`.
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Fit inside a `max`×`max` box, preserving aspect ratio. Never upscales. */
export function scaleToFit(width: number, height: number, max: number): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= max) {
    return { width, height };
  }
  const ratio = max / longEdge;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

async function drawToJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  // `OffscreenCanvas` has no `toBlob` — that is `HTMLCanvasElement`'s
  // callback-style method. `convertToBlob` takes an options object and returns a
  // Promise. Mixing the two up is the classic mistake here. `drawImage` accepts
  // either an `ImageBitmap` or an `HTMLImageElement`, so both decode paths share this.
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Nie udało się przygotować zdjęcia.");
    }
    ctx.drawImage(source, 0, 0, width, height);
    return asJpeg(await canvas.convertToBlob({ type: JPEG, quality: QUALITY }));
  }

  // iOS Safari gained `OffscreenCanvas` only in 16.4, and an employee's phone is
  // exactly the device that lags behind. Fall back to the DOM canvas.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Nie udało się przygotować zdjęcia.");
  }
  ctx.drawImage(source, 0, 0, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(asJpeg(blob));
        } else {
          reject(new Error("Nie udało się przygotować zdjęcia."));
        }
      },
      JPEG,
      QUALITY,
    );
  });
}

/**
 * The `protocols` bucket's `allowed_mime_types` is checked against the **Blob's
 * own `type`**, not against storage-js's `contentType` option. A blob that
 * arrives untyped uploads as `application/octet-stream` and the upload is
 * rejected. Both canvas paths already set `image/jpeg`; this makes that a
 * guarantee rather than an assumption.
 */
function asJpeg(blob: Blob): Blob {
  return blob.type === JPEG ? blob : new Blob([blob], { type: JPEG });
}
