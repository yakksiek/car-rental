// core
import { describe, expect, it } from "vitest";

// others
import {
  type AddOutcome,
  PROVISION_FAILURE_CODES,
  inviteActionLabel,
  repairedMailFailedMessage,
  resolveAddReport,
} from "./staff-banner";

// Every arm of `POST /api/staff`, as the island sees it. The sweep below runs
// the invariants across this list, so an arm added to the resolver without a
// row here is a gap the reviewer can see rather than one the overlay hides.
const EVERY_ARM: { name: string; outcome: AddOutcome }[] = [
  { name: "201 created", outcome: { kind: "ok", activationMail: null, status: "created" } },
  { name: "200 repaired, mail sent", outcome: { kind: "ok", activationMail: "sent", status: "invited" } },
  { name: "200 repaired, mail not needed", outcome: { kind: "ok", activationMail: "not_needed", status: "active" } },
  { name: "200 repaired, mail failed", outcome: { kind: "ok", activationMail: "failed", status: "created" } },
  { name: "409 duplicate", outcome: { kind: "http", httpStatus: 409 } },
  { name: "500 provision_rolled_back", outcome: { kind: "http", httpStatus: 500, code: "provision_rolled_back" } },
  { name: "500 provision_orphaned", outcome: { kind: "http", httpStatus: 500, code: "provision_orphaned" } },
  { name: "500 unhandled (no code)", outcome: { kind: "http", httpStatus: 500, code: null } },
  { name: "403 forbidden", outcome: { kind: "http", httpStatus: 403 } },
  { name: "400 bad body", outcome: { kind: "http", httpStatus: 400 } },
  { name: "fetch threw", outcome: { kind: "network" } },
];

describe("resolveAddReport — the invariants", () => {
  // THE POINT OF PHASE 9. `addEmployee`'s network arm set a banner and left the
  // modal open, so the message painted BEHIND `ModalShell`'s overlay
  // (`fixed inset-0 z-[60] … backdrop-blur-sm`) and hit-testing its centre
  // returned the overlay. The admin submitted, the button returned to idle, and
  // their only feedback was a blurred smear behind a dimmed backdrop.
  //
  // This is the assertion that stops it coming back. If a future edit routes any
  // arm to the banner while leaving the modal open, this goes red.
  it("never reports to the banner while the modal stays open", () => {
    for (const { name, outcome } of EVERY_ARM) {
      const report = resolveAddReport(outcome);
      expect(report.target === "banner" && report.keepsModalOpen, `${name} reports off-screen`).toBe(false);
    }
  });

  it("gives every arm that keeps the modal open a slot to render into", () => {
    for (const { name, outcome } of EVERY_ARM) {
      const report = resolveAddReport(outcome);
      if (report.keepsModalOpen) {
        expect(report.slot, `${name} has no slot`).not.toBeNull();
        expect(report.message, `${name} has no message`).toBeTruthy();
      }
    }
  });

  it("carries a message on exactly the arms that report one", () => {
    for (const { name, outcome } of EVERY_ARM) {
      const report = resolveAddReport(outcome);
      expect(report.message === null, name).toBe(report.target === "none");
    }
  });
});

