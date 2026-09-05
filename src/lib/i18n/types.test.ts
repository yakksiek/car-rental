// core
import { describe, expect, it } from "vitest";

// others
import { DEFAULT_LOCALE, asLocale, isLocale, requireDocumentLocale } from "./types";

// The two readers of a STORED locale, and the difference between them.
//
// `asLocale` defaults. `requireDocumentLocale` throws. Which one a call site
// picks decides whether a lagging migration is a silent wrong record or a visible
// 500, so the split is worth pinning rather than leaving to a comment.

describe("isLocale", () => {
  it("accepts exactly the two locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pl")).toBe(true);
  });

  it("rejects everything else, including near-misses and non-strings", () => {
    expect(isLocale("de")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale("en-GB")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(1)).toBe(false);
  });
});

describe("asLocale — the LENIENT reader (cookies, stored preferences)", () => {
  it("passes a recognised value through", () => {
    expect(asLocale("pl")).toBe("pl");
    expect(asLocale("en")).toBe("en");
  });

  it("falls back to the default for anything else", () => {
    expect(asLocale(null)).toBe(DEFAULT_LOCALE);
    expect(asLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(asLocale("")).toBe(DEFAULT_LOCALE);
    expect(asLocale("de")).toBe(DEFAULT_LOCALE);
  });
});

describe("requireDocumentLocale — the STRICT reader (issued documents)", () => {
  it("passes a recognised value through, exactly like asLocale", () => {
    expect(requireDocumentLocale("pl", "test")).toBe("pl");
    expect(requireDocumentLocale("en", "test")).toBe("en");
  });

  // The case it exists for. `reservations.locale` is NOT NULL with a check
  // constraint, so the database can never hand us a bad value — but a Worker
  // deployed ahead of its migrations reads an RPC whose return shape has no
  // language column at all, and the property arrives as `undefined`. With
  // `asLocale` every PDF issued in that window renders English and stamps 'en',
  // permanently, with nothing anywhere saying so.
  it("THROWS on a missing column — the lagging-migration window", () => {
    expect(() => requireDocumentLocale(undefined, "pickups/[reservationId]")).toThrow();
    expect(() => requireDocumentLocale(null, "pickups/[reservationId]")).toThrow();
  });

  it("throws on an unrecognised value rather than picking one", () => {
    expect(() => requireDocumentLocale("de", "test")).toThrow();
    expect(() => requireDocumentLocale("", "test")).toThrow();
  });

  it("names the call site and the likely cause, so the 500 is actionable", () => {
    expect(() => requireDocumentLocale(undefined, "returns/[reservationId] documentLocale")).toThrow(
      /returns\/\[reservationId\] documentLocale/,
    );
    expect(() => requireDocumentLocale(undefined, "x")).toThrow(/migration/i);
  });

  it("differs from asLocale on exactly the inputs asLocale defaults on", () => {
    for (const bad of [null, undefined, "", "de", "EN"]) {
      expect(asLocale(bad)).toBe(DEFAULT_LOCALE);
      expect(() => requireDocumentLocale(bad, "x")).toThrow();
    }
  });
});
