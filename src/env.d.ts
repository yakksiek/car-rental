// Vite's `?inline` suffix resolves a binary asset to a `data:` URI string. Used
// by `src/lib/media/fonts.ts` to embed the PDF's Unicode TTFs; `astro/client`
// declares `?url` and `?raw` but not `?inline`.
declare module "*.ttf?inline" {
  const dataUri: string;
  export default dataUri;
}

declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    // null means unauthenticated *or* authenticated-but-no-profile (fail-closed).
    role: import("./types").AppRole | null;
    // True only for the published demo account (profiles.is_demo). Non-nullable
    // and false by default: an unauthenticated, profile-less or unconfigured
    // request is never a demo request, and the guard must never branch on a
    // nullable read. Independent of `role` — it denies, it never grants.
    isDemo: boolean;
    // Per-request Supabase client (cookie-based SSR). `null` when unconfigured.
    // Populated in src/middleware.ts; consumed by catalog services (S-01) and S-02+.
    supabase: import("@supabase/supabase-js").SupabaseClient<import("./db/database.types").Database> | null;
    // The active locale for THIS request (english-localization). Non-nullable and
    // always defaulted — same rule as `isDemo`: a page must never branch on a
    // nullable locale, and there is no "no language" state to render.
    // Resolved in src/middleware.ts by `resolveLocale` (cookie > profiles.locale >
    // default), which never throws.
    locale: import("./lib/i18n/types").Locale;
    // Translator bound to `locale`, so `.astro` components read
    // `Astro.locals.t("ns.key")` without threading the locale themselves. This is
    // the COMPOSED accessor — server-only. React islands take `locale` as a prop
    // and use `translator(locale, namespace)` instead; see src/lib/i18n/types.ts.
    t: ReturnType<typeof import("./lib/i18n").useTranslations>;
  }
}
