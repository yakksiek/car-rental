// core
import { describe, expect, it } from "vitest";

// others
import {
  type AddOutcome,
  PROVISION_FAILURE_CODES,
  type RemoveOutcome,
  type Report,
  type RowActionOutcome,
  type StaffMutation,
  TRIGGERED_FROM,
  allowedTargets,
  inviteActionLabel,
  repairedMailFailedMessage,
  resolveAddReport,
  resolveRemoveReport,
  resolveRowActionReport,
} from "./staff-report";

// Every arm of every roster mutation, as the island sees it, tagged with the
// mutation it belongs to. The sweeps below run the invariants across this one
// list, so an arm added to a resolver without a row here is a gap the reviewer
// can see rather than one the overlay hides.
const EVERY_ARM: { mutation: StaffMutation; name: string; report: Report }[] = [
  // ── add (header-triggered) ────────────────────────────────────────────────
  ...(
    [
      { name: "201 created", outcome: { kind: "ok", activationMail: null, status: "created" } },
      { name: "200 repaired, mail sent", outcome: { kind: "ok", activationMail: "sent", status: "invited" } },
      {
        name: "200 repaired, mail not needed",
        outcome: { kind: "ok", activationMail: "not_needed", status: "active" },
      },
      { name: "200 repaired, mail failed", outcome: { kind: "ok", activationMail: "failed", status: "created" } },
      { name: "409 duplicate", outcome: { kind: "http", httpStatus: 409 } },
      { name: "500 provision_rolled_back", outcome: { kind: "http", httpStatus: 500, code: "provision_rolled_back" } },
      { name: "500 provision_orphaned", outcome: { kind: "http", httpStatus: 500, code: "provision_orphaned" } },
      { name: "500 unhandled (no code)", outcome: { kind: "http", httpStatus: 500, code: null } },
      { name: "403 forbidden", outcome: { kind: "http", httpStatus: 403 } },
      { name: "400 bad body", outcome: { kind: "http", httpStatus: 400 } },
      { name: "fetch threw", outcome: { kind: "network" } },
    ] as { name: string; outcome: AddOutcome }[]
  ).map(({ name, outcome }) => ({ mutation: "add" as const, name: `add: ${name}`, report: resolveAddReport(outcome) })),

  // ── remove (row-triggered) ────────────────────────────────────────────────
  ...(
    [
      { name: "200 removed", outcome: { kind: "http", httpStatus: 200 } },
      { name: "409 last administrator", outcome: { kind: "http", httpStatus: 409 } },
      { name: "403 self / forbidden", outcome: { kind: "http", httpStatus: 403 } },
      { name: "404 not found", outcome: { kind: "http", httpStatus: 404 } },
      { name: "400 confirm mismatch", outcome: { kind: "http", httpStatus: 400 } },
      { name: "500 unhandled", outcome: { kind: "http", httpStatus: 500 } },
      { name: "fetch threw", outcome: { kind: "network" } },
    ] as { name: string; outcome: RemoveOutcome }[]
  ).map(({ name, outcome }) => ({
    mutation: "remove" as const,
    name: `remove: ${name}`,
    report: resolveRemoveReport(outcome),
  })),

  // ── invite / reset (row-triggered) ────────────────────────────────────────
  ...(["invite", "reset"] as const).flatMap((action) =>
    (
      [
        { name: "200 sent", outcome: { kind: "http", httpStatus: 200 } },
        { name: "409 already has a password", outcome: { kind: "http", httpStatus: 409 } },
        { name: "404 not found", outcome: { kind: "http", httpStatus: 404 } },
        { name: "502 send failed", outcome: { kind: "http", httpStatus: 502 } },
        { name: "403 unconfigured", outcome: { kind: "http", httpStatus: 403 } },
        { name: "fetch threw", outcome: { kind: "network" } },
      ] as { name: string; outcome: RowActionOutcome }[]
    ).map(({ name, outcome }) => ({
      mutation: action,
      name: `${action}: ${name}`,
      report: resolveRowActionReport(action, outcome),
    })),
  ),
];

