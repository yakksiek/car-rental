---
change_id: return-protocol-comparison
title: Return protocol with auto-computed deltas vs. issue baseline, emailed to customer
status: implementing
created: 2026-07-14
updated: 2026-07-22
archived_at: null
---

## Notes

Seeded from `context/foundation/roadmap.md` → slice **S-06** (return-protocol-comparison).

- **Outcome:** A logged-in employee fills a return protocol — the issue baseline shown as reference, all current values entered fresh — and the system auto-computes and displays deltas (km driven, fuel change, new damage); the protocol is auto-emailed to the customer.
- **PRD refs:** US-02, FR-007, FR-008, NFR (mobile-usable protocol forms)
- **Prerequisites:** S-05 (issue-protocol) — done, archived at `context/archive/2026-07-09-issue-protocol/`. Reuses the same Supabase Storage bucket + Resend email seam + pdf-lib/fontkit PDF path.
- **Risk (from roadmap):** the delta computation is the differentiating value over paper protocols; it consumes the issue baseline, so building it before S-05 would leave nothing to compare against.
