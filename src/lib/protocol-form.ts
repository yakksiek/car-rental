// others
import { PHOTO_SLOTS } from "./protocol-schema";
import type { ProtocolPhotoSlot } from "../types";

// Pure helpers the protocol form island leans on (S-05 Phase 5). They live here
// rather than inside the island so they are unit-testable in the `unit` project,
// which runs `src/**/*.test.ts` under node with no DOM.
//
// The Polish labels themselves live in `protocol-labels.ts` and are shared with
// the PDF, so a slot can never be named one thing on screen and another in the
// customer's only copy of the evidence.

/** Storage paths keyed by slot; a slot the employee has not captured yet is absent. */
export type PhotoPaths = Partial<Record<ProtocolPhotoSlot, string>>;

/** How many of the six baseline slots carry an uploaded object. Drives the `{done}/6` counter. */
export function filledSlotCount(photos: PhotoPaths): number {
  return PHOTO_SLOTS.filter((slot) => Boolean(photos[slot])).length;
}

/** All six baseline shots are in. The schema enforces this too; this is what greens the counter. */
export function allSlotsFilled(photos: PhotoPaths): boolean {
  return filledSlotCount(photos) === PHOTO_SLOTS.length;
}

/**
 * `"128450"` → `"128 450"` — the Polish thousands separator is a space. Non-digits
 * are dropped: the field is `inputMode="numeric"`, but a paste can still carry
 * anything, and the schema coerces `Number(value)`.
 */
export function formatOdometer(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** The inverse: strip grouping (and anything else) back to the digits the schema coerces. */
export function parseOdometer(display: string): string {
  return display.replace(/\D/g, "");
}

/**
 * A v4 UUID for the client-minted `protocolId` / `damageId` that key every storage
 * object.
 *
 * NOT just `crypto.randomUUID()`: that API is gated to a **secure context** (HTTPS
 * or `localhost`) and is `undefined` on a phone reaching the dev server over LAN
 * (`http://<ip>:4321`). Calling it there throws in the island's first render and
 * leaves a blank screen — there is no SSR HTML behind a `client:only` island. The
 * fallback builds the id from `crypto.getRandomValues`, which is available in an
 * insecure context too. The result still satisfies `z.guid()` and `UUID_RE`.
 */
export function randomUuid(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
