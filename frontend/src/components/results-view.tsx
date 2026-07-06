"use client";

import Image from "next/image";
import Link from "next/link";
import { FilmPoster } from "@/components/film-poster";
import { WatchProviderIcons } from "@/components/watch-provider-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useFilmsWatchProviders } from "@/hooks/use-watch-providers";
import { cn } from "@/lib/utils";
import type {
  ConstraintRelaxation,
  FilmResult,
  ProfileSummary,
  RecommendationResponse,
} from "@/types/api";
import type { FilmWatchProvidersLookup } from "@/hooks/use-watch-providers";

interface ResultsViewProps {
  data: RecommendationResponse & { profile_summary?: ProfileSummary };
  showActions?: boolean;
}

function formatRating(rating: number | null): string {
  if (rating === null) return "—";
  return rating.toFixed(1);
}

function formatRottenTomatoesScore(score: number | null): string {
  if (score === null) return "—";
  return `${score}%`;
}

function formatFilmTitle(film: FilmResult): string {
  return `${film.title}${film.year ? ` (${film.year})` : ""}`;
}

function formatDirectorRuntime(film: FilmResult): string | null {
  const parts = [film.director, film.runtime ? `${film.runtime} min` : null].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

function RatingsRow({ film }: { film: FilmResult }) {
  return (
    <div className="flex gap-3 font-mono text-label-md normal-case tracking-normal text-muted-foreground">
      <span>TMDB: {formatRating(film.tmdb_rating)}</span>
      <span>RT: {formatRottenTomatoesScore(film.rotten_tomatoes_score)}</span>
    </div>
  );
}

function KeyFactorsSection({ factors }: { factors: string[] }) {
  if (factors.length === 0) return null;

  return (
    <div>
      <p className="text-label-md normal-case tracking-normal">Key factors</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {factors.map((factor) => (
          <Badge key={factor} variant="secondary">
            {factor}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function WhyItMatchesSection({ text }: { text: string }) {
  return (
    <div>
      <p className="text-label-md normal-case tracking-normal">Why it matches</p>
      <p className="text-body-lg text-muted-foreground">{text}</p>
    </div>
  );
}

function CardWatchlistLink({
  film,
  className,
}: {
  film: FilmResult;
  className?: string;
}) {
  const filmTitle = formatFilmTitle(film);

  return (
    <Link
      href={`/watchlist/${film.film_id}`}
      aria-label={`View ${filmTitle} in watchlist`}
      className={cn(
        "absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    />
  );
}

function WinnerResultCard({
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

function RunnerResultCard({
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
          <CardDescription>
            {formatDirectorRuntime(film) ?? ""}
          </CardDescription>
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

export function ResultsView({ data, showActions = true }: ResultsViewProps) {
  const filmIds = [data.winner.film_id, ...data.runners_up.map((film) => film.film_id)];
  const watchProvidersByFilm = useFilmsWatchProviders(filmIds);

  return (
    <div className="space-y-8">
      {data.constraint_relaxation && (
        <ConstraintRelaxationBanner relaxation={data.constraint_relaxation} />
      )}

      <WinnerResultCard
        film={data.winner}
        watchProviders={watchProvidersByFilm.get(data.winner.film_id)}
      />

      {data.runners_up.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-h2">Runners-up</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.runners_up.map((film) => (
              <RunnerResultCard
                key={film.film_id}
                film={film}
                watchProviders={watchProvidersByFilm.get(film.film_id)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {data.profile_summary && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">View answer summary</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Your preferences</SheetTitle>
                <SheetDescription>
                  Profile used for this recommendation
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <p className="text-body-lg">{data.profile_summary.narrative_profile}</p>
                <pre className="overflow-auto rounded bg-surface-high p-3 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(data.profile_summary.structured_profile, null, 2)}
                </pre>
              </div>
            </SheetContent>
          </Sheet>
        )}
        {showActions && (
          <>
            <Button asChild>
              <Link href="/recommend">New recommendation</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/history">View history</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
