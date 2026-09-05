// others
import type { Locale } from "./i18n/types";
import type { StaffStatus } from "./staff-status";

// ---------------------------------------------------------------------------
// Where every mutation on `/dashboard/staff` is reported, and in what words.
//
// Extracted out of `StaffList.tsx` for the same reason `staff-status.ts` was
// extracted out of `services/staff.ts`: the `COPY` block is a module-private
// object inside a `.tsx` island, so nothing can gate its wording — and this
// module exists precisely BECAUSE the wording, and then the ROUTING, were wrong.
// In `src/lib` the `unit` Vitest project (the one layer CI actually runs) can
// hold the rule.
//
// Phase 7 put the copy here. Phase 9 put the ADD flow's routing here too,
// because the routing was the worse defect. Phase 10 widened it to the other
// three mutations, for the reason phase 9 established and phase 10 rediscovered
// one surface over: a routing decision left as an `if` inside an island is a
// decision nothing can test.
//
// NAMED `staff-report`, NOT `staff-banner` (phase 10 §1). The module outgrew the
// old name in phase 9 — it owns modal copy and routing, and after phase 10 it
// owns three surfaces of which the banner is one. The rename was a mechanical
// move plus import updates (one importer, two comment references), taken as its
// own step rather than smuggled in with the behaviour change.
//
// Three rules this module holds, all pinned by `staff-report.test.ts`:
//
//   1. No arm reports to the banner while a modal stays open. That is the exact
//      state that produced phase 9's invisible error, and the `inModal` /
//      `inBanner` constructors make it unrepresentable as well as tested.
//   2. Every arm targets a surface its own mutation is allowed to use
//      (`ALLOWED_TARGETS`). This is what stops `remove` drifting back onto the
//      banner, which is where phase 10 found it.
//   3. The API distinguishes `provision_rolled_back` from `provision_orphaned`
//      — a real system-health signal, an orphan means the compensating delete
//      also failed — but the ADMIN's situation is identical in both, and so is
//      their remedy. Both codes therefore render one byte-identical sentence.
//   4. A refusal that can never succeed carries no retry control. Added by the
//      demo gate: three of the four mutations answer a demo caller with 403
//      `demo_blocked`, and that is the only failure in this module which is not
//      worth trying again — so it is the one row-action failure without `Ponów`.
//
// WHAT THIS MODULE CANNOT SEE, and where that half is enforced instead.
// Phase 10's defect was not "the wrong surface" — three of four row arms were
// already on the banner and that was the intended surface. It was that the
// banner itself sat at the top of a scrolling document while the controls that
// set it were per-row, so the message landed outside the viewport (measured
// 2026-08-21: banner top `-1033` at 390×844, `elementFromPoint` → null).
// Reachability depends on scroll position and on the overlay. A pure function
// over outcomes has no view of either, so asserting it here would be a criterion
// no layer can fail. The split, stated so it is not rediscovered:
//
//   • THIS module + `staff-report.test.ts` gate WHICH surface an arm targets.
//   • `e2e/staff-admin.spec.ts` gates whether that surface is REACHABLE, with an
//     in-viewport + topmost-at-its-own-centre assertion at 390×844 — the only
//     viewport where a seeded roster scrolls far enough for the defect to exist.
//
// SHAPE — three sibling resolvers over one `Report`, not one union (phase 10 §1).
// Written out arm by arm first, as the plan asked. A single `resolveMutationReport`
// would have to discriminate on the mutation anyway — `409` means "duplicate
// e-mail" for add and "last administrator" for remove, and they resolve to
// different surfaces — so the union collapses to three functions wearing one
// signature, and the per-mutation table stops being readable in one place. The
// shared parts that DO generalise are the `Report` shape, the constructors, and
// the invariant sweep, and those are shared.
// ---------------------------------------------------------------------------

/**
 * The failure codes `POST /api/staff` carries in its 500 body
 * (`api/staff.ts:87-90`). Anything else — including an unhandled 500, which has
 * no `code` at all — is not a provisioning failure.
 */
export const PROVISION_FAILURE_CODES = ["provision_rolled_back", "provision_orphaned"] as const;

export type ProvisionFailureCode = (typeof PROVISION_FAILURE_CODES)[number];

/**
 * The `code` the three demo-gated routes carry on their 403 (`api/staff.ts`,
 * `api/staff/[id]/deactivate.ts`, `api/staff/[id]/reset-password.ts`).
 *
 * It exists because a BARE 403 already means something else on every one of
 * those routes — bad origin, missing role, unconfigured service key, or (on
 * remove) the `self` refusal — and all of them resolve to a "check your
 * connection / try again" sentence. A demo refusal is none of those and is not
 * retryable, so without the code the roster would name the wrong cause and offer
 * a retry that cannot succeed.
 */
