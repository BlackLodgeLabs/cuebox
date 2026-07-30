"use client";

import Image from "next/image";
import { FilmPoster } from "@/components/film-poster";
import { WatchProviderIcons } from "@/components/watch-provider-icons";
import {
  CardWatchlistLink,
  formatDirectorRuntime,
  formatFilmTitle,
  KeyFactorsSection,
  RatingsRow,
  WhyItMatchesSection,
} from "@/components/ceremony/ceremony-shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFilmsWatchProviders } from "@/hooks/use-watch-providers";
import type {
  ConstraintRelaxation,
  FilmResult,
  ProfileSummary,
  RecommendationResponse,
} from "@/types/api";
import type { FilmWatchProvidersLookup } from "@/hooks/use-watch-providers";

function WinnerRecordCard({
  film,
  watchProviders,
}: {
  film: FilmResult;
  watchProviders?: FilmWatchProvidersLookup;
}) {
  const filmTitle = formatFilmTitle(film);
  const directorRuntime = formatDirectorRuntime(film);

  return (
    <Card className="relative overflow-hidden border-primary bg-surface-high shadow-glow hover-glow">
      <div className="flex min-h-[320px]">
        <div className="relative w-[120px] shrink-0 sm:w-[160px] md:w-[200px]">
          {film.poster_url ? (
            <Image
              src={film.poster_url}
              alt={film.title}
              fill
              priority
              sizes="(max-width: 768px) 120px, 200px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-high text-label-md text-muted-foreground">
              NO POSTER
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-6">
          <Badge variant="secondary" className="w-fit uppercase tracking-wider">
            TOP PICK
          </Badge>
          <h3 className="font-heading text-h2 leading-none">{filmTitle}</h3>
          {directorRuntime && (
            <p className="text-body-md text-muted-foreground">{directorRuntime}</p>
          )}
          <RatingsRow film={film} />
          {watchProviders?.data && (
            <WatchProviderIcons categories={watchProviders.data.categories} />
          )}
          {film.synopsis && (
            <div>
              <p className="text-label-md normal-case tracking-normal">Synopsis</p>
              <p className="text-body-lg text-muted-foreground">{film.synopsis}</p>
            </div>
          )}
          <KeyFactorsSection factors={film.explanation.most_influential_factors} />
          <WhyItMatchesSection text={film.explanation.why_it_matches} />
          {film.explanation.why_it_beat_alternatives && (
            <div>
              <p className="text-label-md normal-case tracking-normal">
                Why it beat alternatives
              </p>
              <p className="text-body-lg text-muted-foreground">
                {film.explanation.why_it_beat_alternatives}
              </p>
            </div>
          )}
          {film.explanation.caveats && (
            <div>
              <p className="text-label-md normal-case tracking-normal">Caveats</p>
              <p className="text-body-lg text-muted-foreground">
                {film.explanation.caveats}
              </p>
            </div>
          )}
        </div>
      </div>
      <CardWatchlistLink film={film} />
    </Card>
  );
}

function RunnerRecordCard({
  film,
  watchProviders,
}: {
  film: FilmResult;
  watchProviders?: FilmWatchProvidersLookup;
}) {
  const filmTitle = formatFilmTitle(film);

  return (
    <Card className="relative hover-glow">
      <CardHeader className="flex flex-row gap-4">
        <FilmPoster src={film.poster_url} alt={film.title} size="md" />
        <div className="flex-1 space-y-1">
          <CardTitle>{filmTitle}</CardTitle>
          <CardDescription>{formatDirectorRuntime(film) ?? ""}</CardDescription>
          <RatingsRow film={film} />
          {watchProviders?.data && (
            <WatchProviderIcons categories={watchProviders.data.categories} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <KeyFactorsSection factors={film.explanation.most_influential_factors} />
        <WhyItMatchesSection text={film.explanation.why_it_matches} />
        {film.explanation.caveats && (
          <div>
            <p className="text-label-md normal-case tracking-normal">Caveats</p>
            <p className="text-body-lg text-muted-foreground">
              {film.explanation.caveats}
            </p>
          </div>
        )}
      </CardContent>
      <CardWatchlistLink film={film} />
    </Card>
  );
}

function ConstraintRelaxationBanner({
  relaxation,
}: {
  relaxation: ConstraintRelaxation;
}) {
  const entries = Object.entries(relaxation);
  if (entries.length === 0) return null;

  return (
    <div className="warning-banner p-4">
      <p className="text-label-md normal-case tracking-normal text-secondary">
        Some constraints were relaxed
      </p>
      <ul className="mt-2 list-inside list-disc text-body-md text-muted-foreground">
        {entries.map(([key, value]) => (
          <li key={key}>
            {key.replace(/_/g, " ")}:{" "}
            {value.relaxed_to !== undefined
              ? `relaxed to ${value.relaxed_to}`
              : value.relaxed
                ? "relaxed"
                : JSON.stringify(value)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CeremonyStageRecord({
  data,
}: {
  data: RecommendationResponse & { profile_summary?: ProfileSummary };
}) {
  const filmIds = [
    data.winner.film_id,
    ...data.runners_up.map((film) => film.film_id),
  ];
  const watchProvidersByFilm = useFilmsWatchProviders(filmIds);

  return (
    <section
      className="space-y-8"
      data-testid="ceremony-stage-record"
      aria-label="Ceremony stage 3 — session record"
    >
      {data.constraint_relaxation && (
        <ConstraintRelaxationBanner relaxation={data.constraint_relaxation} />
      )}

      <WinnerRecordCard
        film={data.winner}
        watchProviders={watchProvidersByFilm.get(data.winner.film_id)}
      />

      {data.runners_up.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-h2">Runners-up</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.runners_up.map((film) => (
              <RunnerRecordCard
                key={film.film_id}
                film={film}
                watchProviders={watchProvidersByFilm.get(film.film_id)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
