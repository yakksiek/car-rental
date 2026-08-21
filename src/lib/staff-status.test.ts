// core
import { describe, expect, it } from "vitest";

// others
import { deriveStaffStatus } from "./staff-status";

describe("deriveStaffStatus", () => {
  it("is active once a password has been set", () => {
    expect(deriveStaffStatus("2026-08-20T10:00:00.000Z")).toBe("active");
  });

  it("is invited when a password has never been set", () => {
    expect(deriveStaffStatus(null)).toBe("invited");
  });

  it("is invited when the column is absent entirely (pre-backfill / partial select)", () => {
    expect(deriveStaffStatus(undefined)).toBe("invited");
  });

  // THE REGRESSION. Before invite-journey-fixes the derivation read
  // `auth.users.last_sign_in_at`, which GoTrue stamps on the invite link
  // exchange — so a hire who opened their link and closed the tab was listed
  // AKTYWNY while being unable to sign in, and a repair sent them no activation
  // mail. The link exchange is not an input here at all; only the stamp is.
  it("stays invited for a hire whose link exchange stamped last_sign_in_at but who set no password", () => {
    const lastSignInAt = "2026-08-20T10:00:00.000Z"; // stamped by verifyOtp
    const passwordSetAt = null; // never set a password
    expect(deriveStaffStatus(passwordSetAt)).toBe("invited");
    // Guard against a future refactor quietly reintroducing the proxy: the
    // exchange timestamp must not be able to flip the badge.
    expect(deriveStaffStatus(passwordSetAt)).not.toBe(deriveStaffStatus(lastSignInAt));
  });

  it("treats an empty string as never-set rather than truthy-by-accident", () => {
    expect(deriveStaffStatus("")).toBe("invited");
  });
});
