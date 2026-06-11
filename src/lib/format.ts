// others
import type { Transmission, VehicleCategory } from "../types";

// Pure, I/O-free presentation helpers for the public catalog. Two quirks they
// own so call sites don't have to:
//   1. Money — `numeric(10,2)` columns deserialize to `string` in supabase-js
//      despite the generated `number` type (see src/types.ts). Every money
//      helper parses `string | number` defensively; never `toFixed` a raw value.
//   2. Cargo dims — stored in cm (also string-at-runtime); the detail/card UI
//      wants metres.
// Polish copy is canonical (PRD §Non-Goals); these labels are the single source.

const PLN_GROUP_SEPARATOR = " "; // non-breaking space, Polish thousands grouping
const DASH = "—"; // shown for absent values

/** Coerce a `string | number` (the numeric-as-string quirk) to a finite number. */
function toNumber(value: string | number): number {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Group an integer-part string with non-breaking spaces every three digits. */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, PLN_GROUP_SEPARATOR);
}

/**
 * Format a PLN amount, e.g. `formatPln("320.00") -> "320 zł"`,
 * `formatPln(1.2) -> "1,20 zł"`, `formatPln(5900) -> "5 900 zł"`.
 * Whole amounts drop the decimal part; fractional amounts show two digits
 * with a comma separator (Polish convention).
 */
export function formatPln(value: string | number): string {
  const n = toNumber(value);
  const fixed = Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const grouped = groupThousands(intPart);
  const body = decPart ? `${grouped},${decPart}` : grouped;
  return `${body} zł`;
}

/** Daily-rate display, e.g. `"320 zł/doba"`. */
export function formatDailyRate(value: string | number): string {
  return `${formatPln(value)}/doba`;
}

/** Epoch ms of an ISO `YYYY-MM-DD` date at UTC midnight (calendar math only). */
function dateValue(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole-day rental span, e.g. `rentalDays("2026-03-24", "2026-03-27") -> 3`.
 * Calendar-day difference (`return − pickup`) — the billing unit the screens
 * show (`24 – 27 marca · 3 dni`), independent of the 14:00/10:00 hours.
 */
export function rentalDays(pickup: string, returnDate: string): number {
  return Math.round((dateValue(returnDate) - dateValue(pickup)) / MS_PER_DAY);
}

/**
 * Estimated rental total: `daily_rate × days`, e.g. `(320, 3) -> 960`.
 * Defensive about the numeric-as-string quirk; cent-rounded to avoid float
 * drift. The deposit is shown separately and never summed in.
 */
export function estimatedTotal(dailyRate: string | number, days: number): number {
  return Math.round(toNumber(dailyRate) * days * 100) / 100;
}

/**
 * Polish duration label, plural-aware: `1 -> "1 dzień"`, otherwise `"N dni"`.
 */
export function formatDuration(days: number): string {
  return days === 1 ? "1 dzień" : `${days} dni`;
}

/** Format one cm dimension as metres (`440 -> "4.40"`), or the dash when absent. */
function formatDimM(cm: string | number | null | undefined): string {
  if (cm === null || cm === undefined || cm === "") {
    return DASH;
  }
  return (toNumber(cm) / 100).toFixed(2);
}

/**
 * Cargo dimensions L × W × H in metres, e.g. `"4.30 × 1.78 × 1.94 m"`.
 * Null-safe per dimension; returns `"—"` when every dimension is absent.
 */
export function formatCargoDims(
  length: string | number | null | undefined,
  width: string | number | null | undefined,
  height: string | number | null | undefined,
): string {
  const allAbsent = [length, width, height].every((d) => d === null || d === undefined || d === "");
  if (allAbsent) {
    return DASH;
  }
  return `${formatDimM(length)} × ${formatDimM(width)} × ${formatDimM(height)} m`;
}

/** Payload capacity in kg, e.g. `"1 350 kg"`, or the dash when absent. */
export function formatPayloadKg(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return DASH;
  }
  return `${groupThousands(toNumber(value).toFixed(0))} kg`;
}

const CATEGORY_LABELS_PL: Record<VehicleCategory, string> = {
  cargo_van: "Furgon",
  passenger_van: "Bus osobowy",
  car_transporter: "Autolaweta",
  refrigerated_truck: "Chłodnia",
  flatbed_truck: "Skrzyniowy",
};

/** Polish label for a vehicle category enum value. */
export function categoryLabelPl(category: VehicleCategory): string {
  return CATEGORY_LABELS_PL[category];
}

const TRANSMISSION_LABELS_PL: Record<Transmission, string> = {
  manual: "Manualna",
  automatic: "Automatyczna",
};

/** Polish label for a transmission enum value; dash when absent. */
export function transmissionLabelPl(transmission: Transmission | null | undefined): string {
  if (!transmission) {
    return DASH;
  }
  return TRANSMISSION_LABELS_PL[transmission];
}

// `fuel_type` is a free-text column (not an enum); map the known values and fall
// back to the raw string (capitalized) for anything unseeded.
const FUEL_LABELS_PL: Record<string, string> = {
  diesel: "Diesel",
  petrol: "Benzyna",
  benzyna: "Benzyna",
  gasoline: "Benzyna",
  electric: "Elektryczny",
  hybrid: "Hybryda",
  lpg: "LPG",
};

/** Polish label for a free-text fuel type; dash when absent. */
export function fuelLabelPl(fuel: string | null | undefined): string {
  if (!fuel) {
    return DASH;
  }
  const key = fuel.trim().toLowerCase();
  return FUEL_LABELS_PL[key] ?? fuel.charAt(0).toUpperCase() + fuel.slice(1);
}
