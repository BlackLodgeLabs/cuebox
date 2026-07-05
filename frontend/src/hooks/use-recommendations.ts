"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRecommendation,
  listRecommendations,
  postRecommendation,
  deleteRecommendation,
} from "@/lib/api-client";
import type { CreateRecommendationRequest, HistoryQueryParams } from "@/types/api";

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
