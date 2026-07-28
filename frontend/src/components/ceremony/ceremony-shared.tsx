"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FilmResult } from "@/types/api";

export function formatFilmTitle(film: FilmResult): string {
  return `${film.title}${film.year ? ` (${film.year})` : ""}`;
}

export function formatDirectorRuntime(film: FilmResult): string | null {
  const parts = [film.director, film.runtime ? `${film.runtime} min` : null].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatRating(rating: number | null): string {
  if (rating === null) return "—";
  return rating.toFixed(1);
}

export function formatRottenTomatoesScore(score: number | null): string {
  if (score === null) return "—";
  return `${score}%`;
}

export function RatingsRow({ film }: { film: FilmResult }) {
  return (
    <div className="flex gap-3 font-mono text-label-md normal-case tracking-normal text-muted-foreground">
      <span>TMDB: {formatRating(film.tmdb_rating)}</span>
      <span>RT: {formatRottenTomatoesScore(film.rotten_tomatoes_score)}</span>
    </div>
  );
}

export function KeyFactorsSection({ factors }: { factors: string[] }) {
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

export function WhyItMatchesSection({ text }: { text: string }) {
  return (
    <div>
      <p className="text-label-md normal-case tracking-normal">Why it matches</p>
      <p className="text-body-lg text-muted-foreground">{text}</p>
    </div>
  );
}

export function ShortReasons({ film }: { film: FilmResult }) {
  return (
    <div className="space-y-3" data-testid="short-reasons">
      <KeyFactorsSection factors={film.explanation.most_influential_factors} />
      <WhyItMatchesSection text={film.explanation.why_it_matches} />
    </div>
  );
}

export function CardWatchlistLink({
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

export function WatchlistDeepLink({ film }: { film: FilmResult }) {
  const filmTitle = formatFilmTitle(film);
  return (
    <Link
      href={`/watchlist/${film.film_id}`}
      className="text-body-md text-secondary underline-offset-4 hover:underline"
    >
      View {filmTitle} in watchlist
    </Link>
  );
}
