# Canonical mockups — auth-surface-hardening (S-14)

Source: Claude Design project `Rental car company` (`352d78a6-84fd-49a2-8b38-2fe289691fc3`),
folder `design-review/`. Spec transcription lives in `../design-contract.md`.

## Present — mobile (390 × 844 @2× = 780 × 1688)

Pulled 2026-08-12 via `DesignSync get_file` and base64-decoded.

| File                 | Screen                                      |
| -------------------- | ------------------------------------------- |
| `auth-signin-m.png`  | Sign in                                     |
| `auth-forgot-m.png`  | R1 · Forgot password                        |
| `auth-sent-m.png`    | R2 · Check your email                       |
| `auth-set-m.png`     | R3/R9 · Set new password (with account box) |
| `auth-invite-m.png`  | R6/R10 · Invite accept                      |
| `auth-success-m.png` | R4 · Password updated                       |
| `auth-expired-m.png` | R5 · Link expired                           |
| `auth-authed-m.png`  | **R11 · Already signed in** (new)           |
| `auth-inapp-m.png`   | **R12 · Use account settings** (new)        |
| `auth-nolink-m.png`  | **R13 · Nothing to set here** (new)         |

**Freshness: verified by render, not assumed.** `auth-invite-m.png` shows `WITAJ WE FLOCIE` (the
corrected euphonic `we`), the invite-specific subtitle, and the `USTAWIASZ HASŁO DLA` account box —
all three post-date the 2026-08-11 copy round, so this export is current.

## Export artifact — secure-row footer wrap — RESOLVED 2026-08-13

The footer `🛡 Połączenie szyfrowane · tylko personel` was breaking across two lines with 120–170 px
of free space still on line 1. Cause: `Icon.base` (`shared.jsx`) set no `flexShrink: 0`, so the SVG
and the text span both shrank proportionally when the icon's width attribute wasn't honoured at
measure time. **Fixed in `shared.jsx`** (`style: { flexShrink: 0, ...props.style }`), then all
affected artboards were re-exported and verified. Full write-up: `../design-contract.md` §2a.

**Every mockup in this folder now renders that footer on one line.** Nothing to work around at the
vision-diff gate — and the shipped footer must likewise be one line.

## Present — desktop (1320 × 840 @2× = 2640 × 1680)

All 11 files supplied manually 2026-08-13.

`auth-{signin,forgot,sent,set,invite,success,expired,authed,authed-busy,inapp,nolink}-d.png`

## Historical note — why these were supplied by hand

The mobile set was pulled programmatically via `DesignSync get_file`. The desktop set could not be:
`get_file` caps at 256 KiB and every desktop artboard exceeds it, returning `truncated: true`
(verified on 6 — all exactly 262 144 base64 bytes), which decodes to a corrupt PNG. So the 11
desktop files were supplied manually instead.

If this set ever needs refreshing, expect the same split: mobile is fetchable, desktop is not.

`auth-authed-busy-d.png` is the deterministic R11 pending-state artboard — it makes the spinner
diffable without timing a click.

## Retention

Per `context/foundation/lessons.md` ("Port the design spec …", two-tier retention): prune this
folder at archive, and promote the finalized shipped-surface screens to
`context/foundation/design/screenshots/` with catalog rows in `design-system.md`. The auth flow has
**never** been in that catalog — which is why S-08's mockups went stale unnoticed.
