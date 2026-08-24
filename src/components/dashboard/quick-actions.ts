// core
import { CalendarDays, Truck, type LucideIcon } from "lucide-react";

// The quick-action menu's canonical rows and the absorb merge (S-12b), kept out
// of any component so the merge — the piece three mount sites depend on — is
// unit-testable on its own.
//
// Ported from the design source `manual-reservation.jsx` (`MR_MENU` +
// `QuickMenuList`'s `promoted` branch). Polish copy is canonical; the icons are
// the source's `Icon.calendar` / `Icon.truck` mapped onto lucide.

export interface QuickActionItem {
  key: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  /**
   * Where a plain-navigation row goes. Rows that open something in place —
   * `res` (the manual-reservation modal) and a promoted row like Zespół's
   * `employee` (its add-employee dialog) — carry `onPick` instead.
   */
  href?: string;
  onPick?: () => void;
}

/** A row with its resolved tile colour: crimson when primary, grey otherwise. */
export type ResolvedQuickAction = QuickActionItem & { primary: boolean };

/**
 * The two canonical rows, in order. `res` is primary — on desktop it is always
 * the crimson tile, because the desktop popover never absorbs (design contract
 * E12). Never mutated: `buildQuickActions` only ever reads it.
 */
export const QUICK_ACTIONS: QuickActionItem[] = [
  { key: "res", icon: CalendarDays, label: "Nowa rezerwacja", desc: "Dodaj wynajem ręcznie" },
  { key: "vehicle", icon: Truck, label: "Dodaj pojazd", desc: "Nowy pojazd do floty", href: "/dashboard/vehicles/new" },
];

/** The canonical primary — `res`, matching `MR_MENU`'s `primary: true`. */
const PRIMARY_KEY = "res";

/**
 * Resolve the rows to render. With `promoted` (the mobile absorb path), that
 * page-local action leads as the crimson primary and the canonical rows follow,
 * **de-duplicated by key** and demoted to grey — which is why Flota renders 2
 * rows (its `vehicle` key collides) and Zespół 3 (`employee` is new) from one
 * code path. Without `promoted`, the canonical menu with `res` primary.
 *
 * `QUICK_ACTIONS` is never mutated — every row is returned as a fresh object.
 */
export function buildQuickActions(promoted?: QuickActionItem): ResolvedQuickAction[] {
  if (!promoted) {
    return QUICK_ACTIONS.map((item) => ({ ...item, primary: item.key === PRIMARY_KEY }));
  }
  return [
    { ...promoted, primary: true },
    ...QUICK_ACTIONS.filter((item) => item.key !== promoted.key).map((item) => ({ ...item, primary: false })),
  ];
}
