"use client";

import Link from "next/link";
import { FilmPoster } from "@/components/film-poster";
import { FilmStatusActions } from "@/components/film-status-actions";
import { Icon } from "@/components/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FilmStatus, FilmSummary, WatchlistTab } from "@/types/api";

interface WatchlistPosterGridProps {
  films: FilmSummary[];
  tab: WatchlistTab;
  onStatusTransition: (filmId: string, status: FilmStatus) => void;
  onMarkWatched?: (film: FilmSummary) => void;
  onCompleteReview?: (film: FilmSummary) => void;
  isStatusPending?: boolean;
}

export function WatchlistPosterGrid({
  films,
  tab,
  onStatusTransition,
  onMarkWatched,
  onCompleteReview,
  isStatusPending = false,
}: WatchlistPosterGridProps) {
  return (
    <ul
      data-testid="watchlist-poster-grid"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      {films.map((film) => {
        const href = `/watchlist/${film.id}?tab=${tab}`;
        return (
          <li key={film.id} className="min-w-0">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded bg-surface-high">
              <Link
                href={href}
                className="absolute inset-0 block"
                aria-label={`View ${film.title}`}
              >
                <FilmPoster
                  src={film.poster_url}
                  alt={film.title}
                  size="fill"
                  className="rounded"
                />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Actions for ${film.title}`}
                    className="absolute right-1 top-1 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded bg-black/55 text-foreground backdrop-blur-sm hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <Icon name="more_horiz" size={22} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={4}>
                  <FilmStatusActions
                    status={film.status}
                    variant="menu"
                    isPending={isStatusPending}
                    onTransition={(status) => onStatusTransition(film.id, status)}
                    onMarkWatched={() => onMarkWatched?.(film)}
                    onCompleteReview={() => onCompleteReview?.(film)}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Link
              href={href}
              className="mt-2 block truncate text-body-md font-medium text-foreground hover:text-primary hover:underline"
            >
              {film.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
