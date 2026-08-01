---
change_id: testing-quality-gates-wiring
title: Wire the CI quality gate so unit + integration suites run on every PR to main
status: impl_reviewed
created: 2026-08-01
updated: 2026-08-01
archived_at: null
---

## Notes

Open a change folder for rollout Phase 5 of context/foundation/test-plan.md: "Quality-gates wiring".
Risks covered: cross-cutting. Test types planned: gates.
Risk response intent: the CI gate ensures the existing unit + integration suites actually run on every PR to main, so a regression in any covered risk class — #1 PII/RLS, #2 booking overlap, #4 IDOR/authz, #5 server-side input parity, #6 dashboard availability, #3 protocol email — cannot merge without those suites executing. This closes the gap that local-only hooks leave: pre-commit/pre-push are bypassable (--no-verify) and fail open when local Supabase is down. Deliverable is the CI half of test-plan §5 "unit + integration = local + CI"; the local post-edit hook half is already shipped.
Note: work on branch `testing-quality-gates-wiring` (already checked out). After creating the folder, follow the downstream continuation rule.
