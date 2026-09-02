// core
import { defineDict } from "./types";

// Page chrome that lives in `src/layouts/Layout.astro` — the document title's
// tagline and the missing-config banner's wrapper copy.
//
// **`Flota` is NOT here.** The brand is untranslated everywhere it appears as a
// brand (the document title, the footer wordmark, the staff sidebar wordmark);
// only the tagline beside it localizes. The identical string DOES translate to
// "Fleet" where it is a NAV ITEM, which is why the two live in different
// namespaces — see the plan's "Critical Implementation Details".
export const layout = defineDict({
  en: {
    tagline: "utility vehicle rental",
    // Banner label before a missing-config message.
    noticePrefix: "Note:",
    // Fallback link text when a config entry supplies no label of its own.
    docsLabel: "Documentation",
  },
  pl: {
    tagline: "wynajem pojazdów użytkowych",
    noticePrefix: "Uwaga:",
    docsLabel: "Dokumentacja",
  },
});
