// others
import type { Locale } from "../../lib/i18n/types";
import type { ProtocolDamageType, ReturnBaselineDamage } from "../../types";

// Shared props for the issue-protocol island (S-05 Phase 5).

/**
 * The handover's fixed context, resolved server-side from `list_dispatch_today`
 * and serialized into the island. The island never re-fetches it.
 */
export interface ProtocolContext {
  reservationId: string;
  /** e.g. `R-2401` */
  reference: string;
  customerName: string;
  customerEmail: string;
  /** Display name, e.g. `Ford Transit`. */
  vehicle: string;
  plate: string;
  /** The booking's fixed pickup hour, e.g. `14:00`. A separate fact from `signed_at`. */
  pickupTime: string;
  /** Newest odometer reading across any protocol for this vehicle — a soft-warning baseline, never a block. */
  lastOdometerKm: number | null;
  /**
   * The CUSTOMER's language (`reservations.locale`) — what the PDF is rendered
   * in and what gets stamped onto `protocols.locale`.
   *
   * *** Named `documentLocale`, not `locale`, on purpose. *** The island already
   * takes a `locale` prop, and that one is the EMPLOYEE's session: it decides
   * what language the form's own chrome is in. The two are independent by
   * design — an English cockpit issuing a Polish customer's protocol is the case
   * this whole column exists for — so they must not be one word apart at the
   * call site that feeds both.
   */
  documentLocale: Locale;
}

/** One photo tile's lifecycle. `failed` is retryable; the whole tile becomes the retry button. */
export type UploadState = "empty" | "uploading" | "failed" | "done";

/** A damage row as the editor holds it. `id` is client-minted — it keys the item's storage objects. */
export interface DamageValue {
  id: string;
  type: ProtocolDamageType;
  location: string;
  size: string | null;
  /**
   * The `existing | new` decision (S-06 return only): the baseline damage this row
   * carries over from (⇒ existing), or `null` (⇒ new). Auto-suggested from the
   * baseline, overridable in the editor, persisted as `protocol_damages.baseline_damage_id`.
   * Absent on issue rows — they have no baseline to diff against.
   */
  baselineDamageId?: string | null;
  /** Storage paths, already uploaded. */
  photos: string[];
}

/**
 * The return's fixed context, resolved server-side from `get_return_baseline` and
 * serialized into the return island (S-06 Phase 5). Mirrors `ProtocolContext` plus
 * the issue baseline the return is measured against — the island never re-fetches it.
 */
export interface ReturnProtocolContext {
  reservationId: string;
  /** e.g. `R-2401` */
  reference: string;
  customerName: string;
  customerEmail: string;
  /** Display name, e.g. `Ford Transit`. */
  vehicle: string;
  plate: string;
  /** The booking's fixed hotel-style return hour, e.g. `10:00`. A separate fact from `signed_at`. */
  returnTime: string;
  /** The issue protocol this return is compared against — the id the RPC asserts. */
  baselineProtocolId: string;
  /** Odometer at issue time (km) — the read-only reference and the km-delta baseline. */
  baselineOdometerKm: number;
  /** Fuel at issue time (eighths, 0–8) — the read-only reference and the fuel-delta baseline. */
  baselineFuelEighths: number;
  /** The issue-time damage list the return shows read-only and the auto-tagger diffs against. */
  baselineDamages: ReturnBaselineDamage[];
  /** The customer's language — see `ProtocolContext.documentLocale` for why it is not called `locale`. */
  documentLocale: Locale;
}
