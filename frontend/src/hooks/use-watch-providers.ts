"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { getFilmWatchProviders } from "@/lib/api-client";
import type { FilmWatchProvidersResponse } from "@/types/api";

export function useFilmWatchProviders(
  filmId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["films", filmId, "watch-providers"],
    queryFn: () => getFilmWatchProviders(filmId),
    enabled: Boolean(filmId) && (options?.enabled ?? true),
    staleTime: 0,
  });
}

export interface FilmWatchProvidersLookup {
  data: FilmWatchProvidersResponse | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function useFilmsWatchProviders(filmIds: string[]) {
  const cappedIds = filmIds.slice(0, 5);

  const queries = useQueries({
    queries: cappedIds.map((filmId) => ({
      queryKey: ["films", filmId, "watch-providers"],
      queryFn: () => getFilmWatchProviders(filmId),
      enabled: Boolean(filmId),
      staleTime: 0,
    })),
  });

  const lookup = new Map<string, FilmWatchProvidersLookup>();
  cappedIds.forEach((filmId, index) => {
    const query = queries[index];
    lookup.set(filmId, {
      data: query.data,
      isLoading: query.isLoading,
      isError: query.isError,
    });
  });

  return lookup;
}
