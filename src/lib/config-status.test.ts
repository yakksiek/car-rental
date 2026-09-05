// core
import { describe, expect, it } from "vitest";

// others
import { configStatuses, missingConfigs } from "./config-status";

// `configStatuses` / `missingConfigs` were module-level const ARRAYS until
// english-localization Phase 1 turned them into functions of the locale. The
// conversion is invisible to `astro check` at the one call site
// (`Layout.astro`), so the shape and the copy are pinned here instead.
//
// Under Vitest `astro:env/server` is stubbed to an UNCONFIGURED deployment
// (tests/stubs/astro-env-server.ts), so all three entries report missing — which
// is exactly the state that renders the banner, and therefore the state worth
// asserting.

describe("configStatuses", () => {
  it("still reports the same three entries, in the same order", () => {
    expect(configStatuses("pl").map((s) => s.name)).toEqual(["Supabase", "Resend", "Zarządzanie kontami"]);
    expect(configStatuses("en").map((s) => s.name)).toEqual(["Supabase", "Resend", "Account management"]);
  });

  it("keeps the product names untranslated — only the third entry has a translatable name", () => {
    const pl = configStatuses("pl");
    const en = configStatuses("en");
    expect(en[0].name).toBe(pl[0].name);
    expect(en[1].name).toBe(pl[1].name);
    expect(en[2].name).not.toBe(pl[2].name);
  });

  it("localizes every message and docs label", () => {
    for (const [plEntry, enEntry] of configStatuses("pl").map((s, i) => [s, configStatuses("en")[i]] as const)) {
      expect(plEntry.message).not.toBe(enEntry.message);
      expect(plEntry.docsLabel).not.toBe(enEntry.docsLabel);
      // The docs URL is not copy — it must not drift between locales.
      expect(plEntry.docsUrl).toBe(enEntry.docsUrl);
    }
  });

  it("no English message carries a Polish diacritic", () => {
    for (const entry of configStatuses("en")) {
      expect(entry.message).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
      expect(entry.docsLabel ?? "").not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
    }
  });
});

describe("missingConfigs", () => {
  it("is the unconfigured subset — all three under the test stub", () => {
    expect(missingConfigs("en")).toHaveLength(3);
    expect(missingConfigs("en").every((s) => !s.configured)).toBe(true);
  });
});
