// core
import { z } from "zod";

// The single issue-protocol contract (S-05), shared by the ProtocolForm island
// (client-side inline errors) and POST /api/protocols (the trust boundary) —
// mirrors vehicle-schema.ts, so the client and the trust boundary cannot
// disagree. Polish copy is canonical.
//
// `protocolId` and every `damages[].id` are CLIENT-MINTED (crypto.randomUUID)
// before the first upload: they key the storage objects, so they must exist
// before any byte is written. Every path field is therefore checked to sit under
// `issue/<protocolId>/` — the RPC records whatever path it is handed, and
// `storage.objects` RLS only scopes to the `issue/` prefix, so this schema is
// the one place a protocol's paths are pinned to that protocol's folder.
//
// This module must stay free of `astro:env` and any server-only import: it is
// bundled into the client island.
//
// Ids use `z.guid()`, not `z.uuid()`: zod 4's `uuid()` additionally asserts the
// RFC 9562 version + variant nibbles, which is stricter than both the Postgres
// `uuid` column and the `UUID_RE` guard every service in this repo uses. A
// `crypto.randomUUID()` value satisfies either, but a fixture or a seeded id
// (`1111…`) satisfies only `guid()` — so `uuid()` would reject ids the database
// accepts, and the schema would disagree with the trust boundary below it.

const MSG = {
  id: "Nieprawidłowy identyfikator.",
  odometer: "Podaj stan licznika.",
  fuel: "Wybierz poziom paliwa.",
  ack: "Klient musi potwierdzić stan pojazdu.",
  signature: "Wymagany podpis.",
  signedAt: "Nieprawidłowa data podpisu.",
  photos: "Wykonaj wszystkie sześć zdjęć pojazdu.",
  damageType: "Wybierz rodzaj uszkodzenia.",
  damageLocation: "Podaj lokalizację uszkodzenia.",
  path: "Nieprawidłowa ścieżka pliku.",
} as const;

/** Mirrors the `protocol_photo_slot` DB enum, in capture order. */
export const PHOTO_SLOTS = ["front", "rear", "left", "right", "interior", "dashboard"] as const;

/** Mirrors the `protocol_damage_type` DB enum. */
export const DAMAGE_TYPES = ["scratch", "dent", "crack", "missing"] as const;

// The odometer is an `int` column; the form holds it as a string (like every
// numeric input in this repo), so it coerces here. A blank field must fail the
// required check rather than coerce to 0 — `Number("")` is 0, so normalize it
// to undefined first.
const odometerKm = z.preprocess(
  (value) => (typeof value === "string" ? (value.trim() === "" ? undefined : Number(value.trim())) : value),
  z.number(MSG.odometer).int(MSG.odometer).min(0, MSG.odometer),
);

const storagePath = z.string(MSG.path).trim().min(1, MSG.path);

const damageSchema = z.object({
  id: z.guid(MSG.id),
  type: z.enum(DAMAGE_TYPES, MSG.damageType),
  location: z.string(MSG.damageLocation).trim().min(1, MSG.damageLocation),
  size: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().optional(),
    )
    .transform((value) => value ?? null),
  photos: z.array(storagePath).optional().default([]),
});

// All six slots are required, so the object shape (not an array) is the schema:
// a missing slot is a missing key, which zod reports per field rather than as a
// length check the form cannot map back onto a tile.
const photosSchema = z.object(
  Object.fromEntries(PHOTO_SLOTS.map((slot) => [slot, storagePath])) as Record<
    (typeof PHOTO_SLOTS)[number],
    typeof storagePath
  >,
  MSG.photos,
);

export const protocolInputSchema = z
  .object({
    protocolId: z.guid(MSG.id),
    reservationId: z.guid(MSG.id),
    odometerKm,
    fuelEighths: z.number(MSG.fuel).int(MSG.fuel).min(0, MSG.fuel).max(8, MSG.fuel),
    // A literal `true`: the checkbox is the customer's acknowledgement, and an
    // unchecked box must fail validation, not persist `false`.
    customerAck: z.literal(true, MSG.ack),
    signedAt: z.iso.datetime(MSG.signedAt),
    signaturePath: storagePath,
    photos: photosSchema,
    damages: z.array(damageSchema).optional().default([]),
  })
  .superRefine((input, ctx) => {
    // Pin every client-supplied path to this protocol's folder. Without this a
    // caller could record a path pointing at another protocol's evidence.
    const prefix = `issue/${input.protocolId}/`;
    const flag = (path: (PropertyKey | number)[]) => {
      ctx.addIssue({ code: "custom", path: [...path], message: MSG.path });
    };

    if (!input.signaturePath.startsWith(prefix)) {
      flag(["signaturePath"]);
    }
    for (const slot of PHOTO_SLOTS) {
      if (!input.photos[slot].startsWith(prefix)) {
        flag(["photos", slot]);
      }
    }
    input.damages.forEach((damage, i) => {
      damage.photos.forEach((path, j) => {
        if (!path.startsWith(prefix)) {
          flag(["damages", i, "photos", j]);
        }
      });
    });
  });

export type ProtocolInput = z.infer<typeof protocolInputSchema>;

/**
 * First zod message per top-level field — the `{ errors: Record<field, message> }`
 * body shape every route in this repo returns and every island re-maps onto its
 * inputs. Re-exported from the S-04 schema so the two cannot drift.
 */
export { firstIssuePerField } from "./vehicle-schema";
