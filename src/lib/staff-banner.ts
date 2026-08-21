// others
import type { StaffStatus } from "./staff-status";

// ---------------------------------------------------------------------------
// Where every outcome of `POST /api/staff` is reported, and in what words.
//
// Extracted out of `StaffList.tsx` for the same reason `staff-status.ts` was
// extracted out of `services/staff.ts`: the `COPY` block is a module-private
// object inside a `.tsx` island, so nothing can gate its wording — and this
// module exists precisely BECAUSE the wording, and then the ROUTING, were wrong.
// In `src/lib` the `unit` Vitest project (the one layer CI actually runs) can
// hold the rule.
//
// Phase 7 put the copy here. Phase 9 put the routing here too, because the
// routing was the worse defect: `addEmployee`'s network arm set a BANNER and
// left the modal open, so the message painted behind `ModalShell`'s overlay
// (`fixed inset-0 z-[60] … backdrop-blur-sm`). Hit-testing the banner's centre
// returned the overlay, not the banner — the most common failure, a dropped
// connection, was the one that reported nothing an admin could read.
//
// Two rules this module now holds, both pinned by `staff-banner.test.ts`:
//
//   1. No arm reports to the banner while the modal stays open. That is the
//      exact state that produced the invisible error, and `inBanner` /
//      `inModal` below make it unrepresentable through the constructors.
//   2. The API distinguishes `provision_rolled_back` from `provision_orphaned`
//      — a real system-health signal, an orphan means the compensating delete
//      also failed — but the ADMIN's situation is identical in both, and so is
//      their remedy. Both codes therefore render one byte-identical sentence.
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
 * Copy is `design-contract.md` §9 verbatim. Do not reword here — these are
 * approved Polish and the contract is their source.
 *
 * The two modal strings lead with the identical state-of-the-world clause and
 * differ only in the remedy, following §9's two-sentence convention. Neither
 * names the address: inside the modal it is on screen in the e-mail field two
 * rows above, which is exactly the argument the banner form could not make.
 */
const COPY = {
  /** §9.4 — a provisioning failure, reported in the modal the admin is still in. */
  provisionFailed: "Nie udało się utworzyć konta. Spróbuj ponownie.",
  /** §9.4 — a dropped connection or any other unhandled response. */
  requestFailed: "Nie udało się utworzyć konta. Sprawdź połączenie i spróbuj ponownie.",
  /** Shipped S-08 string, moved here unchanged so the table owns every arm. */
  duplicateEmail: "Ten adres e-mail jest już w zespole.",
} as const;

/**
 * Where a report is rendered.
 *
 * There is deliberately no `both`. Phase 9 §3 had to resolve a duplication —
 * the modal's submit and the banner's `Ponów` as two live retries for one
 * failure — and resolved it by giving the modal sole ownership of every add
 * failure. One failure, one message: a variant nothing can produce would be
 * dead machinery, and its absence is the type-level statement of that decision.
 */
export type AddReportTarget = "none" | "modal" | "banner";

export interface AddReport {
  /** Which surface renders the message. */
  target: AddReportTarget;
  /** Which slot inside the modal — inline under the e-mail field, or form-level. */
  slot: "email" | "form" | null;
  /** Whether the add modal stays open around the report. */
  keepsModalOpen: boolean;
  /** The message, or `null` on the arms that render none. */
  message: string | null;
}

/** Everything `POST /api/staff` can answer with, as the island sees it. */
export type AddOutcome =
  | { kind: "ok"; activationMail?: "sent" | "failed" | "not_needed" | null; status?: StaffStatus | null }
  | { kind: "http"; httpStatus: number; code?: string | null }
  | { kind: "network" };

// The three legal shapes of a report. Going through these constructors is what
// makes "banner while the modal stays open" unrepresentable — rule 1 above.
const silent = (): AddReport => ({ target: "none", slot: null, keepsModalOpen: false, message: null });

