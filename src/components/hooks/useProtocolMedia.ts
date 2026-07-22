// core
import * as React from "react";

// others
import { compressImage } from "../../lib/media/compress";
import { filledSlotCount } from "../../lib/protocol-form";
import * as paths from "../../lib/protocol-storage-paths";
import { PHOTO_SLOTS } from "../../lib/protocol-schema";
import type { ProtocolKind, ProtocolPhotoSlot } from "../../types";
import { createStorageClient, uploadObject } from "../protocol/storage";
import type { BrowserClient } from "../protocol/storage";
import type { UploadState } from "../protocol/types";

// The shared upload/blob/signature orchestration for both protocol forms (S-05
// issue + S-06 return), lifted out of `ProtocolForm` in S-06 Phase 5 so the ~150
// lines of media plumbing exist once and cannot drift between the two shells.
// A pure mechanical extraction — no behavior change; the existing issue-flow
// integration tests + a manual re-verify are the regression guard.
//
// The storage `kind` (`issue` / `return`) selects the object-key prefix via the
// shared `protocol-storage-paths` module (the same source the return schema and
// the PDF route guard consume), so bytes never leak past the `storage.objects`
// RLS prefix predicate.
//
// The hook owns everything that touches storage: the browser client, the
// path-keyed blob cache (so the PDF builder re-reads what it just uploaded rather
// than downloading it back), photo-tile lifecycle, the signature upload with its
// supersede guard, and the derived `uploading` / `done` flags. It does NOT own the
// react-hook-form instance: `protocolId` is minted by the shell (RHF needs it in
// `defaultValues` at construction, before any hook callback that reads the form
// could exist), and storage results are written back through the two stable
// callbacks the shell supplies. The PDF build stays in each shell (issue vs
// return differ) but consumes `bytesOf` from here.

export interface TileState {
  state: UploadState;
  pct: number;
}

/** The resting tile: nothing captured yet. Shared so a shell can render an empty slot. */
export const IDLE: TileState = { state: "empty", pct: 0 };

export interface UseProtocolMediaParams {
  supabaseUrl: string;
  supabaseKey: string;
  /** Storage prefix selector — `issue` / `return`. Keys every object under `<kind>/<protocolId>/`. */
  kind: ProtocolKind;
  /** Client-minted before the first upload (the shell mints it, RHF needs it in defaultValues). */
  protocolId: string;
  /** The watched `photos` value — which slots already carry an uploaded object. */
  photos: Partial<Record<ProtocolPhotoSlot, string>>;
  /** Wire a finished photo upload back into the form: set its path + clear its errors. Must be stable. */
  onPhotoUploaded: (slot: ProtocolPhotoSlot, path: string) => void;
  /** Wire the committed signature back into the form: set path + `signed_at` + clear errors. Must be stable. */
  onSignatureUploaded: (path: string, signedAt: string) => void;
}

export interface ProtocolMedia {
  /** Browser → Supabase Storage client; the shell reuses it to upload the built PDF. */
  client: BrowserClient;
  /** Object URLs of every compressed blob, keyed by storage path — for tile/damage previews. */
  previews: Record<string, string>;
  /** Per-slot photo-tile lifecycle. Absent ⇒ `IDLE`. */
  tiles: Record<string, TileState>;
  /** A photo tile is still mid-flight; the shell disables submit while true. */
  uploading: boolean;
  /** How many of the six baseline slots carry an uploaded object. Drives the `{done}/6` counter. */
  done: number;
  /** Compress + upload one slot's photo, driving its tile through uploading → done/failed. */
  capture: (slot: ProtocolPhotoSlot, file: File) => Promise<void>;
  /** Replay the last file picked for a slot (a failed tile becomes its own retry button), or reset it. */
  retryCapture: (slot: ProtocolPhotoSlot) => void;
  /** Desktop multi-select / drop: fill the next free slots, in capture order. */
  fillFreeSlots: (files: File[]) => void;
  /** Compress + upload one damage-item photo; resolves to its storage path. */
  uploadDamagePhoto: (damageId: string, index: number, file: File) => Promise<string>;
  /** Upload the committed signature PNG and stamp `signed_at`; resolves `true` once it lands. */
  handleSigned: (png: Blob) => Promise<boolean>;
  /** Read a cached blob's bytes for the PDF build (never re-downloads). Throws if the path is unknown. */
  bytesOf: (path: string) => Promise<Uint8Array>;
}

