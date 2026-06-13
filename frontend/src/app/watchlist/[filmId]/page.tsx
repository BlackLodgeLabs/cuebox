"use client";

import { useParams } from "next/navigation";
import { FilmDetailView } from "@/components/film-detail-view";
import { CardGridSkeleton } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useFilm } from "@/hooks/use-films";

export default function WatchlistFilmPage() {
  const params = useParams<{ filmId: string }>();
  const filmId = params.filmId;

  const { data, isLoading, isError, refetch } = useFilm(filmId);

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

  return <FilmDetailView film={data} />;
}
