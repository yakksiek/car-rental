// core
import { describe, expect, it } from "vitest";

// others
import { NAMESPACES } from "./index";
import { LOCALES } from "./types";

// The catalog's own gate (english-localization Phase 7 §4): an untranslated key
// is a FAILING TEST, not a silent fallback.
//
// Why it exists at all when `Dict<T>` already makes parity a compile error. The
// type checks the SHAPE the source declares; these check the objects that
// actually ship. Two things slip past the compiler:
//
//   * A key present in both halves whose `pl` value was pasted from `en` and
//     never translated — or, far more likely here, the reverse: an `en` value
//     still holding the Polish it was copied from. The type system cannot read
//     a string. §2 below can.
//   * A namespace registered without being declared through `defineDict`, or a
//     future refactor that widens `Dict` — the type stops carrying the
//     guarantee, and nothing says so.
//
// Both walk `NAMESPACES` from `./index.ts` rather than a list of their own, so a
// namespace added there is covered the moment it is registered. A hand-kept list
// could only check what someone remembered to add to it, which is the failure
// mode the gate is for.

const namespaces = Object.entries(NAMESPACES);

describe("catalog key parity", () => {
  it("registers every namespace under a name (the `ns.` prefix of its keys)", () => {
    // Guards the walk itself: an empty or half-built registry would make every
    // assertion below pass vacuously.
    expect(namespaces.length).toBeGreaterThan(15);
  });

  it.each(namespaces)("%s — `en` and `pl` hold exactly the same keys", (_name, dict) => {
    const en = Object.keys(dict.en).sort();
    const pl = Object.keys(dict.pl).sort();
    expect(pl).toEqual(en);
  });

  it.each(namespaces)("%s — every value in both halves is a non-empty string", (_name, dict) => {
    for (const locale of LOCALES) {
      const table: Record<string, string> = dict[locale];
      for (const [key, value] of Object.entries(table)) {
        expect(typeof value, `${locale}.${key}`).toBe("string");
        expect(value.trim(), `${locale}.${key}`).not.toBe("");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// §2 — Polish leakage in the `en` half
// ---------------------------------------------------------------------------
//
// The copy-paste-forgot-to-translate case, which the types cannot see. A `pl`
// value duplicated into `en` and left there renders Polish to an English reader
// with every gate green — `npm run sweep:i18n` deliberately skips this directory
// (Polish lives here legitimately), so nothing else looks.
//
// Diacritics are the detector rather than a vocabulary because the direction is
// reversed from the sweep's: there, a hand-list could only catch Polish someone
// had already noticed; here the corpus is small, authored, and reviewed, and the
// realistic failure is a whole Polish sentence — which always carries one.
//
// The knowing gap is diacritic-free Polish in an `en` value (`Start`, `Cennik`,
// `Pulpit`). Those are single words and are what a reviewer sees at a glance;
// the sentences are what hide.

/**
 * Polish that stays Polish in English copy — the CLOSED set of product
 * decisions, each one recorded, not a convenience list.
 *
 *   * `zł` is a currency SYMBOL, not a word: it stays `zł` in both locales
 *     (`glossary.md` §4, and `format.ts` composes the amount by hand rather than
 *     using `style: "currency"` for the same reason).
 *   * `Mokotów` is a Warsaw district — a proper noun, and the one depot's name.
 *   * The rest are Polish LEGAL INSTRUMENTS with no English equivalent (frame
 *     decision 3 / `glossary.md` §4). Each is kept and glossed once per surface:
 *     "dowód osobisty (Polish national ID card)". Inventing "national ID card"
 *     is wrong, not merely awkward.
 *
 * Adding English copy with a new Polish word fails this test until the word is
 * added here, which is the intended friction: the list is the record of which
 * Polish is deliberate.
 */
const RETAINED_POLISH = ["zł", "Mokotów", "dowód osobisty", "prawo jazdy", "faktura VAT"];

const DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/** The value with every deliberately-retained Polish term removed. */
function withoutRetainedPolish(value: string): string {
  return RETAINED_POLISH.reduce((text, term) => text.split(term).join(""), value);
}

describe("no Polish leaks into the `en` half", () => {
  it.each(namespaces)("%s", (_name, dict) => {
    const leaks = Object.entries(dict.en as Record<string, string>)
      .filter(([, value]) => DIACRITICS.test(withoutRetainedPolish(value)))
      .map(([key, value]) => `${key}: ${value}`);
    expect(leaks).toEqual([]);
  });

  it("the detector is not vacuous — an untranslated value would be caught", () => {
    expect(DIACRITICS.test(withoutRetainedPolish("Akceptuję regulamin wynajmu."))).toBe(true);
    // The knowing gap, asserted rather than merely described: diacritic-free
    // Polish is invisible to this detector. Those are single words a reviewer
    // sees at a glance; the sentences are what hide, and they always carry one.
    expect(DIACRITICS.test(withoutRetainedPolish("Zaakceptuj regulamin wynajmu."))).toBe(false);
    // …and the retained terms really are subtracted rather than the whole check
    // being disabled: an allowed term inside an otherwise-Polish sentence still
    // fails, so the list cannot be used to wave a leak through.
    expect(DIACRITICS.test(withoutRetainedPolish("Kaucja od 1 500 zł, zwracana w ciągu 3 dni"))).toBe(true);
    expect(DIACRITICS.test(withoutRetainedPolish("Deposit from 1 500 zł, refunded within 3 days"))).toBe(false);
  });
});
