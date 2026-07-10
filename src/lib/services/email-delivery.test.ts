// core
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// others
import { resetEmailAdapter, setEmailAdapter } from "../email";
import type { EmailMessage } from "../email";
import { sendTracked } from "./email-delivery";

// A `null` client exercises the degrade path; `recordingClient` captures the
// `record_email_delivery` args without a database. The adapter is swapped through
// the seam's own setter — no `vi.mock` of module internals.

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

function recordingClient(rpcError: unknown = null) {
  const calls: RpcCall[] = [];
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve({ error: rpcError });
    },
  };
  // The real client is a full SupabaseClient; sendTracked only ever calls .rpc().
  return { calls, client: client as never };
}

const content = { subject: "Protokół wydania", html: "<p>Wąsik</p>", text: "Wąsik" };
const ctx = { entityType: "protocol", entityId: "11111111-1111-1111-1111-111111111111", template: "protocol_issued" };

describe("sendTracked", () => {
  beforeEach(() => {
    // The console.error paths are deliberate; keep the test output readable.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetEmailAdapter();
    vi.restoreAllMocks();
  });

  it("returns sent and records a `sent` delivery row when the adapter resolves", async () => {
    const sent: EmailMessage[] = [];
    setEmailAdapter((message) => {
      sent.push(message);
      return Promise.resolve();
    });
    const { calls, client } = recordingClient();

    const result = await sendTracked(client, "anna@example.test", content, ctx);

    expect(result).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("anna@example.test");
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("record_email_delivery");
    expect(calls[0].args).toMatchObject({
      p_entity_type: "protocol",
      p_entity_id: ctx.entityId,
      p_template: "protocol_issued",
      p_recipient: "anna@example.test",
      p_status: "sent",
      p_error: undefined,
    });
  });

  it("returns failed WITHOUT throwing when the adapter throws, and records the error", async () => {
    setEmailAdapter(() => Promise.reject(new Error("Resend rejected the message (403): domain not verified")));
    const { calls, client } = recordingClient();

    // The whole point: the handover is already committed. A provider failure must
    // never propagate — it becomes a row and a badge.
    const result = await sendTracked(client, "anna@example.test", content, ctx);

    expect(result).toEqual({ status: "failed" });
    expect(calls[0].args.p_status).toBe("failed");
    expect(calls[0].args.p_error).toContain("domain not verified");
  });

  it("still returns failed when recording the outcome itself fails", async () => {
    setEmailAdapter(() => Promise.reject(new Error("network down")));
    const { client } = recordingClient({ code: "42501", message: "insufficient privilege" });

    await expect(sendTracked(client, "anna@example.test", content, ctx)).resolves.toEqual({ status: "failed" });
  });

  it("attempts the send but records nothing when the client is null", async () => {
    const sent: EmailMessage[] = [];
    setEmailAdapter((message) => {
      sent.push(message);
      return Promise.resolve();
    });

    const result = await sendTracked(null, "anna@example.test", content, ctx);

    expect(result).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1);
  });

  it("forwards attachments to the adapter", async () => {
    const sent: EmailMessage[] = [];
    setEmailAdapter((message) => {
      sent.push(message);
      return Promise.resolve();
    });
    const { client } = recordingClient();

    await sendTracked(client, "anna@example.test", content, {
      ...ctx,
      attachments: [{ path: "https://signed.example/p.pdf", filename: "protokol.pdf" }],
    });

    expect(sent[0].attachments).toEqual([{ path: "https://signed.example/p.pdf", filename: "protokol.pdf" }]);
  });
});
