"use client";

import { Badge } from "@/components/ui/badge";
import { FilmPoster } from "@/components/film-poster";
import {
  formatDirectorRuntime,
  formatFilmTitle,
  ShortReasons,
  WatchlistDeepLink,
} from "@/components/ceremony/ceremony-shared";
import type { FilmResult } from "@/types/api";

export function CeremonyStageWinner({ film }: { film: FilmResult }) {
  const filmTitle = formatFilmTitle(film);
  const directorRuntime = formatDirectorRuntime(film);

  return (
    <section
      className="space-y-6"
      data-testid="ceremony-stage-winner"
      aria-label="Ceremony stage 1 — winner"
    >
      <div className="relative mx-auto aspect-[2/3] w-full max-w-xs overflow-hidden rounded bg-surface-high shadow-glow sm:max-w-sm">
        <FilmPoster
          src={film.poster_url}
          alt={film.title}
          size="fill"
          priority
          sizes="(max-width: 640px) 320px, 384px"
        />
      </div>

      <div className="space-y-3 text-center sm:text-left">
        <Badge variant="secondary" className="w-fit uppercase tracking-wider">
          TOP PICK
        </Badge>
        <h2 className="font-heading text-h2 leading-none">{filmTitle}</h2>
        {directorRuntime && (
          <p className="text-body-md text-muted-foreground">{directorRuntime}</p>
        )}
        <ShortReasons film={film} />
        <WatchlistDeepLink film={film} />
      </div>
    </section>
  );
}
