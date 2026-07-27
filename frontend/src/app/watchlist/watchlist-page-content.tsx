"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_WATCHLIST_FILTERS,
  WatchlistFilterSheet,
  type WatchlistFilterValues,
} from "@/components/watchlist-filter-sheet";
import { WatchlistPosterGrid } from "@/components/watchlist-poster-grid";
import { WatchReviewDialog, watchToDialogProps } from "@/components/watch-review-dialog";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/error-state";
import { PosterGridSkeleton } from "@/components/loading-state";
import { useFilmStatusTransition, useFilms } from "@/hooks/use-films";
import { cn } from "@/lib/utils";
import type { FilmSortField, FilmStatus, FilmSummary, SortDirection, WatchlistTab } from "@/types/api";

const LIMIT = 20;

function parseSort(value: string | null): FilmSortField {
  if (
    value === "title" ||
    value === "year" ||
    value === "created_at" ||
    value === "enrichment_status"
  ) {
    return value;
  }
  return "created_at";
}

function parseSortDir(value: string | null): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

function parseTab(value: string | null): WatchlistTab {
  if (value === "watched" || value === "archived") {
    return value;
  }
  return "active";
}

function tabLabel(tab: WatchlistTab, count: number | undefined): string {
  const names: Record<WatchlistTab, string> = {
    active: "Watchlist",
    watched: "Watched",
    archived: "Archived",
  };
  const total = count ?? "…";
  return `${names[tab]} (${total})`;
}

function filtersAreActive(values: WatchlistFilterValues): boolean {
  return (
    values.search !== "" ||
    values.enrichmentStatus !== "all" ||
    values.year !== "" ||
    values.createdFrom !== "" ||
    values.createdTo !== "" ||
    values.sort !== DEFAULT_WATCHLIST_FILTERS.sort ||
    values.sortDir !== DEFAULT_WATCHLIST_FILTERS.sortDir
  );
}

