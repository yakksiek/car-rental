// core
import * as React from "react";
import { createPortal } from "react-dom";
import { Command } from "cmdk";
import { AlertTriangle, ArrowDown, Clock, Search, Tag, Truck, X } from "lucide-react";

// components
import { Popover, PopoverAnchor, PopoverContent } from "../ui/popover";
import { Kbd, ReservationRow, ReturnRow, ROW_SHELL, searchHref, VehicleRow } from "./SearchRows";

// others
import { cn } from "../../lib/utils";
import { search } from "../../lib/i18n/search";
import { translator, type Locale } from "../../lib/i18n/types";
import { useGlobalSearchHotkey } from "../hooks/useGlobalSearchHotkey";
import { useSearch } from "../hooks/useSearch";
import type { SearchResults } from "../../types";

// Staff global search (S-13) — the persistent header field and its dropdown, plus
// the mobile full-screen view. Built to design-contract.md Surfaces 1, 2 and 4;
// Polish copy canonical.
//
// Two surfaces, one component, because they share the query and the ⌘K entry:
//   * DESKTOP (md+) — a 520px field living in StaffShell's top bar, with the panel
//     in a radix Popover anchored under it (contract D7). The field renders on
//     PULPIT ONLY (`field`); every other staff page mounts the island without it.
//   * MOBILE (below md) — a full-screen overlay opened from the dashboard hero's
//     magnifier, which dispatches `flota:search-open` on the document (the hero is
//     Astro markup, so a DOM event is the seam between it and this island).
//
// The island stays mounted on all 10 staff pages even where no field renders
// (contract N2): it owns the ⌘K listener and the mobile overlay, and the overlay
// needs no anchor, so below `md` the shortcut opens in place anywhere. At md+ on a
// fieldless page there is nothing to anchor to, so ⌘K navigates to Pulpit instead
// (contract N3).
//
// cmdk owns the list semantics and ↑↓/Enter roving focus (contract D5). Filtering
// is `shouldFilter={false}` — the server already ranked and capped the rows, so
// re-filtering client-side would fight the RPC's ordering.

/** The document event the Astro hero magnifier fires to open the mobile view. */
export const SEARCH_OPEN_EVENT = "flota:search-open";

/** Where ⌘K sends a desktop user who is on a page with no search field. */
const DASHBOARD_WITH_SEARCH = "/dashboard?search=1";

/** The `search`-namespace translator the sub-components take instead of a locale. */
type Translate = (key: keyof typeof search.en) => string;

/** Below this length the endpoint (and the RPC) answer with empty groups. */
const MIN_QUERY_LENGTH = 2;

