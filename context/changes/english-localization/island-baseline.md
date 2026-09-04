# Island chunk baseline — before any catalog string reaches a browser bundle

Phase 5 compares against this file (criterion 5.13). Without it, "island chunks have not grown
materially" has nothing to measure against and passes whatever happens — which is exactly how a
composed-map leak would reach production unnoticed.

## Provenance

|             |                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------ |
| Measured    | 2026-09-02                                                                                       |
| Base commit | `f8e4a8e` (the commit this branch was on; the measured tree is Phase 1's working tree)           |
| Command     | `npm run build`, then per-file `stat -f%z` and `gzip -c \| wc -c` over `dist/client/_astro/*.js` |
| Astro       | v6.3.1                                                                                           |
| Node        | v24.11.1                                                                                         |

**Why the Phase 1 working tree still counts as "before any catalog string lands."** Phase 1 does
create three namespaces (`i18n/api.ts`, `i18n/config.ts`, `i18n/layout.ts`) and the composed map
(`i18n/index.ts`), but **nothing an island imports reaches any of them**. The only consumers are
`src/middleware.ts`, `src/layouts/Layout.astro`, `src/lib/config-status.ts` and
`src/pages/api/locale.ts` — all server-only, none in a `client:*` graph. Confirmed by the numbers
below: `format.Bmk3_PAM.js` (the shared chunk behind `src/lib/format.ts`, imported by 11 islands) is
still **1 406 B raw / 816 B gzip**, i.e. the pure numeric module it was.

## The watch list

The islands the plan names, being the ones that import `src/lib/format.ts` or `src/lib/staff-format.ts`
and are therefore most exposed if the accessor boundary leaks. Sizes are the emitted chunk only — not
its shared dependencies.

| chunk                             |   raw B |  gzip B |
| --------------------------------- | ------: | ------: |
| `BookingWidget.BAiucmB0.js`       |   7 857 |   2 787 |
| `FleetList.DWzYrgUi.js`           |  10 876 |   3 778 |
| `GlobalSearch.zbkmywOc.js`        |  28 312 |   9 768 |
| `HeroSearch.CAJXXtly.js`          |   3 777 |   1 578 |
| `PendingQueue.4-m3RpyJ.js`        |  19 363 |   5 560 |
| `ReservationCalendar.ChO37D6k.js` | 338 251 | 107 175 |
| `ReservationForm.CNU2etlu.js`     |  15 083 |   4 450 |
| `StaffList.gHS8Rj7i.js`           |  24 550 |   7 172 |
| `VehicleForm.3PDyPRHV.js`         |  11 742 |   4 285 |

**Four of the named islands have no chunk of their own** — Rollup folded them into the entry that
renders them, so measure the parent instead: `NeedDecisionPanel` and `ManualReservationModal` →
`PendingQueue` / `QuickAddButton`; `SearchRows` → `GlobalSearch`; `ManualReservationCalendar` →
`ReservationCalendar`.

**The sharpest single signal is not an island at all**: `format.Bmk3_PAM.js` at **1 406 B / 816 B**.
It is the shared module 11 islands pull in, so if anything in `src/lib` starts reaching the composed
map, this is the chunk that moves first and it moves for every one of them at once.

## Full `dist/client/_astro/*.js` inventory

Kept whole so a Phase 5 comparison can tell "this island grew" from "the shared chunk it depends on
grew", and so a chunk that appears or disappears is visible.

```
chunk                                                             raw B    gzip B
BookingWidget.BAiucmB0.js                                          7857      2787
ChangePasswordForm.CYBCBpom.js                                     2229       990
ClientRouter.astro_astro_type_script_index_0_lang.Dteb_nDv.js      3973      1776
DeliveryBadge.BFqE7lD9.js                                          1388       809
DispatchBoard.CRhibSKb.js                                         17335      5378
FilterBar.Dxf-cx2j.js                                              7563      2580
FleetList.DWzYrgUi.js                                             10876      3778
FleetTypeScroll.D6MwojKk.js                                        3645      1546
ForgotPasswordForm.DDA62P2i.js                                     1624       929
FormField.Gr8H2asW.js                                              1439       756
GlobalSearch.zbkmywOc.js                                          28312      9768
HeaderContactToggle.B4Jp1zOZ.js                                    2238      1074
HeroSearch.CAJXXtly.js                                             3777      1578
MobileNav.CkfommNH.js                                              5472      2200
PendingQueue.4-m3RpyJ.js                                          19363      5560
PickupQueue.CW0RfGJJ.js                                            3562      1603
ProtocolForm.Cn8mJ4iw.js                                          12380      4859
ProtocolView.BiyoUnrf.js                                          12328      3639
QuickAddButton.BuNCA6EL.js                                        30206      9554
QuickAddButton.Bz-VfGLo.js                                          362       266
ReservationCalendar.ChO37D6k.js                                  338251    107175
ReservationDecision.DnRyN4I1.js                                    7673      2792
ReservationForm.CNU2etlu.js                                       15083      4450
ResetPasswordForm.rFym0bUt.js                                      2175      1127
ReturnProtocolForm.DU77e_Qd.js                                    17902      6138
ReturnQueue.DxcFUDxX.js                                            9713      3134
ServerError.BcjLX2lc.js                                            1485       810
SignInForm.CzqzoWJ-.js                                             3849      1711
SignOutButton.ByUwcnzO.js                                           502       396
StaffList.gHS8Rj7i.js                                             24550      7172
SubmitButton.DNFNy44o.js                                            770       468
VehicleForm.3PDyPRHV.js                                           11742      4285
VehicleGallery.CFnP-WQH.js                                         3340      1324
arrow-down.BP18RMjr.js                                              229       220
arrow-left.DUcuo083.js                                              229       226
arrow-right.DQD3oKqQ.js                                             229       220
badge.ZkkDlxlr.js                                                  1459       712
button.BsvmPIGK.js                                                 2342      1110
calendar.CCPzYGvi.js                                              53434     16469
calendar.CStuJuVc.js                                                321       259
catalog-filters.Dtgw6l6v.js                                        2324      1060
check.ZIAN7EVq.js                                                   183       192
checkbox.BqPuDOtQ.js                                               1016       541
chevron-down.n2S-jcft.js                                            192       199
chevron-left.CdLzJ5LG.js                                            194       206
chevron-right.BnUpM0QC.js                                           194       202
client.BgaXXmFo.js                                               182343     57466
createLucideIcon.8dySzDKd.js                                       1431       828
date-iso.DkScj-7J.js                                              28481      7920
format.Bmk3_PAM.js                                                 1406       816
heic2any.MkzNu3Wi.js                                            1352951    341449
index.B83kc8uK.js                                                   426       322
index.BNdofa_d.js                                                  4763      1737
index.D2JZsrLv.js                                                  5883      2487
index.Dabko54n.js                                                   279       213
index.Dl3pL0im.js                                                   113       127
index.DoxAox2i.js                                                 47496     17417
index.Drp7ozNU.js                                                  3706      1416
index.DwtfnXpH.js                                                 20475      7287
index.MHsFi0H0.js                                                  8188      3182
index._uZv87_9.js                                                  3455      1549
index.gUR1xOZ8.js                                                  5262      2024
index.s2s-SrKS.js                                                  2420      1154
jsx-runtime.DXco-PnT.js                                             531       350
label.Byxm-I-4.js                                                  1271       630
mail.oXrIYMx5.js                                                    277       252
phone.DZJcYTOS.js                                                   386       285
plus.CM2ZL2y6.js                                                    217       201
popover.BkWxsEbs.js                                                1131       546
reservation-schema.DC5700Tj.js                                     1393       799
return-form.CcIRuGY3.js                                            1481       907
returns-filter.cuBa01E2.js                                          445       304
router.cwrQGGhT.js                                                12070      4262
schemas.C33JEILZ.js                                               67840     18234
search.BAUgE9bZ.js                                                  233       218
select.DHqq8xzt.js                                                 3938      1473
shield-check.D6NiIw5M.js                                            384       312
triangle-alert.C5PuDn_T.js                                          329       275
truck.BwZ-xflk.js                                                   465       319
tslib.es6.DUVHAbQF.js                                              1588       767
useProtocolMedia.CtKlyqF8.js                                    1497689    621029
useResendEmail.D_vTncAw.js                                          521       379
useReturnProtocolSubmit.B0IZS6nb.js                                1340       651
utils.DZz9tWqn.js                                                 26745      8438
vehicle-schema.B8OJIStW.js                                         1909       986
x.DEYTYYYc.js                                                       218       202
```

## How to re-measure

Content hashes in the filenames change on every rebuild, so compare by the **name before the hash**,
not the whole filename:

```bash
npm run build
for f in dist/client/_astro/*.js; do
  printf "%s\t%s\t%s\n" "$(basename "$f")" "$(stat -f%z "$f")" "$(gzip -c "$f" | wc -c | tr -d ' ')"
done | sort
```

A jump on a **public-site** island (`HeroSearch`, `FleetList`, `BookingWidget`) — or any movement at
all in `format.*.js` — means something reached the composed map. Find it before shipping, per the
accessor boundary in `src/lib/i18n/types.ts`.

---

## Interim reading — end of Phase 4 (2026-09-02)

Not a new baseline; the table above stays the reference. Recorded here because Phase 4 is the first
phase to put catalog strings into browser bundles, so this is the first chance the boundary rule had
to fail — and criterion 5.13 should arrive at a comparison that is already explained.

Same command, same tooling, `dist/client/_astro/*.js` after `npm run build`.

| chunk                 | baseline raw | now raw |    Δ raw | baseline gzip | now gzip |   Δ gzip |
| --------------------- | -----------: | ------: | -------: | ------------: | -------: | -------: |
| `format`              |        1 406 |   1 099 | **−307** |           816 |      605 | **−211** |
| `BookingWidget`       |        7 857 |   7 813 |      −44 |         2 787 |    2 758 |      −29 |
| `FleetList`           |       10 876 |  10 930 |      +54 |         3 778 |    3 790 |      +12 |
| `GlobalSearch`        |       28 312 |  29 451 |   +1 139 |         9 768 |   10 152 |     +384 |
| `HeroSearch`          |        3 777 |   3 836 |      +59 |         1 578 |    1 592 |      +14 |
| `PendingQueue`        |       19 363 |  17 252 |   −2 111 |         5 560 |    4 787 |     −773 |
| `ReservationCalendar` |      338 251 | 337 900 |     −351 |       107 175 |  107 022 |     −153 |
| `ReservationForm`     |       15 083 |  14 906 |     −177 |         4 450 |    4 393 |      −57 |
| `StaffList`           |       24 550 |  24 618 |      +68 |         7 172 |    7 209 |      +37 |
| `VehicleForm`         |       11 742 |  11 717 |      −25 |         4 285 |    4 268 |      −17 |

**`format` went DOWN, and that is the load-bearing number.** It is the chunk 11 islands share, so a
composed-map leak moves it first and moves it for all of them at once. Instead it shrank by 211 B
gzip: the five Polish enum dictionaries left `src/lib/format.ts` for
`src/lib/i18n/{vehicle,reservation}.ts`, which the callers now import per-domain. Every island that
went down did so for the same reason — they were carrying `format`'s Polish vocabulary and no longer
are.

Two islands grew, both for the string they were supposed to gain:

- **`GlobalSearch` +384 B gzip** — the `search` namespace (19 keys × 2 locales), which `SearchRows`
  is folded into. This is the whole of it.
- **`FleetList` / `StaffList` +12 / +37 B gzip** — the `vehicle` and `staff` namespaces reaching them
  through shared chunks. Noise.

### One measured near-miss, fixed before it shipped

`HeroSearch` first came in at **7 285 B / 2 972 B — +3 508 raw / +1 394 gzip, nearly double**, which
is exactly the shape criterion 5.13 is looking for. It was not a composed-map leak: the island had
imported the `landing` namespace for six search-bar labels, and `landing` is ~35 keys of marketing
prose the rest of the page renders server-side. Moving those six keys into `i18n/vehicle.ts` — which
the island already imported for `categoryLabel` — brought it to **+59 raw / +14 gzip**.

Worth recording because it is the failure mode the rule does NOT name: the accessor boundary in
`i18n/types.ts` says "do not reach the composed map", and this obeyed it perfectly while still
shipping a locale's worth of prose to a browser. The rule that catches it is the narrower one — an
island imports the SMALLEST namespace that covers it, and a namespace an island touches must not
accumulate server-only copy.

---

## Phase 5 comparison (2026-09-04) — criterion 5.13

The gate this file exists for. Same command, same tooling, `dist/client/_astro/*.js`
after `npm run build`, on top of `d146e49`. Phase 5 is the phase that put copy into
every remaining island, so it is the one with something to prove.

| chunk                 | baseline raw | now raw |    Δ raw | baseline gzip | now gzip |     Δ gzip |
| --------------------- | -----------: | ------: | -------: | ------------: | -------: | ---------: |
| `format`              |        1 406 |   1 099 | **−307** |           816 |      605 |   **−211** |
| `BookingWidget`       |        7 857 |   7 290 |     −567 |         2 787 |    2 573 |       −214 |
| `FleetList`           |       10 876 |  10 554 |     −322 |         3 778 |    3 465 |       −313 |
| `GlobalSearch`        |       28 312 |  29 354 |   +1 042 |         9 768 |   10 109 |       +341 |
| `HeroSearch`          |        3 777 |   3 838 |      +61 |         1 578 |    1 568 |        −10 |
| `PendingQueue`        |       19 363 |  16 586 |   −2 777 |         5 560 |    4 336 |     −1 224 |
| `ReservationCalendar` |      338 251 | 338 130 |     −121 |       107 175 |  107 056 |       −119 |
| `ReservationForm`     |       15 083 |  14 414 |     −669 |         4 450 |    3 989 |       −461 |
| `StaffList`           |       24 550 |  28 771 |   +4 221 |         7 172 |    8 470 | **+1 298** |
| `VehicleForm`         |       11 742 |  11 222 |     −520 |         4 285 |    3 920 |       −365 |

**`format` is flat at 1 099 / 605 — unchanged from the Phase 4 interim reading.**
That is the load-bearing number: it is the chunk 11 islands share, so a
composed-map leak moves it first and moves it for all of them at once. It did not
move, and no island's `COPY` object was replaced by something bigger than itself.

**Seven of the ten went DOWN**, which is the shape to expect: each island's
module-level `COPY` literal left the island's own chunk for a shared namespace
chunk that its siblings also use. `PendingQueue` (−1 224 B gzip) is the clearest
case — its ~45-key `COPY` map moved into `dashboard`, which `ReturnQueue`,
`PickupQueue`, `ReservationCalendar` and `ManualReservationModal` now share.

### The namespace chunks Rollup emitted

Per-domain namespacing is doing exactly what it was designed to do — each
namespace is its own shared chunk, and an island pays only for the ones it imports:

```
booking       6 184 / 2 489    protocol     10 300 / 3 647
dashboard    12 493 / 4 300    reservation     614 /   375
fleet         2 890 / 1 327    search          233 /   218
fleet-admin   3 781 / 1 646    staff         3 057 / 1 383
format-date   1 867 /   813    types           228 /   199
nav             605 /   374    validation    2 937 / 1 267
                               vehicle       1 441 /   703
```

`staff-admin` and `auth` have no chunk of their own — Rollup folded each into its
single consumer (`StaffList`, the auth forms).

### The one island that grew, and why it is the right growth

**`StaffList` +1 276 B gzip.** It is the sole consumer of `staff-admin` (≈60 keys ×
2 locales), so Rollup inlined the namespace rather than emitting a shared chunk —
the +1 276 B _is_ that namespace. Nothing else reaches it, so there is no
amortisation to be had and no smaller namespace to move to: every key is roster
chrome the roster renders. `GlobalSearch` +336 B gzip is the same story one size
down (the `search` namespace plus `dashboard` arriving through `SearchRows`).

### The leak check, run explicitly

The six SERVER-ONLY namespaces must never appear in a client chunk — they are the
proof that no island reached the composed `i18n/index.ts`:

```bash
for ns in api config info landing layout footer; do ls dist/client/_astro/$ns.*.js; done
#   → all six absent

grep -rl "noticePrefix\|pricingHeading\|storyHeading" dist/client/_astro/*.js
#   → no match: not one line of server-only copy is in any client chunk
```

`info` alone is ~90 keys of marketing prose in two languages. Its absence from
every browser bundle is the boundary rule holding under the phase that stressed it
hardest.