describe("the invariants, swept across every mutation", () => {
  // PHASE 9's RULE, GENERALISED. `addEmployee`'s network arm set a banner and
  // left the modal open, so the message painted BEHIND `ModalShell`'s overlay
  // (`fixed inset-0 z-[60] … backdrop-blur-sm`) and hit-testing its centre
  // returned the overlay. Phase 10 found the identical shape on `removeEmployee`,
  // which is why this now sweeps all four mutations rather than one.
  it("never reports to the banner while a modal stays open", () => {
    for (const { name, report } of EVERY_ARM) {
      expect(report.target === "banner" && report.keepsModalOpen, `${name} reports off-screen`).toBe(false);
    }
  });

  // PHASE 10's RULE. The concrete predicate criterion 10.2 asks for: each arm
  // targets a surface its own mutation is allowed to use. `remove` may not use
  // the banner at all — its modal is open — and that is the clause with teeth,
  // because the banner is exactly where phase 10 found remove's failures.
  //
  // Deliberately NOT phrased as "reachable". Reachability depends on scroll
  // position and on the overlay; a pure function over outcomes can see neither.
  // `e2e/staff-admin.spec.ts` gates that half at 390×844. See the module header.
  it("keeps every arm inside the surfaces its mutation is allowed to use", () => {
    for (const { mutation, name, report } of EVERY_ARM) {
      expect([...allowedTargets(mutation)], `${name} targets ${report.target}`).toContain(report.target);
    }
  });

  it("gives every arm that keeps a modal open a slot to render into", () => {
    for (const { name, report } of EVERY_ARM) {
      if (report.keepsModalOpen) {
        expect(report.slot, `${name} has no slot`).not.toBeNull();
        expect(report.message, `${name} has no message`).toBeTruthy();
      }
    }
  });

  it("carries a message on exactly the arms that report one", () => {
    for (const { name, report } of EVERY_ARM) {
      const silentTarget = report.target === "none" || report.target === "last-admin-modal";
      expect(report.message === null, name).toBe(silentTarget);
    }
  });

  // One failure, one retry control. Every surface that IS the retry — the add
  // modal's submit, the remove modal's `Usuń` — must not also ship a `Ponów`,
  // which is the duplication phase 9 §3 had to resolve.
  it("never offers a second retry beside a surface that already is one", () => {
    for (const { name, report } of EVERY_ARM) {
      if (report.keepsModalOpen) {
        expect(report.offersRetry, `${name} offers a competing retry`).toBe(false);
      }
    }
  });

  // A banner needs a tone to render at all — it picks the glyph, the text colour
  // and the background. Anything else must not claim one.
  it("assigns a tone to exactly the banner arms", () => {
    for (const { name, report } of EVERY_ARM) {
      expect(report.tone !== null, name).toBe(report.target === "banner" || report.target === "modal");
    }
  });

  // The property phase 10 turned on. Recorded as an assertion so that adding a
  // fifth mutation forces a deliberate answer rather than a default.
  it("classifies every mutation by the control that launches it", () => {
    expect(TRIGGERED_FROM).toEqual({ add: "header", remove: "row", invite: "row", reset: "row" });
  });
});

