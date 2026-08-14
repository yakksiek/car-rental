// core
import type { APIContext } from "astro";

// others
import { LINK_ORIGIN_COOKIE } from "../../src/lib/auth-session";
import { anonClient, serviceClient } from "./clients";
import { buildApiContext, type AppLocalsRole, type BuildApiContextOptions } from "./context";

// Link-minted session contexts for the integration harness (S-14).
//
// WHY THIS EXISTS: every other authenticated context in the suite is minted by
// `signInWithPassword` (`clients.ts:47`) — which is, by construction, exactly the
// session type the set-password gate must REJECT. Nothing in `tests/helpers/**`
// could produce the session it must ACCEPT, so neither side of the property was
// assertable before this helper.
//
// It replicates what a real recipient's browser does, minus the email hop:
//   admin.generateLink({ type })  →  properties.hashed_token
//   anonClient().verifyOtp({ token_hash, type })  →  a session whose JWT records
//   `amr: [{ method: "otp" }]`, which is what `readSessionOrigin` reads.
//
// `generateLink` is service-role (setup only, per the isolation invariant in
// clients.ts); the exchange itself runs on the anon key exactly as a browser's
// would, so the resulting session is subject to the same RLS and gates.

export type LinkType = "recovery" | "invite";

export interface LinkSessionOptions extends Omit<BuildApiContextOptions, "supabase" | "user" | "role"> {
  /** `recovery` for a reset link, `invite` for a new hire's first password. */
  type: LinkType;
  /** Recipient. For `invite` the user must NOT exist yet — GoTrue creates it. */
  email: string;
  /** `locals.role`, as middleware would derive it. Defaults to `employee`. */
  role?: AppLocalsRole;
  /**
   * Pre-set the marker cookie `/auth/callback` stamps on a real navigation.
   * Defaults to true; pass false to drive the "link session, spent marker" case.
   */
  marker?: boolean;
}

/** The user id GoTrue resolved (or created) for the link, plus its context. */
export interface LinkSession {
  context: APIContext;
  userId: string;
}

/**
 * Mint a genuine link-exchanged session and wrap it in an `APIContext`.
 * Throws with an actionable message on either GoTrue hop.
 */
export async function linkSessionContext(opts: LinkSessionOptions): Promise<LinkSession> {
  const { type, email, role = "employee", marker = true, cookies, ...rest } = opts;

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

  const client = anonClient();
  const { data, error } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type });
  if (error || !data.user) {
    throw new Error(`Failed to exchange the ${type} link for ${email}: ${error?.message ?? "no user"}`);
  }

  return {
    userId: data.user.id,
    context: buildApiContext({
      ...rest,
      supabase: client,
      user: data.user,
      role,
      cookies: { ...(marker ? { [LINK_ORIGIN_COOKIE]: type } : {}), ...cookies },
    }),
  };
}
