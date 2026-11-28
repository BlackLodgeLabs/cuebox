"use client";

import { useParams } from "next/navigation";
import { TmdbFilmPage } from "@/components/tmdb-film-page";

export default function CatalogueFilmPage() {
  const params = useParams<{ tmdbId: string }>();
  return <TmdbFilmPage tmdbId={params.tmdbId} />;
}
