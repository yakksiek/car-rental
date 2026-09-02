# Design Contract — English Localization

Source of truth: Claude Design project `Rental car company`
(`352d78a6-84fd-49a2-8b38-2fe289691fc3`), pulled live via `DesignSync` on 2026-09-01.
Files read: `info-pages.jsx`, `shared.jsx`, `staff-desktop.jsx`, `nav-spec.jsx`, `design-review/index.md`.

Every line below is marked `exact` (transcribed from the design JSX) or `deviation(reason)`.

---

## Design Alignment Audit

### 1. Freshness — repo designs vs the live source

Audited the **source**, not the repo's screenshot cache (the cache is an export, so auditing it would
measure the wrong thing).

| Artifact                                              | Status               | Note                                                                                                                 |
| ----------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `design-review/index.md` — canonical screenshot index | **missing (header)** | Carries no header/nav row at all. The redesigned `InfoHeader` is **not in the reviewed set**.                        |
| `design-system.md` rows 27–29 (`info-pages.jsx`)      | current              | Cennik / FAQ / O nas. Same file that owns `InfoHeader`, so the header ships with them.                               |
| `design-system.md` row 20 (`staff-desktop.jsx`)       | current, but see §3  | Re-exported 2026-07-28 from `staff-pulpit-dispatch`. Its `StaffTopbar` already contains a `LangToggle`.              |
| `context/foundation/design/screenshots/*.png`         | n/a for this change  | No header-focused screenshot exists in the repo; nothing to supersede.                                               |
| `LangToggle` / `ActionMenu` geometry                  | **now pulled**       | Both live in `shared.jsx`, not `info-pages.jsx`. Transcribed below — previously unpulled, so previously unspecified. |

### 2. Quality — gaps in the design itself

| #   | Gap                                                                                                                                                                                                                                                                                                             | Severity         | Disposition                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | **`INFO_NAV` read `['fleet', 'Fleet']`** — English inside an otherwise-Polish nav (`Start`, `Cennik`, `FAQ`, `O nas`). Confirmed live defect.                                                                                                                                                                   | High             | ✅ **FIXED in the design source 2026-09-01** — now `['fleet', 'Flota']`.                                       |
| 2   | **`StaffTopbar` placed `LangToggle` in the band** — see §3. The shipped band has no room for it.                                                                                                                                                                                                                | High             | ✅ **FIXED in the design source 2026-09-01** — moved to a new `SidebarLangRow` in the sidebar `mt-auto` block. |
| 3   | `ActionMenu`'s trigger `aria-label` is `t.browseFleet` ("Browse the fleet"), but the menu it opens is Call · Reserve.                                                                                                                                                                                           | Medium           | Fix in our implementation; note upstream.                                                                      |
| 4   | `LangToggle` has **no open/dropdown state** — it renders a caret but click toggles EN⇄PL directly. The caret promises a menu that never appears.                                                                                                                                                                | Medium           | ✅ **RESOLVED in the app 2026-09-02** — caret removed, toggle kept. See below.                                 |
| 5   | No **focus-visible** or **hover** state specified for `LangToggle` or `ActionMenu`.                                                                                                                                                                                                                             | Medium           | We author both; not a blocker.                                                                                 |
| 6   | No **mobile** staff design at all — the design has no `StaffShell` mobile locale control.                                                                                                                                                                                                                       | Medium           | `deviation` recorded below (account-screen row).                                                               |
| 7   | `STR.EN` / `STR.PL` each declare **`fullName` AND `emailAddr` twice** (confirmed by esbuild `duplicate-object-key` warnings at `shared.jsx:358/384` and `764/790`). Harmless in JS (last wins) but signals an unaudited dictionary.                                                                             | Low              | Note only.                                                                                                     |
| 8   | No **pending/in-flight** state for the toggle — the design is a client-side mock; ours posts to the server.                                                                                                                                                                                                     | Low              | `deviation` recorded below.                                                                                    |
| 9   | **The staff sidebar nav is not bilingual.** `staff-desktop.jsx`'s `nav` array hardcodes `Pulpit`/`Wnioski`/`Wydania`/`Zwroty`/`Kalendarz`/`Flota`, and the `Operacje` section header likewise — so they stay Polish under EN. Same defect class as item 1, found by **rendering** the board, not by reading it. | High for Phase 4 | Not fixed — see below.                                                                                         |

### 3. Alignment — plan vs design

