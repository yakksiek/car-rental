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
  }
}
