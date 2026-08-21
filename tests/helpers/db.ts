// core
import postgres from "postgres";

// Direct Postgres connection for CATALOG-INTROSPECTION guardrails ONLY — reading
// pg_proc / grant state and other pg_catalog facts that PostgREST does not
// expose. NEVER use this for data access: that must go through the supabase-js
// clients in ./clients so RLS applies exactly as it does in production (see the
// service-role isolation invariant there). A superuser catalog query is the
// right tool for a GRANT-introspection assertion — it inspects privileges, it
// does not exercise them.
//
// ONE NAMED EXCEPTION (invite-journey-fixes): ageing a DISPOSABLE user's own
// `auth.users.*_sent_at` in `resolve-link-token.test.ts`, to reach the RPC's
// expiry clause. PostgREST does not expose the `auth` schema and no admin API
// sets that column, so there is no client-side route to that state at all. It is
// row-scoped to a user the test created and deletes, and leaves NO schema state
// behind if the test crashes — unlike a DDL write, which on a Supabase stack
// four worktrees share would strand the siblings. Do not widen this exception to
// `public` tables: those all have a supabase-js route.
//
// Defaults to the Supabase CLI's fixed local dev URL; CI overrides via
// SUPABASE_DB_URL. The postgres/postgres credentials are the documented local
// defaults (`supabase status` prints them), not secrets — which is why this can
// default inline instead of forcing a .env.test entry.
//
// SAFE BY CONSTRUCTION: `queryDb` is a TAGGED TEMPLATE, not a raw-string runner.
// Every interpolated `${value}` is bound as a query PARAMETER by postgres.js —
// never concatenated into SQL — so this cannot become an injection vector even
// if a future caller interpolates untrusted input. Running an arbitrary string
// would require postgres.js's `sql.unsafe()`, which this helper deliberately
// does NOT expose. (Passing a plain string is also a compile error: the param
// is a TemplateStringsArray, so a bypass needs a visible `as any`.)
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Run a read-only catalog query and return its rows. Use as a tagged template:
 *
 *   const rows = await queryDb<Row>`select ... from pg_proc where ...`;
 *
 * Interpolated `${values}` are parameterized (injection-safe). There is no
 * raw-string overload by design.
 */
export async function queryDb<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: readonly unknown[]
): Promise<T[]> {
  const sql = postgres(process.env.SUPABASE_DB_URL ?? LOCAL_DB_URL, { max: 1 });
  try {
    // Forward the template parts to postgres.js's own tagged template, which
    // binds every value as a parameter (never string-concatenated). The cast is
    // type-plumbing only — postgres.js types params as ParameterOrFragment, not
    // `unknown` — NOT a safety bypass: values are still parameterized.
    const rows = await sql(strings, ...(values as never[]));
    return rows as unknown as T[];
  } finally {
    await sql.end({ timeout: 5 });
  }
}
