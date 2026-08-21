// core
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import {
  linkOriginOf,
  readLinkOrigin,
  readPendingToken,
  readSessionOrigin,
  selectResetPasswordBranch,
  serializePendingToken,
  type PendingLinkToken,
  type ResolvedLinkTarget,
} from "./auth-session";

// The app's first JWT-claim read (S-14). These cases pin the classification and,
// more importantly, the FAIL-CLOSED default: anything the helper cannot read
// with confidence must come back `"unknown"`, which no gate accepts. A helper
// that guessed `"link"` on a malformed token would hand back exactly the
// privilege the gate exists to withhold.
//
// Fixture tokens are hand-built rather than minted by GoTrue: the helper reads
// the payload only (the signature is checked by the paired `getUser()`), so a
// real token would test nothing extra here — the integration suite covers the
// real GoTrue shape end to end.

/** `header.payload.signature` with a base64url payload — no signing needed. */
function tokenWith(payload: unknown): string {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json, "utf8").toString("base64url");
  return `header.${base64}.signature`;
}

/** A client whose `getSession()` answers with this access token (or no session). */
function clientWith(accessToken: string | null): SupabaseClient {
  return {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: accessToken === null ? null : { access_token: accessToken } },
          error: null,
        }),
    },
  } as unknown as SupabaseClient;
}

/** A client whose `getSession()` rejects, e.g. an unreachable auth server. */
function throwingClient(): SupabaseClient {
  return {
    auth: {
      getSession: () => Promise.reject(new Error("network")),
    },
  } as unknown as SupabaseClient;
}

describe("readSessionOrigin", () => {
  it("classifies a link exchange (amr otp) as `link`", async () => {
    const client = clientWith(tokenWith({ amr: [{ method: "otp", timestamp: 1_754_000_000 }] }));

    await expect(readSessionOrigin(client)).resolves.toBe("link");
  });

  it("classifies an ordinary password sign-in as `password`", async () => {
    const client = clientWith(tokenWith({ amr: [{ method: "password", timestamp: 1_754_000_000 }] }));

    await expect(readSessionOrigin(client)).resolves.toBe("password");
  });

  it("finds `otp` anywhere in the array, not just first", async () => {
    // A refresh appends rather than replaces, so the link entry can be preceded
    // by others — the gate must still see the provenance.
    const client = clientWith(tokenWith({ amr: [{ method: "token_refresh" }, { method: "otp" }] }));

    await expect(readSessionOrigin(client)).resolves.toBe("link");
  });

  it("returns `unknown` when the token carries no amr claim", async () => {
    const client = clientWith(tokenWith({ sub: "abc", role: "authenticated" }));

    await expect(readSessionOrigin(client)).resolves.toBe("unknown");
  });

  it("returns `unknown` for an unrecognised amr method", async () => {
    const client = clientWith(tokenWith({ amr: [{ method: "webauthn" }] }));

    await expect(readSessionOrigin(client)).resolves.toBe("unknown");
  });

  it("returns `unknown` when amr is not an array", async () => {
    const client = clientWith(tokenWith({ amr: "otp" }));

    await expect(readSessionOrigin(client)).resolves.toBe("unknown");
  });

  it("returns `unknown` for a payload that is not JSON", async () => {
    const client = clientWith(`header.${Buffer.from("not json at all", "utf8").toString("base64url")}.signature`);

    await expect(readSessionOrigin(client)).resolves.toBe("unknown");
  });

  it("returns `unknown` for a token with no payload segment", async () => {
    const client = clientWith("not-a-jwt");

    await expect(readSessionOrigin(client)).resolves.toBe("unknown");
  });

  it("returns `unknown` when there is no session at all", async () => {
    await expect(readSessionOrigin(clientWith(null))).resolves.toBe("unknown");
  });

  it("returns `unknown` rather than throwing when getSession rejects", async () => {
    await expect(readSessionOrigin(throwingClient())).resolves.toBe("unknown");
  });

  it("decodes a payload carrying Polish diacritics", async () => {
    // The payload is UTF-8 and real tokens carry the user's email/name, so the
    // decode must not be byte-naive — `atob` alone would mangle it.
    const client = clientWith(
      tokenWith({ amr: [{ method: "otp" }], user_metadata: { full_name: "Zofia Wąsik-Łęcka" } }),
    );

    await expect(readSessionOrigin(client)).resolves.toBe("link");
  });
});

describe("readLinkOrigin", () => {
  it("accepts the two values the callback stamps", () => {
    expect(readLinkOrigin("recovery")).toBe("recovery");
    expect(readLinkOrigin("invite")).toBe("invite");
  });

  it("rejects anything else, including an absent cookie", () => {
    expect(readLinkOrigin(undefined)).toBeNull();
    expect(readLinkOrigin("")).toBeNull();
    expect(readLinkOrigin("1")).toBeNull();
    expect(readLinkOrigin("admin")).toBeNull();
  });
});

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
