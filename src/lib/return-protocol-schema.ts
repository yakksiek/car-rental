// core
import { z } from "zod";

// others
import { isValidObjectPath } from "./protocol-storage-paths";
import { DAMAGE_TYPES, PHOTO_SLOTS } from "./protocol-schema";

// The single return-protocol contract (S-06), shared by the ReturnProtocolForm
// island (client-side inline errors) and POST /api/return-protocols (the trust
// boundary) — the return analogue of `protocolInputSchema`. It mirrors the issue
// schema field-for-field, adding `baselineProtocolId` and a per-damage
// `baselineDamageId`, and pins every storage path to the `return/` prefix.
//
// `protocolId` and every `damages[].id` are CLIENT-MINTED (crypto.randomUUID)
// before the first upload: they key the storage objects, so they must exist
// before any byte is written. Every path field is checked to sit under
// `return/<protocolId>/` via `isValidObjectPath` from the shared
// `protocol-storage-paths` module — there is NO inline `return/` literal here, so
// the client, this schema, and the PDF route guard cannot drift from the SQL RLS
// predicate. `PHOTO_SLOTS`, `DAMAGE_TYPES`, and `firstIssuePerField` are reused
// from the issue schema so the error-body shape cannot drift either.
//
// This module must stay free of `astro:env` and any server-only import: it is
// bundled into the client island. Ids use `z.guid()`, not `z.uuid()`, for the
// same reason the issue schema does (see protocol-schema.ts).

const MSG = {
  id: "Nieprawidłowy identyfikator.",
  odometer: "Podaj stan licznika.",
  fuel: "Wybierz poziom paliwa.",
  ack: "Klient musi potwierdzić stan pojazdu.",
  signedAt: "Nieprawidłowa data podpisu.",
  photos: "Wykonaj wszystkie sześć zdjęć pojazdu.",
  damageType: "Wybierz rodzaj uszkodzenia.",
  damageLocation: "Podaj lokalizację uszkodzenia.",
  path: "Nieprawidłowa ścieżka pliku.",
} as const;

// The odometer is an `int` column held as a string in the form (like every
// numeric input in this repo); a blank field must fail required rather than
// coerce to 0, so normalize "" to undefined first. Identical to the issue schema.
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
  // Non-null ⇒ carried over from that baseline item (existing); null ⇒ new. The
  // auto-tagger pre-selects it on the client; the value here is the confirmed one.
  baselineDamageId: z
    .guid(MSG.id)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  photos: z.array(storagePath).optional().default([]),
});

// All six slots are required, so the object shape (not an array) is the schema —
// a missing slot is a missing key reported per field. Identical to the issue schema.
const photosSchema = z.object(
  Object.fromEntries(PHOTO_SLOTS.map((slot) => [slot, storagePath])) as Record<
    (typeof PHOTO_SLOTS)[number],
    typeof storagePath
  >,
  MSG.photos,
);

export const returnProtocolSchema = z
  .object({
    protocolId: z.guid(MSG.id),
    reservationId: z.guid(MSG.id),
    // The issue protocol this return is compared against — the baseline id the
    // form reads from `get_return_baseline` and the RPC asserts against.
    baselineProtocolId: z.guid(MSG.id),
    odometerKm,
    fuelEighths: z.number(MSG.fuel).int(MSG.fuel).min(0, MSG.fuel).max(8, MSG.fuel),
    customerAck: z.literal(true, MSG.ack),
    signedAt: z.iso.datetime(MSG.signedAt),
    signaturePath: storagePath,
    photos: photosSchema,
    damages: z.array(damageSchema).optional().default([]),
  })
  .superRefine((input, ctx) => {
    // Pin every client-supplied path to this protocol's `return/` folder. Without
    // this a caller could record a path pointing at another protocol's evidence.
    // `isValidObjectPath` is the shared checker — no inline `return/` literal.
    const flag = (path: (PropertyKey | number)[]) => {
      ctx.addIssue({ code: "custom", path: [...path], message: MSG.path });
    };
    const valid = (path: string) => isValidObjectPath("return", input.protocolId, path);

    if (!valid(input.signaturePath)) {
      flag(["signaturePath"]);
    }
    for (const slot of PHOTO_SLOTS) {
      if (!valid(input.photos[slot])) {
        flag(["photos", slot]);
      }
    }
    input.damages.forEach((damage, i) => {
      damage.photos.forEach((path, j) => {
        if (!valid(path)) {
          flag(["damages", i, "photos", j]);
        }
      });
    });
  });

export type ReturnProtocolInput = z.infer<typeof returnProtocolSchema>;

/**
 * First zod message per top-level field — the `{ errors: Record<field, message> }`
 * body shape every route returns. Re-exported from the issue schema (which re-exports
 * it from the S-04 schema) so the three cannot drift.
 */
export { firstIssuePerField } from "./protocol-schema";