export const DEMO_BLOCKED_CODE = "demo_blocked";

/**
 * The demo refusal, shared by all three resolvers AND by the island's disabled
 * controls (`StaffList.tsx`, and the promoted add row in `QuickAddButton.tsx`),
 * so the reason a control is fenced and the reason the server gives are one
 * string. Matches the `MSG.demoBlocked` the three routes answer with.
 *
 * Deliberately NOT the same sentence as the sign-in card's demo note
 * (design-contract §2.9): that one is scoped to the sign-in context and warns
 * ahead of time; this one explains a control the visitor is looking at.
 */
const DEMO_BLOCKED = {
  en: "This action is disabled on the demo account.",
  pl: "Ta akcja jest wyłączona na koncie demo.",
};

/**
 * The demo gate's refusal, in the active locale. A function rather than the
 * constant it replaced so the island's disabled hints and the report table below
 * cannot answer with different sentences.
 */
export function demoBlockedMessage(locale: Locale): string {
  return DEMO_BLOCKED[locale];
}

// Membership via a Set, not by indexing an object literal: `codes["__proto__"]`
// would answer with `Object.prototype` — truthy, non-null, and rendered as
// "[object Object]". Same guard, same reason, as `auth-messages.ts:82-85`.
const KNOWN_CODES: ReadonlySet<string> = new Set(PROVISION_FAILURE_CODES);

/**
 * Copy is `design-contract.md` §9 verbatim. Do not reword here — these are
 * approved Polish and the contract is their source.
 *
 * The four modal strings lead with an identical state-of-the-world clause per
 * surface and differ only in the remedy, following §9's two-sentence convention.
 * None names the address or the person: inside a modal both are already on
 * screen, which is exactly the argument the banner form could not make.
 */
interface StaffCopy {
  /** §9.4 — a provisioning failure, reported in the add modal. */
  provisionFailed: string;
  /** §9.4 — a dropped connection or any other unhandled response on add. */
  requestFailed: string;
  /** Shipped S-08 string, moved here unchanged so the table owns every arm. */
  duplicateEmail: string;
  /** §9.5 — the server refused a remove, reported in the remove modal. */
  removeFailed: string;
  /** §9.5 — a dropped connection on remove. */
  removeRequestFailed: string;
  /**
   * The ROW actions' failure banner. Deliberately generic: invite and reset have
   * no form to report into, so one string covers both. §9.4 records the decision
   * not to split it.
   */
  mutationError: string;
  /**
   * §9.3 authored this one precisely because a RESEND changes nothing on screen
   * — the badge is already ZAPROSZONY — so without it the admin gets no feedback
   * at all. That makes it load-bearing, and phase 10 exists partly because a
   * success banner the admin never sees fails that job as completely as a
   * failure banner does.
   */
  inviteSent: string;
  resetSent: string;
  /** The label on a password-less row's one action — first send vs resend. */
  sendInvite: string;
  resendInvite: string;
  /** `{action}` is substituted with whichever of the two labels that row shows. */
  repairedMailFailed: string;
}

const COPY: Record<Locale, StaffCopy> = {
  en: {
    provisionFailed: "Could not create the account. Try again.",
    requestFailed: "Could not create the account. Check your connection and try again.",
    duplicateEmail: "This email is already on the team.",
    removeFailed: "Could not remove the employee. Try again.",
    removeRequestFailed: "Could not remove the employee. Check your connection and try again.",
    mutationError: "Could not save your change. Check your connection and try again.",
    inviteSent: "Invitation sent.",
    resetSent: "Password-reset email sent.",
    sendInvite: "Send invite",
    resendInvite: "Resend invite",
    repairedMailFailed: "The account was restored, but the invitation was not sent. Use “{action}” on that person.",
  },
  pl: {
    provisionFailed: "Nie udało się utworzyć konta. Spróbuj ponownie.",
    requestFailed: "Nie udało się utworzyć konta. Sprawdź połączenie i spróbuj ponownie.",
    duplicateEmail: "Ten adres e-mail jest już w zespole.",
    removeFailed: "Nie udało się usunąć pracownika. Spróbuj ponownie.",
    removeRequestFailed: "Nie udało się usunąć pracownika. Sprawdź połączenie i spróbuj ponownie.",
    mutationError: "Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj ponownie.",
    inviteSent: "Wysłano zaproszenie.",
    resetSent: "Wysłano e-mail do resetu hasła.",
    sendInvite: "Wyślij zaproszenie",
    resendInvite: "Wyślij ponownie zaproszenie",
    repairedMailFailed:
      "Konto zostało odnowione, ale zaproszenie nie zostało wysłane. Użyj „{action}” przy tej osobie.",
  },
};

