// core
import type { APIRoute } from "astro";

// others
import { requireRole } from "../../lib/access";
import { createAdminClient } from "../../lib/supabase";
import { createEmployee, employeeInviteSchema } from "../../lib/services/staff";

// Staff create/invite endpoint (S-08). Admin-only. Mirrors the S-04 mutation
// route defenses, but the DB backstop here is the SERVICE-ROLE admin client
// (RLS bypass), so the in-handler admin gate IS the real boundary:
//   (a) same-origin `Origin` check (CSRF),
//   (b) auth (401) + admin role (403),
//   (c) zod body validation (shared employeeInviteSchema), 400 `{ errors }`,
//   (d) the invite/reactivate, mapping the result tag to HTTP.

const MSG = {
  badOrigin: "Nieprawidłowe źródło żądania.",
  badBody: "Nieprawidłowe zgłoszenie.",
  unauthenticated: "Wymagane logowanie.",
  forbidden: "Brak uprawnień.",
  duplicateEmail: "Pracownik z tym adresem e-mail już istnieje.",
  unconfigured: "Zarządzanie kontami nie jest skonfigurowane.",
  // The invite mail went out but the profiles row did not land. The roster island
  // renders its own §9 copy off `code`, so this string is for non-browser callers
  // and logs; the two outcomes share it because the remedy differs only in the
  // island's wording.
  provisionFailed: "Zaproszenie zostało wysłane, ale konta nie udało się dokończyć.",
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

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json(400, { error: MSG.badBody, errors: {} });
  }

  // (c) Validate — the same schema the island runs client-side.
  const parsed = employeeInviteSchema.safeParse(payload);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in errors)) {
        errors[key] = issue.message;
      }
    }
    return json(400, { errors });
  }

  // (d) Invite/reactivate through the service-role admin client.
  const result = await createEmployee(createAdminClient(), { ...parsed.data, origin: context.url.origin });
  switch (result.status) {
    case "created":
      return json(201, { member: result.member });
    case "reactivated":
      // Still 200: the account really was repaired and really does belong on the
      // roster. The activation-mail outcome rides in the BODY, not the status —
      // the two-systems house pattern (`services/email-delivery.ts:57-77`,
      // `api/return-protocols/[id]/pdf.ts:18-21`).
      return json(200, { member: result.member, activationMail: result.activationMail });
    case "duplicate_active":
      return json(409, { errors: { email: MSG.duplicateEmail } });
    // Provisioning half-succeeded: 500 is the honest class (our write failed),
    // and `code` is what makes it distinguishable from an unhandled 500 — those
    // carry Astro's HTML body with no `code`, so the island falls back to the
    // network banner exactly as before.
    case "provision_rolled_back":
      return json(500, { error: MSG.provisionFailed, code: "provision_rolled_back" });
    case "provision_orphaned":
      return json(500, { error: MSG.provisionFailed, code: "provision_orphaned" });
    case "unauthorized":
      // A null admin client here means the service-role key is unconfigured.
      return json(403, { error: MSG.unconfigured });
  }
};
