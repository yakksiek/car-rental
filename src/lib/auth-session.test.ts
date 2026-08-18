// core
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// others
import { readLinkOrigin, readSessionOrigin } from "./auth-session";

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
