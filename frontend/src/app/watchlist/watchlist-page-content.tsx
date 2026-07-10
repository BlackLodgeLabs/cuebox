"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WatchlistTable } from "@/components/watchlist-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/error-state";
import { CardGridSkeleton } from "@/components/loading-state";
import { useFilms } from "@/hooks/use-films";
import { formatEnrichmentStatus } from "@/lib/enrichment-status";
import type { FilmSortField, SortDirection } from "@/types/api";

const LIMIT = 20;
const ENRICHMENT_OPTIONS = [
  "pending",
  "matching",
  "review_required",
  "enriching",
  "ready",
  "failed",
] as const;

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

export function WatchlistPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sort = parseSort(searchParams.get("sort"));
  const sortDir = parseSortDir(searchParams.get("sort_dir"));
  const offset = Number(searchParams.get("offset") ?? "0") || 0;
  const yearFromUrl = searchParams.get("year") ?? "";
  const createdFrom = searchParams.get("created_from") ?? "";
  const createdTo = searchParams.get("created_to") ?? "";
  const enrichmentStatus = searchParams.get("enrichment_status") ?? "all";
  const searchFromUrl = searchParams.get("search") ?? "";

  const [search, setSearch] = useState(searchFromUrl);
  const [yearInput, setYearInput] = useState(yearFromUrl);

  useEffect(() => {
    setSearch(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    setYearInput(yearFromUrl);
  }, [yearFromUrl]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search === searchFromUrl) return;
      updateParams({ search: search || null, offset: null });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchFromUrl, updateParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (yearInput === yearFromUrl) return;
      updateParams({ year: yearInput || null, offset: null });
    }, 300);
    return () => clearTimeout(timer);
  }, [yearInput, yearFromUrl, updateParams]);

  const queryParams = useMemo(
    () => ({
      on_watchlist: true,
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

  const { data, isLoading, isError, refetch } = useFilms(queryParams);

  const handleSort = (column: FilmSortField) => {
    const nextDir =
      sort === column ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    updateParams({
      sort: column,
      sort_dir: nextDir,
      offset: null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1">Watchlist</h1>
          <p className="mt-1 text-body-md text-muted-foreground">
            {data
              ? `${data.pagination.total} film${data.pagination.total === 1 ? "" : "s"} on your watchlist`
              : "Browse films and enrichment data from your Letterboxd watchlist."}
          </p>
        </div>
        <Button asChild>
          <Link href="/watchlist/add">Add film</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Filter by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Input
          type="number"
          placeholder="Year"
          value={yearInput}
          onChange={(e) => setYearInput(e.target.value)}
          className="max-w-[120px]"
        />
        <Input
          type="date"
          value={createdFrom}
          onChange={(e) =>
            updateParams({ created_from: e.target.value || null, offset: null })
          }
          className="max-w-[160px]"
        />
        <Input
          type="date"
          value={createdTo}
          onChange={(e) =>
            updateParams({ created_to: e.target.value || null, offset: null })
          }
          className="max-w-[160px]"
        />
        <Select
          value={enrichmentStatus}
          onValueChange={(value) =>
            updateParams({
              enrichment_status: value === "all" ? null : value,
              offset: null,
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Enrichment status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ENRICHMENT_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {formatEnrichmentStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <CardGridSkeleton count={4} />}

      {isError && (
        <ErrorState
          message="Could not load watchlist."
          onRetry={() => void refetch()}
        />
      )}

      {data && data.data.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No films match your filters.{" "}
          <Link href="/import" className="text-primary hover:underline">
            Import your watchlist
          </Link>
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <WatchlistTable
            films={data.data}
            sort={sort}
            sortDir={sortDir}
            onSort={handleSort}
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
    </div>
  );
}