/**
 * Where a report is rendered.
 *
 * There is deliberately no `both`. Phase 9 §3 had to resolve a duplication —
 * the modal's submit and the banner's `Ponów` as two live retries for one
 * failure — and resolved it by giving the modal sole ownership of every add
 * failure. One failure, one message: a variant nothing can produce would be
 * dead machinery, and its absence is the type-level statement of that decision.
 *
 * `last-admin-modal` is a surface swap rather than a message — the refusal's
 * copy lives in `LastAdminModal` itself. It earns a target because leaving it
 * out would make remove's table read as three arms when it has four, and an
 * incomplete table is what phase 9 and phase 10 were both written against.
 */
export type ReportTarget = "none" | "modal" | "last-admin-modal" | "banner";

export type ReportTone = "error" | "success";

export interface Report {
  /** Which surface renders the message. */
  target: ReportTarget;
  /** Which slot inside the modal — inline under a field, or form-level. */
  slot: "email" | "form" | null;
  /** Whether the modal the mutation was launched from stays open around the report. */
  keepsModalOpen: boolean;
  /** Banner tone. `null` on the arms that render no banner. */
  tone: ReportTone | null;
  /**
   * Whether the surface carries a retry control of its own. False wherever the
   * surface already IS the retry — the add modal's submit, the remove modal's
   * `Usuń` — so exactly one retry control is ever on screen for one failure.
   */
  offersRetry: boolean;
  /** The message, or `null` on the arms that render none. */
  message: string | null;
}

/** The four mutations the roster can run. */
export type StaffMutation = "add" | "remove" | "invite" | "reset";

/**
 * Which control launches each mutation.
 *
 * This is the property phase 10 turned on: `add` is launched from a button in a
 * NON-STICKY page header, so the admin is necessarily at the top of the page
 * when its modal opens and its banner was covered but never off-screen. The
 * other three are per-row and carry no such guarantee at any scroll depth.
 */
export const TRIGGERED_FROM: Record<StaffMutation, "header" | "row"> = {
  add: "header",
  remove: "row",
  invite: "row",
  reset: "row",
};

/**
 * The surfaces each mutation is allowed to report to under phase 10 §3.
 *
 * `remove` excluding `banner` is the bite: its modal stays open on both failure
 * arms, so a banner would paint behind `ModalShell`'s overlay — phase 9's defect
 * on a sibling surface, which is exactly where phase 10 found it.
 */
const ALLOWED_TARGETS: Record<StaffMutation, ReadonlySet<ReportTarget>> = {
  add: new Set<ReportTarget>(["none", "modal", "banner"]),
  remove: new Set<ReportTarget>(["none", "modal", "last-admin-modal"]),
  invite: new Set<ReportTarget>(["none", "banner"]),
  reset: new Set<ReportTarget>(["none", "banner"]),
};

/** Exported for the sweep in `staff-report.test.ts`; not used by the island. */
export function allowedTargets(mutation: StaffMutation): ReadonlySet<ReportTarget> {
  return ALLOWED_TARGETS[mutation];
}

/** Everything `POST /api/staff` can answer with, as the island sees it. */
export type AddOutcome =
  | { kind: "ok"; activationMail?: "sent" | "failed" | "not_needed" | null; status?: StaffStatus | null }
  | { kind: "http"; httpStatus: number; code?: string | null }
  | { kind: "network" };

/**
 * Everything `POST /api/staff/:id/deactivate` can answer with.
 *
 * `code` widens this to `AddOutcome`'s shape. Only the demo gate populates it
 * today; every other arm leaves it null and keeps the status-only routing it
 * shipped with.
 */
export type RemoveOutcome = { kind: "http"; httpStatus: number; code?: string | null } | { kind: "network" };

/**
 * Everything the two row-action routes can answer with.
 *
 * Widened with `code` for the same reason as `RemoveOutcome`. Only `reset` can
 * actually carry `demo_blocked` — `[id]/invite.ts` is deliberately outside the
 * gate — but the two actions share one resolver and one wire read, so splitting
 * the type would buy an asymmetry rather than a guarantee.
 */
