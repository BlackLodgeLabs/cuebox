"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrivalRise } from "@/components/home-arrival";
import { Icon } from "@/components/icon";
import { SectionHeader } from "@/components/section-header";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WhereToWatchSheet } from "@/components/where-to-watch-sheet";
import { ErrorState } from "@/components/error-state";
import { useFilms, useHomeActiveFilms } from "@/hooks/use-films";
import { useFilmWatchProviders } from "@/hooks/use-watch-providers";
import { filmDetailLine, firstServiceName } from "@/lib/programme-format";
import { fillHomeRows, type HomeRowFilm } from "@/lib/home-rows";
import { surpriseOffset } from "@/lib/surprise-pick";
import { todayFeatureOffset, ukCalendarDate } from "@/lib/today-feature";
import type { FilmSummary } from "@/types/api";

const RAIL_LIMIT = 12;

function toRowFilm(film: FilmSummary): HomeRowFilm {
  return {
    id: film.id,
    title: film.title,
    posterUrl: film.poster_url,
    genres: film.genres ?? [],
    tones: film.tones ?? [],
    emotionalOutcomes: film.emotional_outcomes ?? [],
    runtime: film.runtime,
  };
}

export function HomeScreen() {
  const catalogue = useHomeActiveFilms();

  if (catalogue.isLoading) {
    return (
      <div data-testid="home-loading" className="min-h-[70svh] animate-pulse bg-cb-surface" />
    );
  }

  if (catalogue.isError) {
    return (
      <ErrorState
        message="Could not reach the API. Make sure the backend is running."
        onRetry={() => void catalogue.refetch()}
      />
    );
  }

  const total = catalogue.data?.total ?? 0;
  if (total === 0) {
    return <EmptyHome />;
  }

  return (
    <FilledHome
      total={total}
      films={(catalogue.data?.films ?? []).map(toRowFilm)}
    />
  );
}

function EmptyHome() {
  return (
    <ArrivalRise index={0} className="px-4 py-16">
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <h1 className="font-display text-cb-page">Nothing on your watchlist yet</h1>
        <p className="font-ui text-cb-body text-cb-muted">
          Import a Letterboxd watchlist and a film will be waiting here each day.
        </p>
        <Button asChild className="w-full">
          <Link href="/import">Import watchlist</Link>
        </Button>
      </div>
    </ArrivalRise>
  );
}

