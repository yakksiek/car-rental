// core
import type { APIContext } from "astro";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// others
import { anonClient, as, type SeededRole } from "./clients";

// Constructed-APIContext factory for route-handler tests.
//
// The `/api` tree is NOT gated by middleware — `ROUTE_ROLES` (src/lib/access.ts)
// covers only `/dashboard` pages, so every API route self-gates in its own
// handler. The cheapest way to test that gate is to invoke the exported handler
// directly with a hand-built context: no HTTP server, no cookie session, runs in
// the existing `integration` project against local Supabase.
//
// The handlers read ONLY `context.request` (Origin header + `.json()`),
// `context.url` (`.origin`, `.searchParams`), `context.locals` (`.supabase`,
// `.user`, `.role`) and `context.params` (`.id`). A minimal object covers all of
// them; the single `as unknown as APIContext` cast below is the one type escape
// (Astro's real `APIContext` is far larger than any handler uses).
//
// ROLE CONSISTENCY: `buildApiContext` keeps no invariant on its own — a caller
// could pass a mismatched client/role. Prefer the `asContext` / `anonContext`
// wrappers, which pair the Supabase client's JWT role with `locals.role` /
// `locals.user` exactly as middleware derives locals from the session, so an
// allow-path case passes both the app gate AND the DB backstop (RPC
// `current_app_role()` / RLS), and a deny-path case fails at the app gate.

// The dev/test origin. Handlers compare the request `Origin` against
// `context.url.origin` for the CSRF check; both derive from this base, so a
// normal request is same-origin by default.
const BASE_ORIGIN = "http://localhost:4321";

/** The app-level role middleware writes to `locals.role` (null = fail-closed). */
export type AppLocalsRole = "admin" | "employee" | null;

export interface BuildApiContextOptions {
  method: "GET" | "POST" | "PATCH";
  /** Path, may include a query string — e.g. "/api/reservations/calendar?start=…". */
  path: string;
  /** `locals.supabase` — `anonClient()` for unauthed, `as(role)` for a real JWT. */
  supabase: SupabaseClient;
  /** `locals.user` — truthy for an authed caller, null for anon. */
  user?: User | null;
  /** `locals.role` — middleware normally derives this from the profiles lookup. */
  role?: AppLocalsRole;
  /** Route params for `[id]` routes, e.g. `{ id }`. */
  params?: Record<string, string | undefined>;
  /** Request body — JSON-serialized into the Request. Omit for GET. */
  body?: unknown;
  /**
   * `Origin` header. Defaults to the same origin as `path` (passes the CSRF
   * check). Pass a foreign origin to test a cross-site POST, or `null` to send
   * no Origin header at all.
   */
  origin?: string | null;
}

/** Assemble the minimal `APIContext` the route handlers read. */
export function buildApiContext(opts: BuildApiContextOptions): APIContext {
  const url = new URL(opts.path, BASE_ORIGIN);

  const headers = new Headers();
  if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  // `origin: null` → send no Origin header; otherwise default to same-origin.
  if (opts.origin !== null) {
    headers.set("origin", opts.origin ?? url.origin);
  }

  const request = new Request(url, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  return {
    request,
    url,
    params: opts.params ?? {},
    locals: {
      supabase: opts.supabase,
      user: opts.user ?? null,
      role: opts.role ?? null,
    },
  } as unknown as APIContext;
}

/**
 * Build a context for a seeded role, pairing `as(role)`'s real JWT with a
 * matching `locals.user`/`locals.role` so client and app-role never drift.
 * `norole` is an authenticated user with NO profiles row, so its app-role is
 * null (fail-closed) even though `locals.user` is truthy.
 */
export async function asContext(
  role: SeededRole,
  opts: Omit<BuildApiContextOptions, "supabase" | "user" | "role">,
): Promise<APIContext> {
  const supabase = await as(role);
  const { data } = await supabase.auth.getUser();
  const appRole: AppLocalsRole = role === "norole" ? null : role;
  return buildApiContext({ ...opts, supabase, user: data.user, role: appRole });
}

/** Build a context for an unauthenticated (anon) caller: null user + null role. */
export function anonContext(opts: Omit<BuildApiContextOptions, "supabase" | "user" | "role">): APIContext {
  return buildApiContext({ ...opts, supabase: anonClient(), user: null, role: null });
}
