// core
import { defineConfig } from "vitest/config";

// Two named projects share one root `resolve.alias` (per-project `test` blocks
// do NOT inherit root-level `test` options, so each project repeats its own).
//
//   unit        — pure-logic units colocated in `src/`. No DB, fast, parallel.
//                 This is what the default `npm test` (and today's CI) runs.
//   integration — DB-backed suites in `tests/integration/` against local
//                 Supabase. Serial (`fileParallelism: false`) because the GiST
//                 EXCLUDE constraint makes concurrent reservation writes
//                 collide; `setup.ts` loads `.env.test` and fails fast on a
//                 misconfigured machine. Run via `npm run test:integration`.
export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
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
