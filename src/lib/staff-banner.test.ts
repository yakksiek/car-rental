// core
import { describe, expect, it } from "vitest";

// others
import { PROVISION_FAILURE_CODES, provisionFailureMessage } from "./staff-banner";

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
