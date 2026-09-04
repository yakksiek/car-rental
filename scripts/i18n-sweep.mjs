#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Polish-copy sweep — the scripted gate behind plan criteria 5.6 and 6.15 of
// `context/changes/english-localization`.
//
// A plain diacritic grep undercounts badly: `Start`, `Flota`, `Cennik`,
// `Pulpit`, `Nowe`, `Wszystkie` and `Nie znaleziono zwrotu` carry none between
// them. So this scans for BOTH the nine Polish diacritics AND a vocabulary
// harvested from the catalog itself, over source with comments and catalog `pl`
// blocks stripped out — the two places Polish legitimately lives.
//
//   npm run sweep:i18n            # src/pages + src/components   (criterion 5.6)
//   npm run sweep:i18n -- --all   # all of src/                  (criterion 6.15)
//
// Exit code 1 on any hit, so it can gate CI.
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ALL = process.argv.includes("--all");
const ROOTS = ALL ? ["src"] : ["src/pages", "src/components"];

// Polish lives legitimately in the catalog's `pl` halves; nothing else there is
// app copy. (It is also the sweep's own dictionary — see `harvestPolishWords`.)
const CATALOG_DIR = "src/lib/i18n";
const SKIP_DIRS = new Set([CATALOG_DIR]);

// `slug.ts` is the one file whose Polish is DATA, not copy: a 9-entry
// transliteration table (`ą → a`) that exists so a user-entered vehicle name
// yields an ASCII URL. It has no English twin by construction, and the plan is
// explicit that the behaviour stays (Phase 5 §5). Exempted by name so the
// full-tree sweep (`--all`, Phase 6's criterion) does not trip on it.
const SKIP_FILES = new Set(["src/lib/slug.ts"]);

const EXT = /\.(ts|tsx|astro)$/;

// Test files assert BOTH locales by design — a Polish literal in one is the
// assertion, not a leak.
const IS_TEST = /\.test\.(ts|tsx)$/;

const DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Blank out `//`, block, JSX and HTML comments, preserving line numbers so a hit
 * still reports where it is. Runs before any `pl:` matching, so a `pl:` written
 * inside prose cannot open a bogus block.
 */
function stripComments(src) {
  const out = src.split("");
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i += 1) {
      if (out[i] !== "\n") out[i] = " ";
    }
  };
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] === "/" && src[i + 1] === "/") {
      const end = src.indexOf("\n", i);
      blank(i, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end;
    } else if (src[i] === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      blank(i, end === -1 ? src.length : end + 2);
      i = end === -1 ? src.length : end + 1;
    } else if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      blank(i, end === -1 ? src.length : end + 3);
      i = end === -1 ? src.length : end + 2;
    }
  }
  return out.join("");
}

/**
 * Every `<locale>: { … }` / `[ … ]` / `"…"` region in `src`, as [start, end)
 * offsets. Brace-matched rather than regex-bounded, because a namespace half is
 * nested objects and a lazy regex would stop at the first `}`.
 */
