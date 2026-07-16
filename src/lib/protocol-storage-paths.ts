// others
import type { ProtocolKind, ProtocolPhotoSlot } from "../types";

// The single TypeScript source of truth for protocol storage object keys (S-06).
//
// Every protocol object lives at `<kind>/<protocol_id>/…`, folder-per-protocol,
// with `kind` in `{issue, return}` (mirroring the DB `protocol_type` enum). The
// ids are client-minted *before* the first upload precisely so these paths can
// exist: the create RPC records the path, it does not mint it.
//
// The `<kind>/` prefix must stay consistent across four places or bytes leak past
// `storage.objects` RLS — the client path builders, the return schema
// `superRefine`, the PDF-finalize route path guard, and the SQL RLS predicate.
// The SQL side cannot import TypeScript (its `(storage.foldername(name))[1] in
// ('issue','return')` is the unavoidable second copy, pinned by an integration
// test), but the *three* TypeScript places share this one module — so the client,
// the schema, and the route guard cannot drift. Domain-scoped, matching the
// `PHOTO_SLOTS`/`DAMAGE_TYPES` convention, not a global settings object.
//
// This module stays free of `astro:env` and any server-only import: it is
// bundled into the client island (via `src/components/protocol/storage.ts`).

/** The folder every one protocol's objects sit under: `<kind>/<protocolId>/`. */
export const objectFolder = (kind: ProtocolKind, protocolId: string): string => `${kind}/${protocolId}/`;

export const photoPath = (kind: ProtocolKind, protocolId: string, slot: ProtocolPhotoSlot): string =>
  `${objectFolder(kind, protocolId)}photo-${slot}.jpg`;

export const damagePhotoPath = (kind: ProtocolKind, protocolId: string, damageId: string, n: number): string =>
  `${objectFolder(kind, protocolId)}damage-${damageId}-${n}.jpg`;

export const signaturePath = (kind: ProtocolKind, protocolId: string): string =>
  `${objectFolder(kind, protocolId)}signature.png`;

export const pdfPath = (kind: ProtocolKind, protocolId: string): string =>
  `${objectFolder(kind, protocolId)}protocol.pdf`;

/**
 * True iff `path` sits under this protocol's own folder for the given kind. The
 * one predicate the client-supplied path checks share: the return schema's
 * `superRefine` and the PDF route guard both call this instead of re-typing a
 * `return/` literal. It checks the prefix only — a caller adding a suffix rule
 * (e.g. the PDF guard's `.pdf`) composes it with the boolean this returns.
 */
export function isValidObjectPath(kind: ProtocolKind, protocolId: string, path: string): boolean {
  return path.startsWith(objectFolder(kind, protocolId));
}
