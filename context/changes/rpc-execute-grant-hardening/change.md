---
change_id: rpc-execute-grant-hardening
title: RPC execute-grant hardening
status: implemented
created: 2026-07-14
updated: 2026-07-14
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- 2026-07-14 — **Phase 1 implemented (4e4b897), with one deviation.** The migration revokes execute
  from `public, anon` on the four staff RPCs (keeping `authenticated`) and adds an explicit
  `grant execute on current_app_role() to authenticated`. Grant matrix verified via
  `has_function_privilege`: staff RPCs `anon_exec=f`, the four public RPCs `anon_exec=t`,
  `current_app_role` `authenticated=t`. Unit 198 + integration 108 green (no regression).
  - **⚠ Dropped the planned `alter default privileges` statement — spike-verified NO-OP in Supabase.**
    The Phase 1 `__canary()` spike proved (three ways: combined revoke, in-session re-run, PUBLIC-alone
    revoke) that a freshly-created function still receives the built-in PUBLIC execute grant
    (`proacl {=X/...}`), so anon can call it — Supabase's managed Postgres does not honor
    default-privilege suppression of the function-execute-to-PUBLIC default. Per the user's
    "targeted revokes only" call, the statement was removed and `lessons.md` corrected: the
    per-function `revoke ... from public, anon` is the durable control and is mandatory on every new
    RPC (there is no reliable "start closed" default here). The plan's Overview / Desired-End-State /
    Phase-1 prose still describe the default-privileges approach (plan blocks are read-only during
    implement); this note is the authoritative record of what shipped.
