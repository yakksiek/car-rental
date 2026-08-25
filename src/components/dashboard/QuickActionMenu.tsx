// core
import * as React from "react";

// others
import { cn } from "../../lib/utils";
import type { ResolvedQuickAction } from "./quick-actions";

// The quick-action row list (S-12b), shared verbatim by the desktop popover and
// the mobile bottom sheet — a port of the design source's `QuickMenuList` row
// spec (`manual-reservation.jsx`). Every dimension here is `exact` per
// design-contract.md Surface 5.
//
// E13: the divider is POSITIONAL, not structural — `borderTop` fires on
// `i === 1` only, together with `marginTop: 4` / `paddingTop: 13` on that same
// row. So Zespół's 3-row absorb sheet has ONE divider (after row 1), not two.
// Do not generalize it to "between every pair".

interface QuickActionMenuProps {
  items: ResolvedQuickAction[];
  onPick: (item: ResolvedQuickAction) => void;
  /**
   * Rows rendered non-interactive with a hint below the label — the empty-fleet
   * case (design contract D3) and, transiently, the row whose fetch is in
   * flight (D4).
   */
  disabledKeys?: Record<string, { hint?: string; pending?: boolean }>;
}

export function QuickActionMenu({ items, onPick, disabledKeys }: QuickActionMenuProps) {
  return (
    <div className="flex flex-col">
      {items.map((item, i) => {
        const disabledState = disabledKeys?.[item.key];
        const disabled = disabledState !== undefined;
        const Icon = item.icon;

        return (
          <button
            key={item.key}
            type="button"
            disabled={disabled}
            onClick={() => {
              onPick(item);
            }}
            className={cn(
              "flex items-center gap-3 rounded-[12px] bg-transparent px-3 py-[11px] text-left",
              "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
              disabled ? "opacity-55" : "hover:bg-background",
              // E13 — index 1 only.
              i === 1 && "mt-1 border-t border-[var(--flota-hair-2)] pt-[13px]",
            )}
          >
            <span
              className={cn(
                "flex size-[38px] shrink-0 items-center justify-center rounded-[11px]",
                item.primary ? "bg-[var(--flota-accent-soft)]" : "bg-[var(--flota-neutral-soft)]",
              )}
            >
              {disabledState?.pending ? (
                // D4 `deviation(async-affordance)` — the row triggers a fetch, so
                // it shows the project's async-button spinner (SubmitButton.tsx's
                // ring) in place of its icon while that request is in flight.
                <span
                  className={cn(
                    "size-[18px] animate-spin rounded-full border-2",
                    item.primary
                      ? "border-[var(--flota-accent)]/30 border-t-[var(--flota-accent)]"
                      : "border-[var(--flota-ink-2)]/30 border-t-[var(--flota-ink-2)]",
                  )}
                />
              ) : (
                <Icon
                  className={cn("size-[18px]", item.primary ? "text-primary" : "text-[var(--flota-ink-2)]")}
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-[13.5px] font-[650] tracking-[-0.1px]">{item.label}</span>
              <span className="text-muted-foreground mt-px block text-[11.5px]">
                {disabledState?.hint ?? item.desc}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
