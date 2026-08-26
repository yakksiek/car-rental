// core
import { useEffect, useState } from "react";

// others
import type { SearchResults } from "../../types";

// Live search over `GET /api/search` for the ⌘K dropdown (S-13 Phase 3).
//
// Two things the naive version gets wrong, both handled here:
//   1. A FETCH PER KEYSTROKE. Typing "krzysztof" would fire nine requests. The
//      query is debounced (~200ms) — no debounce utility exists in the repo, so it
//      is a plain `setTimeout` cleared by the effect's own teardown.
//   2. OUT-OF-ORDER RESPONSES. Even debounced, a slow "krz" can land after a fast
//      "krzysztof" and overwrite fresher results with staler ones. Every in-flight
//      request is aborted by the same teardown, so only the newest can ever settle.
//
// Below `minLength` the hook answers with empty groups WITHOUT a round-trip — the
// resting dropdown asks the server for nothing (the endpoint and the RPC enforce
// the same floor independently).

const EMPTY: SearchResults = { reservations: [], returns: [], vehicles: [] };

export interface UseSearchOptions {
  /** Mirrors the endpoint's zod floor. */
  minLength?: number;
  debounceMs?: number;
}

export interface UseSearchResult {
  results: SearchResults;
  loading: boolean;
  /** True once a request has failed — the panel shows its empty state rather than a broken list. */
  failed: boolean;
}

/** What settled, and for which query — the pairing is what makes `loading` derivable. */
interface SettledSearch {
  forQuery: string;
  results: SearchResults;
  failed: boolean;
}

export function useSearch(query: string, { minLength = 2, debounceMs = 200 }: UseSearchOptions = {}): UseSearchResult {
  // ONE piece of state, written only from the fetch's own callbacks. `loading` and
  // the short-query reset are DERIVED below rather than stored: setting state
  // synchronously inside the effect (the obvious way to write this) triggers the
  // cascading re-render the React Compiler rejects, and would also flash stale
  // results for one frame on every keystroke.
  const [settled, setSettled] = useState<SettledSearch>({ forQuery: "", results: EMPTY, failed: false });

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minLength) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
          }
          return response.json() as Promise<SearchResults>;
        })
        .then((body) => {
          setSettled({ forQuery: trimmed, results: body, failed: false });
        })
        .catch(() => {
          // An abort is the expected path for a superseded query — the teardown
          // below already fired, so this instance must not touch state.
          if (controller.signal.aborted) {
            return;
          }
          setSettled({ forQuery: trimmed, results: EMPTY, failed: true });
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, minLength, debounceMs]);

  const trimmed = query.trim();
  // Results are shown only when they belong to the query on screen; anything else
  // is still in flight (or was never asked for), so the panel shows no stale rows.
  const isCurrent = settled.forQuery === trimmed;
  return {
    results: isCurrent ? settled.results : EMPTY,
    loading: trimmed.length >= minLength && !isCurrent,
    failed: isCurrent && settled.failed,
  };
}