| Canonical surface               | Plan phase | Verdict                                                                                                                                                                                                        |
| ------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InfoHeader` (public, desktop)  | Phase 3    | aligned — container-query reflow adopted as designed                                                                                                                                                           |
| `InfoHeaderMobile`              | Phase 3    | aligned — reduces to `LangToggle` + `ActionMenu`                                                                                                                                                               |
| `LangToggle`                    | Phase 3    | aligned, 3 deviations recorded                                                                                                                                                                                 |
| `ActionMenu`                    | Phase 3    | aligned — replaces `HeaderContactToggle`, **and fixes a live tablet bug** (see below)                                                                                                                          |
| `PublicDock` (mobile nav)       | Phase 3    | aligned — `nav-spec.jsx` scroll spec transcribed below                                                                                                                                                         |
| `LandingNav` desktop pill       | Phase 3    | **DIVERGENT — no collapse exists.** Phone absent 1024–1279 today; adding `LangToggle` widens that to 1024–1326 unless the design's `ActionMenu` collapse is ported to the landing fork. See `known-issues.md`. |
| `StaffShell` sidebar locale row | Phase 3    | **DIVERGENT — design must change.** See below.                                                                                                                                                                 |
| `/dashboard/account` locale row | Phase 3    | **no design exists** — `deviation(no source)`                                                                                                                                                                  |

**The staff divergence, stated precisely.** `staff-desktop.jsx` `StaffTopbar` renders its right
cluster as `SearchField(520) → LangToggle → calendar button(38) → QuickAddButton`, gap 12. At the
design's board width that fits. In the shipped app it cannot: `StaffShell.astro:272-275` documents
that at 768px the 520px `GlobalSearch` field plus the 92px `QuickAddButton` already consume **624px
of 632px usable**. Adding a ~75px `LangToggle` overflows by ~67px before the title gets any space.

Resolution (owner's call, 2026-09-01): **move `LangToggle` in the design** from `StaffTopbar` into
the sidebar's `marginTop: 'auto'` block, above the user chip — the one part of the staff chrome with
slack.

**Done 2026-09-01.** `staff-desktop.jsx` now defines `SidebarLangRow` (rendered as the first child of
the `marginTop: 'auto'` block, `marginBottom: 8` above the user chip) and `StaffTopbar`'s right
cluster is back to `SearchField → calendar → QuickAddButton`, with a comment recording why the
switcher is not there. The design and the app now agree.

### 4. Gate verdict

**BLOCKED (1 of 3 items outstanding)** — 7 surfaces audited, 0 repo designs superseded, 6 deviations
recorded.

- ✅ §2 item 1 — `INFO_NAV` `'Fleet'` → `'Flota'` — **fixed in the design source 2026-09-01**
- ✅ §2 item 2 — `LangToggle` moved out of `StaffTopbar` into `SidebarLangRow` — **fixed 2026-09-01**
- ✅ **Canonical screenshots captured and both edits rendered** — 2026-09-01, into
  `context/changes/english-localization/design-review/` (14 PNGs, 2× DPI). See §5.

**Verdict: PASS** — 8 surfaces audited, 0 repo designs superseded, 6 deviations recorded, 2 blocking
defects fixed and verified by render.

Two findings arrived _after_ the initial verdict and neither reopens the gate, because each is a
**recorded divergence with a defined resolution** rather than a missing design:

- **§2 item 9** — the staff sidebar nav is hardcoded Polish. Found by rendering. Owned by Phase 4
  (it adds app-authored strings); blocks nothing in Phase 3.
- **`LandingNav` desktop pill** — no collapse mechanism, so the phone is absent 1024–1279 today and
  adding `LangToggle` would widen that to 1024–1326. Owned by Phase 3, whose `LandingNav` contract
  now requires porting the design's `ActionMenu` collapse to the landing fork. The gate stays PASS
  because the design **does** specify the collapse — it was simply never applied to this fork.

### 5. Render verification (2026-09-01)

Rendered locally with a purpose-built harness rather than the project's `export-shot.html`: that
harness loads **18** JSX files and registers no info-pages screen, while `info-pages.jsx` needs only
`shared.jsx`. JSX was transformed with esbuild (not Babel-in-browser) and loaded as classic scripts,
preserving the cross-file global scoping the design files rely on. Fonts: the **app's own
self-hosted variable Inter** (`.astro/fonts/font-inter-400-700-normal-latin*.woff2`), latin +
latin-ext — never the Google CDN's static instances, which snap the 540/650/750 weights this design
leans on. Zero page errors in either board.

**Public header — measured, not eyeballed.** Container queries fire exactly as specified:

| Container width | Bar padding | Nav pill padding | Phone      | CTA        | ActionMenu | LangToggle | Overflow |
| --------------- | ----------- | ---------------- | ---------- | ---------- | ---------- | ---------- | -------- |
| 1280            | 48px        | 18px             | shown      | shown      | hidden     | 75×38      | none     |
| 1180            | **28px**    | 18px             | shown      | shown      | hidden     | 75×38      | none     |
| 980             | 28px        | 18px             | **hidden** | **hidden** | **shown**  | 75×38      | none     |
| 840             | 28px        | **13px**         | hidden     | hidden     | shown      | 75×38      | none     |
| 768             | 28px        | 13px             | hidden     | hidden     | shown      | 75×38      | none     |

`LangToggle` measures **75×38px** at every width — matching this contract's computed 75px estimate
and its `exact` 38px height, and confirming the frame's header-slack arithmetic. Nav labels render
`["Start", "Flota", "Cennik", "FAQ", "O nas"]` — item 1 fixed and visually confirmed.

**Staff sidebar — measured.** One language control on the whole board; **1 in the sidebar, 0 in the
topbar**, which is the item-2 fix confirmed structurally. Row geometry: padding `9px 10px`, radius
`10px`, gap `10px`, font `13px/540`, width **211px** (240 sidebar − 2×14 padding), height 36px; chip
23×18px. It is the **first child** of the `marginTop:auto` block (resolved to 446px), i.e. above the
user chip. The endonym flips `Polski/PL` ⇄ `English/EN`, and the chip lands in the same right-hand
column as the nav badges (`4`, `2`, `PL`) — the visual rationale for keeping it.

**Live bug the port fixes (verified 2026-09-01, dev, Playwright).** `HeaderContactToggle`'s phone
mode expands 183px → 227px, and `SiteHeader.astro:41` has no `gap`/`min-w-0`/`truncate` and no
`whitespace-nowrap` on the nav links — so at **768–790px and 840px** the nav pill's "O nas" wraps to
two lines and the header grows 86px → 108px, while `Zarezerwuj` collapses to an unlabelled icon.
`LandingNav`'s tablet band is immune: it is static (two direct links, 4-item nav, measured 182×49
across 768–1023). The design's `ActionMenu` — a fixed 40px popover trigger — cannot reproduce it, so
Phase 3 removes the failure by construction. Evidence: `bug-siteheader-768-phonemode.png`.

**Caveat, stated plainly.** The staff _topbar_ is **not** a canonical render: `SearchField` and
`QuickAddButton` live in design files not pulled locally and were **stubbed**. Only the sidebar — the
region that changed — is faithful. The topbar claim ("no language control") is a DOM assertion, not a
picture.

Phases 1, 2 and 4–7 are **not** blocked by any of this — only Phase 3 touches chrome geometry.

---

## Token map

| Design value                         | App token            | Note                                                                                                         |
| ------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `tokens.card` `#FFFFFF`              | `--card` / `bg-card` | exact                                                                                                        |
| `tokens.ink` `#0F172A`               | `--foreground`       | exact                                                                                                        |
| `tokens.ink2` `#334155`              | `--flota-ink-2`      | exact                                                                                                        |
| `tokens.muted` `#94A3B8`             | `--muted-foreground` | exact                                                                                                        |
| `tokens.hair` `rgba(15,23,42,0.08)`  | `--flota-hair`       | exact                                                                                                        |
| `tokens.hair2` `rgba(15,23,42,0.05)` | `--flota-hair-2`     | exact                                                                                                        |
| `tokens.accent` `#B43638`            | `--primary`          | exact                                                                                                        |
| `tokens.greySoft` `#EEF1F5`          | `--flota-grey-soft`  | exact                                                                                                        |
| `tokens.bg` `#F1F3F6`                | `--background`       | exact                                                                                                        |
| `INKD` `#141B2D`                     | `--flota-ink-deep`   | exact — CTA/dark panel ground                                                                                |
| `#F1F3F7` (nav pill track)           | `--background`       | `deviation(1-digit drift)` — design uses `#F1F3F7` for the pill track vs `#F1F3F6` app bg; use the app token |

