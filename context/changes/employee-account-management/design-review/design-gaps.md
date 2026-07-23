# S-08 Employees — Design Gaps (RESOLVED)

> **Status: resolved.** The user supplied the full canonical screenshot set directly into this
> folder (`design-review/*.jpg`, 2026-07-23). The finished exact-value spec is
> `../design-contract.md` (full rewrite). This file is now the **gap-closure ledger**: which of
> the original 15 gaps are CLOSED (with the screenshot that closed them) and what residual work
> remains.

## Correction to the prior "DesignSync not installed" blocker

The earlier revision of this file declared a **source-access BLOCKER** — "`DesignSync` /
`/design-sync` is not installed; the live design project can't be read; the reset flow, the two
modals, the empty/mobile states are left unspecced-from-source." **That was a subagent-environment
limitation, not a real project blocker.** The user has since exported and dropped **every** final
screenshot into `design-review/` directly. All previously-blocked surfaces are now drawn and
transcribed. There is nothing to unblock and no `DesignSync` dependency: the JPG finals are the
canonical source, and the contract is derived from them (not from the stale June-03 export in
`design-source/`, which is superseded).

## Gap ledger (#1–#15)

| #   | Gap (original)                                      | Status                          | Closed by / residual                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Self-service reset flow (3+ screens)                | **CLOSED**                      | Fully drawn: `reset-r1-forgot-desktop.jpg` (forgot), `reset-r2-check-email-desktop.jpg` (neutral check-email), `reset-r3-set-password-desktop.jpg` (set), `reset-r4-success-desktop.jpg` (success), `reset-r5-expired-desktop.jpg` (expired), `reset-r6-invite-accept-desktop.jpg` (invite), `reset-r7-r10-mobile.jpg` (mobile). Spec §3.14–3.21. |
| 2   | Add-employee modal (name + email, no role selector) | **CLOSED**                      | `employees-add-modal.jpg` + `employees-add-duplicate-error.jpg` — name + email only, **no role selector** (confirmed), duplicate-email error state drawn. Spec §3.6.                                                                                                                                                                              |
| 3   | Remove / typed-confirm modal                        | **CLOSED**                      | `employees-remove-confirm.jpg` — typed-email confirmation ("WPISZ E-MAIL, ABY POTWIERDZIĆ") + `employees-remove-last-admin.jpg` (last-admin refusal) + self-remove greyed `×` (roster + mobile). Spec §3.7–3.8.                                                                                                                                   |
| 4   | Empty roster / no-results                           | **CLOSED**                      | `employees-empty.jpg` (Brak pracowników + CTA) + `employees-no-results.jpg` (Brak wyników). Spec §3.9–3.10.                                                                                                                                                                                                                                       |
| 5   | Loading state / mutation error banner               | **CLOSED**                      | `employees-loading.jpg` (skeleton) + `employees-error-banner.jpg` (danger banner + Ponów). Spec §3.11–3.12. (Skeleton parked — roster is SSR-loaded; §3.11.)                                                                                                                                                                                      |
| 6   | Reset-password post-click feedback                  | **CLOSED**                      | Modeled as the inline success banner (`Wysłano e-mail do resetu hasła.`) reusing the §3.12 strip. No toast in the app.                                                                                                                                                                                                                            |
| 7   | **Tablet / in-between widths**                      | **RESIDUAL (open)**             | Not drawn — only desktop (table) and mobile (cards) frames exist. The table→cards switch is `md` (768px). This is the one un-drawn surface; carry as a build-time decision + a past-bug watch (embedded/in-between widths).                                                                                                                       |
| 8   | PL copy for EN surfaces                             | **CLOSED (spec'd)**             | All EN strings localized in contract §5. **Residual = user approval** of the `needs-copy-confirm` set (add-modal, mobile chips, reset-flow) — see below.                                                                                                                                                                                          |
| 9   | "Online now" misleading                             | **CLOSED**                      | Canonical uses `przed chwilą` (desktop) / `moments ago`→`przed chwilą` (mobile) for recent last-login — the misleading "Online now/Online teraz" is gone. §5 #15/#20.                                                                                                                                                                             |
| 10  | Nav mismatch (prototype vs `StaffShell`)            | **CLOSED (deviation recorded)** | Shipped `StaffShell` is authoritative; slice adds only admin-only `Zespół`. §3.22, §0.1.                                                                                                                                                                                                                                                          |
| 11  | Confirm no role selector                            | **CLOSED**                      | Add modal has **no** role selector (the sticky note on `employees-add-modal.jpg` confirms "admins are runbook-only"). Matches plan "What We're NOT Doing".                                                                                                                                                                                        |
| 12  | Token mapping (avatar / dots / badges)              | **CLOSED**                      | Admin avatar = crimson, employee = navy (both breakpoints); status dots success/warning; badges danger-soft/muted/success-soft/warning-soft. §1, §3.3, §3.4.                                                                                                                                                                                      |
| 13  | Mobile parity (stat cards / search / reset)         | **CLOSED — full parity**        | `employees-mobile-roster.jpg`: mobile HAS a full-width search, filter **chips** (Active/Invited/Admin), and a per-card **reset (key)** action stacked over `×`. Counts surfaced via chips (not stat cards). The old "mobile omits these" divergence is gone. §3.13.                                                                               |
| 14  | Admin avatar color across breakpoints               | **CLOSED**                      | Crimson on **both** desktop and mobile (PB is crimson in `employees-mobile-roster.jpg`). Consistent. §3.13.                                                                                                                                                                                                                                       |
| 15  | Reset icon = chat glyph                             | **CLOSED**                      | Roster + mobile reset action now draw a **key** glyph (`KeyRound`) — semantically correct. The chat/message glyph survives only on the add-modal **Send invite** button, which the contract swaps to `Send`. §3.3, §3.6.                                                                                                                          |

## Residual gaps (the only open items)

1. **PL-copy localization approval (#8)** — **CLOSED 2026-07-23.** User approved all
   `needs-copy-confirm` Polish and delegated English→Polish translation; the §5 Polish is final.
   No copy sign-off remains. _(Original groups, now approved, kept below for reference:)_
   - **Add-modal:** subtitle, `FULL NAME`/`EMAIL ADDRESS` labels, `Send invite`, duplicate-email
     error, pending label (contract §5.4 #32–#38).
   - **Mobile roster:** eyebrow `4 STAFF`, chips `Active/Invited/Admin`, role `ADMIN/EMPLOYEE`,
     status `Active/Invited`, `moments ago`, footer note (§5.3 #21–#30, §5.2 #20).
   - **Reset flow (R1–R10):** every title/subtitle/label/button across the 6 states incl. the
     invite-mode eyebrow `WELCOME TO FLOTA` and the illustrative checklist (§5.6 #51–#76).
2. **Tablet / in-between widths (#7)** — not drawn; specify/validate the `md` table→cards switch
   at build (a real past bug on embedded/in-between widths).

Everything else (#1–#6, **#8**, #9–#15) is **CLOSED**. The only open residual is **#7** (tablet / in-between width), a build-time watch.

## Note on the stale `design-source/` June-03 export

`design-source/` holds a **pre-iteration** June-03 code export (role-selector add-modal, simple
remove-confirm, reset toast, no mobile/reset screens). It is **superseded** by the 2026-07-23 JPG
finals and must not be used to derive the contract. Keep it only as historical provenance; the
copy conflicts it raised (`Pracownicy` vs `Zespół`, `Administrator` vs `ADMIN`, toast vs banner)
are resolved by the finals: desktop title **`Pracownicy`**, nav **`Zespół`**, desktop role badge
**`ADMINISTRATOR`**, feedback via inline **banner**.
