// ---------------------------------------------------------------------------
// Roster status derivation (invite-journey-fixes).
//
// Extracted out of `services/staff.ts` deliberately. `staff.ts` has no unit test
// importing it, and the `unit` Vitest project is the one layer CI actually gates
// this change on — so the rule that decides AKTYWNY vs ZAPROSZONY lives here,
// where `staff-status.test.ts` can hold it. Mirrors the shape `readLinkOrigin`
// and `resolveAuthError` already use for page-level decisions.
// ---------------------------------------------------------------------------

/** What the roster badge shows: AKTYWNY vs ZAPROSZONY. */
export type StaffStatus = "active" | "invited";

/**
 * ACTIVE iff this person has set a password through one of our own two routes
 * (`api/auth/reset-password.ts`, `api/auth/change-password.ts`), which is what
 * writes `profiles.password_set_at`.
 *
 * NOT `last_sign_in_at`. GoTrue stamps that on the invite LINK EXCHANGE, so a
 * hire who merely opened their link — and cannot sign in, having never chosen a
 * password — reads as ACTIVE through that proxy. That misreading is the whole
 * reason this function exists; `staff-status.test.ts` pins it as a regression.
 */
export function deriveStaffStatus(passwordSetAt: string | null | undefined): StaffStatus {
  return passwordSetAt ? "active" : "invited";
}
