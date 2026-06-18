// core
import { describe, expect, it } from "vitest";

// others
import { DEFAULT_POST_LOGIN, safeRedirectPath } from "./safe-redirect";

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
