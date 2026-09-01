// @ts-check
import { defineConfig, envField, fontProviders } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  devToolbar: {
    enabled: false,
  },
  adapter: cloudflare(),
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: ["400 700"],
      styles: ["normal"],
      subsets: ["latin", "latin-ext"],
      fallbacks: ["system-ui", "sans-serif"],
    },
    {
      provider: fontProviders.google(),
      name: "Instrument Serif",
      cssVariable: "--font-instrument-serif",
      weights: [400],
      styles: ["normal"],
      subsets: ["latin", "latin-ext"],
      fallbacks: ["Georgia", "serif"],
      display: "optional",
    },
    {
      provider: fontProviders.google(),
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      weights: ["400 600"],
      styles: ["normal"],
      subsets: ["latin", "latin-ext"],
      fallbacks: ["ui-monospace", "monospace"],
    },
  ],
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // Transactional email (S-05). Optional: with either missing, the email seam
      // falls back to the dev/log adapter and the app boots with a banner.
      RESEND_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      EMAIL_FROM: envField.string({ context: "server", access: "secret", optional: true }),
      // Service-role key (S-08) — RLS-bypassing admin client for staff
      // provisioning. Server-only, used exclusively inside admin-gated
      // `/api/staff*` routes. Optional: with it missing, staff-management
      // mutations are unconfigured (createAdminClient() returns null).
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // Published demo password for the portfolio deployment
      // (demo-account-gate). The value is deliberately PUBLIC in meaning — it is
      // rendered into /auth/signin for anyone to read — but it is declared
      // `secret` for a mechanical reason: `access: "public"` inlines the value
      // into the build (verified 2026-08-28 — the literals landed in
      // `dist/server/chunks/*.mjs`), so `wrangler secret put` would set
      // something the code never reads and the card would silently stay hidden
      // on prod. `secret` resolves at runtime, which is what makes rotating the
      // demo password a secret change instead of a rebuild. Optional — with it
      // absent the card does not render, so local dev, CI and any other
      // deployment stay unchanged.
      //
      // There is deliberately no DEMO_EMAIL: the address is derived from
      // `profiles.is_demo` via `demo_account_email()`
      // (`20260901130000_demo_account_email.sql`) so the card can only ever
      // publish an account the gate actually covers. Two independent switches
      // could disagree, and the disagreement failed OPEN.
      DEMO_PASSWORD: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