---

## `LangToggle` — exact spec

Source: `shared.jsx` → `function LangToggle({ tone = 'light' })`.

| Property        | Value (light)                                              | Value (dark)                       | Mark                          |
| --------------- | ---------------------------------------------------------- | ---------------------------------- | ----------------------------- |
| display         | `inline-flex`, `align-items:center`                        | same                               | exact                         |
| gap             | `6px`                                                      | same                               | exact                         |
| height          | `38px`                                                     | same                               | exact                         |
| padding         | `0 10px`                                                   | same                               | exact                         |
| border-radius   | `999px`                                                    | same                               | exact                         |
| border          | `1px solid rgba(15,23,42,0.08)`                            | `1px solid rgba(255,255,255,0.22)` | exact                         |
| background      | `#FFFFFF`                                                  | `rgba(255,255,255,0.14)`           | exact                         |
| backdrop-filter | none                                                       | `blur(6px)`                        | exact                         |
| flex-shrink     | `0`                                                        | same                               | exact                         |
| globe icon      | `15×15`, stroke `#0F172A`, width `1.8`, round caps/joins   | stroke `#fff`                      | exact                         |
| label           | `12.5px / 700 / letter-spacing 0.3` color `#0F172A`        | color `#fff`                       | exact                         |
| label text      | `EN` / `PL` — uppercase 2-letter code                      | same                               | exact                         |
| caret icon      | ~~`10×10`, stroke width `2.4`, `opacity 0.6`~~ **removed** | ~~stroke `#fff`~~                  | `deviation(false affordance)` |
| aria-label      | `"Change language"`                                        | same                               | exact                         |

