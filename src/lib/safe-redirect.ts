// Post-login redirect safety (S-03 follow-up A1).
//
// Middleware appends the intended destination as `?redirect=<path>` when it
// bounces an unauthenticated user from a protected route to the sign-in page.
// Sign-in honors that target only if it is a safe *internal* path — this is the
// open-redirect guard: an attacker-supplied absolute URL ("https://evil.test")
// or protocol-relative path ("//evil.test") must never be followed after a
// successful login. Anything that doesn't pass falls back to the staff home.

export const DEFAULT_POST_LOGIN = "/dashboard";

export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw) {
    return DEFAULT_POST_LOGIN;
  }
  // Must be a single-slash, root-relative path. Reject anything not starting
  // with "/", and protocol-relative forms the browser treats as a host:
  // "//evil.test" and the backslash variant "/\evil.test".
  if (!raw.startsWith("/") || raw[1] === "/" || raw[1] === "\\") {
    return DEFAULT_POST_LOGIN;
  }
  // Never bounce back into the auth pages — that would loop or strand the user
  // on the sign-in screen they just cleared. (Middleware never sets this, but a
  // hand-crafted query string could.)
  if (raw === "/auth" || raw.startsWith("/auth/")) {
    return DEFAULT_POST_LOGIN;
  }
  return raw;
}
