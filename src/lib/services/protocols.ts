// core
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import type { Database } from "../../db/database.types";
import { protocolIssuedEmail } from "../email/templates";
import { PHOTO_SLOTS } from "../protocol-schema";
import type { ProtocolInput } from "../protocol-schema";
import type { ReturnProtocolInput } from "../return-protocol-schema";
import { sendTracked } from "./email-delivery";
import type {
  CreateProtocolResult,
  CreateReturnProtocolResult,
  DispatchReturnRow,
  DispatchRow,
  ProtocolDamageItem,
  ProtocolPhotoSlot,
  ProtocolView,
  ReturnBaseline,
  ReturnBaselineDamage,
} from "../../types";

// The single home for issue-protocol data access (S-05). The five protocol
// tables carry a `revoke all` and NO policies at all, so every read and write
// here crosses the RLS boundary through a SECURITY DEFINER RPC that self-gates
// on `current_app_role()` and fails closed on a null role.
//
// Mirrors the vehicles/reservations services exactly: client-first, a `null`
// client degrades to the "cannot act" value rather than throwing, `UUID_RE`
// guards every id so a malformed one is a typed miss instead of a Postgres 500,
// and an unexpected DB error rethrows.

type ProtocolClient = SupabaseClient<Database>;

// Same guard as the sibling services: PostgREST hands a non-UUID straight to
// Postgres, which throws `invalid input syntax for type uuid` (a 500) rather
// than returning no rows.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The private bucket every protocol object lives in, keyed `issue/<protocol_id>/…`. */
const BUCKET = "protocols";

// Long enough for Resend to fetch the object server-side at send time, short
// enough that a leaked URL is worthless. The customer never receives it — they
// receive the bytes, as an attachment.
const SIGNED_URL_TTL_SECONDS = 300;

const TEMPLATE = "protocol_issued";
const ENTITY_TYPE = "protocol";

/**
 * Commit a handover via the `create_protocol` definer RPC — the only way a
 * protocol row is ever created.
 *
 * The RPC is the single transition authority: it gates on role, takes
 * `select … for update` on the reservation, asserts it is still `confirmed`,
 * then inserts the protocol, its six photos, its damages and their photos in one
 * transaction. `unique (reservation_id)` is the backstop, so two employees
 * tapping simultaneously produce one protocol and one clean `conflict` tag —
 * which carries the *existing* protocol's id so the conflict screen can link to it.
 *
 * **Nothing is emailed here.** The PDF does not exist yet; see `resendProtocolEmail`.
 */
export async function createProtocol(
  client: ProtocolClient | null,
  input: ProtocolInput,
): Promise<CreateProtocolResult> {
  if (!client || !UUID_RE.test(input.protocolId) || !UUID_RE.test(input.reservationId)) {
    return { status: "unauthorized" };
  }

  const { data, error } = await client.rpc("create_protocol", {
    p_id: input.protocolId,
    p_reservation_id: input.reservationId,
    p_odometer_km: input.odometerKm,
    p_fuel_eighths: input.fuelEighths,
    p_signed_at: input.signedAt,
    p_customer_ack: input.customerAck,
    p_signature: input.signaturePath,
    // The RPC reads `slot` / `path` off each element; the schema holds the six
    // photos as an object so a missing slot is a per-field error, not a length check.
    p_photos: PHOTO_SLOTS.map((slot) => ({ slot, path: input.photos[slot] })),
    p_damages: input.damages.map((damage) => ({
      id: damage.id,
      type: damage.type,
      location: damage.location,
      size: damage.size,
      photos: damage.photos,
    })),
  });
  if (error) {
    throw error;
  }

  // The RPC always returns exactly one row with a result tag.
  const row = data.at(0);
  switch (row?.result) {
    case "ok":
    case "conflict":
      return { status: row.result, protocolId: row.protocol_id };
    case "not_found":
      return { status: "not_found" };
    case "not_confirmed":
      return { status: "not_confirmed" };
    case "unauthorized":
      return { status: "unauthorized" };
    default:
      throw new Error(`create_protocol returned an unexpected result: ${JSON.stringify(data)}`);
  }
}

/**
 * Today's confirmed reservations with their protocol state folded in, via the
 * role-gated `list_dispatch_today` definer RPC (a non-staff caller gets zero rows).
 *
 * Issued rows are **kept, never filtered**: a protocol whose email failed is
 * exactly the row the employee needs to find, and dropping it would make
 * `email_deliveries` unreachable and the recovery action undeliverable.
 * `protocol_id` null ⇒ still awaiting handover.
 */
