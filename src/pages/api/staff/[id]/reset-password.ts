// core
import type { APIRoute } from "astro";

// others
import { requireRole } from "../../../../lib/access";
import { createAdminClient } from "../../../../lib/supabase";
import { getStaffEmail, resetStaffPassword } from "../../../../lib/services/staff";

// Admin-triggered "Resetuj hasło" row action (S-08). Admin-only. Looks up the
// target's email via the admin API (never trusts a client-sent email), then
// sends a GoTrue recovery email through the cookie client. Always 200 on success
// — it neither confirms nor denies the account's state to the caller beyond
// "sent".
//   (a) CSRF, (b) auth+admin, (c) resolve email, (d) send recovery.

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe zgłoszenie.",
  unauthenticated: "Wymagane logowanie.",
  forbidden: "Brak uprawnień.",
  notFound: "Nie znaleziono pracownika.",
  unconfigured: "Zarządzanie kontami nie jest skonfigurowane.",
} as const;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const POST: APIRoute = async (context) => {
  // (a) CSRF: reject anything not same-origin before doing any work.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return json(403, { error: MSG.badOrigin });
  }

  // (b) Auth + role gate: a signed-out caller is 401, a non-admin 403.
  if (!context.locals.user) {
    return json(401, { error: MSG.unauthenticated });
  }
  if (!requireRole(context.locals, "admin")) {
    return json(403, { error: MSG.forbidden });
  }

  const id = context.params.id;
  if (!id) {
    return json(400, { error: MSG.badBody });
  }

  const admin = createAdminClient();
  if (!admin) {
    return json(403, { error: MSG.unconfigured });
  }

  // (c) Resolve the real email server-side.
  const email = await getStaffEmail(admin, id);
  if (!email) {
    return json(404, { error: MSG.notFound });
  }

  // (d) Send the recovery email (no service-role needed — GoTrue issues it).
  await resetStaffPassword(context.locals.supabase, email, context.url.origin);
  return json(200, { status: "sent" });
};