export type RowActionOutcome = { kind: "http"; httpStatus: number; code?: string | null } | { kind: "network" };

// The four legal shapes of a report. Going through these constructors is what
// makes "banner while the modal stays open" unrepresentable — rule 1 above.
const silent = (): Report => ({
  target: "none",
  slot: null,
  keepsModalOpen: false,
  tone: null,
  offersRetry: false,
  message: null,
});

const inModal = (slot: "email" | "form", message: string): Report => ({
  target: "modal",
  slot,
  keepsModalOpen: true,
  tone: "error",
  offersRetry: false,
  message,
});

const inBanner = (tone: ReportTone, message: string, offersRetry = false): Report => ({
  target: "banner",
  slot: null,
  keepsModalOpen: false,
  tone,
  offersRetry,
  message,
});

const swapToLastAdmin = (): Report => ({
  target: "last-admin-modal",
  slot: null,
  keepsModalOpen: false,
  tone: null,
  offersRetry: false,
  message: null,
});

/**
 * The whole outcome→surface table for the ADD flow, in one readable place.
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
 * | 403 + `demo_blocked`                 | modal, form-level          | stays   |
 * | 500 + a provisioning `code`          | modal, form-level          | stays   |
 * | anything else, incl. `fetch` threw   | modal, form-level          | stays   |
 */
export function resolveAddReport(outcome: AddOutcome, locale: Locale): Report {
  const copy = COPY[locale];
  switch (outcome.kind) {
    case "ok":
      // The repair succeeded — the row belongs on the roster and the modal
      // closes — but the activation e-mail did not go out, so the hire has no
      // way in. This is the ONE add arm that still reports as a banner, and it
      // is out of scope by design: it rides a 200, the row really did land, and
      // its remedy is the row's own invite action, which the copy names.
      //
      // Phase 10 note: it is also the one add arm whose reachability was NOT
      // guaranteed by construction. The add button sits in a non-sticky header,
      // so the admin is at the top when the modal opens — but `body` keeps
      // `overflow: visible`, so the page can be scrolled behind an open dialog,
      // and this banner would then paint above a page that has moved. Sticky
      // (§3) closes that for free; it is why §5's scroll-lock question could be
      // deferred rather than answered here.
      return outcome.activationMail === "failed"
        ? inBanner("error", repairedMailFailedMessage(outcome.status ?? "created", locale))
        : silent();

    case "http":
      // A duplicate belongs to the e-mail the admin typed, so it attaches to
      // that field — the shipped idiom, and the design's own answer to "the
      // server refused your add: say so in the form".
      if (outcome.httpStatus === 409) {
        return inModal("email", copy.duplicateEmail);
      }
      // The demo gate refused it. Reported in the modal like every other add
      // failure (phase 9's rule), form-level rather than under the e-mail field:
      // nothing is wrong with the address, the account is simply not allowed to
      // create staff. `inModal` carries `offersRetry: false`, which is the whole
      // point here — retrying is futile by construction, not merely unhelpful.
      //
      // Reachable only from a stale page: the island renders this trigger
      // disabled for a demo caller. The server is the boundary; the disabled
      // control is the courtesy.
      if (outcome.httpStatus === 403 && outcome.code === DEMO_BLOCKED_CODE) {
        return inModal("form", demoBlockedMessage(locale));
      }
      // A provisioning failure belongs to the submission, not to a field. The
      // route marks it with a machine-readable `code`; an unhandled 500 has
      // none (Astro's HTML body), so it falls through to the arm below.
      if (outcome.code && KNOWN_CODES.has(outcome.code)) {
        return inModal("form", copy.provisionFailed);
      }
      return inModal("form", copy.requestFailed);

    case "network":
      // THE PHASE-9 DEFECT. `fetch` threw, the typed values are still perfectly
      // good, and this used to set a banner behind the overlay while leaving the
      // modal open — feedback the admin could not read at all.
      return inModal("form", copy.requestFailed);
  }
}

/**
 * The outcome→surface table for REMOVE.
 *
 * | Outcome                     | Surface                | Modal   |
 * | --------------------------- | ---------------------- | ------- |
 * | 200 removed                 | nothing                | closes  |
 * | 409 last administrator      | the refusal modal      | swaps   |
 * | 403 + `demo_blocked`        | modal, form-level      | stays   |
 * | anything else               | modal, form-level      | stays   |
 * | `fetch` threw               | modal, form-level      | stays   |
 *
 * THE PHASE-10 DEFECT, on this mutation. Both failure arms used to set the
 * roster banner and leave `RemoveModal` open — so the message was off-screen
 * while the admin was scrolled (top `-1033` at 390×844), and underneath the
 * `z-[60]` overlay once they scrolled up to it. Two failures compounding, and
 * `toBeVisible()` passed on both.
 */
