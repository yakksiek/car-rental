// core
import type { APIContext, AstroCookieSetOptions } from "astro";
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
// `.user`, `.role`), `context.params` (`.id`) and — since S-14's session-origin
// gate — `context.cookies`. A minimal object covers all of them; the single
// `as unknown as APIContext` cast below is the one type escape (Astro's real
// `APIContext` is far larger than any handler uses).
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
   * Raw request body, written verbatim (NOT JSON-serialized). Use to send a
   * malformed-JSON body so a handler's `await request.json()` throws and the
   * route returns its pre-schema 400. Takes precedence over `body` when set.
   */
  rawBody?: string;
  /**
   * Form-encoded request body, for the routes fed by a native `<form method="POST">`
   * (the auth endpoints read `request.formData()`, not `request.json()`). Sent as
   * `application/x-www-form-urlencoded`. Takes precedence over `body`/`rawBody`.
   */
  formBody?: Record<string, string>;
  /**
   * `Origin` header. Defaults to the same origin as `path` (passes the CSRF
   * check). Pass a foreign origin to test a cross-site POST, or `null` to send
   * no Origin header at all.
   */
  origin?: string | null;
  /**
   * Incoming cookies, name → value. Backed by a Map the handler also writes
   * through, so a `set` / `delete` it performs is observable afterwards via
   * `context.cookies.get(name)` — which is how the S-14 one-shot marker
   * (spent on success, kept on a validation failure) is asserted. The attributes
   * of those writes are observable too, via `cookieOptions(context, name)`.
   */
  cookies?: Record<string, string>;
}

// Attribute side-channel for the cookie double (auth-followups, F7). The double
// used to drop its third argument entirely, so `path` — called "load-bearing" in
// auth-session.ts, because an `/auth`-scoped marker is invisible to the handler
// at `/api/auth/reset-password` — and `secure` were unassertable at this layer.
//
// A SECOND map rather than a `{ value, options }` jar entry, for two reasons:
//   - the value jar must stay live-cookies-only, so a `delete` really removes
//     the key and `get`/`has` answer exactly as they do today. An entry recording
//     a delete's options would leave the key present and turn
//     `reset-password.test.ts`'s "marker is spent" assertion red.
//   - `buildApiContext` returns `... as unknown as APIContext`, so a test sees
//     Astro's `AstroCookies`, whose `get()` yields `{ value, json(), … }` and has
//     no `options` member — `get(X)?.options` would not type-check under
//     `astro check` / the type-aware lint rules. Going through the exported
//     function below needs no cast.
//
// Keyed by the double itself, so it is reachable from a plain `APIContext`.
const COOKIE_OPTIONS = new WeakMap<object, Map<string, AstroCookieSetOptions | undefined>>();

/**
 * The options a handler passed to `cookies.set` / `cookies.delete` for `name` —
 * the LAST write wins, and `undefined` means either no write or a write that
 * passed no options.
 */
export function cookieOptions(context: APIContext, name: string): AstroCookieSetOptions | undefined {
  return COOKIE_OPTIONS.get(context.cookies)?.get(name);
}

/**
 * Minimal `AstroCookies` stand-in over a Map. Covers the four members the
 * handlers use — `get` (value only), `set`, `delete`, `has` — and nothing else;
 * Astro's real class also does signing, JSON coercion and header serialization,
 * none of which a route gate touches.
 *
 * Attributes go to the side map above, read back with `cookieOptions()`.
 * `AstroCookieDeleteOptions` is `Omit<AstroCookieSetOptions, "expires" | "maxAge"
 * | "encode">` and is not exported from `astro`, so both writers are typed with
 * the set variant — every delete option is a member of it.
 */
function buildCookies(initial: Record<string, string>) {
  const jar = new Map<string, string>(Object.entries(initial));
  const options = new Map<string, AstroCookieSetOptions | undefined>();
  const api = {
    get: (key: string) => {
      const value = jar.get(key);
      return value === undefined ? undefined : { value };
    },
    set: (key: string, value: string, opts?: AstroCookieSetOptions) => {
      jar.set(key, value);
      options.set(key, opts);
    },
    delete: (key: string, opts?: AstroCookieSetOptions) => {
      jar.delete(key);
      options.set(key, opts);
    },
    has: (key: string) => jar.has(key),
  };
  COOKIE_OPTIONS.set(api, options);
  return api;
}

/** Assemble the minimal `APIContext` the route handlers read. */
export function buildApiContext(opts: BuildApiContextOptions): APIContext {
  const url = new URL(opts.path, BASE_ORIGIN);

  // Precedence: `formBody` (urlencoded) > `rawBody` (verbatim, possibly malformed)
  // > `body` (JSON-serialized).
  const form = opts.formBody !== undefined ? new URLSearchParams(opts.formBody).toString() : undefined;
  const hasBody = form !== undefined || opts.rawBody !== undefined || opts.body !== undefined;
  const serializedBody = form ?? opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined);

  const headers = new Headers();
  if (hasBody) {
    headers.set("content-type", form !== undefined ? "application/x-www-form-urlencoded" : "application/json");
  }
  // `origin: null` → send no Origin header; otherwise default to same-origin.
  if (opts.origin !== null) {
    headers.set("origin", opts.origin ?? url.origin);
  }

  const request = new Request(url, {
    method: opts.method,
    headers,
    body: serializedBody,
  });

  return {
    request,
    url,
    params: opts.params ?? {},
    // Redirect-shaped routes (the native-<form> auth endpoints) answer with
    // `context.redirect(...)`, which Astro injects at runtime. Mirror its default:
    // a 302 carrying `Location`.
    redirect: (path: string, status = 302) => new Response(null, { status, headers: { location: path } }),
    cookies: buildCookies(opts.cookies ?? {}),
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
