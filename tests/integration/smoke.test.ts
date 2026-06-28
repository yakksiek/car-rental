// core
import { describe, expect, it } from "vitest";

// others
import { anonClient, as, type SeededRole } from "../helpers/clients";

// Connectivity smoke test — proves the whole harness wires up before any risk
// assertion exists: env loads (setup.ts), the anon client reaches the REST API,
// and every seeded role (incl. the fail-closed `norole`) signs in. No PII or
// overlap assertions here — those live in the dedicated suites.

// Seeded auth.uid()s (see supabase/seed.sql).
const SEEDED_UIDS: Record<SeededRole, string> = {
  admin: "a0000000-0000-0000-0000-0000000000ad",
  employee: "e0000000-0000-0000-0000-0000000000e0",
  norole: "b0000000-0000-0000-0000-0000000000b0",
};

describe("harness connectivity", () => {
  it("anon client reads a public (active) vehicle", async () => {
    const client = anonClient();
    const { data, error } = await client.from("vehicles").select("id, is_active").eq("is_active", true).limit(1);

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
    expect(data?.[0].is_active).toBe(true);
  });

  it.each<SeededRole>(["admin", "employee", "norole"])(
    "seeded role %s signs in with the expected auth.uid()",
    async (role) => {
      const client = await as(role);
      const { data, error } = await client.auth.getUser();

      expect(error).toBeNull();
      expect(data.user?.id).toBe(SEEDED_UIDS[role]);
    },
  );
});
