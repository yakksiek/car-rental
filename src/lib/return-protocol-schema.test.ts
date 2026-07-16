// core
import { describe, expect, it } from "vitest";

// others
import { firstIssuePerField, returnProtocolSchema } from "./return-protocol-schema";
import { PHOTO_SLOTS } from "./protocol-schema";

/** Parse, assert it failed, and hand back the `{ field: message }` map the API returns. */
function expectFieldErrors(input: unknown): Record<string, string> {
  const result = returnProtocolSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error("expected the schema to reject this input");
  }
  return firstIssuePerField(result.error.issues);
}

const PROTOCOL_ID = "11111111-1111-1111-1111-111111111111";
const RESERVATION_ID = "22222222-2222-2222-2222-222222222222";
const BASELINE_ID = "33333333-3333-3333-3333-333333333333";
const DAMAGE_ID = "44444444-4444-4444-4444-444444444444";
const BASELINE_DAMAGE_ID = "55555555-5555-5555-5555-555555555555";
const PREFIX = `return/${PROTOCOL_ID}`;

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    protocolId: PROTOCOL_ID,
    reservationId: RESERVATION_ID,
    baselineProtocolId: BASELINE_ID,
    odometerKm: "42850",
    fuelEighths: 4,
    customerAck: true,
    signedAt: "2026-07-16T12:08:00.000Z",
    signaturePath: `${PREFIX}/signature.png`,
    photos: Object.fromEntries(PHOTO_SLOTS.map((slot) => [slot, `${PREFIX}/photo-${slot}.jpg`])),
    damages: [],
    ...overrides,
  };
}

describe("returnProtocolSchema", () => {
  it("accepts a complete return protocol and coerces the odometer string to an int", () => {
    const parsed = returnProtocolSchema.parse(validInput());
    expect(parsed.odometerKm).toBe(42850);
    expect(parsed.baselineProtocolId).toBe(BASELINE_ID);
    expect(parsed.photos.dashboard).toBe(`${PREFIX}/photo-dashboard.jpg`);
  });

  it("rejects a missing baselineProtocolId — a return may not stand without an issue baseline", () => {
    const { baselineProtocolId: _omit, ...withoutBaseline } = validInput();
    expect(expectFieldErrors(withoutBaseline)).toHaveProperty("baselineProtocolId");
  });

  it("rejects a non-uuid baselineProtocolId", () => {
    expect(returnProtocolSchema.safeParse(validInput({ baselineProtocolId: "not-a-uuid" })).success).toBe(false);
  });

  it("carries a per-damage baselineDamageId when the item is tagged existing", () => {
    const parsed = returnProtocolSchema.parse(
      validInput({
        damages: [
          {
            id: DAMAGE_ID,
            type: "scratch",
            location: "lewy błotnik — zarysowanie ąćęłńóśźż",
            baselineDamageId: BASELINE_DAMAGE_ID,
            photos: [`${PREFIX}/damage-${DAMAGE_ID}-1.jpg`],
          },
        ],
      }),
    );
    expect(parsed.damages[0].baselineDamageId).toBe(BASELINE_DAMAGE_ID);
    expect(parsed.damages[0].location).toBe("lewy błotnik — zarysowanie ąćęłńóśźż");
  });

  it("defaults an absent baselineDamageId to null (a new damage)", () => {
    const parsed = returnProtocolSchema.parse(
      validInput({
        damages: [{ id: DAMAGE_ID, type: "dent", location: "prawe drzwi ąćęłńóśźż", photos: [] }],
      }),
    );
    expect(parsed.damages[0].baselineDamageId).toBeNull();
  });

  it("rejects a signature path under the issue/ prefix — the return guard must not accept it", () => {
    const errors = expectFieldErrors(validInput({ signaturePath: `issue/${PROTOCOL_ID}/signature.png` }));
    expect(errors).toHaveProperty("signaturePath");
  });

  it("rejects a photo path pointing at another protocol's return folder", () => {
    const photos = {
      ...Object.fromEntries(PHOTO_SLOTS.map((slot) => [slot, `${PREFIX}/photo-${slot}.jpg`])),
      front: "return/99999999-9999-9999-9999-999999999999/photo-front.jpg",
    };
    expect(expectFieldErrors(validInput({ photos }))).toHaveProperty("photos");
  });

  it("rejects a damage photo path outside this protocol's return folder", () => {
    const result = returnProtocolSchema.safeParse(
      validInput({
        damages: [
          {
            id: DAMAGE_ID,
            type: "scratch",
            location: "tylny zderzak ąćęłńóśźż",
            photos: [`issue/${PROTOCOL_ID}/damage-${DAMAGE_ID}-1.jpg`],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects customerAck when it is false", () => {
    expect(returnProtocolSchema.safeParse(validInput({ customerAck: false })).success).toBe(false);
  });

  it.each([-1, 9])("rejects fuelEighths outside 0–8 (%i)", (fuelEighths) => {
    expect(returnProtocolSchema.safeParse(validInput({ fuelEighths })).success).toBe(false);
  });

  // The return schema RE-DECLARES its own odometer/photos/damage validators (it
  // imports only PHOTO_SLOTS/DAMAGE_TYPES/firstIssuePerField), so these mirror the
  // issue-schema negatives — otherwise a regression in the return copies is uncaught.

  it("requires all six photo slots", () => {
    const photos = Object.fromEntries(
      PHOTO_SLOTS.filter((s) => s !== "rear").map((s) => [s, `${PREFIX}/photo-${s}.jpg`]),
    );
    expect(returnProtocolSchema.safeParse(validInput({ photos })).success).toBe(false);
  });

  it("rejects a blank odometer rather than coercing it to 0", () => {
    expect(expectFieldErrors(validInput({ odometerKm: "  " }))).toHaveProperty("odometerKm");
  });

  it("rejects a negative odometer", () => {
    expect(returnProtocolSchema.safeParse(validInput({ odometerKm: "-1" })).success).toBe(false);
  });

  it("rejects a non-uuid protocolId", () => {
    expect(returnProtocolSchema.safeParse(validInput({ protocolId: "not-a-uuid" })).success).toBe(false);
  });

  it("rejects a damage item with a blank location", () => {
    const result = returnProtocolSchema.safeParse(
      validInput({ damages: [{ id: DAMAGE_ID, type: "crack", location: "   ", photos: [] }] }),
    );
    expect(result.success).toBe(false);
  });

  it("normalizes a blank damage size to null", () => {
    const parsed = returnProtocolSchema.parse(
      validInput({
        damages: [
          {
            id: DAMAGE_ID,
            type: "dent",
            location: "lewy błotnik ąćęłńóśźż",
            size: "  ",
            photos: [`${PREFIX}/damage-${DAMAGE_ID}-1.jpg`],
          },
        ],
      }),
    );
    expect(parsed.damages[0].size).toBeNull();
  });
});
