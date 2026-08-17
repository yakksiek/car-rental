# Canonical screenshots — staff-search-dashboard-only

**Status: outstanding.** This folder is the destination for the `v2-` export described in
`../design-export-request.md`. Rendering to PNG cannot be driven through `DesignSync`
(it reads and writes files only), so the export is run by hand in the Design app.

Expected set — 6 desktop at 1440×900, 4 mobile at 390×844:

```
v2-desktop-01-pulpit-entry.png     v2-mobile-01-pulpit-entry.png
v2-desktop-02-no-field.png         v2-mobile-02-resting.png
v2-desktop-03-resting.png          v2-mobile-03-live-results.png
v2-desktop-04-live-results.png     v2-mobile-04-no-results.png
v2-desktop-05-live-scrolled.png
v2-desktop-06-no-results.png
```

When they land:

1. Audit them against the "must appear / must NOT appear" lists at the end of
   `../design-export-request.md` — in particular that the copy is **Polish**, that no shot
   shows `Ostatnie wyszukiwania`, `Klienci`, `Zobacz wszystkie wyniki` or a tab-bar
   magnifier, and that the **Pojazdy** group has real rows in `v2-desktop-05` and
   `v2-mobile-03`.
2. Run the rendered vision-diff for every surface in `../design-contract.md`, comparing the
   real app at 1440×900 and 390×844 against these PNGs. It must come back empty apart from
   the recorded deviations (D9, D10, D16, N1–N3) and the two "Known deltas" in that
   contract.
3. Prune the 8 superseded PNGs in `../../staff-global-search/design-review/` (dated
   2026-08-10; two of them render the deleted results page). Git keeps the blobs — pruning
   only stops them being mistaken for current.

Until then, plan row **4.6** stays unchecked and the audit verdict in `../design-contract.md`
remains BLOCKED on this input. Implementation is not blocked: every value in the contract is
transcribed from the code-backed JSX, not measured off a screenshot.
