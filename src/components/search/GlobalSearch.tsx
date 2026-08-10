// core
import * as React from "react";
import { createPortal } from "react-dom";
import { Command } from "cmdk";
import { AlertTriangle, ArrowDown, Clock, Search, X } from "lucide-react";

// components
import { Popover, PopoverAnchor, PopoverContent } from "../ui/popover";

// others
import { cn } from "../../lib/utils";
import { useGlobalSearchHotkey } from "../hooks/useGlobalSearchHotkey";

// Staff global search (S-13 Phase 2) — the persistent header field and its
// dropdown, plus the mobile full-screen view. Built to design-contract.md
// Surfaces 1, 2 and 4; Polish copy canonical.
//
// Two surfaces, one component, because they share the query and the ⌘K entry:
//   * DESKTOP (md+) — a 520px field living in StaffShell's always-on top bar, with
//     the panel in a radix Popover anchored under it (contract D7).
//   * MOBILE (below md) — a full-screen overlay opened from the floating tab bar's
//     magnifier, which dispatches `flota:search-open` on the document (the tab bar
//     is Astro markup, so a DOM event is the seam between it and this island).
//
// cmdk owns the list semantics and ↑↓/Enter roving focus (contract D5). Filtering
// is `shouldFilter={false}` — the server already ranked and capped the rows, so
// re-filtering client-side would fight the RPC's ordering.
//
// PHASE SCOPE: the resting (quick-jumps) state is complete here because it is pure
// props. The live results / no-results bodies arrive in Phase 3.

/** The document event the Astro tab-bar magnifier fires to open the mobile view. */
export const SEARCH_OPEN_EVENT = "flota:search-open";

const COPY = {
  placeholder: "Szukaj rezerwacji, pojazdu, rejestracji…",
  ariaLabel: "Szukaj",
  clear: "Wyczyść",
  cancel: "Anuluj",
  quickJumps: "Szybkie przejścia",
  pending: "Oczekujące rezerwacje",
  overdue: "Przeterminowane",
  dueToday: "Dzisiejsze zwroty",
  navigate: "nawigacja",
  open: "otwórz",
  close: "zamknij",
};

/** Below this length the endpoint (and the RPC) answer with empty groups. */
const MIN_QUERY_LENGTH = 2;

export interface GlobalSearchProps {
  /** Pending reservations — the first quick-jump's live count (threaded from the shell). */
  pendingCount?: number;
  /** Open overdue returns — the second quick-jump's live count (threaded from the shell). */
  overdueCount?: number;
}

interface QuickJump {
  id: string;
  label: string;
  href: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  /** Icon-tile background + foreground tokens, per the contract's tone map. */
  tile: string;
}

