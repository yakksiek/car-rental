// others
import type { ProtocolDamageType } from "../types";

// Pure, I/O-free comparison of a return protocol against its issue baseline (S-06)
// — the differentiating value over paper protocols. Both the return form (live
// display) and the return PDF (comparison section) consume this, so the numbers a
// customer sees on screen and in the emailed document come from one place and
// cannot disagree. No React, no DB, no `astro:env`: it runs in the client island,
// in the PDF builder, and under Vitest with the same result.
//
// Fuel and odometer are plain integers at runtime (`smallint`/`int` columns, not
// the numeric(10,2) money quirk), so arithmetic here is safe.

/** Odometer + fuel at issue time — the baseline the return is measured against. */
export interface DeltaBaseline {
  odometerKm: number;
  /** Fuel level in eighths, 0–8. */
  fuelEighths: number;
}

/**
 * One return damage as the delta cares about it: only whether it links back to a
 * baseline item. A truthy `baselineDamageId` ⇒ carried over (existing); a falsy
 * one (null / undefined / "") ⇒ new. This mirrors `protocol_damages.baseline_damage_id`,
 * the persisted decision.
 *
 * `undefined` is admitted deliberately: the return form recomputes deltas LIVE
 * from raw react-hook-form state, where an un-linked row reads back as `undefined`
 * — the zod `?? null` transform only runs at submit. Counting must not depend on
 * whether the caller already normalized to `null`, so the count below is falsy-based.
 */
export interface DeltaCurrentDamage {
  baselineDamageId: string | null | undefined;
}

/** The freshly-entered return values the deltas are computed from. */
export interface DeltaCurrent {
  odometerKm: number;
  fuelEighths: number;
  damages: DeltaCurrentDamage[];
}

export interface ReturnDeltaFlags {
  /** Fuel returned below pickup level — the customer owes fuel. */
  fuelAdverse: boolean;
  /** At least one new (non-baseline) damage was recorded. */
  damageAdverse: boolean;
  /**
   * Non-positive OR non-finite km driven — physically implausible for a real
   * rental (a below-baseline odometer, or a NaN from a half-typed live-form
   * value). A soft warning only: `kmDriven` still displays neutrally (no hard
   * block, per FR); the display shows the warning and can suppress a NaN readout.
   */
  odometerSuspect: boolean;
}

export interface ReturnDeltas {
  /** `current − baseline` odometer. May be 0 or negative (see `odometerSuspect`). */
  kmDriven: number;
  /** `current − baseline` fuel, in eighths. Negative ⇒ returned lower (adverse). */
  fuelDelta: number;
  /** Count of return damages with no baseline link — the "new damage" number. */
  newDamageCount: number;
  flags: ReturnDeltaFlags;
}

/**
 * Compute the comparison summary from the issue baseline and the entered return
 * values. Pure arithmetic + a count; the adverse flags are the display's cue for
 * the `warning` token. A new damage is a return damage with no baseline link —
 * `baselineDamageId` falsy (null / undefined / "") — i.e. not matched to, or
 * un-linked from, any baseline item. Falsy-based, not `=== null`, so a raw
 * un-normalized `undefined` from the live form is still counted as new.
 */
export function computeReturnDeltas(baseline: DeltaBaseline, current: DeltaCurrent): ReturnDeltas {
  const kmDriven = current.odometerKm - baseline.odometerKm;
  const fuelDelta = current.fuelEighths - baseline.fuelEighths;
  const newDamageCount = current.damages.filter((damage) => !damage.baselineDamageId).length;

  return {
    kmDriven,
    fuelDelta,
    newDamageCount,
    flags: {
      fuelAdverse: fuelDelta < 0,
      damageAdverse: newDamageCount > 0,
      // `!(kmDriven > 0)` — not `kmDriven <= 0` — so a NaN (from a half-typed
      // live-form odometer) is also flagged suspect, since `NaN <= 0` is false.
      odometerSuspect: !(kmDriven > 0),
    },
  };
}

/** A baseline damage the auto-tagger tries to match a return damage back to. */
export interface AutoTagBaselineDamage {
  id: string;
  type: ProtocolDamageType;
  location: string;
  size: string | null;
}

/** The distinguishing fields of a return damage — the ones the match compares. */
export interface AutoTagCurrentDamage {
  type: ProtocolDamageType;
  location: string;
  size: string | null;
}

/** Lowercase, collapse internal whitespace, trim — so `" Lewy  Błotnik "` matches `"lewy błotnik"`. */
function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Suggest a `baselineDamageId` for each return damage by matching `type` +
 * normalized `location` + normalized `size` against the baseline list. Returns
 * one suggestion (a baseline id, or null for "new") per current damage, in order
 * — **suggestions only**: the persisted value is whatever the employee confirms
 * on the form. Each baseline item is claimed at most once, so two identical
 * return rows do not both tag the same baseline scratch (the second reads `new`).
 */
export function autoTagDamages(
  baselineDamages: AutoTagBaselineDamage[],
  currentDamages: AutoTagCurrentDamage[],
): (string | null)[] {
  const claimed = new Set<string>();

  return currentDamages.map((current) => {
    const match = baselineDamages.find(
      (baseline) =>
        !claimed.has(baseline.id) &&
        baseline.type === current.type &&
        normalize(baseline.location) === normalize(current.location) &&
        normalize(baseline.size) === normalize(current.size),
    );
    if (!match) {
      return null;
    }
    claimed.add(match.id);
    return match.id;
  });
}
