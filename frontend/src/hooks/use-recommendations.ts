"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HISTORY_PAGE_SIZE, useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import {
  getRecommendation,
  listRecommendations,
  postRecommendation,
  deleteRecommendation,
} from "@/lib/api-client";
import type {
  CreateRecommendationRequest,
  HistoryCard,
  HistoryQueryParams,
} from "@/types/api";

export function useCreateRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateRecommendationRequest) => postRecommendation(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recommendations", "history"] });
    },
  });
}

export function useRecommendation(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["recommendations", sessionId],
    queryFn: () => getRecommendation(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useRecommendationHistory(params?: HistoryQueryParams) {
  return useQuery({
    queryKey: ["recommendations", "history", params],
    queryFn: () => listRecommendations(params),
  });
}

export function useInfiniteRecommendationHistory(
  params: Omit<HistoryQueryParams, "limit" | "offset">,
) {
  return useInfiniteScroll<HistoryCard>({
    queryKey: ["recommendations", "history", params],
    pageSize: HISTORY_PAGE_SIZE,
    fetchPage: ({ offset, limit }) => listRecommendations({ ...params, offset, limit }),
  });
}

export function useDeleteRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => deleteRecommendation(sessionId),
    onSuccess: (_data, sessionId) => {
      void queryClient.invalidateQueries({ queryKey: ["recommendations", "history"] });
      queryClient.removeQueries({ queryKey: ["recommendations", sessionId] });
    },
  });
}
