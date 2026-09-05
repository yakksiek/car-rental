// core
import type { APIRoute } from "astro";

// others
import { api } from "../../../../lib/i18n/api";
import { translator } from "../../../../lib/i18n/types";
import { requireRole } from "../../../../lib/access";
import { createAdminClient } from "../../../../lib/supabase";
import { inviteEmployee } from "../../../../lib/services/staff";

// Admin-triggered "Wyślij zaproszenie" row action (S-08, invite-journey-fixes
// phase 8). Step 2 of the two-step add: `POST /api/staff` creates the account
// silently, this route is what actually sends the invitation. Offered for both
// password-less roster states — a first send (DODANY) and a resend (ZAPROSZONY).
//
// Mirrors `reset-password.ts` exactly, because `/api` sits outside middleware's
// gate and must self-gate in this order (lessons.md):
//   (a) CSRF, (b) auth+admin, (c) the guarded send.
//
// The service resolves the target's email itself through the admin API — this
// route never accepts one from the client — and carries the
// `password_set_at is null` gate, so a person who can already sign in is refused
// here and not merely hidden in the island.

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

  const id = context.params.id;
  if (!id) {
    return json(400, { error: t("badBody") });
  }

  // (c) Send. `invitedAt` rides back in the body so the island can move the row
  // from DODANY to ZAPROSZONY off the authoritative timestamp rather than a
  // locally-guessed one.
  const result = await inviteEmployee(createAdminClient(), id, context.url.origin);
  switch (result.status) {
    case "sent":
      return json(200, { status: "sent", invitedAt: result.invitedAt ?? null });
    case "has_password":
      return json(409, { error: t("hasPassword") });
    case "not_found":
      return json(404, { error: t("staffNotFound") });
    case "failed":
      // 502: our call to GoTrue failed, not the caller's request. The island
      // renders its network banner with a retry, which is the honest remedy.
      return json(502, { error: t("sendFailed") });
    case "unauthorized":
      // A null admin client here means the service-role key is unconfigured.
      return json(403, { error: t("unconfigured") });
  }
};
