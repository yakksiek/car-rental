/* eslint-disable @typescript-eslint/no-deprecated -- tseslint.config() is the only way to use extends; core defineConfig has incompatible API */
import { includeIgnoreFile } from "@eslint/config-helpers";
import eslint from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import eslintPluginAstro from "eslint-plugin-astro";
import pluginReact from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import path from "node:path";
import tseslint from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

const baseConfig = tseslint.config({
  extends: [eslint.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    "no-console": "warn",
    // Local (src) files must use relative imports — the @/ alias is banned for
    // app code. The tsconfig `@/*` mapping is kept only so shadcn/ui tooling
    // resolves; convert any generated `@/` import to a relative path.
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/*"],
            message: "Use a relative import (./ or ../) for local files — the @/ alias is banned for src files.",
          },
        ],
      },
    ],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
  },
});

const reactConfig = tseslint.config({
  files: ["**/*.{js,jsx,ts,tsx}"],
  extends: [pluginReact.configs.flat.recommended],
  languageOptions: {
    ...pluginReact.configs.flat.recommended.languageOptions,
    globals: {
      window: true,
      document: true,
    },
  },
  plugins: {
    "react-hooks": eslintPluginReactHooks,
    "react-compiler": reactCompiler,
  },
  settings: { react: { version: "detect" } },
  rules: {
    ...eslintPluginReactHooks.configs.recommended.rules,
    "react/react-in-jsx-scope": "off",
    "react-compiler/react-compiler": "error",
  },
});

// `scripts/` holds repo tooling, not app source: plain Node ESM, run by hand or
// from an npm script, outside the `tsconfig` project the type-checked rules need.
// Linting it under the app's config produces only noise (`process` undefined, every
// `readFileSync` result an `any`), so the type-aware layer is dropped and the two
// rules that still say something useful are kept.
const scriptsConfig = tseslint.config({
  files: ["scripts/**/*.mjs"],
  extends: [tseslint.configs.disableTypeChecked],
  languageOptions: {
    globals: { process: "readonly", console: "readonly" },
  },
  rules: {
    "no-console": "off",
    "no-undef": "off",
  },
});

const astroConfig = tseslint.config({
  files: ["**/*.astro"],
  rules: {
    "astro/no-set-html-directive": "error",
    "astro/no-unused-css-selector": "warn",
    "astro/prefer-class-list-directive": "warn",
    // `checksVoidReturn.returns` CRASHES on a top-level `return` in Astro
    // frontmatter — `return Astro.redirect(...)`, which is Astro's documented
    // way to bail out of a page. `astro-eslint-parser` parses frontmatter into
    // the Program body rather than a function body, so the rule's
    // `getParentFunctionNode()` finds no parent and throws "Non-null Assertion
    // Failed: Expected node to have a parent" (verified with typescript-eslint
    // 8.59.2 + astro-eslint-parser 1.4.0). A rule crash is NOT suppressible by
    // an eslint-disable comment, so it has to be turned off here.
    //
    // Only the ReturnStatement listener is dropped (it is registered solely by
    // this sub-option) — conditionals, spreads, arguments, properties and
    // variables still run. Measured, not assumed: a probe .astro carrying one
    // violation per sub-check reports the SAME 5 errors with `returns` on or
    // off. It is redundant here by construction — an explicit `: void` function
    // returning a value is a TypeScript error (caught by `astro check`), and the
    // contextual-void cases TS does permit are reported at the assignment /
    // argument / property instead. Upgrading does not help: `checkReturnStatement`
    // is byte-identical in the latest 8.67.0.
    //
    // `attributes: false` is carried over from the base config, which flat
    // config would otherwise replace wholesale rather than merge.
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false, returns: false } }],
  },
});

export default tseslint.config(
  includeIgnoreFile(gitignorePath),
  // Not app source — exclude from linting:
  // - context/foundation/design: a static design prototype (never imported; see lessons.md)
  // - src/db/database.types.ts: generated by `supabase gen types` (do not hand-edit)
  { ignores: ["context/foundation/design/**", "src/db/database.types.ts"] },
  baseConfig,
  reactConfig,
  scriptsConfig,
  eslintPluginAstro.configs["flat/recommended"],
  ...eslintPluginAstro.configs["flat/jsx-a11y-recommended"],
  astroConfig,
  eslintPluginPrettier,
);