Globe path: `<circle cx=12 cy=12 r=9/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>` — `exact`.
Caret path: `M6 9l6 6 6-6` — `exact`.

Computed width ≈ **75px** (10 + 15 + 6 + ~18 + 6 + 10 + 10). Consistent with the frame's 76–84px
estimate for header-slack math.

**Deviations:**

- `deviation(caret removed — false affordance)` — the design renders a caret but its click handler
  toggles EN⇄PL directly, which §2 item 4 already flags as a confirmed defect. The plan-time call was
  to keep the caret for visual parity with the mockup; **overturned by the owner 2026-09-02** on
  review of the live page. With two locales a dropdown is strictly worse — two interactions instead
  of one, and it could not open without JavaScript, which would cost this control the property that
  makes it work before hydration. So the false affordance goes and the toggle stays. This is also the
  internally-consistent half of the design: `SidebarLangRow`, the design's own staff-side language
  control, draws no caret. Revisit only if a THIRD locale lands — that is what actually turns a toggle
  into a menu. Consequence: the pill measures **61×38** rather than 77×38, which is why the landing
  collapse threshold below is 1208px and not 1240px. `ActionMenu` KEEPS its caret, because that one
  really does open a panel — so a caret in this header now means "opens something", consistently.
- `deviation(server round-trip)` — the design mutates `window.__flotaLang`. Ours is a `<form method="POST">`
  to `/api/locale`, so it works without JS and avoids a client cookie write that would desync SSR
  markup. Adds a pending state (project async-button rule) the design has no equivalent for.
- `deviation(no focus state in source)` — we add `focus-visible` per project a11y practice.

---

## `ActionMenu` — exact spec

Source: `shared.jsx` → `function ActionMenu({ tone = 'light', phone = '+48 22 100 20 30' })`.
Replaces `HeaderContactToggle.tsx` (deleted, not extended).

**Trigger:**

| Property        | Value (light)                                                                                | Value (dark)             | Mark  |
| --------------- | -------------------------------------------------------------------------------------------- | ------------------------ | ----- |
| height          | `40px`                                                                                       | same                     | exact |
| padding         | `0 14px`                                                                                     | same                     | exact |
| gap             | `7px`                                                                                        | same                     | exact |
| border-radius   | `999px`                                                                                      | same                     | exact |
| border          | `none`                                                                                       | same                     | exact |
| background      | `#0F172A` (`tokens.ink`)                                                                     | `rgba(255,255,255,0.15)` | exact |
| color           | `#fff`                                                                                       | same                     | exact |
| backdrop-filter | none                                                                                         | `blur(6px)`              | exact |
| calendar icon   | `17px`, `#fff`                                                                               | same                     | exact |
| caret           | `11×11`, stroke width `2.4`, `#fff`; `rotate(180deg)` when open, `transition: transform .2s` | same                     | exact |

**Panel:**

| Property      | Value                                  | Mark  |
| ------------- | -------------------------------------- | ----- |
| position      | `absolute`, `top: 48px`, `right: 0`    | exact |
| z-index       | `60`                                   | exact |
| min-width     | `216px`                                | exact |
| background    | `#FFFFFF`                              | exact |
| border-radius | `14px`                                 | exact |
| border        | `1px solid rgba(15,23,42,0.08)`        | exact |
| box-shadow    | `0 16px 40px -8px rgba(14,21,36,0.30)` | exact |
| overflow      | `hidden`                               | exact |

**Rows** (2): `padding: 13px 15px`, `gap: 11px`. Icon chip `34×34`, `border-radius: 9px`.
Row 1 chip background `#EEF1F5` (`greySoft`), icon `phone` `16px` `#334155`.
Row 2 chip background `#0F172A` (`ink`), icon `calendar` `16px` `#fff`, plus
`border-top: 1px solid rgba(15,23,42,0.05)`.
Row label: `13.5px / 650 / letter-spacing -0.15`, color `#0F172A`.
Row 1 sub-label (the phone number): `12px`, color `#94A3B8`, `margin-top: 1px`.
All `exact`.

Row 1 is an `<a href="tel:...">` with whitespace stripped from the number — `exact`.

**Deviations:**

- `deviation(aria-label defect)` — the design's trigger uses `aria-label={t.browseFleet}`. We use a
  label naming the menu's actual purpose (contact / booking options), since the menu is Call ·
  Reserve, not fleet browsing.
- `deviation(no keyboard spec)` — we build on `ui/popover.tsx` (already used for header chrome at
  `QuickAddButton.tsx:205`), which supplies focus trapping and Escape-to-close the design omits.

---

## `InfoHeader` — exact spec

Source: `info-pages.jsx` → `function InfoHeader({ active })`.

**Outer:** `width: 100%`, `container-type: inline-size` — `exact`. This is the container-query root;
the app's current viewport breakpoints (`md:` / `lg:` / `min-[840px]:`) are **replaced**, per the
project's own embeddable-panels lesson.

