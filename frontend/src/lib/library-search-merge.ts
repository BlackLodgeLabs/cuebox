import type { FilmStatus, FilmSummary, TmdbSearchResultItem } from "@/types/api";

export const PICKER_LIBRARY_STATUSES: FilmStatus[] = [
  "active",
  "pending_watch_review",
  "watched",
];

export type LibrarySearchHit =
  | {
      kind: "library";
      key: string;
      film: FilmSummary;
    }
  | {
      kind: "tmdb";
      key: string;
      result: TmdbSearchResultItem;
    };

/**
 * Merge local library hits with TMDB results: local rows first; drop TMDB hits
 * whose tmdb_id already matches a local film.
 */
export function mergeLibraryAndTmdbResults(
  libraryFilms: FilmSummary[],
  tmdbResults: TmdbSearchResultItem[],
): LibrarySearchHit[] {
  const localByTmdbId = new Map<number, FilmSummary>();
  for (const film of libraryFilms) {
    if (film.tmdb_id != null) {
      localByTmdbId.set(film.tmdb_id, film);
    }
  }

  const libraryHits: LibrarySearchHit[] = libraryFilms.map((film) => ({
    kind: "library",
    key: `library:${film.id}`,
    film,
  }));

  const tmdbHits: LibrarySearchHit[] = [];
  for (const result of tmdbResults) {
    if (localByTmdbId.has(result.tmdb_id)) {
      continue;
    }
    tmdbHits.push({
      kind: "tmdb",
      key: `tmdb:${result.tmdb_id}`,
      result,
    });
  }

  return [...libraryHits, ...tmdbHits];
}

export function statusBadgeLabel(status: FilmStatus): string {
  switch (status) {
    case "active":
      return "On watchlist";
    case "pending_watch_review":
      return "Pending review";
    case "watched":
      return "Watched";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}
