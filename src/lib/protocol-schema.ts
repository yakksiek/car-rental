// core
import { z } from "zod";

// others
import { isValidObjectPath } from "./protocol-storage-paths";
import { LOCALES, translator } from "./i18n/types";
import type { Locale } from "./i18n/types";
import { validation } from "./i18n/validation";

// The single issue-protocol contract (S-05), shared by the ProtocolForm island
// (client-side inline errors) and POST /api/protocols (the trust boundary) —
// mirrors vehicle-schema.ts, so the client and the trust boundary cannot
// disagree. Reached through `protocolInputSchema(locale)`: zod bakes messages in
// at construction, so one schema is built per locale at module load. Messages
// resolve through the ISLAND-SAFE `translator` because `ProtocolForm` imports
// this module.
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

/** Mirrors the `protocol_photo_slot` DB enum, in capture order. */
export const PHOTO_SLOTS = ["front", "rear", "left", "right", "interior", "dashboard"] as const;

/** Mirrors the `protocol_damage_type` DB enum. */
export const DAMAGE_TYPES = ["scratch", "dent", "crack", "missing"] as const;

function build(locale: Locale) {
  const t = translator(locale, validation);

  // The odometer is an `int` column; the form holds it as a string (like every
  // numeric input in this repo), so it coerces here. A blank field must fail the
  // required check rather than coerce to 0 — `Number("")` is 0, so normalize it
  // to undefined first.
  const odometerKm = z.preprocess(
    (value) => (typeof value === "string" ? (value.trim() === "" ? undefined : Number(value.trim())) : value),
    z.number(t("odometer")).int(t("odometer")).min(0, t("odometer")),
  );

  const storagePath = z.string(t("path")).trim().min(1, t("path"));

  const damageSchema = z.object({
    id: z.guid(t("id")),
    type: z.enum(DAMAGE_TYPES, t("damageType")),
    location: z.string(t("damageLocation")).trim().min(1, t("damageLocation")).max(60, t("damageLocationMax")),
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
    t("photos"),
  );

  const schema = z
    .object({
      protocolId: z.guid(t("id")),
      reservationId: z.guid(t("id")),
      odometerKm,
      fuelEighths: z.number(t("fuel")).int(t("fuel")).min(0, t("fuel")).max(8, t("fuel")),
      // A literal `true`: the checkbox is the customer's acknowledgement, and an
      // unchecked box must fail validation, not persist `false`.
      customerAck: z.literal(true, t("ack")),
      signedAt: z.iso.datetime(t("signedAt")),
      signaturePath: storagePath,
      photos: photosSchema,
      damages: z.array(damageSchema).optional().default([]),
    })
    .superRefine((input, ctx) => {
      // Pin every client-supplied path to this protocol's `issue/` folder. Without
      // this a caller could record a path pointing at another protocol's evidence.
      // `isValidObjectPath` is the shared checker — no inline `issue/` literal.
      const flag = (path: (PropertyKey | number)[]) => {
        ctx.addIssue({ code: "custom", path: [...path], message: t("path") });
      };
      const valid = (path: string) => isValidObjectPath("issue", input.protocolId, path);

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

  return schema;
}

type ProtocolSchema = ReturnType<typeof build>;

const SCHEMAS = Object.fromEntries(LOCALES.map((locale) => [locale, build(locale)])) as Record<Locale, ProtocolSchema>;

/** The issue-protocol contract, with its messages in `locale`. */
export function protocolInputSchema(locale: Locale): ProtocolSchema {
  return SCHEMAS[locale];
}

export type ProtocolInput = z.infer<ProtocolSchema>;

/**
 * First zod message per top-level field — the `{ errors: Record<field, message> }`
 * body shape every route in this repo returns and every island re-maps onto its
 * inputs. Re-exported from the S-04 schema so the two cannot drift.
 */
export { firstIssuePerField } from "./vehicle-schema";
