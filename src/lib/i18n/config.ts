// core
import { defineDict } from "./types";

// The missing-config banner's own copy (`src/lib/config-status.ts`). Separate
// from the `layout` namespace because these are deployment-health messages, not
// page chrome — and because `config-status.ts` reads `astro:env/server`, which
// nothing in the catalog should have to.
//
// The `name` fields for Supabase and Resend are product names and stay verbatim
// in both locales; only the third entry has a translatable name.
export const config = defineDict({
  en: {
    accountsName: "Account management",
    supabaseMissing: "Supabase is not configured — authentication features are disabled.",
    resendMissing: "Resend is not configured — emails only reach the server log.",
    serviceRoleMissing: "The service-role key is not configured — adding and removing employees is disabled.",
    docsLabel: "See the configuration guide",
  },
  pl: {
    accountsName: "Zarządzanie kontami",
    supabaseMissing: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    resendMissing: "Resend nie jest skonfigurowany — wiadomości e-mail trafiają tylko do logu serwera.",
    serviceRoleMissing: "Klucz service-role nie jest skonfigurowany — dodawanie i usuwanie pracowników jest wyłączone.",
    docsLabel: "Zobacz instrukcję konfiguracji",
  },
});
