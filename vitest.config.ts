// core
import { defineConfig } from "vitest/config";

// Two named projects. Neither `test` options NOR `resolve` are inherited from
// the root config by a project, so both are repeated per project — the root
// `resolve` below is what the config file's own loader sees, not what the
// projects see.
//
//   unit        — pure-logic units colocated in `src/`. No DB, fast, parallel.
//                 This is what the default `npm test` (and today's CI) runs.
//   integration — DB-backed suites in `tests/integration/` against local
//                 Supabase. Serial (`fileParallelism: false`) because the GiST
//                 EXCLUDE constraint makes concurrent reservation writes
//                 collide; `setup.ts` loads `.env.test` and fails fast on a
//                 misconfigured machine. Run via `npm run test:integration`.
const alias = {
  "@": new URL("./src", import.meta.url).pathname,
  // `astro:env/server` is an `astro sync`-generated virtual module. Vite resolves
  // it during an Astro build but not under vitest, so anything reaching the email
  // seam or config-status would fail to import. The stub reports an unconfigured
  // deployment (every value `undefined`).
  "astro:env/server": new URL("./tests/stubs/astro-env-server.ts", import.meta.url).pathname,
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
