---
change_id: testing-data-layer-integrity
title: Data-layer integrity harness — RLS PII isolation + reservation overlap (test-plan Phase 1)
status: implementing
created: 2026-06-27
updated: 2026-06-28
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Data-layer integrity harness + RLS/overlap".
Risks covered: #1 (RLS PII leak — anon/wrong-role/employee reads customer PII they shouldn't), #2 (double-booking slips through the overlap rule, incl. same-day changeover off-by-one).
Test types planned: integration (vs local Supabase with anon/employee/admin clients).
Risk response intent:
- #1: prove each role (anon/employee/admin) gets exactly the rows policy allows and a wrong-role SELECT returns 0 PII rows; do NOT accept "logged in == allowed", and watch for a service-role client masking the gap.
- #2: prove a second overlapping reservation is rejected at the DB while same-day return-10:00/pickup-14:00 turnover is allowed; the residual risk is the DB constraint + service insert path, not the already-unit-tested pure rule.
After creating the folder, follow the downstream continuation rule (suggest /10x-research next).
