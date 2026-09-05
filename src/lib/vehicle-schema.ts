// core
import { z } from "zod";

// others
import { LOCALES, translator } from "./i18n/types";
import type { Locale } from "./i18n/types";
import { validation } from "./i18n/validation";

// The single create/edit contract for a vehicle (S-04), shared by the VehicleForm
// island (client-side inline errors) and POST/PATCH /api/vehicles (the trust
// boundary) — mirrors reservation-schema.ts. Money + dimension fields arrive as
// strings (form inputs / JSON), so every numeric field coerces a trimmed string
// and validates the resulting number; the schema OUTPUT is `number | null`, so a
// parsed payload drops straight onto the typed `vehicles` Insert/Update row with
// no mapping layer. Blank optional fields normalize to `null`.
//
// **The schema is now reached through `vehicleInputSchema(locale)`.** zod bakes
// each message into the schema object at construction, so a localized message
// cannot be a lookup at parse time — one schema per locale is built once at
// module load and handed out by locale. Messages resolve through the ISLAND-SAFE
// accessor (`translator`, not the composed catalog) because `VehicleForm` imports
// this module; see `i18n/types.ts`.

// Mirrors the `vehicle_category` / `transmission_type` DB enums. Hard-coded here
// (not derived from the generated types) because z.enum needs a literal tuple;
// the DB CHECK + the column type stay the backstop.
const VEHICLE_CATEGORIES = [
  "cargo_van",
  "passenger_van",
  "car_transporter",
  "refrigerated_truck",
  "flatbed_truck",
] as const;

const TRANSMISSIONS = ["manual", "automatic"] as const;

// Generous bounds — only guard against typos (a 3-digit year, a far-future date),
// not business rules.
const MIN_YEAR = 1950;
const MAX_YEAR = 2100;

// Normalize an empty/whitespace string (or null) to `undefined` so an omitted
// optional field passes `.optional()` and becomes `null`, instead of failing a
// format/numeric check on "".
const emptyToUndefined = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "") ? undefined : value;

// Coerce a numeric field's raw input to a number for z.number to validate: a
// non-empty trimmed string → Number(...) (NaN if non-numeric, which z.number
// rejects), a blank/null/omitted value → undefined (required → rejected,
// optional → null). A non-string passes through untouched.
const coerceNumber = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : Number(trimmed);
  }
  return value ?? undefined;
};

/** Required positive money ("120.00" → 120). Rejects blanks, NaN, and ≤ 0. */
function requiredPositive(message: string) {
  return z.preprocess(
    coerceNumber,
    z.number(message).refine((n) => Number.isFinite(n) && n > 0, message),
  );
}

/** Optional number → `null` when blank. `checks` adds int / min / max bounds. */
function optionalNumber(message: string, checks?: { int?: boolean; min?: number; max?: number }) {
  let base = z.number(message);
  if (checks?.int) {
    base = base.int(message);
  }
  if (checks?.min !== undefined) {
    base = base.min(checks.min, message);
  }
  if (checks?.max !== undefined) {
    base = base.max(checks.max, message);
  }
  return z
    .preprocess(coerceNumber, base.refine((n) => Number.isFinite(n), message).optional())
    .transform((value) => value ?? null);
}

/** Optional trimmed text → `null` when blank. */
function optionalText() {
  return z.preprocess(emptyToUndefined, z.string().trim().optional()).transform((value) => value ?? null);
}

function build(locale: Locale) {
  const t = translator(locale, validation);
  return z.object({
    // Required identity + pricing. `plate` is unique in the DB — the fleet holds
    // many identical models, so it is the only field that tells two of them apart
    // on the dispatch list and the protocol PDF (S-05).
    name: z.string(t("vehicleName")).trim().min(1, t("vehicleName")),
    plate: z.string(t("plate")).trim().min(1, t("plate")),
    category: z.enum(VEHICLE_CATEGORIES, t("category")),
    daily_rate: requiredPositive(t("rate")),
    monthly_rate: requiredPositive(t("rate")),
    deposit: requiredPositive(t("rate")),
    per_extra_km_rate: requiredPositive(t("rate")),
    // Optional specification.
    make: optionalText(),
    model: optionalText(),
    production_year: optionalNumber(t("year"), { int: true, min: MIN_YEAR, max: MAX_YEAR }),
    fuel_type: optionalText(),
    transmission: z
      .preprocess(emptyToUndefined, z.enum(TRANSMISSIONS, t("transmission")).optional())
      .transform((value) => value ?? null),
    seats: optionalNumber(t("intNonNeg"), { int: true, min: 0 }),
    // Optional capacity / dimensions (numeric(10,2) → non-negative).
    payload_capacity_kg: optionalNumber(t("numNonNeg"), { min: 0 }),
    cargo_length_cm: optionalNumber(t("numNonNeg"), { min: 0 }),
    cargo_width_cm: optionalNumber(t("numNonNeg"), { min: 0 }),
    cargo_height_cm: optionalNumber(t("numNonNeg"), { min: 0 }),
    km_limit: optionalNumber(t("intNonNeg"), { int: true, min: 0 }),
    // Photos are URLs in v1 (object storage is S-05). The island splits a textarea
    // into one URL per line; an empty list is valid. Restrict the scheme to http(s)
    // so non-fetchable/unsafe URIs (javascript:/data:/mailto:) fail closed — these
    // strings are rendered as <img src> on the public catalog.
    photos: z
      .array(z.url({ protocol: /^https?$/, error: t("url") }))
      .optional()
      .default([]),
  });
}

type VehicleSchema = ReturnType<typeof build>;

// Built once per locale at module load. Two zod objects is a cheaper constant
// than rebuilding one on every keystroke the RHF resolver validates.
const SCHEMAS = Object.fromEntries(LOCALES.map((locale) => [locale, build(locale)])) as Record<Locale, VehicleSchema>;

/** The create/edit contract, with its messages in `locale`. */
export function vehicleInputSchema(locale: Locale): VehicleSchema {
  return SCHEMAS[locale];
}

export type VehicleInput = z.infer<VehicleSchema>;

/**
 * First zod message per top-level field — the shared shape the VehicleForm island
 * renders inline and the API route returns as `{ errors }`. (The reservation
 * funnel keeps its own private copy; this is S-04's.)
 */
export function firstIssuePerField(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
