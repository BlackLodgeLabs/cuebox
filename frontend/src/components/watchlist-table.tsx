"use client";

import Link from "next/link";
import { FilmPoster } from "@/components/film-poster";
import { FilmStatusActions } from "@/components/film-status-actions";
import { Badge } from "@/components/ui/badge";
import { formatEnrichmentStatus } from "@/lib/enrichment-status";
import { cn } from "@/lib/utils";
import type { FilmSortField, FilmStatus, FilmSummary, SortDirection, WatchlistTab } from "@/types/api";

const SORTABLE_COLUMNS: FilmSortField[] = [
  "title",
  "year",
  "created_at",
  "enrichment_status",
];

interface WatchlistTableProps {
  films: FilmSummary[];
  tab: WatchlistTab;
  sort: FilmSortField;
  sortDir: SortDirection;
  onSort: (column: FilmSortField) => void;
  onStatusTransition: (filmId: string, status: FilmStatus) => void;
  isStatusPending?: boolean;
}

function SortHeader({
  label,
  column,
  sort,
  sortDir,
  onSort,
}: {
  label: string;
  column: FilmSortField;
  sort: FilmSortField;
  sortDir: SortDirection;
  onSort: (column: FilmSortField) => void;
}) {
  const active = sort === column;
  const indicator = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "text-left text-label-md normal-case tracking-normal transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
      {indicator}
    </button>
  );
}

function formatDateColumn(film: FilmSummary, tab: WatchlistTab): string {
  if (tab === "active") {
    return new Date(film.created_at).toISOString().split("T")[0];
  }
  if (film.removed_at) {
    return new Date(film.removed_at).toISOString().split("T")[0];
  }
  return "—";
}

export function WatchlistTable({
  films,
  tab,
  sort,
  sortDir,
  onSort,
  onStatusTransition,
  isStatusPending = false,
}: WatchlistTableProps) {
  const dateColumnLabel = tab === "active" ? "Added" : "Removed";
  const dateSortColumn: FilmSortField = "created_at";

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] border-collapse text-body-md">
        <thead>
          <tr className="border-b border-border bg-surface-high text-left">
            <th className="px-4 py-3 text-label-md text-muted-foreground">Poster</th>
            <th className="px-4 py-3">
              <SortHeader
                label="Title"
                column="title"
                sort={sort}
                sortDir={sortDir}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3">
              <SortHeader
                label="Year"
                column="year"
                sort={sort}
                sortDir={sortDir}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3">
              <SortHeader
                label={dateColumnLabel}
                column={dateSortColumn}
                sort={sort}
                sortDir={sortDir}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3">
              <SortHeader
                label="Enrichment"
                column="enrichment_status"
                sort={sort}
                sortDir={sortDir}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3 text-label-md text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {films.map((film) => (
            <tr
              key={film.id}
              className="border-b border-border/60 transition-colors hover:bg-surface-high/50"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/watchlist/${film.id}?tab=${tab}`}
                  className="inline-block hover-glow"
                >
                  <FilmPoster src={film.poster_url} alt={film.title} size="sm" />
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/watchlist/${film.id}?tab=${tab}`}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {film.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {film.year ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDateColumn(film, tab)}
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">
                  {formatEnrichmentStatus(film.enrichment_status)}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <FilmStatusActions
                  status={film.status}
                  variant="table"
                  isPending={isStatusPending}
                  onTransition={(status) => onStatusTransition(film.id, status)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { SORTABLE_COLUMNS };
