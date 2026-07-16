// core
import { describe, expect, it } from "vitest";

// others
import { createReturnProtocol } from "./protocols";
import { PHOTO_SLOTS } from "../protocol-schema";
import type { ReturnProtocolInput } from "../return-protocol-schema";

// The return-write wrapper's marshaling is the one piece of service logic that a
// through-the-real-RPC integration test does NOT cover: it renames camelCase →
// snake_case (`baselineDamageId` → `baseline_damage_id`), reshapes the six photos
// from an object to the array the RPC reads, and maps the RPC's result tag to the
// typed union. A dropped `baseline_damage_id` would silently persist every return
// damage as "new" (inflating newDamageCount and the customer liability record), so
// it is pinned here with a recording client — the pattern from email-delivery.test.ts.

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

/** Captures the rpc args without a database; returns the configured result row. */
function rpcClient(row: { result: string; protocol_id: string | null }) {
  const calls: RpcCall[] = [];
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve({ data: [row], error: null });
    },
  };
  // createReturnProtocol only ever calls .rpc(); the real client is far larger.
  return { calls, client: client as never };
}

const PROTOCOL_ID = "11111111-1111-1111-1111-111111111111";
const RESERVATION_ID = "22222222-2222-2222-2222-222222222222";
const BASELINE_ID = "33333333-3333-3333-3333-333333333333";
const DAMAGE_ID = "44444444-4444-4444-4444-444444444444";
const NEW_DAMAGE_ID = "66666666-6666-6666-6666-666666666666";
const BASELINE_DAMAGE_ID = "55555555-5555-5555-5555-555555555555";

function validInput(overrides: Partial<ReturnProtocolInput> = {}): ReturnProtocolInput {
  return {
    protocolId: PROTOCOL_ID,
    reservationId: RESERVATION_ID,
    baselineProtocolId: BASELINE_ID,
    odometerKm: 42850,
    fuelEighths: 4,
    customerAck: true,
    signedAt: "2026-07-16T12:08:00.000Z",
    signaturePath: `return/${PROTOCOL_ID}/signature.png`,
    photos: Object.fromEntries(
      PHOTO_SLOTS.map((slot) => [slot, `return/${PROTOCOL_ID}/photo-${slot}.jpg`]),
    ) as ReturnProtocolInput["photos"],
    damages: [
      {
        id: DAMAGE_ID,
        type: "scratch",
        location: "lewy błotnik ąćęłńóśźż",
        size: "10 cm",
        baselineDamageId: BASELINE_DAMAGE_ID,
        photos: [`return/${PROTOCOL_ID}/damage-${DAMAGE_ID}-1.jpg`],
      },
      {
        id: NEW_DAMAGE_ID,
        type: "dent",
        location: "prawe drzwi ąćęłńóśźż",
        size: null,
        baselineDamageId: null,
        photos: [],
      },
    ],
    ...overrides,
  };
}

describe("createReturnProtocol", () => {
  it("marshals baseline_damage_id, the baseline id, and the photos object→array for the RPC", async () => {
    const { calls, client } = rpcClient({ result: "ok", protocol_id: PROTOCOL_ID });

    const result = await createReturnProtocol(client, validInput());

    expect(result).toEqual({ status: "ok", protocolId: PROTOCOL_ID });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("create_return_protocol");

    const args = calls[0].args;
    expect(args.p_baseline_protocol_id).toBe(BASELINE_ID);

    // Photos go from the six-slot object to an array of { slot, path } in slot order.
    expect(args.p_photos).toEqual(
      PHOTO_SLOTS.map((slot) => ({ slot, path: `return/${PROTOCOL_ID}/photo-${slot}.jpg` })),
    );

    // The carried-over damage keeps its baseline link; the fresh one is null.
    const damages = args.p_damages as { id: string; baseline_damage_id: string | null }[];
    expect(damages[0]).toMatchObject({ id: DAMAGE_ID, baseline_damage_id: BASELINE_DAMAGE_ID });
    expect(damages[1]).toMatchObject({ id: NEW_DAMAGE_ID, baseline_damage_id: null });
  });

  it("maps a conflict tag to the existing return id", async () => {
    const existing = "77777777-7777-7777-7777-777777777777";
    const { client } = rpcClient({ result: "conflict", protocol_id: existing });
    expect(await createReturnProtocol(client, validInput())).toEqual({ status: "conflict", protocolId: existing });
  });

  it("maps a no_baseline tag (no issue protocol / mismatched baseline)", async () => {
    const { client } = rpcClient({ result: "no_baseline", protocol_id: null });
    expect(await createReturnProtocol(client, validInput())).toEqual({ status: "no_baseline" });
  });

  it("degrades a null client to unauthorized without calling the RPC", async () => {
    expect(await createReturnProtocol(null, validInput())).toEqual({ status: "unauthorized" });
  });

  it("rejects a malformed baselineProtocolId before touching the RPC (the new third guard)", async () => {
    const { calls, client } = rpcClient({ result: "ok", protocol_id: PROTOCOL_ID });
    const result = await createReturnProtocol(client, validInput({ baselineProtocolId: "not-a-uuid" }));
    expect(result).toEqual({ status: "unauthorized" });
    expect(calls).toHaveLength(0);
  });
});
