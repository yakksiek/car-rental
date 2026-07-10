// others
import type { ProtocolDamageType, ProtocolPhotoSlot } from "../types";

// Canonical Polish labels for the two issue-protocol enums, plus the fuel
// readout. Shared by the PDF (S-05 Phase 4) and the form island (Phase 5) so a
// slot can never be named one thing on screen and another in the customer's
// only copy of the evidence.
//
// Pure and dependency-free: safe on both sides of the SSR boundary.

/** `protocol_photo_slot` → the capture label, in capture order. */
export const PHOTO_SLOT_LABELS_PL: Record<ProtocolPhotoSlot, string> = {
  front: "Przód",
  rear: "Tył",
  left: "Lewy bok",
  right: "Prawy bok",
  interior: "Wnętrze",
  dashboard: "Deska rozdz.",
};

/** `protocol_damage_type` → the chip label used by the damage editor. */
export const DAMAGE_TYPE_LABELS_PL: Record<ProtocolDamageType, string> = {
  scratch: "Rysa",
  dent: "Wgniecenie",
  crack: "Pęknięcie",
  missing: "Brak części",
};

/**
 * `3` → `"3/8"`, with the two ends named the way the form's fuel bar names them:
 * `8/8 · pełny`, `0/8 · pusty`.
 */
export function fuelLabelPl(eighths: number): string {
  if (eighths === 8) {
    return "8/8 · pełny";
  }
  if (eighths === 0) {
    return "0/8 · pusty";
  }
  return `${eighths}/8`;
}
