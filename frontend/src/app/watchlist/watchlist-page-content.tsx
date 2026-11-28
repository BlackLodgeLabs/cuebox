"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Icon } from "@/components/icon";
import { PosterGridSkeleton } from "@/components/loading-state";
import { LoadingMore } from "@/components/ui/infinite-scroll";
import {
  WatchlistFilterSheet,
  type WatchlistFilterValues,
} from "@/components/watchlist-filter-sheet";
import { WatchlistPosterGrid } from "@/components/watchlist-poster-grid";
import { WatchlistSortSheet } from "@/components/watchlist-sort-sheet";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { WATCHLIST_PAGE_SIZE, useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { getFilms } from "@/lib/api-client";
import { watchlistSwitchMotion } from "@/lib/motion";
import {
  resolveWatchlistSort,
  watchlistSortIsDefault,
  type WatchlistSort,
} from "@/lib/watchlist-sort";
import { cn } from "@/lib/utils";
import type { FilmSummary, RuntimePreference, WatchlistTab } from "@/types/api";

const PILLS: { id: WatchlistTab; label: string; noun: string }[] = [
  { id: "active", label: "Unwatched", noun: "unwatched" },
  { id: "watched", label: "Watched", noun: "watched" },
  { id: "archived", label: "Archived", noun: "archived" },
];

function parseTab(value: string | null): WatchlistTab {
  if (value === "watched" || value === "archived") return value;
  return "active";
}

function parseGenres(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseRuntime(value: string | null): RuntimePreference {
  if (value === "le_90" || value === "le_120" || value === "le_150") return value;
  return "any";
}

export function WatchlistPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduced = useReducedMotion();
  const switchMotion = watchlistSwitchMotion(reduced);
  const [crossfade, setCrossfade] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    setCrossfade(true);
  }, []);

  const tab = parseTab(searchParams.get("tab"));
  const sort = resolveWatchlistSort(searchParams.get("sort"), searchParams.get("sort_dir"));
  const genres = parseGenres(searchParams.get("genres"));
  const runtime = parseRuntime(searchParams.get("runtime"));
  const pill = PILLS.find((item) => item.id === tab) ?? PILLS[0];
  const filtersActive = genres.length > 0 || runtime !== "any";

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `/watchlist?${query}` : "/watchlist");
    },
    [router, searchParams],
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const rawSort = params.get("sort");
    const rawDir = params.get("sort_dir");
    const resolved = resolveWatchlistSort(rawSort, rawDir);
    let changed = false;

    if (params.has("offset")) {
      params.delete("offset");
      changed = true;
    }
    if (watchlistSortIsDefault(resolved)) {
      if (params.has("sort") || params.has("sort_dir")) {
        params.delete("sort");
        params.delete("sort_dir");
        changed = true;
      }
    } else if (rawSort !== resolved.sort || rawDir !== resolved.sortDir) {
      params.set("sort", resolved.sort);
      params.set("sort_dir", resolved.sortDir);
      changed = true;
    }
    const rawRuntime = params.get("runtime");
    if (rawRuntime != null && parseRuntime(rawRuntime) === "any") {
      params.delete("runtime");
      changed = true;
    }
    if (!changed) return;
    const next = params.toString();
    router.replace(next ? `/watchlist?${next}` : "/watchlist");
  }, [router, searchParams]);

  const list = useInfiniteScroll<FilmSummary>({
    queryKey: [
      "watchlist",
      tab,
      sort.sort,
      sort.sortDir,
      genres.join("\u0000"),
      runtime,
    ],
    pageSize: WATCHLIST_PAGE_SIZE,
    fetchPage: ({ offset, limit }) =>
      getFilms({
        status: tab,
        sort: sort.sort,
        sort_dir: sort.sortDir,
        ...(genres.length > 0 ? { genres } : {}),
        ...(runtime === "any" ? {} : { runtime }),
        offset,
        limit,
      }),
  });

  function selectTab(next: WatchlistTab) {
    updateParams({
      tab: next === "active" ? null : next,
      offset: null,
    });
  }

  function selectSort(next: WatchlistSort) {
    updateParams({
      sort: watchlistSortIsDefault(next) ? null : next.sort,
      sort_dir: watchlistSortIsDefault(next) ? null : next.sortDir,
      offset: null,
    });
  }

  function applyFilters(values: WatchlistFilterValues) {
    updateParams({
      genres: values.genres.length > 0 ? values.genres.join(",") : null,
      runtime: values.runtime === "any" ? null : values.runtime,
      offset: null,
    });
    setFilterOpen(false);
  }

  const showEmpty = !list.isLoading && !list.isError && list.items.length === 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-cb-page leading-none">Watchlist</h1>
          <p className="mt-1 min-h-[1.35em] font-mono text-cb-caption text-cb-muted">
            {list.total != null ? `${list.total} ${pill.noun}` : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-cb-pill border border-cb-divider bg-cb-bg px-3 font-ui text-cb-caption text-cb-text"
            aria-haspopup="dialog"
            aria-label={`Sort by ${sort.label}`}
            onClick={() => setSortOpen(true)}
          >
            <Icon name="swap_vert" size={16} />
            {sort.label}
          </button>
          <button
            type="button"
            aria-label="Filter"
            aria-pressed={filtersActive}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-cb-pill border bg-cb-bg",
              filtersActive
                ? "border-cb-teal text-cb-teal"
                : "border-cb-divider text-cb-text",
            )}
            onClick={() => setFilterOpen(true)}
          >
            <Icon name="tune" size={18} />
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Watchlist view" className="mt-4 flex gap-2">
        {PILLS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "inline-flex h-9 items-center rounded-cb-pill border px-3 font-ui text-cb-caption",
                selected
                  ? "border-cb-teal text-cb-teal"
                  : "border-cb-divider text-cb-text",
              )}
              onClick={() => selectTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="relative mt-4">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={tab}
            data-cb-watchlist-crossfade=""
            data-out-ms={switchMotion.outMs}
            data-in-ms={switchMotion.inMs}
            data-delay-ms={switchMotion.delayMs}
            initial={crossfade ? { opacity: 0 } : false}
            animate={{ opacity: 1, transition: switchMotion.in }}
            exit={{ opacity: 0, transition: switchMotion.out }}
          >
            {list.isLoading && list.items.length === 0 ? (
              <PosterGridSkeleton count={9} />
            ) : null}
            {list.isError && list.items.length === 0 ? (
              <ErrorState
                message="Could not load watchlist."
                onRetry={() => void list.refetch()}
              />
            ) : null}
            {showEmpty ? <EmptyWatchlist tab={tab} filtered={filtersActive} /> : null}
            {list.items.length > 0 ? (
              <WatchlistPosterGrid films={list.items} tab={tab} />
            ) : null}
            {list.isFetchingNextPage ? <LoadingMore /> : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <WatchlistSortSheet
        open={sortOpen}
        onOpenChange={setSortOpen}
        value={sort}
        onSelect={selectSort}
      />
      <WatchlistFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        status={tab}
        values={{ genres, runtime }}
        onApply={applyFilters}
      />
    </div>
  );
}

function EmptyWatchlist({
  tab,
  filtered,
}: {
  tab: WatchlistTab;
  filtered: boolean;
}) {
  if (filtered) {
    return (
      <p className="py-12 text-center font-ui text-cb-body text-cb-muted">
        No films match these filters.
      </p>
    );
  }
  if (tab === "watched") {
    return (
      <p className="py-12 text-center font-ui text-cb-body text-cb-muted">
        No watched films yet.
      </p>
    );
  }
  if (tab === "archived") {
    return (
      <p className="py-12 text-center font-ui text-cb-body text-cb-muted">
        No archived films.
      </p>
    );
  }
  return (
    <p className="py-12 text-center font-ui text-cb-body text-cb-muted">
      Nothing on your watchlist yet.{" "}
      <Link href="/import" className="text-cb-teal hover:underline">
        Import your watchlist
      </Link>
    </p>
  );
}