function localeRegions(src, locale) {
  const out = [];
  for (const match of src.matchAll(new RegExp(String.raw`\b${locale}\s*[:=]\s*([{[])`, "g"))) {
    const open = match[1];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let i = match.index + match[0].length - 1;
    for (; i < src.length; i += 1) {
      if (src[i] === open) depth += 1;
      else if (src[i] === close) {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push([match.index, i + 1]);
  }
  for (const match of src.matchAll(new RegExp(String.raw`\b${locale}\s*[:=]\s*(["'\`])(?:\\.|(?!\1).)*\1`, "g"))) {
    out.push([match.index, match.index + match[0].length]);
  }
  return out;
}

/**
 * The diacritic-free Polish this app ships — HARVESTED from the catalog rather
 * than hand-listed.
 *
 * A hand-curated list is circular: it can only name Polish someone already
 * noticed, so it cannot catch the leak it was not written for. It did not.
 * `Nie znaleziono zwrotu` sat rendered on `/dashboard/returns/<id>` through a
 * clean sweep — none of its three words carries a diacritic, and none was on the
 * list, because nothing had put it there.
 *
 * The vocabulary therefore comes from `src/lib/i18n/*.ts`: every word in a `pl`
 * half, MINUS every word in an `en` half. The subtraction is what makes it
 * usable — it drops `model`, `status`, `email`, `FAQ`, `Flota`, `LPG`, `Diesel`
 * and every other token the two languages share, which is exactly the set that
 * would otherwise fire on ordinary code. Growing the catalog grows the detector,
 * which is the property the hand-written list could never have.
 */
function harvestPolishWords() {
  const pl = new Set();
  const en = new Set();

  const collect = (text, into) => {
    for (const match of text.matchAll(/["'`]([^"'`\n]{2,})["'`]/g)) {
      for (const word of match[1].toLowerCase().match(/\p{L}{3,}/gu) ?? []) {
        into.add(word);
      }
    }
  };

  for (const entry of readdirSync(join(ROOT, CATALOG_DIR))) {
    if (!entry.endsWith(".ts") || entry.includes(".test.")) continue;
    const src = stripComments(readFileSync(join(ROOT, CATALOG_DIR, entry), "utf8"));
    for (const [locale, into] of [
      ["pl", pl],
      ["en", en],
    ]) {
      for (const [from, to] of localeRegions(src, locale)) {
        collect(src.slice(from, to), into);
      }
    }
  }

  for (const word of en) {
    pl.delete(word);
  }
  // Two the catalog has no reason to carry, but a leak would: an `aria-label`
  // on a header cell with no visible text, and the cockpit's old name.
  pl.add("akcje");
  pl.add("pulpit");
  return [...pl];
}

const WORDS = harvestPolishWords();
const WORD_RE = new RegExp(String.raw`(?<!\p{L})(?:${WORDS.join("|")})(?!\p{L})`, "iu");

// Attributes whose value is a code token, never copy. Needed because the
// harvested vocabulary legitimately contains short words like `start` (Polish
// for "Home") and `auto` (Polish for "car"), which would otherwise fire on
// `align="start"` and `type="auto"`. Copy-bearing attributes — `aria-label`,
// `placeholder`, `alt`, `title`, `aria-roledescription` — are deliberately NOT
// here: `aria-label="Akcje"` is exactly the kind of leak this sweep exists for.
const CODE_ATTRS = [
  "class",
  "className",
  "id",
  "htmlFor",
  "name",
  "key",
  "href",
  "src",
  "slot",
  "role",
  "type",
  "mode",
  "variant",
  "size",
  "align",
  "side",
  "format",
  "method",
  "rel",
  "target",
  "dir",
  "lang",
  "style",
  "width",
  "height",
  "viewBox",
  "fill",
  "stroke",
  "strokeWidth",
  "strokeLinecap",
  "strokeLinejoin",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "xmlns",
  "accept",
  "capture",
  "autoComplete",
  "inputMode",
  "tabIndex",
  "data-slot",
];

/** A path, URL, e-mail address or phone number — an address, not a sentence. */
function isAddress(value) {
  const v = value.trim();
  return /^[./#]/.test(v) || /^(?:https?|mailto|tel):/.test(v) || /^[\w.+-]+@[\w.-]+\.\w+$/.test(v);
}

/** A Tailwind class list, not a sentence: every token is CSS-shaped and at least one carries a `-`, `:` or `[`. */
function looksLikeClassList(value) {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  // The token must START lowercase / digit / `@` / `[` — that alone rules out a
  // sentence, whose first word is capitalised. The TAIL allows uppercase so an
  // arbitrary value (`text-[#0A0A0F]`) still reads as CSS. And at least one token
  // has to carry a `-`, `:`, `[` or `/`, or an all-lowercase Polish sentence
  // ("dostępny tylko jako dzień odbioru") would qualify as a class list.
  const cssShaped = /^[a-z0-9@[][-a-zA-Z0-9:./[\]()%@#_,!*<>=+&'~]*$/;
  return tokens.every((token) => cssShaped.test(token)) && tokens.some((token) => /[-:[/]/.test(token));
}

/**
 * Reduce a file to just its COPY, blanking everything else but preserving line
 * numbers so a hit still reports where it is.
 *
 * This EXTRACTS rather than excludes, and that direction is the whole point. The
 * first version blanked known-bad regions and kept the rest, which meant every
 * ordinary identifier stayed in scope — so the harvested vocabulary fired on
 * `busy` (Polish for "buses"), `auto` ("car") and `start` ("Home") wherever they
 * appeared as a variable, a Tailwind token or an attribute value. Copy only ever
 * lives in two places, so those are the only two this keeps:
 *
 *   1. string literals that are not a class list, a module specifier, or the
 *      value of a code-token attribute;
 *   2. JSX / HTML text nodes.
 *
 * Everything else — identifiers, imports, class strings, `<style>` and
 * `<script>` bodies, `${…}` interpolations — is blanked unread.
 */
function extractCopy(src) {
  const stripped = stripComments(src);
  const keep = new Array(stripped.length).fill(false);
  const mark = (from, to) => {
    for (let i = from; i < to && i < stripped.length; i += 1) keep[i] = true;
  };
  const unmark = (from, to) => {
    for (let i = from; i < to && i < stripped.length; i += 1) keep[i] = false;
  };

  // ── 1. String literals ────────────────────────────────────────────────────
  for (const match of stripped.matchAll(/(["'`])((?:\\.|(?!\1)[^])*?)\1/g)) {
    const body = match[2];
    if (looksLikeClassList(body)) continue;
    const before = stripped.slice(Math.max(0, match.index - 60), match.index);
    // A path, URL or e-mail address is an address, not a sentence.
    if (isAddress(body)) continue;
    // A developer diagnostic — a `console.*` argument or a thrown `Error`. This
    // codebase has three of them by deliberate decision (the cached-blob miss,
    // the image-decode failure, the busy-ranges read): every caller catches and
    // paints its own localized state, so the string reaches a console and never
    // a user. Translating them would be translating text nobody can read.
    if (/(?:console\.\w+|new Error)\s*\(\s*$/.test(before)) continue;
    // An identifier-shaped literal is a code token — an icon name (`"mail"`), a
    // union member (`| "bus"`), an enum value (`value="manual"`), a tone
    // (`tone="ink"`), a generated RPC name (`"get_vehicle_busy_ranges"` — which
    // contains `busy`, Polish for "buses"). It skips the WORDLIST check only;
    // the diacritic check
    // still applies, so `"pełny"` would still be caught. The knowing gap is
    // single-word, all-lowercase, diacritic-free Polish copy — which in this
    // codebase lives in the catalog, not in a bare literal.
    if (/^[a-z][A-Za-z0-9_]*$/.test(body) && !DIACRITICS.test(body)) continue;
    // A module specifier, or the value of an attribute that carries a code token
    // rather than words. `aria-label` / `placeholder` / `alt` / `title` are
    // deliberately absent from CODE_ATTRS — `aria-label="Akcje"` is exactly the
    // leak this sweep exists for.
    if (/\b(?:from|import)\s*\(?\s*$/.test(before)) continue;
    if (new RegExp(String.raw`\b(?:${CODE_ATTRS.join("|")})\s*=\s*\{?\s*$`).test(before)) continue;
    mark(match.index + 1, match.index + 1 + body.length);
  }

  // `${…}` inside a template literal is code, not copy.
  for (const match of stripped.matchAll(/\$\{[^{}]*\}/g)) {
    unmark(match.index, match.index + match[0].length);
  }

  // ── 2. JSX / HTML text nodes ──────────────────────────────────────────────
  //
  // Each `>…<` run is handled ON ITS OWN, which is what makes the brace rule
  // work. A BALANCED `{…}` inside a run is an interpolation, so only it is
  // dropped and the words around it survive (`Przy wydaniu {base}` → the two
  // words are still copy). An UNBALANCED `{` means the run is not text at all
  // but the head of a JSX expression (`{busy ? (`), so everything from it to the
  // end of the run goes. Doing this globally instead — unmark `{` to its match
  // wherever it appears — swallowed the whole conditional, and with it the real
  // `Zapisywanie…` leak nested inside its true branch.
  for (const match of stripped.matchAll(/>([^<>]+)</g)) {
    const run = match[1];
    // `>` … `<` also spans plain code between a generic's closing angle and the
    // next tag (`React.useState(false);` … `<span`). A markup text node carries
    // neither a statement terminator nor an assignment.
    if (/[;=]/.test(run)) continue;
    // `>kontakt@flota.pl<` is an address the markup happens to render as text.
    if (isAddress(run)) continue;
    const base = match.index + 1;
    mark(base, base + run.length);
    let depth = 0;
    let openedAt = -1;
    for (let i = 0; i < run.length; i += 1) {
      if (run[i] === "{") {
        if (depth === 0) openedAt = i;
        depth += 1;
      } else if (run[i] === "}" && depth > 0) {
        depth -= 1;
        if (depth === 0) unmark(base + openedAt, base + i + 1);
      }
    }
    // An unbalanced `{` never closed inside this run.
    if (depth > 0 && openedAt >= 0) unmark(base + openedAt, base + run.length);
  }

  // `<style>` and `<script>` bodies are not markup text.
  for (const match of stripped.matchAll(/<(style|script)\b[^>]*>[^]*?<\/\1>/g)) {
    unmark(match.index, match.index + match[0].length);
  }

  // Polish lives legitimately in the catalog's own `pl` halves.
  for (const [from, to] of localeRegions(stripped, "pl")) {
    unmark(from, to);
  }

  const out = stripped.split("");
  for (let i = 0; i < out.length; i += 1) {
    if (!keep[i] && out[i] !== "\n") out[i] = " ";
  }
  return (
    out
      .join("")
      // Design tokens named after the brand, and the bare currency symbol, which
      // stays identical in both locales (glossary §4 — a symbol, not a word).
      .replace(/--flota-[a-z0-9-]+/g, (token) => " ".repeat(token.length))
      .replace(/(?<!\p{L})zł(?!\p{L})/gu, "  ")
  );
}

function* walk(dir) {
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    const rel = relative(ROOT, path);
    if (SKIP_DIRS.has(rel) || SKIP_FILES.has(rel)) continue;
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXT.test(entry) && !IS_TEST.test(entry)) yield path;
  }
}

const hits = [];
for (const root of ROOTS) {
  for (const file of walk(join(ROOT, root))) {
    const lines = extractCopy(readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      if (DIACRITICS.test(line) || WORD_RE.test(line)) {
        hits.push({ file: relative(ROOT, file), line: index + 1, text: line.trim().slice(0, 120) });
      }
    });
  }
}

if (hits.length === 0) {
  console.log(`i18n sweep: clean across ${ROOTS.join(", ")} (${String(WORDS.length)} harvested words + diacritics)`);
  process.exit(0);
}

let current = "";
for (const hit of hits) {
  if (hit.file !== current) {
    current = hit.file;
    console.log(`\n${hit.file}`);
  }
  console.log(`  ${String(hit.line).padStart(4)}  ${hit.text}`);
}
const files = new Set(hits.map((hit) => hit.file)).size;
console.log(`\ni18n sweep: ${String(hits.length)} line(s) across ${String(files)} file(s) in ${ROOTS.join(", ")}`);
process.exit(1);
