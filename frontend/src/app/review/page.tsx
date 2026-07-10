"use client";

import Link from "next/link";
import { useState } from "react";
import { FilmPoster } from "@/components/film-poster";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardGridSkeleton } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useReviewRequired } from "@/hooks/use-films";
import {
  useAcceptReview,
  useRejectReview,
  useResolveLetterboxdReview,
} from "@/hooks/use-reviews";

export default function ReviewPage() {
  const { data, isLoading, isError, refetch } = useReviewRequired({ limit: 50 });
  const accept = useAcceptReview();
  const reject = useRejectReview();
  const resolveLetterboxd = useResolveLetterboxdReview();
  const [uriDrafts, setUriDrafts] = useState<Record<string, string>>({});

  if (isLoading) {
    return <CardGridSkeleton count={2} />;
  }

  if (isError) {
    return (
      <ErrorState
        message="Could not load films pending review."
        onRetry={() => void refetch()}
      />
    );
  }

  const films = data?.data ?? [];

  if (films.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <h1 className="text-h1">All matches resolved</h1>
        <p className="text-muted-foreground">
          There are no films waiting for metadata review.
        </p>
        <Button asChild>
          <Link href="/recommend">Get a recommendation</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1">Review matches</h1>
        <p className="mt-1 text-body-md text-muted-foreground">
          Confirm TMDB matches or paste a Letterboxd film URL for manually added
          films.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {films.map((film) => {
          const isLetterboxdReview = film.review_type === "letterboxd_uri";
          const confidence = Math.round(film.confidence_score * 100);
          const isPending =
            (accept.isPending && accept.variables === film.review_id) ||
            (reject.isPending && reject.variables === film.review_id) ||
            (resolveLetterboxd.isPending &&
              resolveLetterboxd.variables?.reviewId === film.review_id);

          return (
            <Card key={film.review_id} className="bg-surface-high hover-glow">
              <CardHeader className="flex flex-row gap-4">
                <FilmPoster
                  src={film.candidate_payload.poster_url}
                  alt={film.candidate_payload.title}
                  size="sm"
                />
                <div className="flex-1">
                  <CardTitle className="text-base">
                    {isLetterboxdReview ? (
                      <>
                        {film.candidate_payload.title}
                        {film.candidate_payload.year
                          ? ` (${film.candidate_payload.year})`
                          : ""}
                      </>
                    ) : (
                      <Link
                        href={`/watchlist/${film.film_id}?editMatch=1`}
                        className="hover:text-primary hover:underline"
                      >
                        {film.title}
                        {film.year ? ` (${film.year})` : ""}
                      </Link>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isLetterboxdReview
                      ? "Paste the Letterboxd film URL to finish adding this film."
                      : `Proposed: ${film.candidate_payload.title}${
                          film.candidate_payload.year
                            ? ` (${film.candidate_payload.year})`
                            : ""
                        }`}
                  </CardDescription>
                  {!isLetterboxdReview && film.candidate_payload.director && (
                    <p className="text-sm text-muted-foreground">
                      {film.candidate_payload.director}
                    </p>
                  )}
                  {!isLetterboxdReview && (
                    <p className="mt-1 text-label-md normal-case tracking-normal text-secondary">
                      Confidence: {confidence}%
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLetterboxdReview ? (
                  <>
                    <Input
                      placeholder="https://letterboxd.com/film/... or boxd.it link"
                      value={uriDrafts[film.review_id] ?? ""}
                      onChange={(event) =>
                        setUriDrafts((current) => ({
                          ...current,
                          [film.review_id]: event.target.value,
                        }))
                      }
                      aria-label="Letterboxd film URL"
                    />
                    <Button
                      size="sm"
                      disabled={isPending || !uriDrafts[film.review_id]?.trim()}
                      onClick={() =>
                        resolveLetterboxd.mutate({
                          reviewId: film.review_id,
                          letterboxdUri: uriDrafts[film.review_id].trim(),
                        })
                      }
                    >
                      Submit Letterboxd URL
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => accept.mutate(film.review_id)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => reject.mutate(film.review_id)}
                    >
                      Reject
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/watchlist/${film.film_id}?editMatch=1`}>
                        Choose different match
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