**Bar:** `display:flex`, `align-items:center`, `justify-content:space-between`, `gap: 20px`,
`padding: 18px 48px`, `border-bottom: 1px solid rgba(15,23,42,0.05)`, `background: #FFFFFF` — `exact`.

**Brand cluster:** `gap: 6px`, `flex-shrink: 0`; mark `40px`; wordmark
`20px / 700 / letter-spacing -0.4 / #0E1524` — `exact`.
Brand text is **`Flota`** and **never translates** (frame decision 5) — `exact`.

**Nav pill track:** `gap: 2px`, `padding: 5px 6px`, `background: #F1F3F7`, `border-radius: 999px`,
`flex-shrink: 0` — `exact`.

**Nav item:** `padding: 9px 18px`, `border-radius: 999px`, `font-size: 14.5px`,
`white-space: nowrap` — `exact`.

- Active: `background: #fff`, `box-shadow: 0 2px 6px rgba(14,21,36,0.15)`, `color: #0E1524`, `font-weight: 650`
- Inactive: `background: transparent`, no shadow, `color: #5A6373`, `font-weight: 500`

**Right cluster:** `gap: 12px`, `flex-shrink: 0`, order: `LangToggle → .info-phone → .info-cta → .info-toggle` — `exact`.

**`.info-phone`:** `gap: 8px`, `white-space: nowrap`; icon `phone 16px` in `--primary`; number
`14.5px / 700 / #0E1524` — `exact`.

**`.info-cta`:** `height: 44px`, `padding: 0 22px`, `background: #141B2D`, `border-radius: 999px`,
`color: #fff`, `14.5px / 600`, `white-space: nowrap`, `flex-shrink: 0` — `exact`.

**Reflow (container queries):** — all `exact`

```css
@container (max-width:1180px) {
  .info-header {
    padding-left: 28px;
    padding-right: 28px;
  }
}
@container (max-width:980px) {
  .info-phone {
    display: none;
  }
  .info-cta {
    display: none;
  }
  .info-toggle {
    display: inline-flex;
  }
}
@container (max-width:840px) {
  .info-nav-pill {
    padding-left: 13px;
    padding-right: 13px;
  }
}
.info-toggle {
  display: none;
} /* default */
```

`LangToggle` is visible at **every** width — `exact`.

**`InfoHeaderMobile`:** `padding: 14px 18px`, `border-bottom: 1px solid rgba(15,23,42,0.05)`,
`background: #fff`; brand `gap: 5px`, mark `34px`, wordmark `18px / 700 / -0.4`; right cluster
`gap: 8px` holding `LangToggle` + `ActionMenu` — `exact`.

---

## Verbatim nav copy

`INFO_NAV`, corrected. The **item** translates; the **brand** does not.

| id      | PL (canonical) | EN        | Mark                                                 |
| ------- | -------------- | --------- | ---------------------------------------------------- |
| `home`  | `Start`        | `Home`    | exact                                                |
| `fleet` | **`Flota`**    | `Fleet`   | **corrected** — source reads `'Fleet'` in the PL nav |
| `rates` | `Cennik`       | `Pricing` | exact                                                |
| `faq`   | `FAQ`          | `FAQ`     | exact                                                |
| `about` | `O nas`        | `About`   | exact                                                |

EN values corroborated by `STR.EN` (`fleet: 'Fleet'`, `pricing: 'Pricing'`, `home: 'Home'`).

---

## Staff sidebar locale row — `deviation(design must change)`

No design exists yet; the design currently puts `LangToggle` in `StaffTopbar`, which the shipped band
cannot hold (§3). Target spec, authored to match the sidebar's **existing** row geometry from
`staff-desktop.jsx` so it reads as a sibling of the nav rows:

| Property      | Value                                                                                                            | Source                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| placement     | inside `marginTop: 'auto'` block, **above** the user chip                                                        | `staff-desktop.jsx` sidebar / `StaffShell.astro:193` |
| padding       | `9px 10px`                                                                                                       | exact — matches sidebar nav rows                     |
| border-radius | `10px`                                                                                                           | exact — matches sidebar nav rows                     |
| gap           | `10px`                                                                                                           | exact — matches sidebar nav rows                     |
| font          | `13px / 540 / letter-spacing -0.1`, color `#0F172A`                                                              | exact — matches inactive nav row                     |
| icon          | globe `16px`, `#334155` (`ink2`)                                                                                 | exact — matches nav icon size/colour                 |
| current code  | right-aligned, `10.5px / 700`, chip `min-width 18 / height 18 / radius 99 / padding 0 5px`, background `#EEF1F5` | exact — matches the nav badge geometry               |
| sidebar width | `240px`, padding `24px 14px` → 212px usable                                                                      | exact                                                |

Mobile: **no chrome control** — the tab bar is at 8 items = 360px on a 360px viewport
(`StaffShell.astro:293-299`). Locale lives as a row on `/dashboard/account`.
`deviation(no source; tab bar at capacity)`.

