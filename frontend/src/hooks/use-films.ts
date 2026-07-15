"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFilm, getFilms, getReviewRequired, rematchFilm, searchTmdb, searchTmdbGlobal, addToWatchlist, setFilmStatus } from "@/lib/api-client";
import type { FilmsQueryParams, FilmStatus, ReviewRequiredQueryParams, TmdbSearchParams } from "@/types/api";
import { useToastOnError } from "@/hooks/use-toast-on-error";

export function useFilms(params?: FilmsQueryParams) {
  return useQuery({
    queryKey: ["films", params],
    queryFn: () => getFilms(params),
  });
}

export function useFilm(
  filmId: string,
  options?: { pollWhileEnriching?: boolean },
) {
  return useQuery({
    queryKey: ["films", filmId],
    queryFn: () => getFilm(filmId),
    enabled: Boolean(filmId),
    refetchInterval: (query) =>
      options?.pollWhileEnriching &&
      query.state.data?.enrichment_status === "enriching"
        ? 2000
        : false,
  });
}

export function useTmdbSearch(
  filmId: string,
  params: TmdbSearchParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["films", filmId, "tmdb-search", params],
    queryFn: () => searchTmdb(filmId, params),
    enabled: Boolean(filmId) && Boolean(params.q.trim()) && (options?.enabled ?? true),
  });
}

export function useGlobalTmdbSearch(
  params: TmdbSearchParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["films", "tmdb-search", params],
    queryFn: () => searchTmdbGlobal(params),
    enabled: Boolean(params.q.trim()) && (options?.enabled ?? true),
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: addToWatchlist,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["films"] });
      void queryClient.invalidateQueries({ queryKey: ["films", "watchlist-presence"] });
      void queryClient.invalidateQueries({ queryKey: ["films", "review-required"] });
    },
    onError,
  });
}

export function useRematchFilm() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: ({ filmId, tmdbId }: { filmId: string; tmdbId: number }) =>
      rematchFilm(filmId, tmdbId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["films"] });
      void queryClient.invalidateQueries({ queryKey: ["films", variables.filmId] });
      void queryClient.invalidateQueries({ queryKey: ["films", "review-required"] });
    },
    onError,
  });
}

export function useFilmStatusTransition() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: ({ filmId, status }: { filmId: string; status: FilmStatus }) =>
      setFilmStatus(filmId, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["films"] });
      void queryClient.invalidateQueries({ queryKey: ["films", variables.filmId] });
    },
    onError,
  });
}

export function useReviewRequired(
  params?: ReviewRequiredQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["films", "review-required", params],
    queryFn: () => getReviewRequired(params),
    enabled: options?.enabled ?? true,
  });
}

export function useHasWatchlist() {
  return useQuery({
    queryKey: ["films", "watchlist-presence"],
    queryFn: () => getFilms({ limit: 1 }),
    select: (data) => data.pagination.total > 0,
  });
}

export function usePendingReviewCount() {
  return useQuery({
    queryKey: ["films", "review-required", "count"],
    queryFn: () => getReviewRequired({ limit: 1 }),
    select: (data) => data.pagination.total,
  });
}

export function useWatchlistCount() {
  return useQuery({
    queryKey: ["films", "watchlist-count"],
    queryFn: () => getFilms({ on_watchlist: true, limit: 1 }),
    select: (data) => data.pagination.total,
  });
}