const inModal = (slot: "email" | "form", message: string): AddReport => ({
  target: "modal",
  slot,
  keepsModalOpen: true,
  message,
});

const inBanner = (message: string): AddReport => ({
  target: "banner",
  slot: null,
  keepsModalOpen: false,
  message,
});

/**
 * The whole outcome→surface table for the add flow, in one readable place.
 *
 * Every arm has a case, including the ones that keep the behaviour they shipped
 * with — a table you have to cross-reference against an island to read is the
 * table that produced this bug.
 *
 * | Outcome                              | Surface                    | Modal   |
 * | ------------------------------------ | -------------------------- | ------- |
 * | 201 created / 200 repaired, mail ok  | nothing                    | closes  |
 * | 200 repaired, activation mail failed | banner                     | closes  |
 * | 409 duplicate                        | inline under the e-mail    | stays   |
 * | 500 + a provisioning `code`          | modal, form-level          | stays   |
 * | anything else, incl. `fetch` threw   | modal, form-level          | stays   |
 */
export function resolveAddReport(outcome: AddOutcome): AddReport {
  switch (outcome.kind) {
    case "ok":
      // The repair succeeded — the row belongs on the roster and the modal
      // closes — but the activation e-mail did not go out, so the hire has no
      // way in. This is the ONE arm that still reports as a banner, and it is
      // out of phase 9's scope by design: it rides a 200, the row really did
      // land, and its remedy is the row's own invite action, which the copy
      // names. Nothing about it is hidden behind an overlay.
      return outcome.activationMail === "failed"
        ? inBanner(repairedMailFailedMessage(outcome.status ?? "created"))
        : silent();

    case "http":
      // A duplicate belongs to the e-mail the admin typed, so it attaches to
      // that field — the shipped idiom, and the design's own answer to "the
      // server refused your add: say so in the form".
      if (outcome.httpStatus === 409) {
        return inModal("email", COPY.duplicateEmail);
      }
      // A provisioning failure belongs to the submission, not to a field. The
      // route marks it with a machine-readable `code`; an unhandled 500 has
      // none (Astro's HTML body), so it falls through to the arm below.
      if (outcome.code && KNOWN_CODES.has(outcome.code)) {
        return inModal("form", COPY.provisionFailed);
      }
      return inModal("form", COPY.requestFailed);

    case "network":
      // THE PHASE-9 DEFECT. `fetch` threw, the typed values are still perfectly
      // good, and this used to set a banner behind the overlay while leaving the
      // modal open — feedback the admin could not read at all.
      return inModal("form", COPY.requestFailed);
  }
}

/**
 * The label on a password-less row's one action — a first send for someone
 * created-but-never-invited, a resend for someone whose invite went missing.
 *
 * `active` is not reachable here (that row shows `Resetuj hasło` instead) but is
 * mapped to the first-send label rather than left to throw: a wrong-but-real
 * label degrades better than a crash or a blank button.
 */
export function inviteActionLabel(status: StaffStatus): string {
  return status === "invited" ? "Wyślij ponownie zaproszenie" : "Wyślij zaproszenie";
}

/**
 * The banner for "the account was repaired but its invitation did not go out".
 *
 * It lives here, beside `inviteActionLabel`, because it must NAME that button —
 * and after a repair the target may be in either password-less state, so the two
 * strings have to move together or the copy points at a control that row does not
 * show. That coupling is the whole reason the design first tried to get away with
 * one shared label (design-contract §9.2); carrying two labels is only safe while
 * `staff-banner.test.ts` holds the two functions in agreement.
 *
 * Copy is `design-contract.md` §9.2, verbatim. Do not reword here.
 */
export function repairedMailFailedMessage(status: StaffStatus): string {
  return `Konto zostało odnowione, ale zaproszenie nie zostało wysłane. Użyj „${inviteActionLabel(status)}” przy tej osobie.`;
}