---

## `PublicDock` scroll behaviour

Source: `nav-spec.jsx` → `ScreenNavScrollSpec`. All `exact`.

| Rule        | Value                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Trigger     | Vertical scroll. Down → compact; up → expanded. Ignore movements `< 6px` (debounce).                                                |
| Top pinning | `scrollTop < 24px` → always expanded.                                                                                               |
| Compact     | height `40`, icons only (no label), `bottom: 14`, lighter shadow.                                                                   |
| Expanded    | height `48`, active tab shows its label, `bottom: 22`, stronger shadow.                                                             |
| Motion      | `300ms cubic-bezier(.4, 0, .2, 1)`. No width change — the bar never shifts content.                                                 |
| Position    | `fixed`, centered, `z-index: 25`. Hidden on screens with a bottom action bar.                                                       |
| A11y        | Each tab is a link/button with `aria-label`. Resize is purely visual — order and focus unchanged. Respect `prefers-reduced-motion`. |

---

## Glossary seed — `STR.EN` / `STR.PL`

**248 keys, exact parity in both halves** (verified 2026-09-01 by key diff). This is the Phase 4
glossary's harvest source, not a nice-to-have: these terms have already been through a design pass
and match the mockups.

Confirmed anchors: `brand: 'Flota'` in **both** halves (the brand never translates — corroborates
frame decision 5); `fleet: 'Fleet'`; `perDay: '/day'`; `perMonth: '/month'`; `deposit`; `pickup`;
`return`; `damages`; `signature`; `odometer`; `fuelLevel`; `pickupProtocol`; `returnProtocol`.

Namespaced sub-objects (`proto`, `vform`, `auth`, `status`, `types`) carry their own key sets and
must be harvested with the same parity check.

**Note**: `T.lang` defaults to `'EN'` and `useLang()` falls back to `STR.EN` — the design source's
own default is English, independently corroborating the plan's EN-default decision.

---

## Outstanding before Phase 3

1. ✅ ~~Fix `info-pages.jsx` `INFO_NAV`~~ — done 2026-09-01
2. ✅ ~~Move `LangToggle` in `staff-desktop.jsx` into the sidebar~~ — done 2026-09-01, as `SidebarLangRow`
3. ✅ ~~Render both edited files and capture canonical header screenshots~~ — done 2026-09-01, 14 PNGs
   in `context/changes/english-localization/design-review/`. See §5.

### Follow-ups that are NOT Phase 3 blockers

- **§2 item 9 — the staff sidebar nav is hardcoded Polish.** Consequence for the plan: the glossary
  harvest in Phase 4 will **not** cover the staff nav, so `Pulpit` / `Wnioski` / `Wydania` / `Zwroty` /
  `Kalendarz` / `Flota` / `Operacje` are app-authored strings. `STR` carries plausible existing keys
  (`workerDash`, `pending`, `pickupsLabel`, `returnsLabel`, `calendar`, `fleet`) but the design's nav
  array does not use them; mapping them is a product-copy decision, not a transcription.
- **Design-project screenshot index.** The canonical PNGs live in the repo change folder, per this
  project's own lesson. Syncing them into the design project's `design-review/` + adding a header row
  to its `index.md` is optional and was not done.

### `SidebarLangRow` as shipped to the design source

Matches the spec above, with one addition worth carrying into the app: the row label is the
**endonym of the current language** (`English` / `Polski`), not a translated string. A language row
that reads in the language you are leaving is the one row that must never depend on a translation
key. The trailing chip carries the 2-letter code and reuses the nav badge geometry, so the sidebar's
right-hand badge column stays visually consistent (`4`, `2`, `EN`).

---

## Implementation deviations — Phase 3 (2026-09-02)

Recorded so the fidelity gate converges instead of re-flagging them. Each was found while building
to the spec above; none is a licence to diverge elsewhere.

### Resolved from the design source (pulled during implementation)

`shared.jsx` was re-read for the two components' verbatim copy, which the contract above specifies
geometrically but not textually:

| Element                  | Design source                                                                                                           | Shipped                  | Mark                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `ActionMenu` row 1 label | `t.callUs \|\| 'Zadzwoń'` — **`callUs` is in neither `STR.EN` nor `STR.PL`**, so the design renders Polish under EN too | `Zadzwoń`                | exact (PL); the missing EN key is a design gap of the same class as §2 item 9, and lands with Phase 4/5 copy |
| `ActionMenu` row 2 label | `t.browseFleet`                                                                                                         | `Przeglądaj flotę`       | exact (`STR.PL.browseFleet`)                                                                                 |
| `LangToggle` aria-label  | `"Change language"`                                                                                                     | `"Change language"`      | exact — English in both halves in the source                                                                 |
| `LangToggle` caret       | `10×10` chevron, `opacity 0.6`                                                                                          | **removed**              | `deviation(false affordance)` — see the `LangToggle` deviations above; owner's call 2026-09-02               |
| `ActionMenu` aria-label  | `t.browseFleet` (§2 item 3, a confirmed defect)                                                                         | `"Kontakt i rezerwacja"` | `deviation(aria-label defect)` — names the menu's real purpose                                               |

