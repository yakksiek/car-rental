// core
import type { APIRoute } from "astro";

// others
import { api } from "../../../../lib/i18n/api";
import { translator } from "../../../../lib/i18n/types";
import { isDemoAccount, requireRole } from "../../../../lib/access";
import { createAdminClient } from "../../../../lib/supabase";
import { getStaffEmail, resetStaffPassword } from "../../../../lib/services/staff";

// Admin-triggered "Resetuj hasło" row action (S-08). Admin-only. Looks up the
// target's email via the admin API (never trusts a client-sent email), then
// sends a GoTrue recovery email through the cookie client. Always 200 on success
// — it neither confirms nor denies the account's state to the caller beyond
// "sent".
//   (a) CSRF, (b) auth+admin, (b2) the demo gate, (c) resolve email,
//   (d) send recovery.
//
// WHY (b2) EXISTS HERE. The recipient is not caller-supplied — it comes from
// `getStaffEmail` — but this is a ONE-CLICK real send with no confirm step, so a
// demo visitor can mail every listed staffer at will. The sibling
// `[id]/invite.ts` is deliberately NOT gated: it refuses anyone whose
// `password_set_at` is set, so it can only ever mail an already-listed,
// password-less staffer.

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const POST: APIRoute = async (context) => {
  const t = translator(context.locals.locale, api);

  // (a) CSRF: reject anything not same-origin before doing any work.
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin) {
    return json(403, { error: t("badOrigin") });
  }

  // (b) Auth + role gate: a signed-out caller is 401, a non-admin 403.
  if (!context.locals.user) {
    return json(401, { error: t("unauthenticated") });
  }
  if (!requireRole(context.locals, "admin")) {
    return json(403, { error: t("forbidden") });
  }

  // (b2) Demo gate — after the admin check, before the admin client is built, so
  // no service-role client exists for a request that will be refused and no mail
  // can leave as a result. `code` keeps the roster banner from calling this a
  // bad-origin or unconfigured failure.
  if (isDemoAccount(context.locals)) {
    return json(403, { error: t("demoBlocked"), code: "demo_blocked" });
  }

  const id = context.params.id;
  if (!id) {
    return json(400, { error: t("badBody") });
  }

  const admin = createAdminClient();
  if (!admin) {
    return json(403, { error: t("unconfigured") });
  }

  // (c) Resolve the real email server-side.
  const email = await getStaffEmail(admin, id);
  if (!email) {
    return json(404, { error: t("staffNotFound") });
  }

  // (d) Send the recovery email (no service-role needed — GoTrue issues it).
  await resetStaffPassword(context.locals.supabase, email, context.url.origin);
  return json(200, { status: "sent" });
};
