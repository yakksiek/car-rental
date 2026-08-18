import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY } from "astro:env/server";

import type { Database } from "../db/database.types";

// (S-14) `secure` has to be handed in per request, because `@supabase/ssr`'s
// `DEFAULT_COOKIE_OPTIONS` contains no `secure` key at all — so with no
// `cookieOptions` the attribute is simply never emitted on the auth cookies, and
// OWASP marks it mandatory. Callers pass `shouldSecureCookies(context.url)`, the
// one shared rule (`src/lib/secure-cookies.ts`), which is where the reasoning
// for its two signals lives. Omitting the argument keeps the pre-S-14 behaviour,
// which is what an unconfigured or test path wants.
export function createClient(requestHeaders: Headers, cookies: AstroCookies, options?: { secure?: boolean }) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    // Merged over `DEFAULT_COOKIE_OPTIONS` by the library, so `path`, `sameSite`
    // and `maxAge` keep their defaults; `httpOnly: false` also stays — it is a
    // knowing trade (`src/components/protocol/storage.ts:15-19` needs the browser
    // client to read the JWT for Storage uploads), recorded in `known-issues.md`.
    cookieOptions: { secure: options?.secure ?? false },
    cookies: {
      getAll() {
        return parseCookieHeader(requestHeaders.get("Cookie") ?? "").map(({ name, value }) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}

// Service-role admin client (S-08). Authenticates with SUPABASE_SERVICE_ROLE_KEY
// and BYPASSES RLS — it is the account-provisioning path (invite / reactivate /
// ban). SERVER-ONLY: construct it only inside admin-gated `/api/staff*` route
// handlers (which self-gate with requireRole before touching it). NEVER attach it
// to `context.locals` and NEVER import it into a client island. Uses the base
// `@supabase/supabase-js` client (not `@supabase/ssr`) with no session
// persistence. Returns `null` when either env var is missing (staff-management
// unconfigured) — callers must handle null the same way pages handle a null
// cookie client.
export function createAdminClient(): SupabaseClient<Database> | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
