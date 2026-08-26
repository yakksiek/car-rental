// core
import { afterEach, describe, expect, it, vi } from "vitest";

// others
import { shouldSecureCookies } from "./secure-cookies";

// The `Secure` rule for every cookie the app writes (S-14 Phase 5). Worth its
// own test because the attribute is UNOBSERVABLE in every local run — workerd
// reports `http:` under `astro dev`, `astro preview`, and even
// `wrangler dev --local-protocol https` — so nothing else in the suite, and no
// amount of clicking through the local app, can tell a correct rule from one
// that silently never fires. These cases are the only place the production
// branch is pinned at all.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shouldSecureCookies", () => {
  it("is false for a plain-http request in a non-production build", () => {
    // `npm run dev` on :4321. Marking cookies `Secure` here would make the
    // browser drop every one of them and take the whole auth flow down.
    expect(shouldSecureCookies(new URL("http://localhost:4321/auth/signin"))).toBe(false);
  });

  it("is true for an https request even in a non-production build", () => {
    expect(shouldSecureCookies(new URL("https://localhost:4321/auth/signin"))).toBe(true);
  });

  it("is true in a production build regardless of the request protocol", () => {
    // The load-bearing case. Cloudflare is expected to report an https
    // `request.url` in production, but nothing local can prove it — so the
    // build flag, not the protocol, is what guarantees the attribute ships.
    vi.stubEnv("PROD", true);
    expect(shouldSecureCookies(new URL("http://fleetrent.example/auth/signin"))).toBe(true);
    expect(shouldSecureCookies(new URL("https://fleetrent.example/auth/signin"))).toBe(true);
  });
});
