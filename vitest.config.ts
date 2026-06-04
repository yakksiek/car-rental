// core
import { defineConfig } from "vitest/config";

// First test runner in the project. Scoped to pure-logic unit tests
// (`src/**/*.test.ts`) in a node environment — no Astro/React/DOM surface is
// needed for this slice. The `@/*` alias mirrors tsconfig so tests import the
// same way app code does.
export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
