"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getDevAI,
  getDevRetrieval,
  getDevScoring,
  getDevSystemVersions,
  probeDevModeEnabled,
} from "@/lib/api-client";

export function useDevModeEnabled() {
  return useQuery({
    queryKey: ["dev-mode", "enabled"],
    queryFn: probeDevModeEnabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useDevRetrieval(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["dev-mode", "retrieval", sessionId],
    queryFn: () => getDevRetrieval(sessionId),
    enabled,
  });
}

export function useDevScoring(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["dev-mode", "scoring", sessionId],
    queryFn: () => getDevScoring(sessionId),
    enabled,
  });
}

export function useDevAI(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["dev-mode", "ai", sessionId],
    queryFn: () => getDevAI(sessionId),
    enabled,
  });
}

export function useDevSystemVersions(enabled: boolean) {
  return useQuery({
    queryKey: ["dev-mode", "versions"],
    queryFn: getDevSystemVersions,
    enabled,
  });
}