### Values the contract maps to tokens this app does not have

| Contract line                                       | Shipped                            | Mark                                                                                                                                                                                |
| --------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens.greySoft` → `--flota-grey-soft`             | `--flota-neutral-soft` (`#eef1f5`) | `deviation(token name)` — `--flota-grey-soft` does not exist in `global.css`; the app's token holds the identical value                                                             |
| `#0E1524` (wordmark, active nav item, phone number) | `--foreground` (`#0F172A`)         | `deviation(1-digit drift)` — same resolution the contract already applies to the `#F1F3F7` nav-pill track, and the app's existing header already used the token                     |
| Sidebar row `padding 9px 10px`, height 36           | `px-2.5 py-2.5` → **40px**         | `deviation(match shipped siblings)` — the contract sources this line as "matches sidebar nav rows", and the app's nav rows ship at 10px/40px, so matching them is the stated intent |

### Structural deviations

- **`deviation(no PublicDock in app; hamburger retains mobile nav)`** — the design's
  `InfoHeaderMobile` right cluster is `LangToggle` + `ActionMenu` and nothing else, because in the
  design mobile nav lives in a floating `PublicDock` pill. This app has no `PublicDock`, so the
  hamburger stays as a third item and `MobileNav.tsx` loses only its phone-reveal chip (`ActionMenu`'s
  first row is now the phone). Measured: the mobile bar is **69px tall — pixel-identical to
  `header-390-pl.png`** — and the row fits from **360px** (this project's documented viewport floor)
  with 11px to spare. `min-w-0` + `truncate` on the brand makes sub-360 clip the wordmark instead of
  scrolling the page.
- **`deviation(true centre on the landing tablet band)`** — pulled `customer-desktop.jsx`
  `ScreenTabletHome` during implementation (it was never in the audited set). Its header row has
  **three direct children** under `justify-between` — brand, 4-item pill, `LangToggle` +
  `ActionMenu` with `flexShrink: 0`. The app had wrapped the pill and the controls in one group, so
  the bar had only two children and the pill was glued to the right edge: **+63px off centre at 768
  and +191px at 1023**, and this phase's narrower right cluster (187px → 132px) widened that by a
  further 56px. Ungrouped to match. The design's `space-between` still leaves the pill 17px left of
  centre at every width (brand 98 vs controls 132), and the app's desktop pill is
  `grid-cols-[1fr_auto_1fr]` — a pre-existing S1 choice that centres it exactly — so `space-between`
  here would shift the pill 17px on crossing `lg`. Same grid used on both: measured **0px off centre
  at 768 / 820 / 834 / 900 / 960 / 1023**, and it fits with room to spare (2 × 132 + 298 = 562 of 712
  usable at 768).

- **`deviation(landing collapse threshold derived by measurement)`** — the contract records
  `LandingNav` as DIVERGENT with the resolution "port the design's `ActionMenu` collapse". Ported to
  all three landing presentations. The desktop pill's threshold is a container query on its own
  content box at **1208px** (393 nav + 2 × 402 cluster = 1197, rounded up for font-rendering slack),
  because `grid-cols-[1fr_auto_1fr]` makes the side columns symmetric and a `1fr` column cannot
  shrink below its nowrap min-content. Consequence, accepted: the phone + CTA text appears from
  **vw ≥ 1308** rather than 1280, and below that both live in the menu. The landing hero carries its
  own primary CTA (`HeroSearch`), so the header CTA is secondary.
- **`deviation(auth pages carry no switcher)`** — the eight `src/pages/auth/*` pages use a bespoke
  card layout with no `SiteHeader`, and Phase 3's Changes Required does not list them. The
  `/auth/*` property criterion 3.10 names — that the switcher's redirect guard preserves an auth path
  **with its query string** rather than bouncing to `/dashboard` — is proved at the endpoint instead
  (`/auth/reset-password?token_hash=…&type=recovery` round-trips intact; `https://evil.test/pwn` and
  `//evil.test` both land on `/`).

### Punch-list — resolved

- **Desktop bar height: mockup 82px, app 87px → FIXED, now 82px.** Pixel-measured from
  `header-1280-pl.png` / `header-980-pl.png` against the same renders of the app. The entire 5px was
  the nav item's line box: the app inherits `line-height: 1.5` (21.75px at 14.5px), the design board
  inherits `normal` (17.4px), so the item was 40px instead of 35px and the pill 50px instead of 45px.
  The contract specifies the item's `padding: 9px 18px` and `font-size: 14.5px` but is silent on
  line-height, so it was raised as a mismatch rather than guessed; owner's call 2026-09-02 was to
  match the mockup. `leading-[normal]` on the nav item now reproduces the design's own value.
  **Extended to `LandingNav`'s two pills as well**, once `design-landing-desktop-en.png` existed to
  measure against: the design's landing pill is item 35 / track 45, the app's was 40 / 50 — the same
  defect, and leaving it would have put the site's two public nav pills 5px apart from each other.
  All three now measure item 35 / track 45.

### Vision-diff result (2026-09-02)

Rendered `/pricing` under `locale=pl` at 2× DPI and pixel-compared against the canonical PL mockups.
PL, not EN, because the header's nav copy is still Polish literals until Phase 4 — so PL is the
locale in which the app and the mockup are asserting the same strings, and geometry is what this
phase owns.

| Width | Mockup          | App render      | Verdict         |
| ----- | --------------- | --------------- | --------------- |
| 1280  | 2560×164 → 82px | 2560×164 → 82px | pixel-identical |
| 980   | 1960×164 → 82px | 1960×164 → 82px | pixel-identical |
| 390   | 780×138 → 69px  | 780×138 → 69px  | pixel-identical |

Container-query reflow measured firing at exactly the design's thresholds — bar padding 48→28 at
1180, phone/CTA→`ActionMenu` at 980, nav-item padding 18→13 at 840 — with `1181/981/841` still on the
wider side of each. Renders kept as `render-header-*-pl.png` and `render-sidebar-pl.png` beside the
mockups.

`LangToggle` measures **61×38** at every width. The contract's computed ≈75 (and the 77 the first
build measured, which is 75 plus the 1px border on each side) both included the caret; removing it
takes 16px off — 10px of icon and its 6px gap. Everything the toggle keeps is unchanged: 38px height,
`0 10px` padding, 999px radius, the 15px globe, and the `12.5px / 700 / +0.3` code.

