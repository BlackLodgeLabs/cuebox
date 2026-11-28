"use client";

import Link from "next/link";
import { FilmPoster } from "@/components/film-poster";
import { Icon } from "@/components/icon";
import { InfiniteBatch } from "@/components/ui/infinite-scroll";
import { WATCHLIST_PAGE_SIZE } from "@/hooks/use-infinite-scroll";
import type { FilmSummary, WatchlistTab } from "@/types/api";

interface WatchlistPosterGridProps {
  films: FilmSummary[];
  tab: WatchlistTab;
}

function formatScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function filmMeta(film: FilmSummary): string | null {
  const parts: string[] = [];
  if (film.year != null) parts.push(String(film.year));
  if (film.runtime != null) parts.push(`${film.runtime}m`);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function WatchlistPoster({ film, tab }: { film: FilmSummary; tab: WatchlistTab }) {
  const meta = filmMeta(film);
  const showBadge = tab === "watched" && film.latest_score != null;
  const href = `/watchlist/${film.id}?tab=${tab}`;

  return (
    <Link href={href} className="block min-w-0">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-cb-sm bg-cb-surface">
        <FilmPoster
          src={film.poster_url}
          alt=""
          size="fill"
          className="rounded-cb-sm"
        />
        {showBadge ? (
          <span
            data-testid="watchlist-rating-badge"
            className="absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-0.5 rounded-cb-sm bg-black/70 px-1.5 py-0.5 font-ui text-[11px] font-medium leading-none text-cb-text"
          >
            <Icon name="star" filled size={12} className="text-cb-accent" />
            {formatScore(film.latest_score as number)}
          </span>
        ) : null}
      </div>
      <span className="mt-1.5 block truncate font-ui text-cb-caption font-medium text-cb-text">
        {film.title}
      </span>
      {meta ? (
        <span className="block truncate font-mono text-[11px] leading-snug text-cb-muted">
          {meta}
        </span>
      ) : null}
    </Link>
  );
}

function chunkFilms(films: FilmSummary[]): FilmSummary[][] {
  const pages: FilmSummary[][] = [];
  for (let index = 0; index < films.length; index += WATCHLIST_PAGE_SIZE) {
    pages.push(films.slice(index, index + WATCHLIST_PAGE_SIZE));
  }
  return pages;
}

export function WatchlistPosterGrid({ films, tab }: WatchlistPosterGridProps) {
  const pages = chunkFilms(films);

  return (
    <div
      data-testid="watchlist-poster-grid"
      className="grid grid-cols-3 gap-x-2 gap-y-4"
    >
      {pages.map((page, pageIndex) =>
        pageIndex === 0 ? (
          page.map((film) => <WatchlistPoster key={film.id} film={film} tab={tab} />)
        ) : (
          <InfiniteBatch
            key={page[0]?.id ?? pageIndex}
            className="contents"
            items={page}
            pageSize={WATCHLIST_PAGE_SIZE}
            getKey={(film) => film.id}
            renderItem={(film) => <WatchlistPoster film={film} tab={tab} />}
          />
        ),
      )}
    </div>
  );
}
