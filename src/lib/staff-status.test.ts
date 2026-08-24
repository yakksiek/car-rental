// core
import { describe, expect, it } from "vitest";

// others
import { deriveStaffStatus } from "./staff-status";

const STAMP = "2026-08-20T10:00:00.000Z";
const INVITED = "2026-08-19T09:00:00.000Z";

describe("deriveStaffStatus", () => {
  it("is active once a password has been set", () => {
    expect(deriveStaffStatus(STAMP, INVITED)).toBe("active");
  });

  it("is invited when an invitation went out but no password was ever set", () => {
    expect(deriveStaffStatus(null, INVITED)).toBe("invited");
  });

  it("is created when nothing has been sent yet — the two-step add's first step", () => {
    expect(deriveStaffStatus(null, null)).toBe("created");
  });

  it("is active even with no invitation on record — a password outranks the invite fact", () => {
    // The seed's two F-02 accounts are exactly this shape: a real password,
    // `invited_at` null because they were never invited through GoTrue.
    expect(deriveStaffStatus(STAMP, null)).toBe("active");
  });

  it("is created when both columns are absent entirely (pre-backfill / partial select)", () => {
    expect(deriveStaffStatus(undefined, undefined)).toBe("created");
  });

  // THE REGRESSION. Before invite-journey-fixes the derivation read
  // `auth.users.last_sign_in_at`, which GoTrue stamps on the invite link
  // exchange — so a hire who opened their link and closed the tab was listed
  // AKTYWNY while being unable to sign in, and a repair sent them no activation
  // mail. The link exchange is not an input here at all; only the stamp is.
  it("stays invited for a hire whose link exchange stamped last_sign_in_at but who set no password", () => {
    const lastSignInAt = STAMP; // stamped by verifyOtp
    const passwordSetAt = null; // never set a password
    expect(deriveStaffStatus(passwordSetAt, INVITED)).toBe("invited");
    // Guard against a future refactor quietly reintroducing the proxy: the
    // exchange timestamp must not be able to flip the badge.
    expect(deriveStaffStatus(passwordSetAt, INVITED)).not.toBe(deriveStaffStatus(lastSignInAt, INVITED));
  });

  it("treats empty strings as never-set rather than truthy-by-accident", () => {
    expect(deriveStaffStatus("", INVITED)).toBe("invited");
    expect(deriveStaffStatus("", "")).toBe("created");
  });
});
