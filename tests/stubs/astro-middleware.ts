// Vitest stub for the `astro:middleware` virtual module. Astro maps this
// specifier to its runtime during a build, but Vitest cannot resolve it, so any
// test that imports `src/middleware.ts` (to exercise the real page gate) needs
// this shim. `defineMiddleware` is an identity function in Astro itself
// (astro/dist/core/middleware/defineMiddleware.js), so the stub matches exactly.

export function defineMiddleware<T>(fn: T): T {
  return fn;
}
