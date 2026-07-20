// others
import { autoTagDamages } from "./protocol-delta";
import type { AutoTagBaselineDamage, AutoTagCurrentDamage } from "./protocol-delta";

// Pure display helpers for the return-protocol form island (S-06 Phase 5). They
// live here rather than inside the island so they are unit-testable in the `unit`
// project (node, no DOM), mirroring `protocol-form.ts` for the issue form.
//
// The numbers themselves come from the pure `computeReturnDeltas` (protocol-delta.ts)
// — this module only formats them for the delta chips and defaults the per-damage
// `existing | new` classification. The signed values use U+2212 MINUS (`−`), not a
// hyphen, to match the design's mono delta chips (`−4/8`, `+1 228 km`).

/** U+2212 MINUS SIGN — the design's chip glyph, distinct from a hyphen. */
const MINUS = "−";

/** Group a magnitude with the Polish thousands space: `1228` → `"1 228"`. */
function groupThousands(magnitude: number): string {
  return magnitude.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * `km driven` as a signed delta chip: `+1 228 km`, `${MINUS}120 km`, `0 km`. A
 * non-finite value (a half-typed live-form odometer) renders as `—` so the chip
 * never shows `NaN`. Always neutral in tone — a below-baseline reading shows the
 * negative number, but the km chip itself never flags (the odometer card carries
 * the amber soft-warning instead).
 */
export function formatKmDriven(kmDriven: number): string {
  if (!Number.isFinite(kmDriven)) {
    return "—";
  }
  const sign = kmDriven > 0 ? "+" : kmDriven < 0 ? MINUS : "";
  return `${sign}${groupThousands(Math.abs(kmDriven))} km`;
}

/**
 * Fuel change as a signed delta chip in eighths: `+3/8`, `${MINUS}4/8`, `0/8`.
 * Non-finite (unset fuel) renders `—`. A negative value is the adverse case (the
 * customer returned the tank lower than at pickup) — the caller flags the tone.
 */
export function formatFuelDelta(fuelDelta: number): string {
  if (!Number.isFinite(fuelDelta)) {
    return "—";
  }
  const sign = fuelDelta > 0 ? "+" : fuelDelta < 0 ? MINUS : "";
  return `${sign}${Math.abs(fuelDelta)}/8`;
}

/** New-damage count as a chip: `+1` when any, `0` when none. Adverse iff `> 0`. */
export function formatNewDamageCount(count: number): string {
  return count > 0 ? `+${count}` : "0";
}

/**
 * The classification a freshly-entered return damage should default to: the id of
 * the baseline item it auto-matches (⇒ `existing`), or `null` (⇒ `new`). Wraps the
 * pure `autoTagDamages` matcher for a single row, excluding baseline items already
 * claimed by other current damages — so two identical return rows do not both tag
 * the same baseline scratch. A **suggestion only**: the employee's override on the
 * form is the persisted value.
 */
export function suggestBaselineDamageId(
  baselineDamages: AutoTagBaselineDamage[],
  draft: AutoTagCurrentDamage,
  takenIds: readonly string[],
): string | null {
  const available = baselineDamages.filter((baseline) => !takenIds.includes(baseline.id));
  return autoTagDamages(available, [draft])[0] ?? null;
}
