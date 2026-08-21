// core
import { describe, expect, it } from "vitest";

// others
import {
  PROVISION_FAILURE_CODES,
  inviteActionLabel,
  provisionFailureMessage,
  repairedMailFailedMessage,
} from "./staff-banner";

describe("provisionFailureMessage", () => {
  // THE POINT OF THE MODULE. Phases 1 and 3 shipped two different sentences for
  // these two codes, decomposing the failure the way the TRANSACTION experienced
  // it rather than the way the admin did. The admin's situation and remedy are
  // identical in both, so the strings must be byte-identical — and this is the
  // assertion that stops a future edit from re-splitting them.
  it("renders one byte-identical sentence for both provisioning codes", () => {
    const rolledBack = provisionFailureMessage("provision_rolled_back", "nowa@fleetrent.test");
    const orphaned = provisionFailureMessage("provision_orphaned", "nowa@fleetrent.test");
    expect(rolledBack).not.toBeNull();
    expect(rolledBack).toBe(orphaned);
  });

  it("matches design-contract §9.2 verbatim", () => {
    expect(provisionFailureMessage("provision_rolled_back", "nowa@fleetrent.test")).toBe(
      "Nie udało się utworzyć konta dla nowa@fleetrent.test. Spróbuj ponownie.",
    );
  });

  it("interpolates the submitted address — the banner is the only place it exists", () => {
    for (const code of PROVISION_FAILURE_CODES) {
      expect(provisionFailureMessage(code, "łukasz.wąsik@fleetrent.test")).toContain("łukasz.wąsik@fleetrent.test");
    }
  });

  // Anything without one of our codes must fall through to `COPY.mutationError`,
  // which is what an unhandled 500 (Astro's HTML body, no `code`) still is.
  it("returns null for an unknown code, so the caller keeps the network banner", () => {
    expect(provisionFailureMessage("something_else", "nowa@fleetrent.test")).toBeNull();
  });

  it("returns null for a missing code", () => {
    expect(provisionFailureMessage(null, "nowa@fleetrent.test")).toBeNull();
    expect(provisionFailureMessage(undefined, "nowa@fleetrent.test")).toBeNull();
    expect(provisionFailureMessage("", "nowa@fleetrent.test")).toBeNull();
  });

  // A `code` is attacker-influenced only via a compromised API, but the guard is
  // free and the failure mode is loud: indexing an object literal with
  // `__proto__` yields a truthy non-string that renders as "[object Object]".
  it("returns null for prototype keys rather than a truthy non-string", () => {
    expect(provisionFailureMessage("__proto__", "nowa@fleetrent.test")).toBeNull();
    expect(provisionFailureMessage("constructor", "nowa@fleetrent.test")).toBeNull();
    expect(provisionFailureMessage("toString", "nowa@fleetrent.test")).toBeNull();
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
