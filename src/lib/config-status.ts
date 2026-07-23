import { SUPABASE_URL, SUPABASE_KEY, RESEND_API_KEY, EMAIL_FROM, SUPABASE_SERVICE_ROLE_KEY } from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: "Zobacz instrukcję konfiguracji",
  },
  {
    name: "Resend",
    configured: Boolean(RESEND_API_KEY && EMAIL_FROM),
    message: "Resend nie jest skonfigurowany — wiadomości e-mail trafiają tylko do logu serwera.",
    docsUrl: "https://resend.com/docs/dashboard/domains/introduction",
    docsLabel: "Zobacz instrukcję konfiguracji",
  },
  {
    // S-08: without the service-role key the admin `/api/staff*` routes cannot
    // provision accounts. Auth/roster reads still work (definer RPC), so this is
    // a partial-config warning, not a hard failure.
    name: "Zarządzanie kontami",
    configured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
    message: "Klucz service-role nie jest skonfigurowany — dodawanie i usuwanie pracowników jest wyłączone.",
    docsUrl: "https://supabase.com/docs/guides/api/api-keys",
    docsLabel: "Zobacz instrukcję konfiguracji",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