export interface GlobalSearchProps {
  /** Pending reservations — the first quick-jump's live count (threaded from the shell). */
  pendingCount?: number;
  /** Open overdue returns — the second quick-jump's live count (threaded from the shell). */
  overdueCount?: number;
  /** Returns due today and still open — the third quick-jump's live count. */
  dueTodayCount?: number;
  /**
   * The server's calendar date (ISO), used for the returns rows' "dziś / wczoraj"
   * wording. Passed in rather than read from the browser clock so a server-rendered
   * row and its hydrated counterpart cannot disagree.
   */
  today: string;
  /**
   * Render the desktop search field? Pulpit passes `true`; every other staff page
   * mounts the island without a field (contract Surface B). With no field there is
   * no `PopoverAnchor` and no input to focus, so the desktop branch of `openSearch`
   * navigates to Pulpit instead of opening nothing.
   */
  field?: boolean;
  /**
   * Open the matching surface for the current width as soon as the island hydrates.
   * Set by Pulpit when it was reached via `?search=1` — i.e. by ⌘K from a fieldless
   * page. The parameter is stripped on open so a refresh cannot re-trigger it.
   */
  autoOpen?: boolean;
  /**
   * Claim ⌘K on this page? Default `true`. The two vehicle-form sub-screens pass
   * `false` — search is a navigation affordance, and on a page whose whole job is
   * data entry the shortcut would abandon the form. The island still mounts (it
   * owns the mobile overlay); only the hotkey registration is skipped.
   */
  hotkey?: boolean;
  /** Islands cannot read `Astro.locals`; the mounting shell passes it down. */
  locale: Locale;
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

function resultCount(results: SearchResults): number {
  return results.reservations.length + results.returns.length + results.vehicles.length;
}

export default function GlobalSearch({
  pendingCount = 0,
  overdueCount = 0,
  dueTodayCount = 0,
  today,
  field = true,
  autoOpen = false,
  hotkey = true,
  locale,
}: GlobalSearchProps) {
  // `useMemo`, unlike every other island's plain `translator(...)` call, because
  // this component is the one with hand-written `useCallback` deps below: an
  // unmemoized closure here makes React Compiler give up on preserving them
  // (`react-hooks/preserve-manual-memoization`), and it would hand a new `t`
  // identity to the row components on every render.
  const t = React.useMemo(() => translator(locale, search), [locale]);
  const [query, setQuery] = React.useState("");
  const [desktopOpen, setDesktopOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const fieldRef = React.useRef<HTMLDivElement>(null);
  const desktopInputRef = React.useRef<HTMLInputElement>(null);
  const mobileInputRef = React.useRef<HTMLInputElement>(null);

  const { results } = useSearch(query);
  const trimmed = query.trim();
  const resting = trimmed.length < MIN_QUERY_LENGTH;
  const total = resultCount(results);

  const quickJumps: QuickJump[] = [
    {
      id: "pending",
      label: t("pending"),
      href: "/dashboard/reservations",
      count: pendingCount,
      icon: Clock,
      tile: "bg-[var(--flota-warning-soft)] text-warning",
    },
    {
      id: "overdue",
      label: t("overdue"),
      href: "/dashboard/returns?filter=overdue",
      count: overdueCount,
      icon: AlertTriangle,
      tile: "bg-[var(--flota-danger-soft)] text-primary",
    },
    {
      id: "due",
      label: t("dueToday"),
      href: "/dashboard/returns?filter=due",
      count: dueTodayCount,
      icon: ArrowDown,
      tile: "bg-[var(--flota-neutral-soft)] text-[var(--flota-neutral)]",
    },
  ];

  // ⌘K targets whichever surface is actually on screen: the header field only
  // exists at md+, so below that the shortcut opens the full-screen view.
  const openSearch = React.useCallback(() => {
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (!isDesktop) {
      setMobileOpen(true);
      return;
    }
    if (!field) {
      // Nothing to anchor a popover to and no input to focus on this page, so the
      // shortcut takes the user where both exist and asks Pulpit to open on arrival.
      window.location.assign(DASHBOARD_WITH_SEARCH);
      return;
    }
    setDesktopOpen(true);
    // The field is already in the DOM, but focus must wait for the popover's
    // own open-frame or radix's autofocus handling races it.
    requestAnimationFrame(() => desktopInputRef.current?.focus());
  }, [field]);

  const closeSearch = React.useCallback(() => {
    setDesktopOpen(false);
    setMobileOpen(false);
  }, []);

  useGlobalSearchHotkey({ onOpen: openSearch, onClose: closeSearch, enabled: hotkey });

  // Arriving from ⌘K on a fieldless page (`/dashboard?search=1`): open as soon as
  // the island has hydrated, and strip the parameter in the SAME effect — leaving it
  // in the URL would re-open search on a refresh or for anyone handed the link.
  //
  // The open is deferred by a frame: `openSearch` sets state, and doing that
  // synchronously in an effect body cascades a render (react-hooks/set-state-in-effect).
  // The deferral also matches the focus timing the desktop branch already needs.
  React.useEffect(() => {
    if (!autoOpen) {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("search");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    const frame = requestAnimationFrame(openSearch);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [autoOpen, openSearch]);

  // The dashboard hero's magnifier is Astro markup; it asks for the overlay by event.
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

  const body = (
    <>
      {resting ? (
        <QuickJumpGroup jumps={quickJumps} onNavigate={closeSearch} t={t} />
      ) : total === 0 ? (
        <NoResults query={trimmed} t={t} />
      ) : (
        <ResultGroups results={results} query={trimmed} today={today} locale={locale} t={t} />
      )}
    </>
  );

  return (
    <>
      {/* ── Desktop: the Pulpit-only header field + anchored panel (md+) ──────
          The cmdk root stays even where the field does not, so the island's shape
          is the same on all 10 pages; only the anchored subtree is conditional. */}
      <Command shouldFilter={false} loop label={t("ariaLabel")} className="contents">
        {field && (
          <Popover open={desktopOpen} onOpenChange={setDesktopOpen} modal={false}>
            <PopoverAnchor asChild>
              <div
                ref={fieldRef}
                className={cn(
                  "bg-card hidden h-11 w-[520px] max-w-full items-center gap-2 rounded-[12px] border-[1.5px] px-3 transition-[border-color,box-shadow] md:flex",
                  desktopOpen
                    ? "border-foreground shadow-[0_0_0_4px_rgba(15,23,42,0.06)]"
                    : "border-[var(--flota-hair)]",
                )}
              >
                <Search
                  className={cn("size-[17px] shrink-0", desktopOpen ? "text-[var(--flota-ink-2)]" : "text-muted-foreground")} // prettier-ignore
                />
                <Command.Input
                  ref={desktopInputRef}
                  value={query}
                  onValueChange={setQuery}
                  placeholder={t("placeholder")}
                  onFocus={() => {
                    setDesktopOpen(true);
                  }}
                  className="text-foreground placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label={t("clear")}
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
              <Command.List className="max-h-[460px] overflow-y-auto py-1.5">{body}</Command.List>
              <PanelFooter t={t} />
            </PopoverContent>
          </Popover>
        )}
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
            <Command shouldFilter={false} loop label={t("ariaLabel")} className="flex min-h-0 flex-1 flex-col">
              <div className="bg-card flex items-center gap-3 border-b border-[var(--flota-hair-2)] px-4 pt-[52px] pb-3">
                <div className="bg-background border-foreground flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[12px] border-[1.5px] px-3">
                  <Search className="size-[17px] shrink-0 text-[var(--flota-ink-2)]" />
                  <Command.Input
                    ref={mobileInputRef}
                    value={query}
                    onValueChange={setQuery}
                    placeholder={t("placeholder")}
                    className="text-foreground placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label={t("clear")}
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
                  {t("cancel")}
                </button>
              </div>

              <Command.List className="min-h-0 flex-1 overflow-y-auto pt-1 pb-6">
                {resting ? (
                  <QuickJumpGroup jumps={quickJumps} onNavigate={closeSearch} mobile t={t} />
                ) : total === 0 ? (
                  <NoResults query={trimmed} mobile t={t} />
                ) : (
                  // The list simply ends after the last row (contract Surface 4) —
                  // there is nothing to link out to, so nothing follows it.
                  <ResultGroups results={results} query={trimmed} today={today} locale={locale} t={t} />
                )}
              </Command.List>
            </Command>
          </div>,
          document.body,
        )}
    </>
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
    <span className="text-muted-foreground flex items-center gap-1.5 px-4 pt-3 pb-1.5">
      {Icon && <Icon className="size-[13px]" />}
      <span className="text-[11px] font-bold tracking-[0.5px] uppercase">{label}</span>
      {count !== undefined && <span className="text-[11px] font-bold tracking-[0.5px]">· {count}</span>}
    </span>
  );
}

/**
 * The three grouped result lists — Rezerwacje / Zwroty / Pojazdy (contract Surface 2).
 *
 * Each row carries its deep-link twice, on purpose: as the anchor's `href` (so a
 * click, a middle-click and "open in new tab" all behave like the links they look
 * like) and as cmdk's `onSelect` (so ↵ on the highlighted row opens the same place —
 * cmdk resolves Enter by calling `onSelect`, it does not click the child).
 */
function ResultGroups({
  results,
  query,
  today,
  locale,
  t,
}: {
  results: SearchResults;
  query: string;
  today: string;
  locale: Locale;
  t: Translate;
}) {
  const go = (href: string) => () => {
    window.location.href = href;
  };

  return (
    <>
      {results.reservations.length > 0 && (
        <Command.Group
          heading={<GroupHeader icon={Tag} label={t("reservations")} count={results.reservations.length} />}
        >
          {results.reservations.map((row) => (
            <Command.Item
              key={row.id}
              value={`reservation-${row.id}`}
              onSelect={go(searchHref.reservation(row))}
              asChild
            >
              <ReservationRow row={row} query={query} locale={locale} />
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {results.returns.length > 0 && (
        <Command.Group heading={<GroupHeader icon={ArrowDown} label={t("returns")} count={results.returns.length} />}>
          {results.returns.map((row) => (
            <Command.Item key={row.id} value={`return-${row.id}`} onSelect={go(searchHref.return(row))} asChild>
              <ReturnRow row={row} query={query} today={today} locale={locale} />
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {results.vehicles.length > 0 && (
        <Command.Group heading={<GroupHeader icon={Truck} label={t("vehicles")} count={results.vehicles.length} />}>
          {results.vehicles.map((row) => (
            <Command.Item key={row.id} value={`vehicle-${row.id}`} onSelect={go(searchHref.vehicle(row))} asChild>
              <VehicleRow row={row} query={query} locale={locale} />
            </Command.Item>
          ))}
        </Command.Group>
      )}
    </>
  );
}

/**
 * Guided empty state — contract Surface 2 "No-results". A plain element rather
 * than cmdk's `Command.Empty`: with `shouldFilter={false}` the list is whatever the
 * server returned, so emptiness is already known here, and `Command.Empty` would
 * additionally suppress itself while a request is in flight.
 */
function NoResults({ query, mobile = false, t }: { query: string; mobile?: boolean; t: Translate }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span
        className={cn(
          "bg-background text-muted-foreground flex items-center justify-center rounded-[14px]",
          mobile ? "size-[60px]" : "size-[52px]",
        )}
      >
        <Search className="size-5" />
      </span>
      <span className="text-foreground mt-3 block text-[15px] font-bold">
        {t("noResults")} „{query}”
      </span>
      <span className="text-muted-foreground mt-1.5 block max-w-[340px] text-[12.5px]">{t("noResultsHint")}</span>
    </div>
  );
}

function QuickJumpGroup({
  jumps,
  onNavigate,
  mobile = false,
  t,
}: {
  jumps: QuickJump[];
  onNavigate: () => void;
  mobile?: boolean;
  t: Translate;
}) {
  return (
    <Command.Group heading={<GroupHeader label={t("quickJumps")} />}>
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

/**
 * Desktop panel footer — the keyboard hints, in EVERY phase (contract Surface 2
 * `PanelFooter`). It used to swap to an accent "see all" line once there were
 * results; with the results page gone there is nowhere to link out to, and the
 * design draws the hints unconditionally.
 */
function PanelFooter({ t }: { t: Translate }) {
  return (
    <div className="bg-background flex items-center justify-between gap-3 border-t border-[var(--flota-hair-2)] px-4 py-2.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-[11.5px]">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        {t("navigate")}
        <span className="px-0.5">·</span>
        <Kbd>↵</Kbd>
        {t("open")}
      </span>
      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[11.5px]">
        <Kbd>esc</Kbd>
        {t("close")}
      </span>
    </div>
  );
}
