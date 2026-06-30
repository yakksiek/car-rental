---
change_id: testing-api-boundary-authz
title: API boundary tests — authz matrix + server-side input parity
status: implemented
created: 2026-06-30
updated: 2026-06-30
archived_at: null
---

## Notes

Rollout Phase 2 of context/foundation/test-plan.md: "API boundary: authz + input parity".
Risks covered: #4 (IDOR / broken authorization — an authed-but-wrong-role caller or crafted request reaches a reservation/protocol/vehicle resource, including the public /r/[token] link, without an ownership/role check), #5 (server-side validation bypass — a request crafted to skip the client is accepted by the API).
Test types planned: integration, contract.
Risk response intent:
- #4: prove each protected route denies anon + wrong-role + cross-resource access by id/token; challenge that a route "is protected" means it "checks ownership" (a middleware gate is not a per-resource check), and that the /r/[token] public link is correctly scoped; avoid testing only the happy authed path or trusting middleware to cover IDOR.
- #5: prove the API rejects payloads the client would block (bad dates, overlapping range, malformed fields, invalid vehicle id) with a clean 4xx and NO DB write; challenge that client-side zod equals server enforcement (importing the schema is not applying it server-side); avoid re-asserting the zod schema in isolation (already covered by the existing unit test) instead of proving the route applies it.

## Findings

- F2 — Inconsistent anon HTTP status across protected routes (401 for vehicle routes, 403 for reservation routes; same protection, cosmetic). Documented as a deferred product decision, not normalized: `finding-anon-status-inconsistency.md`.
