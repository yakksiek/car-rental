// core
import type { APIContext } from "astro";

// others
import { LINK_ORIGIN_COOKIE, serializePendingToken, type LinkType } from "../../src/lib/auth-session";
import { anonClient, serviceClient } from "./clients";
import { buildApiContext, type AppLocalsRole, type BuildApiContextOptions } from "./context";

// Pending-link-token contexts for the integration harness
// (S-14, rebuilt by invite-journey-fixes).
//
// WHAT CHANGED: this helper used to mint a link-EXCHANGED SESSION — generateLink
// → verifyOtp → an `APIContext` carrying a JWT whose `amr` recorded `otp`. That
// shape is one the new design never produces: `/auth/callback` no longer
// exchanges anything, so a browser arrives at the set-password POST with NO
// session and an unspent token in a cookie. Minting a session here would test a
// state the app cannot reach.
//
// It now replicates exactly what a real recipient's browser carries, minus the
// email hop:
//   admin.generateLink({ type })  →  properties.hashed_token   (no mail, no exchange)
//   cookie `<type>.<hashed_token>`, which /auth/callback stamps after resolving it
//
// `generateLink` is service-role (setup only, per the isolation invariant in
// clients.ts); the POST under test then spends the token on the anon key exactly
// as a browser's would, so the exchange is subject to the same rules.

export interface PendingTokenOptions extends Omit<BuildApiContextOptions, "supabase" | "user" | "role"> {
  /** `recovery` for a reset link, `invite` for a new hire's first password. */
  type: Exclude<LinkType, "signup">;
  /** Recipient. For `invite` the user must NOT exist yet — GoTrue creates it. */
  email: string;
  /**
   * Stamp the token cookie `/auth/callback` writes on a real navigation.
   * Defaults to true; pass false to drive the "no pending token" case.
   */
  token?: boolean;
  /** `locals.user` / `locals.role`, for the conflict case. Defaults to signed out. */
  session?: {
    user: BuildApiContextOptions["user"];
    role?: AppLocalsRole;
    supabase?: BuildApiContextOptions["supabase"];
  };
}

/** The user id GoTrue resolved (or created) for the link, its token, and a context. */
export interface PendingTokenFixture {
  context: APIContext;
  userId: string;
  tokenHash: string;
}

/**
 * Mint a genuine GoTrue link and wrap its UNSPENT token in an `APIContext`.
 * Throws with an actionable message if the link cannot be minted.
 */
export async function pendingTokenContext(opts: PendingTokenOptions): Promise<PendingTokenFixture> {
  const { type, email, token = true, session, cookies, ...rest } = opts;

  // Branched rather than `{ type, email }` because `GenerateLinkParams` is a
  // discriminated union — a widened `type` doesn't narrow to either member.
  const admin = serviceClient();
  const { data: link, error: linkError } =
    type === "invite"
      ? await admin.auth.admin.generateLink({ type: "invite", email })
      : await admin.auth.admin.generateLink({ type: "recovery", email });
  if (linkError || !link.properties.hashed_token) {
    throw new Error(`Failed to generate a ${type} link for ${email}: ${linkError?.message ?? "no hashed_token"}`);
  }
  const tokenHash = link.properties.hashed_token;

  return {
    userId: link.user.id,
    tokenHash,
    context: buildApiContext({
      ...rest,
      supabase: session?.supabase ?? anonClient(),
      user: session?.user ?? null,
      role: session?.role ?? null,
      cookies: {
        ...(token ? { [LINK_ORIGIN_COOKIE]: serializePendingToken({ type, tokenHash }) } : {}),
        ...cookies,
      },
    }),
  };
}
