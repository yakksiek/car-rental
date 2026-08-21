// ---------------------------------------------------------------------------
// Roster mutation-banner copy (invite-journey-fixes, phase 7).
//
// Extracted out of `StaffList.tsx` for the same reason `staff-status.ts` was
// extracted out of `services/staff.ts`: the `COPY` block is a module-private
// object inside a `.tsx` island, so nothing can gate its wording — and this
// module exists precisely BECAUSE the wording was wrong. In `src/lib` the
// `unit` Vitest project (the one layer CI actually runs) can hold the rule.
//
// The rule that matters: the API distinguishes `provision_rolled_back` from
// `provision_orphaned` — a real system-health signal, an orphan means the
// compensating delete also failed — but the ADMIN's situation is identical in
// both, and so is their remedy. Both codes therefore render one byte-identical
// sentence, and `staff-banner.test.ts` pins that identity so a later edit
// cannot quietly re-split them.
// ---------------------------------------------------------------------------

/**
 * The failure codes `POST /api/staff` carries in its 500 body
 * (`api/staff.ts:87-90`). Anything else — including an unhandled 500, which has
 * no `code` at all — is not a provisioning failure.
 */
export const PROVISION_FAILURE_CODES = ["provision_rolled_back", "provision_orphaned"] as const;

export type ProvisionFailureCode = (typeof PROVISION_FAILURE_CODES)[number];

// Membership via a Set, not by indexing an object literal: `codes["__proto__"]`
// would answer with `Object.prototype` — truthy, non-null, and rendered as
// "[object Object]". Same guard, same reason, as `auth-messages.ts:82-85`.
const KNOWN_CODES: ReadonlySet<string> = new Set(PROVISION_FAILURE_CODES);

/**
 * The banner sentence for a failed provisioning, or `null` when the code is not
 * one of ours — the caller then falls through to the network banner
 * (`COPY.mutationError`), exactly as it did before this module existed.
 *
 * The address is interpolated because a failed provisioning is invisible
 * everywhere else: the orphan drives no roster row (`list_staff` INNER-joins),
 * so this banner is the only place in the product where that address exists.
 *
 * Copy is `design-contract.md` §9.2, verbatim. Do not reword here — the string
 * is approved Polish and the contract is its source.
 */
export function provisionFailureMessage(code: string | null | undefined, email: string): string | null {
  if (!code || !KNOWN_CODES.has(code)) {
    return null;
  }
  return `Nie udało się utworzyć konta dla ${email}. Spróbuj ponownie.`;
}