export async function listDispatchToday(client: ProtocolClient | null): Promise<DispatchRow[]> {
  if (!client) {
    return [];
  }

  const { data, error } = await client.rpc("list_dispatch_today");
  if (error) {
    throw error;
  }
  return data;
}

/**
 * One full protocol — photos, damages and the newest delivery row, folded in by
 * the RPC's lateral joins so this is a single round-trip. `null` for a malformed
 * id, an unknown protocol, or a caller the RPC's role gate turned away (both
 * yield zero rows; the route renders 404 either way, and the role gate already
 * ran there).
 *
 * The jsonb aggregates come back as `Json`; they are cast to the shapes
 * `get_protocol` builds them with.
 */
export async function getProtocol(client: ProtocolClient | null, id: string): Promise<ProtocolView | null> {
  if (!client || !UUID_RE.test(id)) {
    return null;
  }

  const { data, error } = await client.rpc("get_protocol", { p_id: id });
  if (error) {
    throw error;
  }

  const row = data.at(0);
  if (!row) {
    return null;
  }
  const { photos, damages, ...rest } = row;
  return {
    ...rest,
    photos: photos as unknown as { slot: ProtocolPhotoSlot; path: string }[],
    damages: damages as unknown as ProtocolDamageItem[],
  };
}

export interface SetProtocolPdfResult {
  status: "ok" | "not_found" | "unauthorized";
}

/**
 * Record where the client-generated PDF landed, via `set_protocol_pdf`.
 *
 * A separate call because the PDF is built client-side *after* the protocol
 * commits — `create_protocol` cannot know the path. Idempotent: re-running it
 * overwrites `pdf_path` with the same value.
 */
export async function setProtocolPdf(
  client: ProtocolClient | null,
  id: string,
  path: string,
): Promise<SetProtocolPdfResult> {
  if (!client || !UUID_RE.test(id)) {
    return { status: "unauthorized" };
  }

  const { data, error } = await client.rpc("set_protocol_pdf", { p_id: id, p_path: path });
  if (error) {
    throw error;
  }

  const row = data.at(0);
  switch (row?.result) {
    case "ok":
    case "not_found":
    case "unauthorized":
      return { status: row.result };
    default:
      throw new Error(`set_protocol_pdf returned an unexpected result: ${JSON.stringify(data)}`);
  }
}

export type SendProtocolEmailResult =
  | { status: "sent" | "failed" }
  /** The PDF never generated, so there is nothing to attach — regenerate, don't resend. */
  | { status: "no_pdf" }
  | { status: "not_found" }
  | { status: "unauthorized" };

/**
 * Mail a committed protocol's PDF to the customer, recording the outcome.
 *
 * Used for both the first send (from the finalize route, once `pdf_path` is
 * stored) and every resend from the dispatch list — they are the same operation,
 * which is why append-only `email_deliveries` shows a retry as a second row.
 *
 * The attachment is a **short-TTL signed URL** that Resend fetches server-side:
 * the Worker never handles a PDF byte, and the customer receives the bytes, never
 * a bucket URL. Never throws — `sendTracked` records a provider failure as a
 * `failed` row and the caller returns 200 with that status.
 */
