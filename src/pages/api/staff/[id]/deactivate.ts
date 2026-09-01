// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { isDemoAccount, requireRole } from "../../../../lib/access";
import { createAdminClient } from "../../../../lib/supabase";
import { deactivateStaff, getStaffEmail } from "../../../../lib/services/staff";

// Staff soft-remove endpoint (S-08). Admin-only, with server-enforced typed
// confirmation: the caller must echo the target's email, and the server
// re-fetches it (admin API) rather than trusting the client — so the typed
// confirmation is a real gate, not a modal nicety.
//   (a) CSRF, (b) auth+admin, (b2) the demo gate, (c) zod `{ confirmEmail }`,
//   (d) email match check, (e) the guarded deactivate (self / last-admin guards
//   live in the RPC).
//
// WHY (b2) EXISTS HERE. The RPC's guards cover `self` and `last_admin`, so a demo
// admin can remove neither itself nor the last admin — but it CAN remove a
// DIFFERENT admin. Once the owner's real admin account coexists with the demo one
// in production, that is a visitor locking the owner out, recoverable only by
// direct SQL. The gate closes that; the RPC's guards are unchanged.

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe zgłoszenie.",
  unauthenticated: "Wymagane logowanie.",
  forbidden: "Brak uprawnień.",
  notFound: "Nie znaleziono pracownika.",
  confirmMismatch: "Wpisany adres e-mail nie zgadza się.",
  self: "Nie możesz usunąć własnego konta.",
  lastAdmin: "To jedyny administrator — nie można go usunąć.",
  unconfigured: "Zarządzanie kontami nie jest skonfigurowane.",
  // Shared verbatim with `api/staff.ts` and `reset-password.ts` — see the note
  // on that entry there.
  demoBlocked: "Ta akcja jest wyłączona na koncie demo.",
} as const;

const bodySchema = z.object({ confirmEmail: z.string().trim().min(1) });

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

  // (b2) Demo gate — after the admin check, before any body parse or admin-client
  // construction. `code` distinguishes it from this route's other 403s
  // (bad origin, forbidden, unconfigured, `self`), which the roster's remove
  // modal otherwise reports as a generic refusal.
  if (isDemoAccount(context.locals)) {
    return json(403, { error: MSG.demoBlocked, code: "demo_blocked" });
  }

  const id = context.params.id;
  if (!id) {
    return json(400, { error: MSG.badBody });
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: MSG.badBody });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { error: MSG.badBody });
  }

  const admin = createAdminClient();
  if (!admin) {
    return json(403, { error: MSG.unconfigured });
  }

  // (c/d) Re-fetch the target's real email and enforce the typed confirmation
  // server-side. A missing target is a 404; a mismatch is a 400.
  const email = await getStaffEmail(admin, id);
  if (!email) {
    return json(404, { error: MSG.notFound });
  }
  if (email.trim().toLowerCase() !== parsed.data.confirmEmail.trim().toLowerCase()) {
    return json(400, { error: MSG.confirmMismatch });
  }

  // (e) The guarded soft-remove. The RPC (run on the admin's cookie client) is
  // the authority for the self / last-admin guards.
  const result = await deactivateStaff(admin, context.locals.supabase, id);
  switch (result.status) {
    case "ok":
      return json(200, { status: "ok" });
    case "demo":
      // Belt and braces: the (b2) gate above already refused this caller, so the
      // RPC's own demo arm is unreachable from here. Mapped to the identical
      // response anyway — an arm that answers "impossible" is how a guard rots
      // when a later edit moves the gate.
      return json(403, { error: MSG.demoBlocked, code: "demo_blocked" });
    case "self":
      return json(403, { error: MSG.self });
    case "last_admin":
      return json(409, { error: MSG.lastAdmin });
    case "not_found":
      return json(404, { error: MSG.notFound });
    case "unauthorized":
      return json(403, { error: MSG.forbidden });
  }
};
