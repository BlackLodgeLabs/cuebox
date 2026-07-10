"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AddFilmSearch,
  AlreadyOnWatchlistMessage,
  LinkedFilmConflictMessage,
  PendingReviewMessage,
} from "@/components/add-film-search";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAddToWatchlist, useFilm } from "@/hooks/use-films";
import { useToast } from "@/hooks/use-toast";
import { ApiClientError } from "@/lib/api-client";
import type { TmdbSearchResultItem } from "@/types/api";

export default function AddFilmPage() {
  const router = useRouter();
  const { toast } = useToast();
  const addToWatchlist = useAddToWatchlist();
  const [pendingFilmId, setPendingFilmId] = useState<string | null>(null);
  const [alreadyOnWatchlistId, setAlreadyOnWatchlistId] = useState<string | null>(
    null,
  );
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [conflictFilmId, setConflictFilmId] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const polling = useFilm(pendingFilmId ?? "", { pollWhileEnriching: true });

  useEffect(() => {
    if (!pendingFilmId || !polling.data) return;
    const status = polling.data.enrichment_status;
    if (status !== "ready" && status !== "failed") return;

    if (status === "ready") {
      toast({
        title: "Film added",
        description: `${polling.data.title} is ready on your watchlist.`,
      });
    } else {
      toast({
        title: "Enrichment failed",
        description: "The film was added but enrichment failed. Check the watchlist.",
        variant: "destructive",
      });
    }
    router.push(`/watchlist/${pendingFilmId}`);
  }, [pendingFilmId, polling.data, router, toast]);

  function clearInlineMessages() {
    setAlreadyOnWatchlistId(null);
    setPendingReviewId(null);
    setConflictFilmId(null);
    setConflictMessage(null);
  }

  async function handleConfirm(selected: TmdbSearchResultItem) {
    clearInlineMessages();
    try {
      const result = await addToWatchlist.mutateAsync({ tmdb_id: selected.tmdb_id });

      if (result.already_on_watchlist) {
        setAlreadyOnWatchlistId(result.film_id);
        return;
      }

      if (result.enrichment_status === "review_required") {
        setPendingReviewId(result.review_id ?? null);
        toast({
          title: "Letterboxd link needed",
          description:
            "Cuebox could not auto-link this film. Paste the Letterboxd URL on the review page.",
        });
        return;
      }

      if (result.restored) {
        toast({
          title: "Added back to your watchlist",
          description: `${selected.title} was restored to your active watchlist.`,
        });
        router.push(`/watchlist/${result.film_id}`);
        return;
      }

      setPendingFilmId(result.film_id);
      toast({
        title: "Adding film…",
        description: "Enriching metadata and semantic profile.",
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "CONFLICT") {
        const filmId = error.details?.find((detail) => detail.field === "film_id")
          ?.message;
        if (filmId) {
          setConflictFilmId(filmId);
          setConflictMessage(error.message);
          return;
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1">Add film to watchlist</h1>
          <p className="mt-1 text-body-md text-muted-foreground">
            Search TMDB, confirm your pick, and Cuebox will resolve Letterboxd and
            enrich the film.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/watchlist">Back to watchlist</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search TMDB</CardTitle>
          <CardDescription>
            Pick the correct movie. Cuebox links it to Letterboxd automatically when
            possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddFilmSearch
            onConfirm={(selected) => void handleConfirm(selected)}
            isSubmitting={addToWatchlist.isPending || Boolean(pendingFilmId)}
            resultMessage={
              <>
                {alreadyOnWatchlistId ? (
                  <AlreadyOnWatchlistMessage filmId={alreadyOnWatchlistId} />
                ) : null}
                {pendingReviewId ? (
                  <PendingReviewMessage reviewId={pendingReviewId} />
                ) : null}
                {conflictFilmId && conflictMessage ? (
                  <LinkedFilmConflictMessage
                    filmId={conflictFilmId}
                    message={conflictMessage}
                  />
                ) : null}
              </>
            }
          />
          {pendingFilmId && (
            <p className="mt-3 text-sm text-muted-foreground">
              Enriching film… this may take a moment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
