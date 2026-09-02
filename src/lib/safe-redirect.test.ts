// core
import { describe, expect, it } from "vitest";

// others
import { DEFAULT_POST_LOGIN, safeInternalPath, safeRedirectPath } from "./safe-redirect";

// The redirect guard is security-sensitive: it decides where a freshly
// authenticated session lands. A too-loose check is an open-redirect (phishing
// hand-off to an external host); a too-tight one drops legitimate deep-links.
// These lock both the happy path (internal deep-links survive) and the rejects
// (absolute / protocol-relative / auth-loop targets fall back to the home).

describe("safeRedirectPath", () => {
  it("falls back to the staff home for empty input", () => {
    expect(safeRedirectPath(null)).toBe(DEFAULT_POST_LOGIN);
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_POST_LOGIN);
    expect(safeRedirectPath("")).toBe(DEFAULT_POST_LOGIN);
  });

  it("preserves a safe internal path (with query)", () => {
    expect(safeRedirectPath("/dashboard/reservations")).toBe("/dashboard/reservations");
    expect(safeRedirectPath("/dashboard/calendar?view=week&date=2026-06-18")).toBe(
      "/dashboard/calendar?view=week&date=2026-06-18",
    );
  });

  it("rejects absolute and protocol-relative URLs (open-redirect guard)", () => {
    expect(safeRedirectPath("https://evil.test")).toBe(DEFAULT_POST_LOGIN);
    expect(safeRedirectPath("//evil.test")).toBe(DEFAULT_POST_LOGIN);
    expect(safeRedirectPath("/\\evil.test")).toBe(DEFAULT_POST_LOGIN);
    expect(safeRedirectPath("dashboard")).toBe(DEFAULT_POST_LOGIN);
  });

  it("never bounces back into the auth pages", () => {
    expect(safeRedirectPath("/auth")).toBe(DEFAULT_POST_LOGIN);
    expect(safeRedirectPath("/auth/signin")).toBe(DEFAULT_POST_LOGIN);
  });
});

describe("safeInternalPath", () => {
  // The locale switcher's sibling guard. Same open-redirect rules, different
  // policy: it falls back to `/` and does NOT exclude `/auth/*`. Both
  // differences are the reason it exists rather than reusing safeRedirectPath —
  // see the comment above it.

  it("falls back to the site root, not the staff home, for empty input", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath(undefined)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
    // The distinction that matters: an anonymous visitor switching language on
    // the public site must not be thrown at /dashboard.
    expect(safeInternalPath(null)).not.toBe(DEFAULT_POST_LOGIN);
  });

  it("preserves a safe internal path, query string included", () => {
    expect(safeInternalPath("/fleet")).toBe("/fleet");
    expect(safeInternalPath("/dashboard/calendar?view=week")).toBe("/dashboard/calendar?view=week");
  });

  it("KEEPS /auth paths — the recruiter path runs through sign-in", () => {
    expect(safeInternalPath("/auth/signin")).toBe("/auth/signin");
    // Dropping the query here would strand someone mid-invite-accept: the
    // callback and reset pages carry token_hash/type in the URL.
    expect(safeInternalPath("/auth/reset-password?token_hash=abc&type=invite")).toBe(
      "/auth/reset-password?token_hash=abc&type=invite",
    );
  });

  it("rejects an absolute URL (open redirect)", () => {
    expect(safeInternalPath("https://evil.test")).toBe("/");
    expect(safeInternalPath("http://evil.test/x")).toBe("/");
  });

  it("rejects protocol-relative forms the browser treats as a host", () => {
    expect(safeInternalPath("//evil.test")).toBe("/");
    expect(safeInternalPath("/\\evil.test")).toBe("/");
  });

  it("rejects a path that is not root-relative", () => {
    expect(safeInternalPath("dashboard")).toBe("/");
    expect(safeInternalPath("../etc")).toBe("/");
  });
});
