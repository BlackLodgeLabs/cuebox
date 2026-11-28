"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFilm, getFilms, getFilmTrailer, getReviewRequired, getSimilarFilms, getTmdbFilm, getWatchReviewRequired, getPendingReviewCount, rematchFilm, searchTmdb, searchTmdbGlobal, addToWatchlist, setFilmStatus, completeWatchReview, cancelWatchReview, createFilmWatch, updateFilmWatch, deleteFilmWatch } from "@/lib/api-client";
import type { FilmsQueryParams, FilmStatus, FilmSummary, ReviewRequiredQueryParams, TmdbSearchParams, CompleteWatchReviewRequest, CreateWatchRequest, UpdateWatchRequest } from "@/types/api";
import { useToastOnError } from "@/hooks/use-toast-on-error";

export function useFilms(
  params?: FilmsQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["films", params],
    queryFn: () => getFilms(params),
    enabled: options?.enabled ?? true,
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

function invalidateWatchReviewQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  filmId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: ["films"] });
  if (filmId) {
    void queryClient.invalidateQueries({ queryKey: ["films", filmId] });
  }
  void queryClient.invalidateQueries({ queryKey: ["films", "watch-review-required"] });
  void queryClient.invalidateQueries({ queryKey: ["films", "pending-review-count"] });
}

export function useFilmStatusTransition() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: ({ filmId, status }: { filmId: string; status: FilmStatus }) =>
      setFilmStatus(filmId, status),
    onSuccess: (_data, variables) => {
      invalidateWatchReviewQueries(queryClient, variables.filmId);
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

export function useWatchReviewRequired(
  params?: ReviewRequiredQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["films", "watch-review-required", params],
    queryFn: () => getWatchReviewRequired(params),
    enabled: options?.enabled ?? true,
  });
}

export function useCompleteWatchReview() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: ({
      filmId,
      body,
    }: {
      filmId: string;
      body: CompleteWatchReviewRequest;
    }) => completeWatchReview(filmId, body),
    onSuccess: (_data, variables) => {
      invalidateWatchReviewQueries(queryClient, variables.filmId);
    },
    onError,
  });
}

export function useCancelWatchReview() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: (filmId: string) => cancelWatchReview(filmId),
    onSuccess: (_data, filmId) => {
      invalidateWatchReviewQueries(queryClient, filmId);
    },
    onError,
  });
}

export function useCreateFilmWatch() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: ({
      filmId,
      body,
    }: {
      filmId: string;
      body: CreateWatchRequest;
    }) => createFilmWatch(filmId, body),
    onSuccess: (_data, variables) => {
      invalidateWatchReviewQueries(queryClient, variables.filmId);
    },
    onError,
  });
}

export function useUpdateFilmWatch() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: ({
      filmId,
      watchId,
      body,
    }: {
      filmId: string;
      watchId: string;
      body: UpdateWatchRequest;
    }) => updateFilmWatch(filmId, watchId, body),
    onSuccess: (_data, variables) => {
      invalidateWatchReviewQueries(queryClient, variables.filmId);
    },
    onError,
  });
}

export function useDeleteFilmWatch() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: ({ filmId, watchId }: { filmId: string; watchId: string }) =>
      deleteFilmWatch(filmId, watchId),
    onSuccess: (_data, variables) => {
      invalidateWatchReviewQueries(queryClient, variables.filmId);
    },
    onError,
  });
}

const HOME_ACTIVE_PAGE = 100;
/** Safety stop for a very large watchlist. The list endpoint pages at 100. */
const HOME_ACTIVE_MAX_PAGES = 30;

/** Every active watchlist film Home can place on a rail. */
export async function loadActiveWatchlist(): Promise<{
  films: FilmSummary[];
  total: number;
}> {
  const films: FilmSummary[] = [];
  let offset = 0;
  let total = 0;
  for (let page = 0; page < HOME_ACTIVE_MAX_PAGES; page += 1) {
    const response = await getFilms({
      status: "active",
      limit: HOME_ACTIVE_PAGE,
      offset,
    });
    total = response.pagination.total;
    films.push(...response.data);
    if (!response.pagination.has_more || response.data.length === 0) break;
    offset += response.data.length;
  }
  return { films, total };
}

export function useHomeActiveFilms() {
  return useQuery({
    queryKey: ["films", "home-active"],
    queryFn: loadActiveWatchlist,
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
    queryKey: ["films", "pending-review-count"],
    queryFn: () => getPendingReviewCount(),
    select: (data) => data.total,
  });
}

export function useWatchlistCount() {
  return useQuery({
    queryKey: ["films", "watchlist-count"],
    queryFn: () => getFilms({ on_watchlist: true, limit: 1 }),
    select: (data) => data.pagination.total,
  });
}

export function useSimilarFilms(
  filmId: string,
  options?: { limit?: number; enabled?: boolean },
) {
  const limit = options?.limit ?? 6;
  return useQuery({
    queryKey: ["films", filmId, "similar", limit],
    queryFn: () => getSimilarFilms(filmId, { limit }),
    enabled: Boolean(filmId) && (options?.enabled ?? true),
  });
}

export function useFilmTrailer(
  filmId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["films", filmId, "trailer"],
    queryFn: () => getFilmTrailer(filmId),
    enabled: Boolean(filmId) && (options?.enabled ?? true),
  });
}

export function useTmdbFilm(
  tmdbId: number | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["films", "tmdb", tmdbId],
    queryFn: () => getTmdbFilm(tmdbId as number),
    enabled: tmdbId != null && (options?.enabled ?? true),
  });
}
