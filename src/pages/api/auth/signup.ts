import type { APIRoute } from "astro";

// F-02: public self-service signup is closed. v1 has no customer accounts —
// every account is staff, provisioned by an admin (S-08) or the documented
// production first-admin runbook. This route is kept as an explicit, documented
// refusal (defense-in-depth alongside `enable_signup = false` in config.toml)
// rather than deleted, so a stray POST gets correct UX instead of a raw error.
export const POST: APIRoute = (context) => {
  return context.redirect(
    `/auth/signin?error=${encodeURIComponent("Rejestracja jest zarządzana przez administratora.")}`,
  );
};
