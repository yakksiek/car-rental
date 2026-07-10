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

  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const { width, height } = scaleToFit(bitmap.width, bitmap.height, MAX_EDGE);
    return await drawToJpeg(bitmap, width, height);
  } finally {
    bitmap.close();
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

async function drawToJpeg(bitmap: ImageBitmap, width: number, height: number): Promise<Blob> {
  // `OffscreenCanvas` has no `toBlob` — that is `HTMLCanvasElement`'s
  // callback-style method. `convertToBlob` takes an options object and returns a
  // Promise. Mixing the two up is the classic mistake here.
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Nie udało się przygotować zdjęcia.");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
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
  ctx.drawImage(bitmap, 0, 0, width, height);

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
