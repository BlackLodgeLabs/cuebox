"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { FilmDetailView } from "@/components/film-detail-view";
import { WatchReviewDialog } from "@/components/watch-review-dialog";
import { CardGridSkeleton } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useFilm, useFilmStatusTransition } from "@/hooks/use-films";
import { useToast } from "@/hooks/use-toast";
import type { WatchlistTab } from "@/types/api";

function parseWatchlistTab(value: string | null): WatchlistTab | undefined {
  if (value === "active" || value === "watched" || value === "archived") {
    return value;
  }
  return undefined;
}

export default function WatchlistFilmPage() {
  const params = useParams<{ filmId: string }>();
  const searchParams = useSearchParams();
  const filmId = params.filmId;
  const { toast } = useToast();
  const prevStatusRef = useRef<string | null>(null);
  const [markWatchedOpen, setMarkWatchedOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useFilm(filmId, {
    pollWhileEnriching: true,
  });

  const autoOpenEdit = searchParams.get("editMatch") === "1";
  const watchlistTab = parseWatchlistTab(searchParams.get("tab"));
  const statusTransition = useFilmStatusTransition();

  useEffect(() => {
    if (!data) return;

    const prev = prevStatusRef.current;
    const current = data.enrichment_status;
    prevStatusRef.current = current;

    if (prev === "enriching" && current === "ready") {
      toast({
        title: "Enrichment complete",
        description: "Film metadata and semantic profile are up to date.",
      });
    } else if (prev === "enriching" && current === "failed") {
      toast({
        variant: "destructive",
        title: "Enrichment failed",
        description: "Could not regenerate semantic data for this film.",
      });
    }
  }, [data, toast]);

  if (isLoading) {
    return <CardGridSkeleton count={2} />;
  }

  if (isError) {
    return (
      <ErrorState
        message="Could not load film details."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data) {
    return (
      <ErrorState message="Film not found." onRetry={() => void refetch()} />
    );
  }

  return (
    <>
      <FilmDetailView
        film={data}
        autoOpenEditMatch={autoOpenEdit}
        watchlistTab={watchlistTab}
        isStatusPending={statusTransition.isPending}
        onStatusTransition={(status) =>
          statusTransition.mutate({ filmId, status })
        }
        onMarkWatched={async () => {
          await statusTransition.mutateAsync({
            filmId,
            status: "pending_watch_review",
          });
          setMarkWatchedOpen(true);
        }}
      />

      <WatchReviewDialog
        filmId={filmId}
        filmTitle={data.title}
        open={markWatchedOpen}
        cancelOnDismiss
        onOpenChange={setMarkWatchedOpen}
      />
    </>
  );
}
