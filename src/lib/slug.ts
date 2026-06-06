// Pure, I/O-free slug helper for vehicle detail URLs (`/fleet/<id>/<slug>`).
// The slug is decorative/SEO only — the detail route resolves by id and ignores
// the slug segment — so this never has to be reversible, just stable and clean.

const DIACRITICS: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

/** Fold Polish diacritics, lowercase, and hyphenate a make/model into a URL slug. */
export function vehicleSlug(make: string, model: string): string {
  return `${make} ${model}`
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => DIACRITICS[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
