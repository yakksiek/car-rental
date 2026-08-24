// core
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// others
import { POST as resetPasswordPOST } from "../../src/pages/api/auth/reset-password";
import { LINK_ORIGIN_COOKIE } from "../../src/lib/auth-session";
import { anonClient, serviceClient } from "../helpers/clients";
import { buildApiContext } from "../helpers/context";

// Link-type provenance for `/auth/callback` (auth-followups, F3).
//
// WHY THIS FILE EXISTS: the callback stamps a marker cookie whose *value*
// (`invite` / `recovery`) decides which copy the set-password page shows. It
// used to OR in `?flow=invite`, a query parameter nothing validates. Removing
// that clause leaves `type` — trustworthy only if GoTrue resolves the token by
// hash AND type, so a recovery token cannot be re-labelled on its way in.
//
// A type signature and a runtime that accepts the argument prove neither
// (lessons: "A typed, accepted API parameter is not evidence that it is
// enforced" — `current_password` type-checks, is accepted, and is ignored). So
// the property is probed against the real backend, and the probe is COMMITTED
// rather than run from a scratch script: the whole phase rests on this one
// property, and a throwaway proves it today while pinning nothing against a
// future GoTrue version.
//
// If the mismatch case ever turns green-by-acceptance, the premise is gone —
// `type` is then as forgeable as `flow` was, and `callback.ts` must go back to
// treating the marker's value as a hint (the plan's stated fallback).
//
// RETARGETED (invite-journey-fixes): the exchange no longer happens on the
// callback GET, so the second block below drives the same relabelling attack at
// the POST, where `verifyOtp` now lives. The two blocks pin DIFFERENT layers and
// both are needed — `resolve_link_token`'s clause 1 refuses the mismatched
// pairing before GoTrue is ever asked, so the POST-level case would stay green
// even if GoTrue loosened. Only the direct probe can catch that.
//
// `serviceClient()` mints the link exactly as `/api/auth/forgot-password` does;
// every exchange runs on the anon key, as a real recipient's browser would.

const svc = serviceClient();

const EMAIL = "f3-callback-type@fleetrent.test";
const PASSWORD = "Fl33tRent-F3_Probe!";

async function dropUser(email: string): Promise<void> {
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = data.users.find((u) => u.email === email);
  if (existing) {
    await svc.from("profiles").delete().eq("user_id", existing.id);
    await svc.auth.admin.deleteUser(existing.id);
  }
}

/** A fresh recovery token for the disposable user, as an emailed link carries it. */
async function mintRecoveryToken(): Promise<string> {
  const { data, error } = await svc.auth.admin.generateLink({ type: "recovery", email: EMAIL });
  if (error || !data.properties.hashed_token) {
    throw new Error(`Failed to mint a recovery link for ${EMAIL}: ${error?.message ?? "no hashed_token"}`);
  }
  return data.properties.hashed_token;
}

beforeAll(async () => {
  await dropUser(EMAIL);

  const { error } = await svc.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (error) {
    throw new Error(`Failed to create the disposable F3 probe user: ${error.message}`);
  }
});

afterAll(async () => {
  await dropUser(EMAIL);
});

describe("verifyOtp — the link's type is resolved against the token, not taken on trust", () => {
  it("REJECTS a recovery token presented as type=invite", async () => {
    // The attack `?flow` used to make unnecessary: relabel a genuine recovery
    // link so the marker — and the page — read `invite`. Each test mints its own
    // token, so a rejection here is the type mismatch and nothing else.
    const tokenHash = await mintRecoveryToken();

    const { data, error } = await anonClient().auth.verifyOtp({ token_hash: tokenHash, type: "invite" });

    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
    expect(data.user).toBeNull();
  });

  it("REJECTS a recovery token presented as type=signup", async () => {
    // `signup` is the second member of `LINK_TYPES` that `callback.ts` treats as
    // invite-ish, so relabelling a recovery link with it is the same move as the
    // case above with a different string. Pinned separately (impl-review F5):
    // one member passing is no evidence for the other.
    const tokenHash = await mintRecoveryToken();

    const { data, error } = await anonClient().auth.verifyOtp({ token_hash: tokenHash, type: "signup" });

    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
    expect(data.user).toBeNull();
  });

  it("accepts the same token shape when the type matches (control)", async () => {
    // Without this the case above proves nothing — a rejection would read the
    // same if the fixture had never minted a usable token at all.
    const tokenHash = await mintRecoveryToken();

    const { data, error } = await anonClient().auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect(data.user?.email).toBe(EMAIL);
  });
});

describe("the same relabelling attack, at the POST where the exchange now lives", () => {
  it("sets NO password when a recovery token is presented as an invite", async () => {
    const tokenHash = await mintRecoveryToken();

    // The cookie a browser would carry if `/auth/callback` could be talked into
    // stamping the wrong type — or if a user hand-wrote one.
    const context = buildApiContext({
      method: "POST",
      path: "/api/auth/reset-password",
      supabase: anonClient(),
      user: null,
      role: null,
      formBody: { password: "Fl33tRent-Relabel_2026!", confirm: "Fl33tRent-Relabel_2026!" },
      cookies: { [LINK_ORIGIN_COOKIE]: `invite.${tokenHash}` },
    });

    const response = await resetPasswordPOST(context);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/auth/reset-password");

    // The assertion of record: the account is untouched, and the original
    // password still works.
    expect((await anonClient().auth.signInWithPassword({ email: EMAIL, password: PASSWORD })).error).toBeNull();
    expect(
      (await anonClient().auth.signInWithPassword({ email: EMAIL, password: "Fl33tRent-Relabel_2026!" })).error,
    ).not.toBeNull();
  });
});