export async function resendProtocolEmail(
  client: ProtocolClient | null,
  protocolId: string,
): Promise<SendProtocolEmailResult> {
  if (!client || !UUID_RE.test(protocolId)) {
    return { status: "unauthorized" };
  }

  const protocol = await getProtocol(client, protocolId);
  if (!protocol) {
    return { status: "not_found" };
  }
  if (!protocol.pdf_path) {
    return { status: "no_pdf" };
  }

  const { data: signed, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(protocol.pdf_path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    // The object is missing or storage is unreachable. That is a failed delivery,
    // not a 500 — the badge and the resend action are the recovery path.
    // eslint-disable-next-line no-console
    console.error(`[resendProtocolEmail] could not sign ${protocol.pdf_path}:`, error);
    return { status: "failed" };
  }

  const content = protocolIssuedEmail({
    reference: protocol.reference,
    customerName: protocol.customer_name,
    vehicle: [protocol.vehicle_make, protocol.vehicle_model].filter(Boolean).join(" "),
    plate: protocol.vehicle_plate,
    odometerKm: protocol.odometer_km,
    fuelEighths: protocol.fuel_eighths,
    damageCount: protocol.damages.length,
  });

  return sendTracked(client, protocol.customer_email, content, {
    entityType: ENTITY_TYPE,
    entityId: protocolId,
    template: TEMPLATE,
    attachments: [{ path: signed.signedUrl, filename: `protokol-wydania-${protocol.reference}.pdf` }],
  });
}

// ---------------------------------------------------------------------------
// Return protocol (S-06) — the three new wrappers, mirroring the issue wrappers
// above: client-first, `UUID_RE`-guarded, null-client degrades to the "cannot
// act" value, unexpected DB error rethrows. Every read/write still crosses the
// RLS boundary through the same kind of definer RPC that self-gates on
// `current_app_role()` and fails closed on a null role.
// ---------------------------------------------------------------------------

/**
 * Load the issue baseline for a reservation's return screen, via the role-gated
 * `get_return_baseline` definer RPC. `null` for a malformed id, a reservation
 * with no issue protocol (the RPC returns zero rows — the not-found signal), or a
 * caller the role gate turned away. The `baseline_damages` jsonb aggregate is
 * cast to the shape the RPC builds it with.
 */
export async function getReturnBaseline(
  client: ProtocolClient | null,
  reservationId: string,
): Promise<ReturnBaseline | null> {
  if (!client || !UUID_RE.test(reservationId)) {
    return null;
  }

  const { data, error } = await client.rpc("get_return_baseline", { p_reservation_id: reservationId });
  if (error) {
    throw error;
  }

  const row = data.at(0);
  if (!row) {
    return null;
  }
  const { baseline_damages, ...rest } = row;
  return { ...rest, baseline_damages: baseline_damages as unknown as ReturnBaselineDamage[] };
}

/**
 * The returns worklist — confirmed reservations due-or-overdue to return, with
 * the return protocol state folded in — via the role-gated `list_returns_today`
 * definer RPC (a non-staff caller gets zero rows).
 *
 * Returned rows are **kept, never filtered** while relevant: a return whose email
 * failed is exactly the row the employee needs to find, and today's just-filed
 * returns stay for resend. `return_protocol_id` null ⇒ still open.
 */
export async function listReturnsToday(client: ProtocolClient | null): Promise<DispatchReturnRow[]> {
  if (!client) {
    return [];
  }

  const { data, error } = await client.rpc("list_returns_today");
  if (error) {
    throw error;
  }
  return data;
}

/**
 * Commit a return via the `create_return_protocol` definer RPC — the only way a
 * return protocol row is ever created.
 *
 * Mirrors `createProtocol` plus the baseline precondition: the RPC asserts an
 * issue protocol exists and that `p_baseline_protocol_id` is its id (else
 * `no_baseline`), and the composite `unique (reservation_id, 'return')` is the
 * backstop that turns a double-submit into a clean `conflict` tag carrying the
 * existing return's id. Damages carry an optional `baseline_damage_id` per item
 * (non-null ⇒ existing, null ⇒ new). **Nothing is emailed here** — the PDF does
 * not exist yet, exactly as in the issue flow.
 */
export async function createReturnProtocol(
  client: ProtocolClient | null,
  input: ReturnProtocolInput,
): Promise<CreateReturnProtocolResult> {
  if (
    !client ||
    !UUID_RE.test(input.protocolId) ||
    !UUID_RE.test(input.reservationId) ||
    !UUID_RE.test(input.baselineProtocolId)
  ) {
    return { status: "unauthorized" };
  }

  const { data, error } = await client.rpc("create_return_protocol", {
    p_id: input.protocolId,
    p_reservation_id: input.reservationId,
    p_baseline_protocol_id: input.baselineProtocolId,
    p_odometer_km: input.odometerKm,
    p_fuel_eighths: input.fuelEighths,
    p_signed_at: input.signedAt,
    p_customer_ack: input.customerAck,
    p_signature: input.signaturePath,
    p_photos: PHOTO_SLOTS.map((slot) => ({ slot, path: input.photos[slot] })),
    p_damages: input.damages.map((damage) => ({
      id: damage.id,
      type: damage.type,
      location: damage.location,
      size: damage.size,
      // The RPC persists this verbatim: non-null ⇒ existing, null ⇒ new.
      baseline_damage_id: damage.baselineDamageId,
      photos: damage.photos,
    })),
  });
  if (error) {
    throw error;
  }

  // The RPC always returns exactly one row with a result tag.
  const row = data.at(0);
  switch (row?.result) {
    case "ok":
    case "conflict":
      return { status: row.result, protocolId: row.protocol_id };
    case "not_found":
      return { status: "not_found" };
    case "no_baseline":
      return { status: "no_baseline" };
    case "unauthorized":
      return { status: "unauthorized" };
    default:
      throw new Error(`create_return_protocol returned an unexpected result: ${JSON.stringify(data)}`);
  }
}