describe("resolveAddReport — the table, arm by arm", () => {
  it("says nothing and closes on a clean create", () => {
    expect(resolveAddReport({ kind: "ok", activationMail: null, status: "created" })).toMatchObject({
      target: "none",
      slot: null,
      keepsModalOpen: false,
      message: null,
    });
  });

  // Out of phase 9's scope and deliberately unmoved: it rides a 200, the row
  // really did land, and its modal really should close. Nothing about it hides
  // behind an overlay — and after phase 10 it is pinned, so it is also not
  // off-screen if the admin scrolled behind the open dialog.
  it("keeps the repaired-but-unsent mail on the banner, with the modal closed", () => {
    const report = resolveAddReport({ kind: "ok", activationMail: "failed", status: "invited" });
    expect(report.target).toBe("banner");
    expect(report.keepsModalOpen).toBe(false);
    expect(report.tone).toBe("error");
    expect(report.offersRetry).toBe(false);
    expect(report.message).toBe(repairedMailFailedMessage("invited"));
  });

  it("attaches a duplicate to the e-mail field, modal open — the shipped idiom, unchanged", () => {
    expect(resolveAddReport({ kind: "http", httpStatus: 409 })).toMatchObject({
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
    expect(rolledBack).toMatchObject({
      target: "modal",
      slot: "form",
      keepsModalOpen: true,
      message: "Nie udało się utworzyć konta. Spróbuj ponownie.",
    });
  });

  // THE DEFECT PHASE 9 CLOSED. A dropped connection is the most common failure
  // and the one case where the typed values are still perfectly good — it must
  // report where the admin is, in the form they would retry in.
  it("reports a thrown fetch in the modal's form slot, not the banner", () => {
    expect(resolveAddReport({ kind: "network" })).toMatchObject({
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

describe("resolveRemoveReport — the table, arm by arm (phase 10)", () => {
  it("says nothing and closes when the row really went", () => {
    expect(resolveRemoveReport({ kind: "http", httpStatus: 200 })).toMatchObject({
      target: "none",
      keepsModalOpen: false,
      message: null,
    });
  });

  // Unchanged by phase 10, and named here so the table is complete: the refusal
  // is a different screen with its own copy, not a message in this one.
  it("swaps to the last-admin refusal on a 409, carrying no message of its own", () => {
    expect(resolveRemoveReport({ kind: "http", httpStatus: 409 })).toMatchObject({
      target: "last-admin-modal",
      keepsModalOpen: false,
      message: null,
    });
  });

  // THE DEFECT PHASE 10 CLOSES, half one. Both of these used to set the roster
  // banner and leave `RemoveModal` open — off-screen while scrolled, and under
  // the `z-[60]` overlay once scrolled up to.
  it("reports a refused remove in the modal's form slot, not the banner", () => {
    for (const status of [400, 403, 404, 500, 502]) {
      expect(resolveRemoveReport({ kind: "http", httpStatus: status })).toMatchObject({
        target: "modal",
        slot: "form",
        keepsModalOpen: true,
        offersRetry: false,
        message: "Nie udało się usunąć pracownika. Spróbuj ponownie.",
      });
    }
  });

  it("reports a thrown fetch in the modal's form slot too", () => {
    expect(resolveRemoveReport({ kind: "network" })).toMatchObject({
      target: "modal",
      slot: "form",
      keepsModalOpen: true,
      message: "Nie udało się usunąć pracownika. Sprawdź połączenie i spróbuj ponownie.",
    });
  });

  it("leads both remove strings with the same state-of-the-world clause", () => {
    // §9.5 mirrors §9.4's construction: identical lead, different remedy.
    for (const outcome of [{ kind: "network" } as const, { kind: "http", httpStatus: 500 } as const]) {
      expect(resolveRemoveReport(outcome).message).toMatch(/^Nie udało się usunąć pracownika\./);
    }
  });

  // The verb is the modal's own. `mutationError` says "zapisać zmiany" because
  // it has to cover invite, reset AND remove from a banner; inside a modal
  // titled `Usunąć tego pracownika?` the specific verb is available and truer.
  it("does not borrow the row actions' generic wording", () => {
    expect(resolveRemoveReport({ kind: "network" }).message).not.toBe(
      "Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj ponownie.",
    );
  });
});

describe("resolveRowActionReport — the table, arm by arm (phase 10)", () => {
  it("names the action that succeeded", () => {
    expect(resolveRowActionReport("invite", { kind: "http", httpStatus: 200 })).toMatchObject({
      target: "banner",
      tone: "success",
      offersRetry: false,
      message: "Wysłano zaproszenie.",
    });
    expect(resolveRowActionReport("reset", { kind: "http", httpStatus: 200 })).toMatchObject({
      target: "banner",
      tone: "success",
      offersRetry: false,
      message: "Wysłano e-mail do resetu hasła.",
    });
  });

  // §9.3 authored `inviteSent` because a RESEND changes nothing on screen — the
  // badge is already ZAPROSZONY. That makes the success arm load-bearing, and a
  // success banner the admin never sees fails that job as completely as a
  // failure banner does. Pinned so it cannot quietly become `silent()`.
  it("never goes silent on success — a resend changes nothing else on screen", () => {
    for (const action of ["invite", "reset"] as const) {
      const report = resolveRowActionReport(action, { kind: "http", httpStatus: 200 });
      expect(report.target).not.toBe("none");
      expect(report.message).toBeTruthy();
    }
  });

  it("gives every failure the generic banner and a retry", () => {
    for (const action of ["invite", "reset"] as const) {
      for (const outcome of [
        { kind: "http", httpStatus: 403 } as const,
        { kind: "http", httpStatus: 404 } as const,
        { kind: "http", httpStatus: 409 } as const,
        { kind: "http", httpStatus: 502 } as const,
        { kind: "network" } as const,
      ]) {
        expect(resolveRowActionReport(action, outcome)).toMatchObject({
          target: "banner",
          tone: "error",
          offersRetry: true,
          message: "Nie udało się zapisać zmiany. Sprawdź połączenie i spróbuj ponownie.",
        });
      }
    }
  });

  // §9.4 recorded the decision not to split this string per action. Kept as an
  // assertion so a future "helpful" split is a deliberate contract edit.
  it("uses one failure string for both actions", () => {
    expect(resolveRowActionReport("invite", { kind: "network" }).message).toBe(
      resolveRowActionReport("reset", { kind: "network" }).message,
    );
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
