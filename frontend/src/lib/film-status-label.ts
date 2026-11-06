import type { FilmStatus } from "@/types/api";

const FILM_STATUS_LABELS: Record<FilmStatus, string> = {
  active: "On watchlist",
  pending_watch_review: "Needs watch review",
  watched: "Watched",
  archived: "Archived",
};

export function formatFilmStatusLabel(status: FilmStatus | string): string {
  return FILM_STATUS_LABELS[status as FilmStatus] ?? status.replaceAll("_", " ");
}
