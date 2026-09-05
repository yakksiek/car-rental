// core
import { describe, expect, it } from "vitest";

// others
import { DEFAULT_LOCALE } from "./types";
import { resolveLocale } from "./resolve";

// Locale resolution is read on EVERY request, including anonymous ones, and its
// inputs are untrusted (a cookie anyone can hand-edit) or shared (one profiles
// row behind every demo visitor). These lock the precedence, the never-throw
// contract, and the demo carve-out — the last of which has no other guard: the
// write side is deliberately ungated, so removing the skip here re-opens the
// cross-visitor leak silently.

describe("resolveLocale precedence", () => {
  it("falls back to the default when there is no signal at all", () => {
    expect(resolveLocale({})).toBe(DEFAULT_LOCALE);
    expect(resolveLocale({ cookie: null, profileLocale: null })).toBe(DEFAULT_LOCALE);
  });

  it("English is the default — Polish is the opt-in", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("uses the cookie when it holds a known locale", () => {
    expect(resolveLocale({ cookie: "pl" })).toBe("pl");
    expect(resolveLocale({ cookie: "en" })).toBe("en");
  });

  it("cookie beats the stored profile preference", () => {
    expect(resolveLocale({ cookie: "en", profileLocale: "pl" })).toBe("en");
    expect(resolveLocale({ cookie: "pl", profileLocale: "en" })).toBe("pl");
  });

  it("uses the stored profile preference when no cookie is present", () => {
    expect(resolveLocale({ profileLocale: "pl" })).toBe("pl");
    expect(resolveLocale({ cookie: null, profileLocale: "pl" })).toBe("pl");
  });

  it("a null profile preference means 'no preference' — not Polish", () => {
    expect(resolveLocale({ profileLocale: null })).toBe(DEFAULT_LOCALE);
  });
});

describe("resolveLocale never throws on an unrecognised value", () => {
  it("falls through an unrecognised cookie to the next signal", () => {
    // A hand-edited cookie must degrade, not error and not win.
    expect(resolveLocale({ cookie: "de" })).toBe(DEFAULT_LOCALE);
    expect(resolveLocale({ cookie: "de", profileLocale: "pl" })).toBe("pl");
    expect(resolveLocale({ cookie: "", profileLocale: "pl" })).toBe("pl");
    expect(resolveLocale({ cookie: "PL" })).toBe(DEFAULT_LOCALE);
  });

  it("falls through an unrecognised stored preference to the default", () => {
    expect(resolveLocale({ profileLocale: "de" })).toBe(DEFAULT_LOCALE);
    expect(resolveLocale({ profileLocale: "" })).toBe(DEFAULT_LOCALE);
  });
});

describe("resolveLocale demo carve-out", () => {
  // Every demo visitor shares ONE profiles row. Without this skip the first
  // recruiter to touch the switcher sets the language for every recruiter who
  // signs in afterwards — defeating the acceptance test outright.
  it("ignores a stored preference on the demo account", () => {
    expect(resolveLocale({ profileLocale: "pl", isDemo: true })).toBe(DEFAULT_LOCALE);
  });

  it("still honours the demo visitor's OWN cookie — the switch works in-session", () => {
    expect(resolveLocale({ cookie: "pl", profileLocale: "pl", isDemo: true })).toBe("pl");
    expect(resolveLocale({ cookie: "pl", profileLocale: null, isDemo: true })).toBe("pl");
  });

  it("does NOT skip the stored preference for a real account", () => {
    expect(resolveLocale({ profileLocale: "pl", isDemo: false })).toBe("pl");
  });
});