function FilledHome({ total, films }: { total: number; films: HomeRowFilm[] }) {
  const ukDate = ukCalendarDate(new Date());
  const offset = todayFeatureOffset(total, ukDate);
  const featureQuery = useFilms(
    { status: "active", limit: 1, offset },
    { enabled: total > 0 },
  );
  const feature = featureQuery.data?.data[0] ?? null;
  const rows = fillHomeRows(films, ukDate);
  const [watchOpen, setWatchOpen] = useState(false);
  const [watchFilmId, setWatchFilmId] = useState<string | null>(null);
  const [watchFilmTitle, setWatchFilmTitle] = useState<string | undefined>();
  const [surpriseAt, setSurpriseAt] = useState<number | null>(null);

  const openWatch = (filmId: string, title: string) => {
    setWatchFilmId(filmId);
    setWatchFilmTitle(title);
    setWatchOpen(true);
  };

  return (
    <div data-testid="home-screen">
      <FeatureHero
        film={feature}
        loading={featureQuery.isLoading}
        onWhereToWatch={() => {
          if (!feature) return;
          openWatch(feature.id, feature.title);
        }}
        onSurprise={() => setSurpriseAt(surpriseOffset(total, offset))}
      />

      {rows.length > 0 ? (
        <div className="space-y-8 px-4 pb-8 pt-8">
          {rows.map((row, index) => (
            <ArrivalRise key={row.id} index={index + 1}>
              <div className="cb-rule" />
              <section aria-label={row.title} className="space-y-3">
                <SectionHeader
                  title={row.title}
                  action={
                    <Link
                      href={row.seeAllHref}
                      className="font-ui text-cb-caption text-cb-teal"
                    >
                      See all
                    </Link>
                  }
                />
                <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                  {row.films.slice(0, RAIL_LIMIT).map((item) => (
                    <li key={item.id} className="w-[104px] shrink-0">
                      <Link href={`/watchlist/${item.id}`} className="block">
                        <div className="relative aspect-[2/3] overflow-hidden rounded-cb-sm bg-cb-surface">
                          {item.posterUrl ? (
                            <img
                              src={item.posterUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 font-ui text-cb-caption text-cb-text">
                          {item.title}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </ArrivalRise>
          ))}
        </div>
      ) : null}

      <WhereToWatchSheet
        filmId={watchFilmId}
        filmTitle={watchFilmTitle}
        open={watchOpen}
        onOpenChange={setWatchOpen}
      />
      <SurpriseSheet
        total={total}
        offset={surpriseAt}
        avoid={offset}
        onOffsetChange={setSurpriseAt}
        onWhereToWatch={openWatch}
      />
    </div>
  );
}

function FeatureHero({
  film,
  loading,
  onWhereToWatch,
  onSurprise,
}: {
  film: FilmSummary | null;
  loading: boolean;
  onWhereToWatch: () => void;
  onSurprise: () => void;
}) {
  const providers = useFilmWatchProviders(film?.id ?? "", {
    enabled: Boolean(film?.id),
  });
  const service = firstServiceName(providers.data?.categories ?? []);
  const meta = film
    ? filmDetailLine(
        {
          year: film.year,
          genres: film.genres ?? [],
          runtime: film.runtime,
        },
        service,
      )
    : "";

  return (
    <section className="relative -mt-[52px] min-h-[70svh]">
      <div
        className="absolute inset-0 bg-cb-surface bg-cover bg-center"
        style={
          film?.backdrop_url ? { backgroundImage: `url(${film.backdrop_url})` } : undefined
        }
      />
      <div className="absolute inset-0 bg-gradient-to-t from-cb-bg via-cb-bg/75 to-cb-bg/20" />
      <div className="relative z-10 flex min-h-[70svh] w-full max-w-lg flex-col justify-end px-4 pb-2 pt-[68px]">
        {loading || !film ? (
          <div className="h-40 animate-pulse rounded-cb bg-cb-surface/40" />
        ) : (
          <>
            <ArrivalRise slot="title" className="space-y-2">
              <p className="font-ui text-cb-caption text-cb-text">
                Today&apos;s feature · from your watchlist
              </p>
              <h1 className="font-display text-cb-display text-cb-text">{film.title}</h1>
              {meta ? (
                <p className="font-mono text-cb-meta normal-case tracking-normal text-cb-text">
                  {meta}
                </p>
              ) : null}
              {film.synopsis ? (
                <p className="line-clamp-2 max-w-prose font-ui text-cb-body text-cb-text">
                  {film.synopsis}
                </p>
              ) : null}
              <Button
                type="button"
                size="lg"
                className="mt-6 h-12 w-full"
                onClick={onWhereToWatch}
              >
                <Icon name="play_arrow" size={18} />
                Where to watch
              </Button>
            </ArrivalRise>
            <ArrivalRise className="mt-3 space-y-3">
              <Button asChild variant="secondary" size="lg" className="h-12 w-full">
                <Link href="/recommend">Get a pick for tonight</Link>
              </Button>
              <button
                type="button"
                onClick={onSurprise}
                className="mx-auto flex min-h-11 items-center gap-2 px-3 font-ui text-cb-ui font-medium text-cb-teal"
              >
                <Icon name="shuffle" size={18} />
                Surprise me
              </button>
            </ArrivalRise>
          </>
        )}
      </div>
    </section>
  );
}

function SurpriseSheet({
  total,
  offset,
  avoid,
  onOffsetChange,
  onWhereToWatch,
}: {
  total: number;
  offset: number | null;
  avoid: number;
  onOffsetChange: (offset: number | null) => void;
  onWhereToWatch: (filmId: string, title: string) => void;
}) {
  const query = useFilms(
    { status: "active", limit: 1, offset: offset ?? 0 },
    { enabled: offset !== null && total > 0 },
  );
  const film = query.data?.data[0] ?? null;
  const providers = useFilmWatchProviders(film?.id ?? "", {
    enabled: offset !== null && Boolean(film?.id),
  });
  const service = firstServiceName(providers.data?.categories ?? []);
  const meta = film
    ? filmDetailLine(
        {
          year: film.year,
          genres: film.genres ?? [],
          runtime: film.runtime,
        },
        service,
      )
    : "";

  return (
    <Sheet
      open={offset !== null}
      onOpenChange={(open) => {
        if (!open) onOffsetChange(null);
      }}
    >
      <SheetContent side="bottom" className="overflow-y-auto">
        <SheetHeader className="pr-8 text-left">
          <SheetDescription>A suggestion from your watchlist</SheetDescription>
          <SheetTitle className="sr-only">Surprise me</SheetTitle>
        </SheetHeader>
        {query.isLoading || !film ? (
          <div className="h-40 animate-pulse rounded-cb bg-cb-bg" />
        ) : (
          <div className="space-y-4">
            <div
              className="aspect-video overflow-hidden rounded-cb bg-cb-bg bg-cover bg-center"
              style={
                film.backdrop_url
                  ? { backgroundImage: `url(${film.backdrop_url})` }
                  : undefined
              }
            />
            <div className="space-y-2">
              <h2 className="font-display text-cb-title text-cb-text">{film.title}</h2>
              {meta ? (
                <p className="font-mono text-cb-meta normal-case tracking-normal text-cb-muted">
                  {meta}
                </p>
              ) : null}
              {film.synopsis ? (
                <p className="line-clamp-2 font-ui text-cb-body text-cb-text">{film.synopsis}</p>
              ) : null}
            </div>
            <Button
              type="button"
              size="lg"
              className="h-12 w-full"
              onClick={() => onWhereToWatch(film.id, film.title)}
            >
              <Icon name="play_arrow" size={18} />
              Where to watch
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="h-12 w-full"
              onClick={() => onOffsetChange(surpriseOffset(total, offset ?? avoid))}
            >
              <Icon name="shuffle" size={18} />
              Another
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
