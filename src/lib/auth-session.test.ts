// core
import { describe, expect, it } from "vitest";

// others
import {
  linkOriginOf,
  readPendingToken,
  selectResetPasswordBranch,
  serializePendingToken,
  type PendingLinkToken,
  type ResolvedLinkTarget,
} from "./auth-session";

// The link-token session layer's pure decisions.
//
// S-14's cases here covered the app's only JWT-claim read (`amr` → "how was this
// session minted?") and the marker cookie's one-word value. invite-journey-fixes
// deleted both: the exchange moved to the set-password POST, so provenance is
// "holds an unspent token" and there is no session to classify. The cases below
// replace them subject-for-subject — the cookie's parse and the page's branch —
// and keep the same priority: the FAIL-CLOSED default is what is being pinned.
// A parser that guessed on a malformed value would hand back exactly the
// credential the gate exists to withhold.

// ---------------------------------------------------------------------------
// Pending link token + page branch selection (invite-journey-fixes).
//
// The cookie now carries a CREDENTIAL rather than a marker, so its parser is a
// security boundary: it must fail closed on every malformed shape. And the page's
// branch choice is `.astro` frontmatter, which no gate runs (research §4) — so
// the decision lives here, where these cases hold it.
// ---------------------------------------------------------------------------

const HASH = "705cbf70cc4fd9fb029e4fc207abbfc94dd783d44ed6c95b7ed95609"; // real GoTrue shape

describe("pending-token cookie payload", () => {
  it("round-trips each link type", () => {
    for (const type of ["recovery", "invite", "signup"] as const) {
      const token: PendingLinkToken = { type, tokenHash: HASH };
      expect(readPendingToken(serializePendingToken(token))).toEqual(token);
    }
  });

  it("rejects a bare marker value left over from before the redesign", () => {
    // The cookie NAME is unchanged, so a browser can still hold the old payload.
    expect(readPendingToken("invite")).toBeNull();
    expect(readPendingToken("recovery")).toBeNull();
  });

  it("fails closed on every malformed shape", () => {
    expect(readPendingToken(undefined)).toBeNull();
    expect(readPendingToken("")).toBeNull();
    expect(readPendingToken(".")).toBeNull();
    expect(readPendingToken(`.${HASH}`)).toBeNull(); // no type
    expect(readPendingToken("invite.")).toBeNull(); // no hash
    expect(readPendingToken(`magiclink.${HASH}`)).toBeNull(); // type outside the closed set
    expect(readPendingToken(`admin.${HASH}`)).toBeNull();
    expect(readPendingToken("invite.short")).toBeNull(); // below the length floor
    expect(readPendingToken(`invite.${"a".repeat(256)}`)).toBeNull(); // above the ceiling
    expect(readPendingToken(`invite.${HASH};path=/`)).toBeNull(); // cookie-separator smuggling
    expect(readPendingToken(`invite.${HASH} `)).toBeNull();
  });

  it("keeps the type attached to its own hash — the first dot is the separator", () => {
    // A hash can never contain a dot (URL-safe charset), so a second dot means a
    // malformed value, not a second field to be lenient about.
    expect(readPendingToken(`invite.${HASH}.recovery`)).toBeNull();
  });
});

describe("linkOriginOf", () => {
  it("maps GoTrue's shared confirmation type onto the invite copy", () => {
    expect(linkOriginOf("invite")).toBe("invite");
    expect(linkOriginOf("signup")).toBe("invite");
  });

  it("keeps recovery on the recovery copy", () => {
    expect(linkOriginOf("recovery")).toBe("recovery");
  });
});

describe("selectResetPasswordBranch", () => {
  const token: PendingLinkToken = { type: "invite", tokenHash: HASH };
  const employee: ResolvedLinkTarget = {
    userId: "e0000000-0000-0000-0000-0000000000e0",
    email: "hire@fleetrent.test",
    fullName: "Łukasz Piątek",
    role: "employee",
  };
  const deactivated: ResolvedLinkTarget = { ...employee, role: null };

  const branch = (over: Partial<Parameters<typeof selectResetPasswordBranch>[0]>) =>
    selectResetPasswordBranch({ done: false, hasSession: false, pendingToken: null, target: null, ...over });

  it("shows R4 for the one-shot done marker, ahead of everything else", () => {
    expect(branch({ done: true })).toBe("done");
    expect(branch({ done: true, hasSession: true, pendingToken: token, target: employee })).toBe("done");
  });

  it("shows R13 to a cold visitor with no link", () => {
    expect(branch({})).toBe("nothing-to-set");
  });

  // THE PARTITION. "No pending token" is NOT a drop-in for "no session":
  // collapsing these two would swallow R12's whole population and take its
  // AccountBox dead with it, which design-contract §8.2 asserts parity on.
  it("shows R12 — not R13 — to a signed-in staffer who typed the URL", () => {
    expect(branch({ hasSession: true })).toBe("in-app");
  });

  it("shows R14 when the link's target has no usable role", () => {
    expect(branch({ pendingToken: token, target: deactivated })).toBe("inactive-account");
  });

  it("shows R5 when the token cookie no longer resolves", () => {
    expect(branch({ pendingToken: token, target: null })).toBe("expired");
    expect(branch({ pendingToken: token, target: null, hasSession: true })).toBe("expired");
  });

  it("shows the form for a live link whose target is staff", () => {
    expect(branch({ pendingToken: token, target: employee })).toBe("form");
  });
});
