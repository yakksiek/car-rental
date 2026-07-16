// core
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import type { Database } from "../../db/database.types";
import * as paths from "../../lib/protocol-storage-paths";
import type { ProtocolPhotoSlot } from "../../types";

// Browser → Supabase Storage, direct. The Worker never sees an image byte (10 ms
// CPU cap, and body limits that six phone photos would blow), so `storage.objects`
// RLS *is* the trust boundary here — see the migration's per-operation policies,
// scoped to the `issue/` prefix and gated on `current_app_role()`.
//
// The session comes from the same cookies `@supabase/ssr` writes on the server
// (`httpOnly: false` by design), so `createBrowserClient` picks up the employee's
// JWT with no token plumbing through props.
//
// Island-only: `createBrowserClient` reads `document.cookie`.

const BUCKET = "protocols";

export type BrowserClient = SupabaseClient<Database>;

export function createStorageClient(url: string, anonKey: string): BrowserClient {
  return createBrowserClient<Database>(url, anonKey);
}

// Object keys, folder-per-protocol. The ids are client-minted *before* the first
// upload precisely so these paths can exist: `create_protocol` records the path,
// it does not mint it. `protocolInputSchema` re-checks every path sits under
// `issue/<protocolId>/`.
//
// The builders live in the shared `protocol-storage-paths` module keyed by
// `kind` (S-06); these wrappers bind `kind = 'issue'` so the issue call sites
// (ProtocolForm) stay unchanged. The return form calls the kind-aware builders
// directly.
export const photoPath = (protocolId: string, slot: ProtocolPhotoSlot) => paths.photoPath("issue", protocolId, slot);
export const damagePhotoPath = (protocolId: string, damageId: string, n: number) =>
  paths.damagePhotoPath("issue", protocolId, damageId, n);
export const signaturePath = (protocolId: string) => paths.signaturePath("issue", protocolId);
export const pdfPath = (protocolId: string) => paths.pdfPath("issue", protocolId);

/**
 * Upload one object and return its path.
 *
 * `contentType` is taken from the blob's own `type`, never guessed: the bucket's
 * `allowed_mime_types` reads exactly that, and an untyped blob arrives as
 * `application/octet-stream` and is rejected. Every producer in the pipeline
 * types its output — `compressImage` → `image/jpeg`, `buildProtocolPdf` →
 * `application/pdf`, the signature canvas → `image/png`.
 *
 * `upsert` so a `Ponów` after a failed or half-finished upload overwrites rather
 * than colliding. (There is deliberately no DELETE policy on `storage.objects`:
 * the protocol is the customer's dispute evidence, so it is append-only.)
 */
export async function uploadObject(client: BrowserClient, path: string, blob: Blob): Promise<string> {
  const { error } = await client.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  });
  if (error) {
    throw error;
  }
  return path;
}
