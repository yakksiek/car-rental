// core
import type { APIRoute } from "astro";
import { z } from "zod";

// others
import { api } from "../../lib/i18n/api";
import { LOCALES, LOCALE_COOKIE, translator } from "../../lib/i18n";
import { safeInternalPath } from "../../lib/safe-redirect";
import { shouldSecureCookies } from "../../lib/secure-cookies";

// The locale switch (english-localization Phase 1 §5).
//
// A SERVER-SIDE cookie write, reached by a real `<form method="POST">`, not a
// client-side `document.cookie` assignment. Two reasons, both load-bearing:
//
//   * a client write would leave the server-rendered markup in the PREVIOUS
//     locale until the next navigation, and any island reading the cookie
//     directly would hydrate against markup the server produced under a
//     different locale — the same SSR/hydration mismatch class `lessons.md`
//     records for the signature timestamp;
//   * a form POST + redirect works with JavaScript disabled, so the switcher is
//     not an island that has to hydrate before the site can be read.
//
// DELIBERATELY PUBLIC — there is NO auth gate here, unlike every other mutation
// in this tree (lessons.md -> "API routes are outside middleware's gate"). An
// anonymous visitor landing from a CV link is the primary user of this endpoint;
// refusing them would defeat the entire slice. What it can do is bounded: set a
// cookie from a two-value enum, and 303 to a path that has been re-validated as
// internal. Signed-in staff additionally get the preference persisted.
//
// Self-gating order is otherwise unchanged: (a) same-origin CSRF -> 403,
// (b) zod parse -> 400, then the write.

const bodySchema = z.object({
  locale: z.enum(LOCALES),
  // Where to send the visitor back to. Re-validated below regardless — this
  // only rejects a non-string.
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

  // The switcher is a native form, so the body is url-encoded. An unparseable
  // body is a malformed request, not a user error.
  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return json(400, { error: t("badBody") });
  }

  // (b) Validate. `form.get` answers `null` for an absent field and a `File` for
  // a file part, so both are narrowed to undefined before parsing.
  const raw = {
    locale: form.get("locale"),
    redirect: typeof form.get("redirect") === "string" ? (form.get("redirect") as string) : undefined,
  };
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: t("badBody") });
  }

  // `safeInternalPath`, NOT `safeRedirectPath` — the latter falls back to
  // /dashboard and refuses /auth/*, both wrong for "put me back where I was".
  // See the comment on the sibling in src/lib/safe-redirect.ts.
  const target = safeInternalPath(parsed.data.redirect);

  // One year: this is a stated preference, not a session artifact.
  // `httpOnly` because nothing in the browser reads it — islands receive the
  // locale as a prop from the server-rendered page. `secure` follows the one
  // shared rule so it is not dropped over plain http in dev (S-14).
  context.cookies.set(LOCALE_COOKIE, parsed.data.locale, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: shouldSecureCookies(context.url),
  });

  // Signed-in staff also get the preference stored, so it survives a cleared
  // cookie and a new device. It MUST go through the definer RPC: the only UPDATE
  // policy on `profiles` is admin-only, and an RLS-denied UPDATE is a successful
  // update of zero rows — a direct `.from("profiles").update(…)` would fail
  // SILENTLY for every employee. A failure here is logged and does NOT fail the
  // switch: the cookie already carries the choice for this browser.
  if (context.locals.user && context.locals.supabase) {
    const { error } = await context.locals.supabase.rpc("set_profile_locale", { p_locale: parsed.data.locale });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[api/locale] set_profile_locale failed — cookie still set:", error);
    }
  }

  // 303, not 302: the browser must follow with GET after a POST.
  return context.redirect(target, 303);
};
