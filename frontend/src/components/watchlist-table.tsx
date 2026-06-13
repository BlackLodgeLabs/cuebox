"use client";

import Link from "next/link";
import { FilmPoster } from "@/components/film-poster";
import { Badge } from "@/components/ui/badge";
import { formatEnrichmentStatus } from "@/lib/enrichment-status";
import { cn } from "@/lib/utils";
import type { FilmSortField, FilmSummary, SortDirection } from "@/types/api";

const SORTABLE_COLUMNS: FilmSortField[] = [
  "title",
  "year",
  "created_at",
  "enrichment_status",
];

interface WatchlistTableProps {
  films: FilmSummary[];
  sort: FilmSortField;
  sortDir: SortDirection;
  onSort: (column: FilmSortField) => void;
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

export function WatchlistTable({
  films,
  sort,
  sortDir,
  onSort,
}: WatchlistTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] border-collapse text-body-md">
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
                label="Added"
                column="created_at"
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
          </tr>
        </thead>
        <tbody>
          {films.map((film) => (
            <tr
              key={film.id}
              className="border-b border-border/60 transition-colors hover:bg-surface-high/50"
            >
              <td className="px-4 py-3">
                <Link href={`/watchlist/${film.id}`} className="inline-block hover-glow">
                  <FilmPoster src={film.poster_url} alt={film.title} size="sm" />
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/watchlist/${film.id}`}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {film.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {film.year ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(film.created_at).toISOString().split("T")[0]}
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">
                  {formatEnrichmentStatus(film.enrichment_status)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { SORTABLE_COLUMNS };
