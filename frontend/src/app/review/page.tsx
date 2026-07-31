"use client";

import Link from "next/link";
import { useState } from "react";
import { FilmPoster } from "@/components/film-poster";
import { OffTabPageHeader } from "@/components/off-tab-page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { Input } from "@/components/ui/input";
import { WatchReviewDialog, watchToDialogProps } from "@/components/watch-review-dialog";
import { useReviewRequired, useWatchReviewRequired } from "@/hooks/use-films";
import {
  useAcceptReview,
  useRejectReview,
  useResolveLetterboxdReview,
} from "@/hooks/use-reviews";

export default function ReviewPage() {
  const matchQuery = useReviewRequired({ limit: 50 });
  const watchQuery = useWatchReviewRequired({ limit: 50 });
  const accept = useAcceptReview();
  const reject = useRejectReview();
  const resolveLetterboxd = useResolveLetterboxdReview();
  const [uriDrafts, setUriDrafts] = useState<Record<string, string>>({});
  const [watchDialog, setWatchDialog] = useState<{
    filmId: string;
    filmTitle: string;
    initialScore?: number | null;
    initialWatchedAt?: string;
    initialNotes?: string | null;
  } | null>(null);

  const isLoading = matchQuery.isLoading || watchQuery.isLoading;
  const isError = matchQuery.isError || watchQuery.isError;

  if (isLoading) {
    return <CardGridSkeleton count={2} />;
  }

  if (isError) {
    return (
      <ErrorState
        message="Could not load pending reviews."
        onRetry={() => {
          void matchQuery.refetch();
          void watchQuery.refetch();
        }}
      />
    );
  }

  const matchFilms = matchQuery.data?.data ?? [];
  const watchFilms = watchQuery.data?.data ?? [];

  if (matchFilms.length === 0 && watchFilms.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <OffTabPageHeader
          title="All caught up"
          subtitle="There are no metadata matches or watch diary entries waiting for review."
        />
        <div className="text-center">
          <Button asChild>
            <Link href="/recommend">Get a recommendation</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <OffTabPageHeader
        title="Review"
        subtitle="Confirm metadata matches and complete watch diary entries."
      />

      {matchFilms.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-h2">Match review</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {matchFilms.map((film) => {
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
                          size="lg"
                          className="min-h-11 w-full sm:w-auto"
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
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                          size="lg"
                          className="min-h-11 w-full sm:w-auto"
                          disabled={isPending}
                          onClick={() => accept.mutate(film.review_id)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          className="min-h-11 w-full sm:w-auto"
                          disabled={isPending}
                          onClick={() => reject.mutate(film.review_id)}
                        >
                          Reject
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          className="min-h-11 w-full sm:w-auto"
                          asChild
                        >
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
        </section>
      )}

      {watchFilms.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-h2">Watched films to review</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {watchFilms.map((film) => (
              <Card
                key={film.film_id}
                className="cursor-pointer bg-surface-high hover-glow"
                onClick={() =>
                  setWatchDialog({
                    filmId: film.film_id,
                    filmTitle: film.title,
                    ...watchToDialogProps(film.pending_watch),
                  })
                }
              >
                <CardHeader className="flex flex-row gap-4">
                  <FilmPoster src={film.poster_url} alt={film.title} size="sm" />
                  <div>
                    <CardTitle className="text-base">
                      {film.title}
                      {film.year ? ` (${film.year})` : ""}
                    </CardTitle>
                    <CardDescription>
                      Watched {film.pending_watch.watched_at}
                      {film.pending_watch.score != null &&
                      film.pending_watch.score > 0.5
                        ? ` · ${film.pending_watch.score}★`
                        : ""}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      )}

      {watchDialog && (
        <WatchReviewDialog
          filmId={watchDialog.filmId}
          filmTitle={watchDialog.filmTitle}
          open
          onOpenChange={(open) => {
            if (!open) setWatchDialog(null);
          }}
          initialScore={watchDialog.initialScore}
          initialWatchedAt={watchDialog.initialWatchedAt}
          initialNotes={watchDialog.initialNotes}
        />
      )}
    </div>
  );
}
