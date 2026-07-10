import { SUPABASE_URL, SUPABASE_KEY, RESEND_API_KEY, EMAIL_FROM } from "astro:env/server";

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
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
