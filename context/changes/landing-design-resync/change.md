---
change_id: landing-design-resync
title: Landing — re-sync to the evolved live design (TypeSelector + Popularne)
status: implementing
created: 2026-08-07
updated: 2026-08-07
archived_at: null
---

## Notes

Follow-up to `landing-fleet-restyle`. The landing shipped faithful to the Claude Design
as of ~2026-08-02, but the **live** design has since evolved. This change re-syncs the two
sections the product owner flagged — **"Wybierz typ pojazdu"** and **"Popularne"** — plus the
two real tablet layout bugs in the Popularne card.

**Backing research:** `context/changes/landing-fleet-restyle/research.md` → section
_"Follow-up Research 2026-08-07 — Full landing fidelity audit"_ (the 14-item decision list;
this plan implements items #2–#11, i.e. everything non-footer).

**Decisions taken with the owner (2026-08-07):**

- **Keep the serif headings** (item #1) — the documented `landing-redesign` brand face. NOT
  reverted to the design's sans. **Out of scope.**
- **"Cała flota" CTA → crimson** (item #4) per the live design.
- **Footer left as-is** (items #12/#13) — explicitly excluded.
- Item #14 (nav phone glyph) **dropped** — vision-agent false positive; the live design's
  glyph is `tokens.accent` (crimson), which the app already matches.

Purely presentational + one small data check (#10). No API/schema/behaviour change.
