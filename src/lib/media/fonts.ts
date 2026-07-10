// core
import notoSansBold from "../../assets/fonts/NotoSans-Bold.subset.ttf?inline";
import notoSansRegular from "../../assets/fonts/NotoSans-Regular.subset.ttf?inline";

// The Unicode TTFs `buildProtocolPdf` embeds.
//
// `?inline` resolves to a `data:font/ttf;base64,…` URI, which `fetch` reads
// identically in the browser island and under vitest's node environment. That is
// the whole point: the unit test that pins `ą ć ę ł ń ó ś ź ż` exercises the
// exact bytes the employee's phone ships, rather than a stand-in read off disk.
//
// `?url` would hand back `/src/assets/…`, which node cannot fetch — so this must
// stay `?inline`. See `src/assets/fonts/README.md` for the subset ranges.
//
// Island-only, like everything under `src/lib/media/`.

export interface PdfFonts {
  regular: Uint8Array;
  bold: Uint8Array;
}

let cached: Promise<PdfFonts> | null = null;

async function readDataUri(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * The embedded font bytes, decoded once per page load. An employee files several
 * protocols per shift and the data URIs never change, so the decode is memoized.
 */
export function loadPdfFonts(): Promise<PdfFonts> {
  cached ??= Promise.all([readDataUri(notoSansRegular), readDataUri(notoSansBold)])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((error: unknown) => {
      // Never memoize a failure: the next protocol gets a fresh attempt.
      cached = null;
      throw error;
    });
  return cached;
}
