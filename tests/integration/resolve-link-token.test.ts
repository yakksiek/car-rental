// core
import { afterAll, describe, expect, it } from "vitest";

// others
import { anonClient, serviceClient } from "../helpers/clients";
import { queryDb } from "../helpers/db";

// `resolve_link_token` — the fail-closed clauses (invite-journey-fixes, phase 4).
//
// WHY THIS FILE EXISTS: `/auth/callback` no longer calls `verifyOtp` on the GET,
// and `verifyOtp` was enforcing FOUR guarantees at once, only one of which was
// written down (lessons.md -> "Moving a call moves only the guarantee you
// named"). Three of them — the hash↔type pairing, the otp expiry window, and
// deactivation-awareness — now live in this RPC, and each one fails OPEN if it
// is dropped. A suite that asserted only the happy path could not tell
// "enforced" from "silently dropped", so every clause below gets its own
// NEGATIVE case, against real GoTrue-minted tokens rather than fixtures.
//
// The last test is the one that pins the whole design: the lookup must be
// repeatable and must leave the token SPENDABLE. That is what makes reopening an
// invite link idempotent, which is Bug 2's fix.

const svc = serviceClient();
const anon = anonClient();
const createdIds: string[] = [];

interface LinkTargetRow {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string | null;
}

function uniqueEmail(tag: string): string {
  return `rlt-${tag}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@fleetrent.test`;
}

/** Call the RPC exactly as `/auth/callback` does — on the anon key, no session. */
async function resolve(tokenHash: string, type: string): Promise<LinkTargetRow[]> {
  const { data, error } = (await anon.rpc("resolve_link_token", {
    p_token_hash: tokenHash,
    p_type: type,
  })) as { data: LinkTargetRow[] | null; error: unknown };
  expect(error).toBeNull();
  return data ?? [];
}

/** An invited hire + the token their invite link carries. No mail is sent. */
async function mintInvite(tag: string, opts: { withProfile?: boolean } = {}) {
  const email = uniqueEmail(tag);
  const generated = await svc.auth.admin.generateLink({ type: "invite", email });
  if (generated.error) throw new Error(`generateLink failed — ${generated.error.message}`);
  const id = generated.data.user.id;
  createdIds.push(id);
  if (opts.withProfile !== false) {
    await svc.from("profiles").insert({ user_id: id, role: "employee", full_name: "Łukasz Piątek" });
  }
  return { id, email, tokenHash: generated.data.properties.hashed_token };
}

afterAll(async () => {
  for (const id of createdIds) {
    await svc.from("profiles").delete().eq("user_id", id);
    await svc.auth.admin.deleteUser(id).catch(() => undefined);
  }
});

describe("resolve_link_token — identity (clause a)", () => {
  it("resolves an invite link's target: id, email, name and app role", async () => {
    const { id, email, tokenHash } = await mintInvite("happy");
    const rows = await resolve(tokenHash, "invite");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.user_id).toBe(id);
    expect(rows[0]?.email).toBe(email);
    expect(rows[0]?.full_name).toBe("Łukasz Piątek");
    expect(rows[0]?.role).toBe("employee");
  });

  it("returns nothing for a hash nobody holds", async () => {
    expect(await resolve("no-such-token-hash", "invite")).toEqual([]);
    expect(await resolve("", "recovery")).toEqual([]);
  });
});

