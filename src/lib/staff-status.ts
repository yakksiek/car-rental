// ---------------------------------------------------------------------------
// Roster status derivation (invite-journey-fixes).
//
// Extracted out of `services/staff.ts` deliberately. `staff.ts` has no unit test
// importing it, and the `unit` Vitest project is the one layer CI actually gates
// this change on — so the rule that decides DODANY vs ZAPROSZONY vs AKTYWNY
// lives here, where `staff-status.test.ts` can hold it. Mirrors the shape
// `readLinkOrigin` and `resolveAuthError` already use for page-level decisions.
// ---------------------------------------------------------------------------

/** What the roster badge shows: AKTYWNY vs ZAPROSZONY vs DODANY. */
export type StaffStatus = "active" | "invited" | "created";

/**
 * Three states, read off two owned facts:
 *
 *   • ACTIVE   — this person has set a password through one of our own two
 *                routes (`api/auth/reset-password.ts`, `api/auth/change-password.ts`),
 *                which is what writes `profiles.password_set_at`.
 *   • INVITED  — no password, but an invitation has gone out (`auth.users.invited_at`).
 *   • CREATED  — neither. The account exists and nothing has been sent for it.
 *                Reachable since the two-step add (phase 8): `createEmployee`
 *                creates silently and `inviteEmployee` is a separate, explicit act.
 *
 * NOT `last_sign_in_at`. GoTrue stamps that on an invite LINK EXCHANGE, so a
 * hire who merely opened their link — and cannot sign in, having never chosen a
 * password — reads as ACTIVE through that proxy. That misreading is the whole
 * reason this function exists; `staff-status.test.ts` pins it as a regression.
 */
export function deriveStaffStatus(
  passwordSetAt: string | null | undefined,
  invitedAt: string | null | undefined,
): StaffStatus {
  if (passwordSetAt) {
    return "active";
  }
  return invitedAt ? "invited" : "created";
}
