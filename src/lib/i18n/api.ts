// core
import { defineDict } from "./types";

// Error copy for `/api` route handlers. Seeded here by english-localization
// Phase 1 with the two messages `POST /api/locale` needs; the remaining 17
// route files' `MSG` maps land in this namespace in Phase 5.
export const api = defineDict({
  en: {
    badOrigin: "Invalid request origin.",
    badBody: "Invalid request.",
  },
  pl: {
    badOrigin: "Nieprawidłowe źródło żądania.",
    badBody: "Nieprawidłowe zgłoszenie.",
  },
});
