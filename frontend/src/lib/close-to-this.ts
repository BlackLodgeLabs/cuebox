import type { SimilarFilm } from "@/types/api";

/** Close to this lists unwatched watchlist films only, and only on a watchlist page. */
export function closeToThisFilms(
  films: SimilarFilm[] | undefined,
  onWatchlist: boolean,
): SimilarFilm[] {
  if (!onWatchlist || !films) return [];
  return films.filter((film) => film.status === "active");
}
