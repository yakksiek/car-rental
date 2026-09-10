// core
import type { APIRoute } from "astro";

// TEMPORARY — verification route for the Sentry rollout. Delete once the first
// events land in the fleet-rent project.
//
//   ?mode=throw   (default) an uncaught error, the path `withSentry` reports.
//   ?mode=swallow a console.warn that still returns 200. This is the swallowed
//                 error pattern, visible only via captureConsoleIntegration.
export const GET: APIRoute = ({ url }) => {
  if (url.searchParams.get("mode") === "swallow") {
    // eslint-disable-next-line no-console -- the swallowed warn is what this route exists to emit
    console.warn("sentry-test: swallowed_write_failed — returned 200 with nothing persisted");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  throw new Error("sentry-test: deliberate error from /api/sentry-test");
};
