---
change_id: issue-protocol
title: Issue handover protocol with photos, signature, and customer auto-email
status: new
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

Seeded from `context/foundation/roadmap.md` — slice **S-05: Issue protocol** (Stream B, employee handover lifecycle).

- **Outcome:** A logged-in employee can fill an issue protocol at pickup — mileage, fuel level, damage notes, photos, and a digital signature — on a phone or tablet, and the completed protocol is auto-emailed to the customer.
- **PRD refs:** US-02, FR-006, FR-008, NFR (mobile-usable protocol forms).
- **Prerequisites:** F-02 (employee/admin roles — done), S-03 (reservation-approval — needs an accepted reservation to attach a protocol to). **Confirm S-03 is shipped before planning** — per the roadmap there is nothing to protocol until a reservation is accepted.
- **First-time infra (heaviest slice):** stands up **file/object storage for photos** and **transactional email** for the first time. Both are reused later by S-06 (return-protocol-comparison).
- **Open unknown (non-blocking):** transactional email provider + verified sender domain not yet chosen (email absent in baseline). A default in-stack option exists; this is a pick at plan time. Owner: user.
- **Field-usability risk (NFR):** on-device photo capture and touch signature must work at the vehicle on phone/tablet.