export default function GlobalSearch({ pendingCount = 0, overdueCount = 0 }: GlobalSearchProps) {
  const [query, setQuery] = React.useState("");
  const [desktopOpen, setDesktopOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const fieldRef = React.useRef<HTMLDivElement>(null);
  const desktopInputRef = React.useRef<HTMLInputElement>(null);
  const mobileInputRef = React.useRef<HTMLInputElement>(null);

  const quickJumps: QuickJump[] = [
    {
      id: "pending",
      label: COPY.pending,
      href: "/dashboard/reservations",
      count: pendingCount,
      icon: Clock,
      tile: "bg-[var(--flota-warning-soft)] text-warning",
    },
    {
      id: "overdue",
      label: COPY.overdue,
      href: "/dashboard/returns?filter=overdue",
      count: overdueCount,
      icon: AlertTriangle,
      tile: "bg-[var(--flota-danger-soft)] text-primary",
    },
    {
      id: "due",
      label: COPY.dueToday,
      href: "/dashboard/returns?filter=due",
      count: 0,
      icon: ArrowDown,
      tile: "bg-[var(--flota-neutral-soft)] text-[var(--flota-neutral)]",
    },
  ];

  // ⌘K targets whichever surface is actually on screen: the header field only
  // exists at md+, so below that the shortcut opens the full-screen view.
  const openSearch = React.useCallback(() => {
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop) {
      setDesktopOpen(true);
      // The field is already in the DOM, but focus must wait for the popover's
      // own open-frame or radix's autofocus handling races it.
      requestAnimationFrame(() => desktopInputRef.current?.focus());
    } else {
      setMobileOpen(true);
    }
  }, []);

  const closeSearch = React.useCallback(() => {
    setDesktopOpen(false);
    setMobileOpen(false);
  }, []);

  useGlobalSearchHotkey({ onOpen: openSearch, onClose: closeSearch });

  // The mobile tab bar is Astro markup; it asks for the overlay by event.
  React.useEffect(() => {
    function onRequest() {
      setMobileOpen(true);
    }
    document.addEventListener(SEARCH_OPEN_EVENT, onRequest);
    return () => {
      document.removeEventListener(SEARCH_OPEN_EVENT, onRequest);
    };
  }, []);

  // Focus the overlay's input once it exists, and lock the page behind it.
  React.useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => mobileInputRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const resting = query.trim().length < MIN_QUERY_LENGTH;

  return (
    <>
      {/* ── Desktop: the persistent header field + anchored panel (md+) ─────── */}
      <Command shouldFilter={false} loop label={COPY.ariaLabel} className="contents">
        <Popover open={desktopOpen} onOpenChange={setDesktopOpen} modal={false}>
          <PopoverAnchor asChild>
            <div
              ref={fieldRef}
              className={cn(
                "bg-card hidden h-11 w-[520px] max-w-full items-center gap-2 rounded-[12px] border-[1.5px] px-3 transition-[border-color,box-shadow] md:flex",
                desktopOpen ? "border-foreground shadow-[0_0_0_4px_rgba(15,23,42,0.06)]" : "border-[var(--flota-hair)]",
              )}
            >
              <Search
                className={cn("size-[17px] shrink-0", desktopOpen ? "text-[var(--flota-ink-2)]" : "text-muted-foreground")} // prettier-ignore
              />
              <Command.Input
                ref={desktopInputRef}
                value={query}
                onValueChange={setQuery}
                placeholder={COPY.placeholder}
                onFocus={() => {
                  setDesktopOpen(true);
                }}
                className="text-foreground placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              />
              {query ? (
                <button
                  type="button"
                  aria-label={COPY.clear}
                  onClick={() => {
                    setQuery("");
                    desktopInputRef.current?.focus();
                  }}
                  className="bg-background text-muted-foreground hover:text-foreground flex size-[22px] shrink-0 items-center justify-center rounded-[7px]"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <span className="flex shrink-0 items-center gap-1">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </span>
              )}
            </div>
          </PopoverAnchor>

          <PopoverContent
            align="end"
            sideOffset={8}
            // Focus stays in the anchored input — the panel is a results surface,
            // not a focus trap; and clicking the field itself must not close it.
            onOpenAutoFocus={(event) => {
              event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (fieldRef.current?.contains(event.target as Node)) {
                event.preventDefault();
              }
            }}
            className="bg-card w-[520px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[16px] border border-[var(--flota-hair)] p-0 shadow-[0_4px_12px_rgba(15,23,42,0.08),0_24px_60px_rgba(15,23,42,0.16)]"
          >
            <Command.List className="max-h-[460px] overflow-y-auto py-1.5">
              {resting && <QuickJumpGroup jumps={quickJumps} onNavigate={closeSearch} />}
            </Command.List>
            <PanelFooter />
          </PopoverContent>
        </Popover>
      </Command>

      {/* ── Mobile: full-screen search (below md) ─────────────────────────────
          PORTALED TO <body> ON PURPOSE. This island is mounted inside StaffShell's
          desktop top bar, which is `hidden … md:flex` — so anything rendered in
          place would be `display:none` at exactly the widths the overlay is for.
          The portal is only ever created client-side (`mobileOpen` starts false, and
          nothing can set it during SSR), so there is no server/client mismatch. */}
      {mobileOpen &&
        createPortal(
          <div className="bg-background fixed inset-0 z-50 flex flex-col md:hidden">
            <Command shouldFilter={false} loop label={COPY.ariaLabel} className="flex min-h-0 flex-1 flex-col">
              <div className="bg-card flex items-center gap-3 border-b border-[var(--flota-hair-2)] px-4 pt-[52px] pb-3">
                <div className="bg-background border-foreground flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[12px] border-[1.5px] px-3">
                  <Search className="size-[17px] shrink-0 text-[var(--flota-ink-2)]" />
                  <Command.Input
                    ref={mobileInputRef}
                    value={query}
                    onValueChange={setQuery}
                    placeholder={COPY.placeholder}
                    className="text-foreground placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label={COPY.clear}
                      onClick={() => {
                        setQuery("");
                        mobileInputRef.current?.focus();
                      }}
                      className="bg-card text-muted-foreground flex size-[22px] shrink-0 items-center justify-center rounded-[7px]"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <button type="button" onClick={closeSearch} className="text-primary shrink-0 text-[14.5px] font-[650]">
                  {COPY.cancel}
                </button>
              </div>

              <Command.List className="min-h-0 flex-1 overflow-y-auto py-1.5">
                {resting && <QuickJumpGroup jumps={quickJumps} onNavigate={closeSearch} mobile />}
              </Command.List>
            </Command>
          </div>,
          document.body,
        )}
    </>
  );
}

