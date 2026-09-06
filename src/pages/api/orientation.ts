// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { api } from "../../lib/i18n/api";
import { translator } from "../../lib/i18n";
import { ORIENTATION_COOKIE, ORIENTATION_SEEN } from "../../lib/orientation";
import { safeInternalPath } from "../../lib/safe-redirect";
import { shouldSecureCookies } from "../../lib/secure-cookies";

// The orientation overlay's dismiss write (staff-panel-discovery Phase 2).
//
// A SERVER-SIDE cookie write reached by a real `<form method="POST">`, exactly
// as `POST /api/locale` is. The form is not decoration: the overlay island
// mounts `client:load`, so its markup is server-rendered into the landing page
// and is visible before — and, with JavaScript off, INSTEAD of — hydration. Were
// the dismiss controls plain buttons, a visitor without JavaScript would sit
// behind a scrim with no way out. With JavaScript the island intercepts the two
// dismiss buttons, closes in place and re-sends this POST in the background; the
// staff button is left to submit natively, so the cookie is set and the redirect
// followed in one step rather than racing a cancelled fetch.
//
// DELIBERATELY PUBLIC — there is NO auth gate here, unlike every other mutation
// in this tree (lessons.md -> "API routes are outside middleware's gate"). An
// anonymous first-time visitor is its ONLY user; a signed-in request never sees
// the overlay at all (`shouldAutoShowOrientation`). What it can do is bounded:
// set one cookie to one constant value, and 303 to a path re-validated as
// internal. There is nothing here to authorize.
//
// Self-gating order is unchanged: (a) same-origin CSRF -> 403, (b) body parse
// -> 400, then the write.

const bodySchema = z.object({
  // Where to send the visitor next. Re-validated below regardless — this only
  // rejects a non-string. Absent means "answer 204, do not navigate".
  redirect: z.string().optional(),
});

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

  // The overlay's controls are a native form, so the body is url-encoded. The
  // island's background dismiss posts the same encoding.
  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return json(400, { error: t("badBody") });
  }

  // (b) Validate. `form.get` answers `null` for an absent field and a `File` for
  // a file part, so both are narrowed to undefined before parsing.
  const rawRedirect = form.get("redirect");
  const parsed = bodySchema.safeParse({
    redirect: typeof rawRedirect === "string" ? rawRedirect : undefined,
  });
  if (!parsed.success) {
    return json(400, { error: t("badBody") });
  }

  // One year: this is a stated preference, not a session artifact.
  // `httpOnly` because nothing in the browser reads it — the island receives the
  // auto-show answer as a prop from the server-rendered page. `secure` follows
  // the one shared rule so it is not dropped over plain http in dev (S-14).
  context.cookies.set(ORIENTATION_COOKIE, ORIENTATION_SEEN, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: shouldSecureCookies(context.url),
  });

  // No `redirect` field: the island's background dismiss, which already closed
  // the modal in place and has nowhere to go.
  if (parsed.data.redirect === undefined) {
    return new Response(null, { status: 204 });
  }

  // `safeInternalPath`, NOT `safeRedirectPath` — the latter falls back to
  // /dashboard and refuses /auth/*, and the staff button redirects to exactly
  // `/auth/signin`. See the comment on the sibling in src/lib/safe-redirect.ts.
  // 303, not 302: the browser must follow with GET after a POST.
  return context.redirect(safeInternalPath(parsed.data.redirect), 303);
};