export function resolveRemoveReport(outcome: RemoveOutcome, locale: Locale): Report {
  const copy = COPY[locale];
  if (outcome.kind === "network") {
    return inModal("form", copy.removeRequestFailed);
  }
  // Unchanged and deliberately so: the row really did go, and the modal that
  // asked for confirmation has nothing left to confirm.
  if (outcome.httpStatus === 200) {
    return silent();
  }
  // The last-admin refusal is a different SCREEN, not a message in this one —
  // `LastAdminModal` carries its own copy. Also unchanged by phase 10.
  if (outcome.httpStatus === 409) {
    return swapToLastAdmin();
  }
  // The demo gate. Checked BEFORE the catch-all below, which would otherwise
  // report "Nie udało się usunąć pracownika. Spróbuj ponownie." — an instruction
  // to retry something that can never succeed. Same surface as every other
  // refused remove (`remove` may not use the banner at all: its modal is open).
  if (outcome.httpStatus === 403 && outcome.code === DEMO_BLOCKED_CODE) {
    return inModal("form", demoBlockedMessage(locale));
  }
  return inModal("form", copy.removeFailed);
}

/**
 * The outcome→surface table for the two ROW actions — a first send or resend of
 * an invitation, and a password-reset mail.
 *
 * | Outcome              | Surface                    | Retry   |
 * | -------------------- | -------------------------- | ------- |
 * | 200                  | banner, success tone       | no      |
 * | 403 + `demo_blocked` | banner, error tone         | no      |
 * | anything else        | banner, error tone         | `Ponów` |
 * | `fetch` threw        | banner, error tone         | `Ponów` |
 *
 * These are the arms with no modal to move a message into, which is why §3 had
 * to make the banner itself reachable rather than relocating them. The surface
 * is unchanged from what shipped; what changed is that it is now pinned
 * (`sticky top-4 z-20`) and dismissible, so it is on screen wherever the row
 * that triggered it was.
 */
export function resolveRowActionReport(action: "invite" | "reset", outcome: RowActionOutcome, locale: Locale): Report {
  const copy = COPY[locale];
  if (outcome.kind === "http" && outcome.httpStatus === 200) {
    return inBanner("success", action === "invite" ? copy.inviteSent : copy.resetSent);
  }
  // The demo gate, on the banner these two actions own — and WITHOUT the `Ponów`
  // the arm below carries, because a retry that is refused by construction is a
  // control that can only fail. Only `reset` can reach this: `[id]/invite.ts` is
  // outside the gate by design, and the integration suite pins that boundary.
  if (outcome.kind === "http" && outcome.httpStatus === 403 && outcome.code === DEMO_BLOCKED_CODE) {
    return inBanner("error", demoBlockedMessage(locale));
  }
  // One generic failure string covers both actions and every failing status.
  // §9.4 records the decision not to split it: neither action has a form to
  // report into, so the specific verb buys nothing the banner can use.
  return inBanner("error", copy.mutationError, true);
}

/**
 * The label on a password-less row's one action — a first send for someone
 * created-but-never-invited, a resend for someone whose invite went missing.
 *
 * `active` is not reachable here (that row shows `Resetuj hasło` instead) but is
 * mapped to the first-send label rather than left to throw: a wrong-but-real
 * label degrades better than a crash or a blank button.
 */
export function inviteActionLabel(status: StaffStatus, locale: Locale): string {
  return status === "invited" ? COPY[locale].resendInvite : COPY[locale].sendInvite;
}

/**
 * The banner for "the account was repaired but its invitation did not go out".
 *
 * It lives here, beside `inviteActionLabel`, because it must NAME that button —
 * and after a repair the target may be in either password-less state, so the two
 * strings have to move together or the copy points at a control that row does not
 * show. That coupling is the whole reason the design first tried to get away with
 * one shared label (design-contract §9.2); carrying two labels is only safe while
 * `staff-report.test.ts` holds the two functions in agreement.
 *
 * Copy is `design-contract.md` §9.2, verbatim. Do not reword here.
 */
export function repairedMailFailedMessage(status: StaffStatus, locale: Locale): string {
  return COPY[locale].repairedMailFailed.replace("{action}", () => inviteActionLabel(status, locale));
}
