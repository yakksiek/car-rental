// core
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import type { Database } from "../../db/database.types";
import { sendEmail } from "../email";
import type { EmailAttachment, EmailContent } from "../email";
import type { DeliveryStatus } from "../../types";

// Make a failed send visible instead of silent (S-05).
//
// Email is the customer's ONLY channel — there is no account and no portal — so
// a send that fails into a `console.error` is a customer with no evidence and an
// operator who never finds out. Every tracked send therefore lands a row in the
// append-only `email_deliveries` table, which the dispatch list reads to render
// a badge and a resend action. Append-only means a retry is a second row, not an
// overwrite, so the history survives.
//
// Only the two STAFF-AUTHENTICATED sends are tracked (the reservation decision
// and the protocol). The anonymous reservation-creation email keeps its swallow:
// tracking it would need `grant execute … to anon` on an audit-log write, and
// that path has a second channel anyway (the `/r/<token>` redirect).
//
// Recording lives here, not in the adapter: an adapter sees only a message and
// cannot know which row it belongs to.

type DeliveryClient = SupabaseClient<Database>;

export interface DeliveryContext {
  /** `'protocol'` | `'reservation'` — the `email_deliveries.entity_type` discriminator. */
  entityType: string;
  entityId: string;
  /** Template identifier, e.g. `'protocol_issued'`. */
  template: string;
  attachments?: EmailAttachment[];
}

/**
 * Send an email and record the outcome. **Never throws** — neither a provider
 * failure nor a failure to record one may roll back the work that preceded the
 * send, which is always already committed (a decided reservation, a signed
 * handover). The returned status is what the caller surfaces to the UI.
 *
 * A `null` client (Supabase unconfigured) still attempts the send but has
 * nowhere to record it — the same "degrade, don't throw" contract every service
 * in this repo follows.
 */
export async function sendTracked(
  client: DeliveryClient | null,
  to: string,
  content: EmailContent,
  ctx: DeliveryContext,
): Promise<{ status: DeliveryStatus }> {
  let status: DeliveryStatus = "sent";
  let error: string | null = null;

  try {
    await sendEmail({ to, ...content, ...(ctx.attachments ? { attachments: ctx.attachments } : {}) });
  } catch (cause) {
    status = "failed";
    error = cause instanceof Error ? cause.message : String(cause);
    // eslint-disable-next-line no-console
    console.error(`[sendTracked] ${ctx.template} → ${to} failed (recorded, request still succeeds):`, cause);
  }

  if (!client) {
    return { status };
  }

  const { error: recordError } = await client.rpc("record_email_delivery", {
    p_entity_type: ctx.entityType,
    p_entity_id: ctx.entityId,
    p_template: ctx.template,
    p_recipient: to,
    p_status: status,
    p_error: error ?? undefined,
  });
  if (recordError) {
    // The send already happened (or already failed). Losing the audit row is bad
    // but is not worth turning a succeeded handover into a 500.
    // eslint-disable-next-line no-console
    console.error("[sendTracked] could not record the delivery outcome:", recordError);
  }

  return { status };
}
