// core
import { describe, expect, it } from "vitest";

// others
import { firstIssuePerField, PHOTO_SLOTS, protocolInputSchema } from "./protocol-schema";

/** Parse, assert it failed, and hand back the `{ field: message }` map the API returns. */
function expectFieldErrors(input: unknown): Record<string, string> {
  const result = protocolInputSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error("expected the schema to reject this input");
  }
  return firstIssuePerField(result.error.issues);
}

const PROTOCOL_ID = "11111111-1111-1111-1111-111111111111";
const RESERVATION_ID = "22222222-2222-2222-2222-222222222222";
const DAMAGE_ID = "33333333-3333-3333-3333-333333333333";
const PREFIX = `issue/${PROTOCOL_ID}`;

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    protocolId: PROTOCOL_ID,
    reservationId: RESERVATION_ID,
    odometerKm: "128450",
    fuelEighths: 6,
    customerAck: true,
    signedAt: "2026-07-10T12:08:00.000Z",
    signaturePath: `${PREFIX}/signature.png`,
    photos: Object.fromEntries(PHOTO_SLOTS.map((slot) => [slot, `${PREFIX}/photo-${slot}.jpg`])),
    damages: [],
    ...overrides,
  };
}

describe("protocolInputSchema", () => {
  it("accepts a complete protocol and coerces the odometer string to an int", () => {
    const parsed = protocolInputSchema.parse(validInput());
    expect(parsed.odometerKm).toBe(128450);
    expect(parsed.photos.dashboard).toBe(`${PREFIX}/photo-dashboard.jpg`);
    expect(parsed.damages).toEqual([]);
  });

  it.each([0, 8])("accepts fuelEighths at the boundary %i", (fuelEighths) => {
    expect(protocolInputSchema.safeParse(validInput({ fuelEighths })).success).toBe(true);
  });

  it.each([-1, 9])("rejects fuelEighths outside 0–8 (%i)", (fuelEighths) => {
    expect(protocolInputSchema.safeParse(validInput({ fuelEighths })).success).toBe(false);
  });

  it("rejects customerAck when it is false — the box must be ticked, not persisted as false", () => {
    expect(protocolInputSchema.safeParse(validInput({ customerAck: false })).success).toBe(false);
  });

  it("rejects a blank odometer rather than coercing it to 0", () => {
    expect(expectFieldErrors(validInput({ odometerKm: "  " }))).toHaveProperty("odometerKm");
  });

  it("rejects a negative odometer", () => {
    expect(protocolInputSchema.safeParse(validInput({ odometerKm: "-1" })).success).toBe(false);
  });

  it("requires all six photo slots", () => {
    const photos = Object.fromEntries(PHOTO_SLOTS.filter((s) => s !== "rear").map((s) => [s, `${PREFIX}/${s}.jpg`]));
    expect(protocolInputSchema.safeParse(validInput({ photos })).success).toBe(false);
  });

  it("rejects a signature path pointing outside this protocol's folder", () => {
    const errors = expectFieldErrors(
      validInput({ signaturePath: "issue/99999999-9999-9999-9999-999999999999/signature.png" }),
    );
    expect(errors).toHaveProperty("signaturePath");
  });

  it("rejects a damage photo path pointing outside this protocol's folder", () => {
    const result = protocolInputSchema.safeParse(
      validInput({
        damages: [
          { id: DAMAGE_ID, type: "scratch", location: "lewy tylny zderzak", photos: ["issue/other/damage-1.jpg"] },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a damage item and normalizes a blank size to null", () => {
    const parsed = protocolInputSchema.parse(
      validInput({
        damages: [
          {
            id: DAMAGE_ID,
            type: "dent",
            location: "lewy błotnik — zarysowanie",
            size: "  ",
            photos: [`${PREFIX}/damage-${DAMAGE_ID}-1.jpg`],
          },
        ],
      }),
    );
    expect(parsed.damages[0].size).toBeNull();
    expect(parsed.damages[0].location).toBe("lewy błotnik — zarysowanie");
  });

  it("rejects a damage item with a blank location", () => {
    expect(
      protocolInputSchema.safeParse(
        validInput({ damages: [{ id: DAMAGE_ID, type: "crack", location: "   ", photos: [] }] }),
      ).success,
    ).toBe(false);
  });

  it("rejects a client-minted id that is not a uuid", () => {
    expect(protocolInputSchema.safeParse(validInput({ protocolId: "not-a-uuid" })).success).toBe(false);
  });
});
