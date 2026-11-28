import type { FilmSortField, SortDirection } from "@/types/api";

export interface WatchlistSort {
  sort: FilmSortField;
  sortDir: SortDirection;
  label: string;
  hint: string;
}

/** Locked sort rows. Each row has one direction; the sheet does not offer a second. */
export const WATCHLIST_SORTS: readonly WatchlistSort[] = [
  { sort: "created_at", sortDir: "desc", label: "Date added", hint: "Newest first" },
  { sort: "title", sortDir: "asc", label: "Title", hint: "A to Z" },
  { sort: "year", sortDir: "desc", label: "Year", hint: "Newest first" },
  { sort: "runtime", sortDir: "asc", label: "Runtime", hint: "Shortest first" },
  { sort: "rating", sortDir: "desc", label: "Rating", hint: "Highest first" },
];

export function resolveWatchlistSort(
  sort: string | null,
  sortDir: string | null,
): WatchlistSort {
  return (
    WATCHLIST_SORTS.find((item) => item.sort === sort && item.sortDir === sortDir) ??
    WATCHLIST_SORTS[0]
  );
}

export function watchlistSortIsDefault(sort: WatchlistSort): boolean {
  return sort.sort === WATCHLIST_SORTS[0].sort && sort.sortDir === WATCHLIST_SORTS[0].sortDir;
}
