"use client";

import Link from "next/link";
import { FilmPoster } from "@/components/film-poster";
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
import { cn } from "@/lib/utils";
import type {
  ConstraintRelaxation,
  FilmResult,
  ProfileSummary,
  RecommendationResponse,
} from "@/types/api";

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

function FilmResultCard({
  film,
  isWinner = false,
}: {
  film: FilmResult;
  isWinner?: boolean;
}) {
  const filmTitle = `${film.title}${film.year ? ` (${film.year})` : ""}`;

  return (
    <Card
      className={cn(
        "relative",
        isWinner
          ? "border-primary bg-surface-high shadow-glow hover-glow"
          : "hover-glow",
      )}
    >
      <CardHeader className="flex flex-row gap-4">
        <FilmPoster src={film.poster_url} alt={film.title} size={isWinner ? "lg" : "md"} />
        <div className="flex-1 space-y-1">
          {isWinner && <Badge variant="secondary">Top pick</Badge>}
          <CardTitle>{filmTitle}</CardTitle>
          <CardDescription>
            {[film.director, film.runtime ? `${film.runtime} min` : null]
              .filter(Boolean)
              .join(" · ")}
          </CardDescription>
          <div className="flex gap-3 font-mono text-label-md normal-case tracking-normal text-muted-foreground">
            <span>TMDB: {formatRating(film.tmdb_rating)}</span>
            <span>RT: {formatRottenTomatoesScore(film.rotten_tomatoes_score)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isWinner && film.synopsis && (
          <div>
            <p className="text-label-md normal-case tracking-normal">Synopsis</p>
            <p className="text-body-lg text-muted-foreground">{film.synopsis}</p>
          </div>
        )}
        <div>
          <p className="text-label-md normal-case tracking-normal">Why it matches</p>
          <p className="text-body-lg text-muted-foreground">
            {film.explanation.why_it_matches}
          </p>
        </div>
        {film.explanation.most_influential_factors.length > 0 && (
          <div>
            <p className="text-label-md normal-case tracking-normal">Key factors</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {film.explanation.most_influential_factors.map((factor) => (
                <Badge key={factor} variant="secondary">
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        )}
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
      </CardContent>
      <Link
        href={`/watchlist/${film.film_id}`}
        aria-label={`View ${filmTitle} in watchlist`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
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
  return (
    <div className="space-y-8">
      {data.constraint_relaxation && (
        <ConstraintRelaxationBanner relaxation={data.constraint_relaxation} />
      )}

      <FilmResultCard film={data.winner} isWinner />

      {data.runners_up.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-h2">Runners-up</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.runners_up.map((film) => (
              <FilmResultCard key={film.film_id} film={film} />
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
