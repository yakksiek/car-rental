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

**Follow-up phases queued (owner review 2026-08-07, after Phases 1–4 shipped).** Phases 1–4 are
implemented + committed (`df6c442`, `f576312`, `bc33f3d`). Two more improvements were flagged and
recorded as **Phase 5** and **Phase 6** (checked against the current live design), pending
implementation via `/10x-implement landing-design-resync phase 5`:

- **Phase 5** — "Wybierz typ pojazdu": drop the active (crimson) pill state entirely; pills are
  hover-only; crimson belongs only to the "Cała flota →" CTA (design renders all pills `active={false}`).
- **Phase 6** — "Popularne": tablet grid → 2 columns (design `ScreenTabletHome` is `1fr 1fr`),
  which widens the tablet cards to ~377px and removes the spec truncation.

Status reset to `planned` to reflect the queued phases; Phases 1–4 remain shipped.
