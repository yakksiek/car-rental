// core
import { describe, expect, it } from "vitest";

// others
import { gotrueErrorCode, resolveAuthError } from "./auth-messages";

// The F6 whitelist (S-14 Phase 3). The property under test is the CLOSED set:
// a crafted `?error=` must resolve to nothing, so the only sentences the app can
// ever render are the ones written in the table. A resolver that echoed an
// unknown value — or fell back to "show the raw code" — would hand a phishing
// link exactly the surface this slice exists to remove.
//
// The second property is that GoTrue's English never travels: `gotrueErrorCode`
// reads only `code` / `status`, never `message`. Its inputs below are the shapes
// probe-verified against local GoTrue, not shapes taken from the docs.

describe("resolveAuthError", () => {
  it("resolves a known code to its message, in the requested locale", () => {
    expect(resolveAuthError("signin", "invalidCredentials", "pl")).toBe("Nieprawidłowy e-mail lub hasło");
    expect(resolveAuthError("resetPassword", "tooShort", "pl")).toBe("Hasło musi mieć co najmniej 6 znaków");
    expect(resolveAuthError("changePassword", "wrongCurrent", "pl")).toBe("Nieprawidłowe obecne hasło");

    expect(resolveAuthError("signin", "invalidCredentials", "en")).toBe("Incorrect email or password");
    expect(resolveAuthError("resetPassword", "tooShort", "en")).toBe("Password must be at least 6 characters");
    expect(resolveAuthError("changePassword", "wrongCurrent", "en")).toBe("That current password is not right");
  });

  it("keeps the closed set closed in BOTH locales", () => {
    // The F6 property is per-locale: adding an English half must not open a
    // second door for a crafted `?error=`.
    const injected = "Your account is locked, call 500123456";

    expect(resolveAuthError("signin", injected, "en")).toBeNull();
    expect(resolveAuthError("signin", "__proto__", "en")).toBeNull();
    expect(resolveAuthError("signin", "wrongCurrent", "en")).toBeNull();
  });

  it("returns null for an unknown code", () => {
    expect(resolveAuthError("signin", "nieznany", "pl")).toBeNull();
    expect(resolveAuthError("signin", "__proto__", "pl")).toBeNull();
  });

  it("returns null for an empty or absent code", () => {
    expect(resolveAuthError("signin", "", "pl")).toBeNull();
    expect(resolveAuthError("signin", null, "pl")).toBeNull();
    expect(resolveAuthError("signin", undefined, "pl")).toBeNull();
  });

  it("returns null for an injected sentence — the F6 lure", () => {
    // The exact shape from the plan's manual check: a phishing sentence on a
    // legitimate, authenticated URL. It must render no alert at all.
    const injected = "Twoje konto zablokowano, zadzwoń pod 500123456";

    expect(resolveAuthError("signin", injected, "pl")).toBeNull();
    expect(resolveAuthError("resetPassword", injected, "pl")).toBeNull();
    expect(resolveAuthError("changePassword", injected, "pl")).toBeNull();
  });

  it("returns null for GoTrue's own English, which used to be forwarded verbatim", () => {
    expect(
      resolveAuthError("changePassword", "New password should be different from the old password.", "pl"),
    ).toBeNull();
    expect(resolveAuthError("signin", "Invalid login credentials", "pl")).toBeNull();
  });

  it("honours a code only on the surfaces where it can honestly have happened", () => {
    // `wrongCurrent` cannot happen at sign-in (there is no current password to
    // get wrong), and sign-in's credential message has no meaning on the
    // in-session change form.
    expect(resolveAuthError("signin", "wrongCurrent", "pl")).toBeNull();
    expect(resolveAuthError("resetPassword", "wrongCurrent", "pl")).toBeNull();
    expect(resolveAuthError("changePassword", "invalidCredentials", "pl")).toBeNull();
    expect(resolveAuthError("resetPassword", "signupClosed", "pl")).toBeNull();
  });

  it("gives every surface its own generic fallback", () => {
    expect(resolveAuthError("signin", "generic", "pl")).toBe("Nie udało się zalogować. Spróbuj ponownie.");
    expect(resolveAuthError("resetPassword", "generic", "pl")).toBe("Nie udało się zapisać hasła. Spróbuj ponownie.");
    expect(resolveAuthError("changePassword", "generic", "pl")).toBe("Nie udało się zmienić hasła. Spróbuj ponownie.");
  });
});

describe("gotrueErrorCode", () => {
  it("maps `same_password` — the English that reached the Polish UI", () => {
    const error = {
      code: "same_password",
      status: 422,
      message: "New password should be different from the old password.",
    };

    expect(gotrueErrorCode(error)).toBe("samePassword");
    expect(resolveAuthError("changePassword", gotrueErrorCode(error), "pl")).toBe(
      "Nowe hasło musi się różnić od obecnego",
    );
  });

  it("maps `weak_password` and `invalid_credentials`", () => {
    expect(gotrueErrorCode({ code: "weak_password", status: 422 })).toBe("weakPassword");
    expect(gotrueErrorCode({ code: "invalid_credentials", status: 400 })).toBe("invalidCredentials");
  });

  it("maps status 429 to `rateLimited` even with no code", () => {
    expect(gotrueErrorCode({ status: 429 })).toBe("rateLimited");
    expect(gotrueErrorCode({ code: "over_request_rate_limit", status: 429 })).toBe("rateLimited");
  });

  it("defaults to `generic` for anything unrecognised", () => {
    expect(gotrueErrorCode({ code: "some_future_gotrue_code", status: 500 })).toBe("generic");
    expect(gotrueErrorCode({ status: 400 })).toBe("generic");
    expect(gotrueErrorCode({})).toBe("generic");
    expect(gotrueErrorCode(null)).toBe("generic");
    expect(gotrueErrorCode(undefined)).toBe("generic");
  });

  it("never returns a code that resolves to the provider's own wording", () => {
    // Belt and braces: whatever the mapper answers must be a key in the table,
    // never a passthrough of the input.
    const resolved = resolveAuthError("resetPassword", gotrueErrorCode({ code: "weak_password", status: 422 }), "pl");

    expect(resolved).toBe("Hasło jest zbyt słabe. Wybierz inne.");
    expect(resolved).not.toContain("Password");

    // And in English the answer is OUR sentence, not GoTrue's — the provider's
    // wording never becomes acceptable just because the locale now matches it.
    const resolvedEn = resolveAuthError("resetPassword", gotrueErrorCode({ code: "weak_password", status: 422 }), "en");

    expect(resolvedEn).toBe("That password is too weak. Choose another one.");
  });
});
