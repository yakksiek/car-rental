import type { APIRoute } from "astro";

// F-02: public self-service signup is closed. v1 has no customer accounts —
// every account is staff, provisioned by an admin (S-08) or the documented
// production first-admin runbook. This route is kept as an explicit, documented
// refusal (defense-in-depth alongside `enable_signup = false` in config.toml)
// rather than deleted, so a stray POST gets correct UX instead of a raw error.
export const POST: APIRoute = (context) => {
  // The refusal copy itself now lives in the sign-in surface's code table
  // (S-14, F6) — only the code travels in the URL.
  return context.redirect("/auth/signin?error=signupClosed");
};
