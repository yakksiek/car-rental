// ---------------------------------------------------------------------------
// One rule for the `Secure` attribute on every cookie this app writes (S-14).
//
// It lives alone in this module because four call sites need it — the three
// `createClient` sites (middleware, signin, signout) and the two S-14 marker
// cookies via `linkCookieOptions` — and a rule that decides a security attribute
// must not be four expressions that can drift apart. It has no `astro:env`
// dependency on purpose, so unit tests can import it without `astro sync`.
// ---------------------------------------------------------------------------

/**
 * Whether cookies written on THIS request should carry `Secure`.
 *
 * Two signals, ORed, because neither covers the ground alone:
 *
 * - `import.meta.env.PROD` — true for any production build, which is the only
 *   thing that actually ships. This is the load-bearing half.
 * - `url.protocol === "https:"` — catches an https request in a non-production
 *   build, so a dev-mode session over TLS is still marked.
 *
 * **Why the build flag is required, not belt-and-braces** (probed 2026-08-17):
 * the protocol check alone can never be observed locally, because workerd sees
 * `http:` in *every* local mode — `astro dev`, `astro preview`, and even
 * `wrangler dev --local-protocol https`, where wrangler terminates TLS at its
 * proxy and forwards plain http (no `X-Forwarded-Proto` either). So a
 * protocol-only rule makes the attribute depend entirely on Cloudflare putting
 * an https scheme in `request.url` in production — an assumption nothing local
 * can falsify, which is the exact shape `lessons.md` §"A typed, accepted API
 * parameter is not evidence that it is enforced" warns about. With the flag,
 * every production build emits `Secure` regardless of what the runtime reports.
 *
 * `npm run dev` is not a production build and is served over http, so local
 * development and the whole e2e suite are unaffected — a `Secure` cookie over
 * plain http would simply be dropped. Under `npm run preview` (a production
 * build over http://localhost) browsers still accept it, since localhost counts
 * as a trustworthy origin; a non-browser client like `curl` will not keep it.
 */
export function shouldSecureCookies(url: URL): boolean {
  return import.meta.env.PROD || url.protocol === "https:";
}
