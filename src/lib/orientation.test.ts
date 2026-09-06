// core
import { describe, expect, it } from "vitest";

// others
import { ORIENTATION_SEEN, shouldAutoShowOrientation } from "./orientation";

// The overlay is the first thing a visitor sees, so both failure directions are
// user-visible: never showing it defeats the whole change, and showing it on
// every page view reads as a broken site. Its inputs are untrusted (a cookie
// anyone can hand-edit) and it runs on an anonymous request, so these lock the
// precedence and the never-throw contract.

describe("shouldAutoShowOrientation", () => {
  it("shows for a first-time anonymous visitor", () => {
    expect(shouldAutoShowOrientation({})).toBe(true);
    expect(shouldAutoShowOrientation({ cookie: null, signedIn: false })).toBe(true);
  });

  it("does not show once the seen cookie is present", () => {
    expect(shouldAutoShowOrientation({ cookie: ORIENTATION_SEEN })).toBe(false);
    expect(shouldAutoShowOrientation({ cookie: "seen" })).toBe(false);
  });

  it("does not show for a signed-in staffer, cookie or not", () => {
    // This is also what keeps the overlay out of the e2e suite's default
    // `employee` storage state, which visits `/`.
    expect(shouldAutoShowOrientation({ signedIn: true })).toBe(false);
    expect(shouldAutoShowOrientation({ cookie: null, signedIn: true })).toBe(false);
  });

  it("treats an unrecognised cookie value as absent rather than erroring", () => {
    // A hand-edited cookie degrades to "show it" — the landing page must never
    // 500 because someone typed into their cookie jar.
    expect(shouldAutoShowOrientation({ cookie: "yes" })).toBe(true);
    expect(shouldAutoShowOrientation({ cookie: "" })).toBe(true);
    expect(shouldAutoShowOrientation({ cookie: "SEEN" })).toBe(true);
  });
});