Remaining differences from the mockups are the caret (deliberate, above) and the structural
deviations recorded above. Nothing else.

---

## Design source corrected upstream — 2026-09-02

### `LangToggle`'s caret is gone from the DESIGN, not just from our app

`shared.jsx` was edited in the Claude Design project (`DesignSync write_files`) and read back to
confirm. §2 item 4 — "the caret promises a menu that never appears" — is now fixed at the source
rather than papered over per-consumer, so the next slice cannot re-inherit it. Because every screen
draws the control through the one shared component (`info-pages.jsx` uses it twice,
`customer-desktop.jsx` five times, and neither file draws a chevron of its own), the single edit
aligns `InfoHeader`, `InfoHeaderMobile`, `LandingNav`, `ScreenTabletHome`, `ScreenMobileHome` and
`DesktopHeader` at once. `ActionMenu` keeps its caret — that one really does open a panel, so a
chevron in this header now consistently means "opens something".

**Rendered and measured after the write:** the design's `LangToggle` is `61×38` with a single `<svg>`
(the globe) and the text `EN` — the same 61×38 our app measures. Design and app now agree; the
`deviation(caret removed)` above is therefore **closed, not carried**.

### Canonical LANDING header mockups now exist — `design-landing-*.png`

The landing header had **no canonical mockup in this change's set**, which is why §3's alignment
table could call `LandingNav`'s tablet band "aligned" when nobody had compared it — and why the
pill sat +191px off centre at 1023 until it was caught by eye. `customer-desktop.jsx` is now pulled
and rendered:

| File                            | Board                         | CSS size | Notes                                                                           |
| ------------------------------- | ----------------------------- | -------- | ------------------------------------------------------------------------------- |
| `design-landing-desktop-en.png` | `LandingNav`                  | 1440×110 | The desktop pill. Brand · 5-item nav · LangToggle + phone + CTA.                |
| `design-landing-tablet-en.png`  | `ScreenTabletHome` header row | 834×110  | Brand · 4-item pill · LangToggle + ActionMenu, the three-child `space-between`. |

Harness, stated for reproducibility: `shared.jsx` + `customer-desktop.jsx` transformed with esbuild
and loaded as **classic scripts**, preserving the cross-file global scoping the design relies on;
React 19 bundled to globals (it ships no UMD); the **app's own self-hosted variable Inter**
(`.astro/fonts/font-inter-400-700-normal-latin*.woff2`), never the CDN's static instances. Two
disclosed substitutions, neither in frame: `InfoFooter` is stubbed (it lives in the un-pulled
`info-pages.jsx`, and every capture crops to the top band), and the hero photo/van are hidden (they
resolve from the project's `assets/`, and are not part of the header spec). Zero page errors on
either board.

### Still pre-correction: `header-*-{en,pl}.png`

The six `InfoHeader` mockups were captured 2026-09-01, **before** the caret was removed, so they
differ from both the current design source and the app in exactly that one respect and in nothing
else. Regenerating them needs `info-pages.jsx` on disk, which the harness above does not have.
Treat them as current for geometry — every dimension was re-verified pixel-identical on 2026-09-02 —
and stale for the caret alone.