export function useProtocolMedia({
  supabaseUrl,
  supabaseKey,
  kind,
  protocolId,
  photos,
  onPhotoUploaded,
  onSignatureUploaded,
}: UseProtocolMediaParams): ProtocolMedia {
  const client = React.useMemo(() => createStorageClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);

  // Every compressed blob, keyed by its storage path. The PDF builder re-reads
  // them from here rather than downloading back what it just uploaded.
  const blobs = React.useRef(new Map<string, Blob>());
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  // The last file picked per slot, so `Ponów` replays it without a second picker.
  const retryFiles = React.useRef(new Map<ProtocolPhotoSlot, File>());
  const [tiles, setTiles] = React.useState<Record<string, TileState>>({});

  // The signature uploads inside its modal, which stays open until the upload
  // resolves — so by the time the form is interactive again the signature is in.
  // Only the inline photo tiles can still be mid-flight here.
  const uploading = Object.values(tiles).some((tile) => tile.state === "uploading");
  const done = filledSlotCount(photos);

  const registerBlob = React.useCallback((path: string, blob: Blob) => {
    blobs.current.set(path, blob);
    setPreviews((prev) => ({ ...prev, [path]: URL.createObjectURL(blob) }));
  }, []);

  // ── Photos ──────────────────────────────────────────────────────────────────

  const capture = React.useCallback(
    async (slot: ProtocolPhotoSlot, file: File) => {
      retryFiles.current.set(slot, file);
      setTiles((prev) => ({ ...prev, [slot]: { state: "uploading", pct: 20 } }));
      try {
        // HEIC is detected and converted inside `compressImage`; a format the
        // browser cannot decode throws here rather than uploading a blank JPEG.
        const blob = await compressImage(file);
        setTiles((prev) => ({ ...prev, [slot]: { state: "uploading", pct: 65 } }));
        const path = paths.photoPath(kind, protocolId, slot);
        await uploadObject(client, path, blob);
        registerBlob(path, blob);
        onPhotoUploaded(slot, path);
        setTiles((prev) => ({ ...prev, [slot]: { state: "done", pct: 100 } }));
      } catch (err) {
        // The tile paints its `failed` / `Ponów` state; the employee retries.
        // Surface the cause: a silent `catch {}` here is what made a broken photo
        // upload (e.g. a `createImageBitmap` allocation failure on a no-GPU Chrome)
        // impossible to diagnose from the tile alone.
        // eslint-disable-next-line no-console
        console.error(`[useProtocolMedia] photo upload failed for slot "${slot}":`, err);
        setTiles((prev) => ({ ...prev, [slot]: { state: "failed", pct: 0 } }));
      }
    },
    [client, kind, protocolId, registerBlob, onPhotoUploaded],
  );

  const retryCapture = React.useCallback(
    (slot: ProtocolPhotoSlot) => {
      const file = retryFiles.current.get(slot);
      if (file) {
        void capture(slot, file);
      } else {
        setTiles((prev) => ({ ...prev, [slot]: IDLE }));
      }
    },
    [capture],
  );

  const fillFreeSlots = React.useCallback(
    (files: File[]) => {
      const free = PHOTO_SLOTS.filter((slot) => !photos[slot]);
      free.slice(0, files.length).forEach((slot, i) => {
        void capture(slot, files[i]);
      });
    },
    [photos, capture],
  );

  // ── Damages ─────────────────────────────────────────────────────────────────

  const uploadDamagePhoto = React.useCallback(
    async (damageId: string, index: number, file: File) => {
      const blob = await compressImage(file);
      const path = paths.damagePhotoPath(kind, protocolId, damageId, index);
      await uploadObject(client, path, blob);
      registerBlob(path, blob);
      return path;
    },
    [client, kind, protocolId, registerBlob],
  );

  // ── Signature ───────────────────────────────────────────────────────────────

  // Bumped on clear/re-sign. The signature upload is async; if the customer taps
  // `Wyczyść` while a sign is still uploading, its resolve must not re-stamp
  // `signed_at` onto a now-empty pad. Each sign captures the current token and
  // drops itself if the token moved before it finished.
  const signSeq = React.useRef(0);

  const handleSigned = React.useCallback(
    async (png: Blob): Promise<boolean> => {
      const seq = (signSeq.current += 1);
      try {
        const path = paths.signaturePath(kind, protocolId);
        await uploadObject(client, path, png);
        if (seq !== signSeq.current) {
          return false;
        }
        registerBlob(path, png);
        // `signed_at` is the moment the customer actually signed — a separate fact
        // from the booking's fixed pickup/return hour.
        onSignatureUploaded(path, new Date().toISOString());
        return true;
      } catch {
        return false;
      }
    },
    [client, kind, protocolId, registerBlob, onSignatureUploaded],
  );

  // ── PDF bytes ─────────────────────────────────────────────────────────────────

  const bytesOf = React.useCallback(async (path: string): Promise<Uint8Array> => {
    const blob = blobs.current.get(path);
    if (!blob) {
      throw new Error(`Brak pliku w pamięci: ${path}`);
    }
    return new Uint8Array(await blob.arrayBuffer());
  }, []);

  return {
    client,
    previews,
    tiles,
    uploading,
    done,
    capture,
    retryCapture,
    fillFreeSlots,
    uploadDamagePhoto,
    handleSigned,
    bytesOf,
  };
}
