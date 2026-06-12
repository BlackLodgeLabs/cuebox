"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getRecommendation,
  listRecommendations,
  postRecommendation,
} from "@/lib/api-client";
import type { CreateRecommendationRequest, HistoryQueryParams } from "@/types/api";

export function useCreateRecommendation() {
  return useMutation({
    mutationFn: (body: CreateRecommendationRequest) => postRecommendation(body),
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