describe("resolve_link_token — hash AND type must both match (clause 1)", () => {
  it("refuses a genuine INVITE token presented as a recovery link", async () => {
    const { tokenHash } = await mintInvite("type-inv");
    expect(await resolve(tokenHash, "invite")).toHaveLength(1);
    expect(await resolve(tokenHash, "recovery")).toEqual([]);
  });

  // The auth-followups F3 regression, restated for the new lookup: appending
  // `&type=invite` to a real recovery link must NOT greet a password reset with
  // "Witaj we Flocie". Matching on hash alone would do exactly that.
  it("refuses a genuine RECOVERY token presented as an invite link", async () => {
    const email = uniqueEmail("type-rec");
    const created = await svc.auth.admin.createUser({
      email,
      password: "Fl33tRent-Rlt_2026!",
      email_confirm: true,
    });
    const id = created.data.user?.id;
    if (!id) throw new Error("createUser failed");
    createdIds.push(id);
    await svc.from("profiles").insert({ user_id: id, role: "employee", full_name: "Zofia Wróbel" });

    const generated = await svc.auth.admin.generateLink({ type: "recovery", email });
    if (generated.error) throw new Error(generated.error.message);
    const tokenHash = generated.data.properties.hashed_token;

    expect(await resolve(tokenHash, "recovery")).toHaveLength(1);
    expect(await resolve(tokenHash, "invite")).toEqual([]);
    expect(await resolve(tokenHash, "signup")).toEqual([]);
  });

  it("returns nothing for a type outside the closed set", async () => {
    const { tokenHash } = await mintInvite("type-unknown");
    for (const type of ["magiclink", "email_change", "", "admin", "confirmation_token"]) {
      expect(await resolve(tokenHash, type)).toEqual([]);
    }
  });
});

describe("resolve_link_token — expiry (clause 2)", () => {
  // auth.one_time_tokens has NO expiry column and GoTrue deletes a token on USE,
  // not on expiry — so without this clause a dead link resolves, renders the
  // form, and is only refused at the POST, after the hire has chosen a password.
  it("returns nothing once the token is past the otp window", async () => {
    const { id, tokenHash } = await mintInvite("expiry");
    expect(await resolve(tokenHash, "invite")).toHaveLength(1);

    // The only route to this state: PostgREST does not expose `auth`, and no
    // admin API sets confirmation_sent_at. See tests/helpers/db.ts's named exception.
    await queryDb`update auth.users set confirmation_sent_at = now() - interval '2 hours' where id = ${id}`;
    expect(await resolve(tokenHash, "invite")).toEqual([]);

    // Just inside the window still resolves — the clause is a window, not a kill switch.
    await queryDb`update auth.users set confirmation_sent_at = now() - interval '59 minutes' where id = ${id}`;
    expect(await resolve(tokenHash, "invite")).toHaveLength(1);
  });

  it("returns nothing when the sent_at timestamp is absent entirely", async () => {
    const { id, tokenHash } = await mintInvite("expiry-null");
    await queryDb`update auth.users set confirmation_sent_at = null where id = ${id}`;
    expect(await resolve(tokenHash, "invite")).toEqual([]);
  });
});

describe("resolve_link_token — deactivation-aware role (clause 3)", () => {
  // profiles.role stays 'employee' after deactivate_staff runs, and
  // current_app_role() has no deactivation check — the null-ing lives ONLY in
  // middleware.ts:36, which never runs for a session-less path. Returning
  // p.role verbatim would show a deactivated staffer the set-password form.
  it("returns a NULL role for a deactivated target (the row survives so R14 can name them)", async () => {
    const { id, email, tokenHash } = await mintInvite("deactivated");
    expect((await resolve(tokenHash, "invite"))[0]?.role).toBe("employee");

    await svc.from("profiles").update({ deactivated_at: new Date().toISOString() }).eq("user_id", id);

    const rows = await resolve(tokenHash, "invite");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBeNull();
    // The card still needs the address to render, so the row must not vanish.
    expect(rows[0]?.email).toBe(email);
  });

  it("returns a NULL role for a profile-less orphan", async () => {
    const { tokenHash } = await mintInvite("orphan", { withProfile: false });
    const rows = await resolve(tokenHash, "invite");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBeNull();
    expect(rows[0]?.full_name).toBeNull();
  });
});

describe("resolve_link_token — lookup only", () => {
  it("never spends the token: repeated lookups leave it exchangeable", async () => {
    const { tokenHash } = await mintInvite("idempotent");

    for (let i = 0; i < 5; i++) {
      expect(await resolve(tokenHash, "invite")).toHaveLength(1);
    }

    // Still spendable afterwards — this is what makes reopening a link render
    // the form again instead of "Link wygasł" (Bug 2's fix).
    const exchange = await anonClient().auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    expect(exchange.error).toBeNull();

    // And once genuinely spent, GoTrue drops the row, so the lookup goes quiet.
    expect(await resolve(tokenHash, "invite")).toEqual([]);
  });
});