export function WatchlistPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tab = parseTab(searchParams.get("tab"));
  const sort = parseSort(searchParams.get("sort"));
  const sortDir = parseSortDir(searchParams.get("sort_dir"));
  const offset = Number(searchParams.get("offset") ?? "0") || 0;
  const yearFromUrl = searchParams.get("year") ?? "";
  const createdFrom = searchParams.get("created_from") ?? "";
  const createdTo = searchParams.get("created_to") ?? "";
  const enrichmentStatus = searchParams.get("enrichment_status") ?? "all";
  const searchFromUrl = searchParams.get("search") ?? "";

  const [filterOpen, setFilterOpen] = useState(false);

  const filterValues = useMemo<WatchlistFilterValues>(
    () => ({
      search: searchFromUrl,
      enrichmentStatus,
      year: yearFromUrl,
      sort,
      sortDir,
      createdFrom,
      createdTo,
    }),
    [
      createdFrom,
      createdTo,
      enrichmentStatus,
      searchFromUrl,
      sort,
      sortDir,
      yearFromUrl,
    ],
  );

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.replace(query ? `/watchlist?${query}` : "/watchlist");
    },
    [router, searchParams],
  );

  const applyFilters = useCallback(
    (values: WatchlistFilterValues) => {
      updateParams({
        search: values.search || null,
        enrichment_status:
          values.enrichmentStatus === "all" ? null : values.enrichmentStatus,
        year: values.year || null,
        sort: values.sort,
        sort_dir: values.sortDir,
        created_from: values.createdFrom || null,
        created_to: values.createdTo || null,
        offset: null,
      });
      setFilterOpen(false);
    },
    [updateParams],
  );

  const clearFilters = useCallback(() => {
    applyFilters(DEFAULT_WATCHLIST_FILTERS);
  }, [applyFilters]);

  const sharedFilters = useMemo(
    () => ({
      search: searchFromUrl || undefined,
      year: yearFromUrl ? Number(yearFromUrl) : undefined,
      created_from: createdFrom || undefined,
      created_to: createdTo || undefined,
      enrichment_status:
        enrichmentStatus === "all" ? undefined : enrichmentStatus,
      sort,
      sort_dir: sortDir,
      limit: LIMIT,
      offset,
    }),
    [
      createdFrom,
      createdTo,
      enrichmentStatus,
      offset,
      searchFromUrl,
      sort,
      sortDir,
      yearFromUrl,
    ],
  );

  const queryParams = useMemo(() => {
    if (tab === "watched") {
      return { ...sharedFilters, status: "watched" as const };
    }
    if (tab === "archived") {
      return { ...sharedFilters, status: "archived" as const };
    }
    return { ...sharedFilters, on_watchlist: true };
  }, [sharedFilters, tab]);

  const { data, isLoading, isError, refetch } = useFilms(queryParams);
  const activeCountQuery = useFilms({ on_watchlist: true, limit: 1 });
  const watchedCountQuery = useFilms({ status: "watched", limit: 1 });
  const archivedCountQuery = useFilms({ status: "archived", limit: 1 });
  const statusTransition = useFilmStatusTransition();
  const [reviewDialog, setReviewDialog] = useState<{
    filmId: string;
    filmTitle: string;
    cancelOnDismiss?: boolean;
    initialScore?: number | null;
    initialWatchedAt?: string;
    initialNotes?: string | null;
  } | null>(null);

  const openMarkWatchedDialog = async (film: FilmSummary) => {
    await statusTransition.mutateAsync({
      filmId: film.id,
      status: "pending_watch_review",
    });
    setReviewDialog({
      filmId: film.id,
      filmTitle: film.title,
      cancelOnDismiss: true,
    });
  };

  const openCompleteReviewDialog = (film: FilmSummary) => {
    const pendingProps = film.pending_watch
      ? watchToDialogProps(film.pending_watch)
      : { initialWatchedAt: film.latest_watched_at ?? undefined };
    setReviewDialog({
      filmId: film.id,
      filmTitle: film.title,
      cancelOnDismiss: false,
      ...pendingProps,
    });
  };

  const handleTabChange = (value: string) => {
    updateParams({
      tab: value === "active" ? null : value,
      offset: null,
    });
  };

  const handleStatusTransition = (filmId: string, status: FilmStatus) => {
    if (status === "pending_watch_review") {
      const film = data?.data.find((item) => item.id === filmId);
      if (film) {
        void openMarkWatchedDialog(film);
      }
      return;
    }
    statusTransition.mutate({ filmId, status });
  };

  const subtitle = (() => {
    if (!data) {
      return "Browse films and enrichment data from your Letterboxd watchlist.";
    }
    const count = data.pagination.total;
    const noun = count === 1 ? "film" : "films";
    if (tab === "watched") {
      return `${count} watched ${noun}`;
    }
    if (tab === "archived") {
      return `${count} archived ${noun}`;
    }
    return `${count} ${noun} on your watchlist`;
  })();

  const emptyState = (() => {
    if (tab === "watched") {
      return (
        <div className="py-12 text-center text-muted-foreground">
          No watched films yet. Mark films as watched from your watchlist.
        </div>
      );
    }
    if (tab === "archived") {
      return (
        <div className="py-12 text-center text-muted-foreground">
          No archived films. Archive films from your watchlist to see them here.
        </div>
      );
    }
    return (
      <div className="py-12 text-center text-muted-foreground">
        No films match your filters.{" "}
        <Link href="/import" className="text-primary hover:underline">
          Import your watchlist
        </Link>
      </div>
    );
  })();

  const filtersActive = filtersAreActive(filterValues);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1">Watchlist</h1>
          <p className="mt-1 text-body-md text-muted-foreground">{subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/search">Add film</Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="active">
              {tabLabel("active", activeCountQuery.data?.pagination.total)}
            </TabsTrigger>
            <TabsTrigger value="watched">
              {tabLabel("watched", watchedCountQuery.data?.pagination.total)}
            </TabsTrigger>
            <TabsTrigger value="archived">
              {tabLabel("archived", archivedCountQuery.data?.pagination.total)}
            </TabsTrigger>
          </TabsList>

          <Button
            type="button"
            variant="outline"
            aria-label="Filter and sort"
            className={cn(
              "min-h-[44px] min-w-[44px] gap-2",
              filtersActive && "border-primary text-primary",
            )}
            onClick={() => setFilterOpen(true)}
          >
            <Icon name="filter_list" size={20} />
            Filter
          </Button>
        </div>

        <TabsContent value={tab} className="mt-6 space-y-6">
          {isLoading && <PosterGridSkeleton count={6} />}

          {isError && (
            <ErrorState
              message="Could not load watchlist."
              onRetry={() => void refetch()}
            />
          )}

          {data && data.data.length === 0 && emptyState}

          {data && data.data.length > 0 && (
            <>
              <WatchlistPosterGrid
                films={data.data}
                tab={tab}
                onStatusTransition={handleStatusTransition}
                onMarkWatched={(film) => void openMarkWatchedDialog(film)}
                onCompleteReview={openCompleteReviewDialog}
                isStatusPending={statusTransition.isPending}
              />

              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() =>
                    updateParams({
                      offset: offset - LIMIT > 0 ? String(offset - LIMIT) : null,
                    })
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!data.pagination.has_more}
                  onClick={() => updateParams({ offset: String(offset + LIMIT) })}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <WatchlistFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        values={filterValues}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      {reviewDialog && (
        <WatchReviewDialog
          filmId={reviewDialog.filmId}
          filmTitle={reviewDialog.filmTitle}
          open
          cancelOnDismiss={reviewDialog.cancelOnDismiss}
          onOpenChange={(open) => {
            if (!open) setReviewDialog(null);
          }}
          initialScore={reviewDialog.initialScore}
          initialWatchedAt={reviewDialog.initialWatchedAt}
          initialNotes={reviewDialog.initialNotes}
        />
      )}
    </div>
  );
}
