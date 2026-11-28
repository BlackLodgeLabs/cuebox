"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FilmDetailView } from "@/components/film-detail-view";
import { FilmDetailSkeleton } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useFilm, useFilmStatusTransition } from "@/hooks/use-films";
import { toast } from "@/components/ui/sonner";
import type { WatchlistTab } from "@/types/api";

function parseWatchlistTab(value: string | null): WatchlistTab | undefined {
  if (value === "active" || value === "watched" || value === "archived") {
    return value;
  }
  return undefined;
}

export default function WatchlistFilmPage() {
  const params = useParams<{ filmId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filmId = params.filmId;
  const prevStatusRef = useRef<string | null>(null);

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
        title: "Film details updated",
        description: "Metadata and profile are up to date.",
      });
    } else if (prev === "enriching" && current === "failed") {
      toast({
        variant: "destructive",
        title: "Couldn’t update film details",
        description: "Try again later, or edit the film match.",
      });
    }
  }, [data, toast]);

  if (isLoading) {
    return <FilmDetailSkeleton />;
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
    <FilmDetailView
      film={data}
      autoOpenEditMatch={autoOpenEdit}
      watchlistTab={watchlistTab}
      isStatusPending={statusTransition.isPending}
      onStatusTransition={(status) =>
        statusTransition.mutate({ filmId, status })
      }
      onRemove={() => {
        statusTransition.mutate(
          { filmId, status: "archived" },
          { onSuccess: () => router.push("/watchlist") },
        );
      }}
    />
  );
}