/** `⌘` / `K` chip — contract Surface 1. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-card text-muted-foreground flex h-5 min-w-[18px] items-center justify-center rounded-[5px] border border-[var(--flota-hair)] px-1 font-sans text-[11px] font-[650]">
      {children}
    </kbd>
  );
}

/** Group heading — icon + uppercase label (+ optional count), contract Surface 2. */
export function GroupHeader({
  icon: Icon,
  label,
  count,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}) {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 px-4 pt-3 pb-1.5">
      {Icon && <Icon className="size-[13px]" />}
      <span className="text-[11px] font-bold tracking-[0.5px] uppercase">{label}</span>
      {count !== undefined && <span className="text-[11px] font-bold tracking-[0.5px]">· {count}</span>}
    </div>
  );
}

/** Row chrome shared by every result and quick-jump row — contract Surface 2 `RowShell`. */
export const ROW_SHELL =
  "mx-1.5 flex cursor-default items-center gap-3 rounded-[11px] px-3 py-[9px] data-[selected=true]:bg-background data-[selected=true]:shadow-[inset_0_0_0_1px_var(--flota-hair)]";

function QuickJumpGroup({
  jumps,
  onNavigate,
  mobile = false,
}: {
  jumps: QuickJump[];
  onNavigate: () => void;
  mobile?: boolean;
}) {
  return (
    <Command.Group heading={<GroupHeader label={COPY.quickJumps} />}>
      {jumps.map((jump) => (
        <Command.Item
          key={jump.id}
          value={`jump-${jump.id}`}
          onSelect={() => {
            onNavigate();
            window.location.href = jump.href;
          }}
          asChild
        >
          <a href={jump.href} className={ROW_SHELL}>
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-[9px]",
                mobile ? "size-[34px]" : "size-8",
                jump.tile,
              )}
            >
              <jump.icon className="size-4" />
            </span>
            <span className="text-foreground min-w-0 flex-1 truncate text-[13.5px] font-[600]">{jump.label}</span>
            {jump.count > 0 && (
              <span className="bg-secondary flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] px-1.5 text-[11px] font-[650] text-[var(--flota-neutral)]">
                {jump.count}
              </span>
            )}
          </a>
        </Command.Item>
      ))}
    </Command.Group>
  );
}

/** Desktop panel footer — keyboard hints left, `esc` right. Contract Surface 2. */
function PanelFooter() {
  return (
    <div className="bg-background flex items-center justify-between border-t border-[var(--flota-hair-2)] px-4 py-2.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        {COPY.navigate}
        <span className="px-0.5">·</span>
        <Kbd>↵</Kbd>
        {COPY.open}
      </span>
      <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Kbd>esc</Kbd>
        {COPY.close}
      </span>
    </div>
  );
}
