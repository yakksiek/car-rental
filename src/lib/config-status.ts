// core
import { SUPABASE_URL, SUPABASE_KEY, RESEND_API_KEY, EMAIL_FROM, SUPABASE_SERVICE_ROLE_KEY } from "astro:env/server";

// others
import { config } from "./i18n/config";
import { translator, type Locale } from "./i18n/types";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

// These were module-level const ARRAYS until english-localization Phase 1, read
// as values by `Layout.astro`. A locale-aware message cannot be baked into a
// module-level constant — the locale is per-request — so both become functions.
// Everything else about them is unchanged: same three entries, same order, same
// `configured` predicates, evaluated once per call rather than once per module.
//
// The named per-namespace accessor is used rather than the composed
// `Astro.locals.t`, because this module is `src/lib` and the composed map is
// server-only (src/lib/i18n/types.ts). Nothing in an island imports it today;
// keeping to the narrow accessor means nothing breaks if one ever does.
export function configStatuses(locale: Locale): ConfigStatus[] {
  const t = translator(locale, config);
  return [
    {
      name: "Supabase",
      configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
      message: t("supabaseMissing"),
      docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
      docsLabel: t("docsLabel"),
    },
    {
      name: "Resend",
      configured: Boolean(RESEND_API_KEY && EMAIL_FROM),
      message: t("resendMissing"),
      docsUrl: "https://resend.com/docs/dashboard/domains/introduction",
      docsLabel: t("docsLabel"),
    },
    {
      // S-08: without the service-role key the admin `/api/staff*` routes cannot
      // provision accounts. Auth/roster reads still work (definer RPC), so this is
      // a partial-config warning, not a hard failure.
      name: t("accountsName"),
      configured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
      message: t("serviceRoleMissing"),
      docsUrl: "https://supabase.com/docs/guides/api/api-keys",
      docsLabel: t("docsLabel"),
    },
  ];
}

export function missingConfigs(locale: Locale): ConfigStatus[] {
  return configStatuses(locale).filter((s) => !s.configured);
}
