"use client";

import { useQuery } from "@tanstack/react-query";
import { getFilms, getReviewRequired } from "@/lib/api-client";
import type { FilmsQueryParams, ReviewRequiredQueryParams } from "@/types/api";

export function useFilms(params?: FilmsQueryParams) {
  return useQuery({
    queryKey: ["films", params],
    queryFn: () => getFilms(params),
  });
}

export function useReviewRequired(params?: ReviewRequiredQueryParams) {
  return useQuery({
    queryKey: ["films", "review-required", params],
    queryFn: () => getReviewRequired(params),
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
