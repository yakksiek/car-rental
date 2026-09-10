// core
import * as Sentry from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

// The Cloudflare Worker entrypoint (`main` in wrangler.jsonc) — NOT an Astro
// server-init file, despite the name. The name is fixed: `@sentry/astro` looks
// for `sentry.server.config.(js|ts)` at the project root, and this is the layout
// Sentry ships in its own `astro-6-cf-workers` e2e fixture.
//
// The wrap is manual because Astro 6 / `@astrojs/cloudflare` v13 no longer emits
// the SSR virtual entry that `@sentry/astro` auto-wraps on adapter v12.
// See getsentry/sentry-javascript#19762.
//
// With SENTRY_DSN absent the SDK is a no-op: events are captured and dropped.
// Same seam as SUPABASE_* and RESEND_* — the app boots unconfigured.
export default Sentry.withSentry(
  (env: { SENTRY_DSN?: string }) => ({
    dsn: env.SENTRY_DSN,
    // Forwards console.warn / console.error to Sentry as issues. This is the only
    // reason a swallowed error — a route that logs a failed write and still
    // returns 200 — is ever visible in production. Narrow to ["error"] if the
    // 5k/month free quota starts filling with routine warnings.
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
    tracesSampleRate: 0.1,
    // Reservations carry customer PII (name, email, phone). Never attach request
    // bodies or headers by default.
    sendDefaultPii: false,
  }),
  handler,
);