describe("resolveAddReport — the table, arm by arm", () => {
  it("says nothing and closes on a clean create", () => {
    expect(resolveAddReport({ kind: "ok", activationMail: null, status: "created" })).toEqual({
      target: "none",
      slot: null,
      keepsModalOpen: false,
      message: null,
    });
  });

  // Out of phase 9's scope and deliberately unmoved: it rides a 200, the row
  // really did land, and its modal really should close. Nothing about it hides
  // behind an overlay.
  it("keeps the repaired-but-unsent mail on the banner, with the modal closed", () => {
    const report = resolveAddReport({ kind: "ok", activationMail: "failed", status: "invited" });
    expect(report.target).toBe("banner");
    expect(report.keepsModalOpen).toBe(false);
    expect(report.message).toBe(repairedMailFailedMessage("invited"));
  });

  it("attaches a duplicate to the e-mail field, modal open — the shipped idiom, unchanged", () => {
    expect(resolveAddReport({ kind: "http", httpStatus: 409 })).toEqual({
      target: "modal",
      slot: "email",
      keepsModalOpen: true,
      message: "Ten adres e-mail jest już w zespole.",
    });
  });

  // Inherited from phase 7. The API keeps the two codes apart for logs and
  // monitoring (`api/staff.ts` says why); the admin's situation and remedy are
  // identical in both, so this pins them to one byte-identical sentence.
  it("renders one byte-identical form-level sentence for both provisioning codes", () => {
    const [rolledBack, orphaned] = PROVISION_FAILURE_CODES.map((code) =>
      resolveAddReport({ kind: "http", httpStatus: 500, code }),
    );
    expect(rolledBack).toEqual(orphaned);
    expect(rolledBack).toEqual({
      target: "modal",
      slot: "form",
      keepsModalOpen: true,
      message: "Nie udało się utworzyć konta. Spróbuj ponownie.",
    });
  });

  // THE DEFECT PHASE 9 CLOSES. A dropped connection is the most common failure
  // and the one case where the typed values are still perfectly good — it must
  // report where the admin is, in the form they would retry in.
  it("reports a thrown fetch in the modal's form slot, not the banner", () => {
    expect(resolveAddReport({ kind: "network" })).toEqual({
      target: "modal",
      slot: "form",
      keepsModalOpen: true,
      message: "Nie udało się utworzyć konta. Sprawdź połączenie i spróbuj ponownie.",
    });
  });

  it("matches design-contract §9.4 verbatim", () => {
    expect(resolveAddReport({ kind: "http", httpStatus: 500, code: "provision_rolled_back" }).message).toBe(
      "Nie udało się utworzyć konta. Spróbuj ponownie.",
    );
    expect(resolveAddReport({ kind: "network" }).message).toBe(
      "Nie udało się utworzyć konta. Sprawdź połączenie i spróbuj ponownie.",
    );
  });

  it("leads both form-level strings with the same state-of-the-world clause", () => {
    // §9.4's justification: the arms differ only in the remedy. If an edit
    // rewrites one lead without the other, the copy stops reading as one family.
    for (const outcome of [
      { kind: "network" } as const,
      ...PROVISION_FAILURE_CODES.map((code) => ({ kind: "http", httpStatus: 500, code }) as const),
    ]) {
      expect(resolveAddReport(outcome).message).toMatch(/^Nie udało się utworzyć konta\./);
    }
  });

  // An unhandled 500 carries Astro's HTML body and therefore no `code`, so it
  // must not borrow the provisioning sentence — nothing was provisioned.
  it("falls through to the connection wording for an unknown or missing code", () => {
    const connectionCopy = "Nie udało się utworzyć konta. Sprawdź połączenie i spróbuj ponownie.";
    expect(resolveAddReport({ kind: "http", httpStatus: 500, code: null }).message).toBe(connectionCopy);
    expect(resolveAddReport({ kind: "http", httpStatus: 500, code: "something_else" }).message).toBe(connectionCopy);
    expect(resolveAddReport({ kind: "http", httpStatus: 500 }).message).toBe(connectionCopy);
    expect(resolveAddReport({ kind: "http", httpStatus: 502 }).message).toBe(connectionCopy);
  });

  // A `code` is attacker-influenced only via a compromised API, but the guard is
  // free and the failure mode is loud: indexing an object literal with
  // `__proto__` yields a truthy non-string that renders as "[object Object]".
  it("treats prototype keys as unknown codes rather than truthy non-strings", () => {
    for (const code of ["__proto__", "constructor", "toString"]) {
      const report = resolveAddReport({ kind: "http", httpStatus: 500, code });
      expect(report.slot).toBe("form");
      expect(report.message).toBe("Nie udało się utworzyć konta. Sprawdź połączenie i spróbuj ponownie.");
    }
  });
});

describe("inviteActionLabel / repairedMailFailedMessage (phase 8)", () => {
  it("names a first send on a created row and a resend on an invited one", () => {
    expect(inviteActionLabel("created")).toBe("Wyślij zaproszenie");
    expect(inviteActionLabel("invited")).toBe("Wyślij ponownie zaproszenie");
  });

  it("degrades an unreachable `active` to the first-send label rather than blank", () => {
    // An active row shows `Resetuj hasło`, so this never renders — but a wrong
    // yet real label beats a crash or an empty button if a future branch slips.
    expect(inviteActionLabel("active")).toBe("Wyślij zaproszenie");
  });

  // THE COUPLING. `repairedMailFailedMessage` fires after a repair whose invite
  // failed, and the target can be in EITHER password-less state — so the banner
  // has to name whichever button that row will actually show. Two labels are only
  // safe while these two functions agree; this is what makes editing one without
  // the other go red instead of shipping copy that points at a missing control.
  it("always names the very button that row renders", () => {
    for (const status of ["created", "invited", "active"] as const) {
      expect(repairedMailFailedMessage(status)).toContain(`„${inviteActionLabel(status)}”`);
    }
  });

  it("keeps the approved sentence around the interpolated label", () => {
    expect(repairedMailFailedMessage("created")).toBe(
      "Konto zostało odnowione, ale zaproszenie nie zostało wysłane. Użyj „Wyślij zaproszenie” przy tej osobie.",
    );
    expect(repairedMailFailedMessage("invited")).toBe(
      "Konto zostało odnowione, ale zaproszenie nie zostało wysłane. Użyj „Wyślij ponownie zaproszenie” przy tej osobie.",
    );
  });
});
