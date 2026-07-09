"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FilmPoster } from "@/components/film-poster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGlobalTmdbSearch } from "@/hooks/use-films";
import { cn } from "@/lib/utils";
import type { TmdbSearchResultItem } from "@/types/api";

interface AddFilmSearchProps {
  onConfirm: (selected: TmdbSearchResultItem) => void;
  isSubmitting?: boolean;
  resultMessage?: React.ReactNode;
}

export function AddFilmSearch({
  onConfirm,
  isSubmitting = false,
  resultMessage,
}: AddFilmSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debouncedYearFilter, setDebouncedYearFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TmdbSearchResultItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedYearFilter(yearFilter), 300);
    return () => clearTimeout(timer);
  }, [yearFilter]);

  useEffect(() => {
    setPage(1);
    setSelected(null);
  }, [debouncedQuery, debouncedYearFilter]);

  const parsedYear = debouncedYearFilter.trim()
    ? Number(debouncedYearFilter)
    : undefined;
  const yearParam =
    parsedYear !== undefined && !Number.isNaN(parsedYear) ? parsedYear : undefined;

  const search = useGlobalTmdbSearch({ q: debouncedQuery, year: yearParam, page });
  const results = search.data?.data ?? [];
  const pagination = search.data?.pagination;
  const isSearchPending = search.isLoading || search.isFetching;
  const activePage =
    pagination && !search.isFetching
      ? Math.floor(pagination.offset / pagination.limit) + 1
      : page;
  const totalPages =
    pagination && pagination.limit > 0
      ? Math.max(1, Math.ceil(pagination.total / pagination.limit))
      : 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search TMDB…"
          aria-label="TMDB search query"
        />
        <Input
          value={yearFilter}
          onChange={(event) => setYearFilter(event.target.value)}
          placeholder="Year"
          inputMode="numeric"
          aria-label="Release year filter"
        />
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {isSearchPending && (
          <p className="text-sm text-muted-foreground">Searching TMDB…</p>
        )}
        {!isSearchPending && search.isError && (
          <p className="text-sm text-destructive">
            Could not load search results. Check your TMDB API key and try again.
          </p>
        )}
        {!isSearchPending &&
          !search.isError &&
          results.length === 0 &&
          debouncedQuery && (
            <p className="text-sm text-muted-foreground">No results found.</p>
          )}
        {!isSearchPending &&
          results.map((result) => {
            const isSelected = selected?.tmdb_id === result.tmdb_id;
            return (
              <button
                key={result.tmdb_id}
                type="button"
                onClick={() => setSelected(result)}
                className={cn(
                  "flex w-full gap-3 rounded border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50",
                )}
              >
                <FilmPoster src={result.poster_url} alt={result.title} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {result.title}
                    {result.year ? ` (${result.year})` : ""}
                  </p>
                  {result.overview && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {result.overview}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={activePage <= 1 || isSearchPending}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <p className="text-sm text-muted-foreground">
            Page {activePage} of {totalPages}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!pagination.has_more || isSearchPending}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {resultMessage}

      <Button
        className="w-full"
        disabled={!selected || isSubmitting}
        onClick={() => selected && onConfirm(selected)}
      >
        Add to watchlist
      </Button>
    </div>
  );
}

export function AlreadyOnWatchlistMessage({ filmId }: { filmId: string }) {
  return (
    <p className="rounded border border-border bg-surface-high p-3 text-sm">
      Already on your watchlist.{" "}
      <Link href={`/watchlist/${filmId}`} className="text-primary hover:underline">
        View film
      </Link>
    </p>
  );
}
