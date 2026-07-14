// others
import type { ProtocolDamageType } from "../../types";

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
}

/** One photo tile's lifecycle. `failed` is retryable; the whole tile becomes the retry button. */
export type UploadState = "empty" | "uploading" | "failed" | "done";

/** A damage row as the editor holds it. `id` is client-minted — it keys the item's storage objects. */
export interface DamageValue {
  id: string;
  type: ProtocolDamageType;
  location: string;
  size: string | null;
  /** Storage paths, already uploaded. */
  photos: string[];
}
