"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSyncRssStatus, postSyncCsv, putSyncRss } from "@/lib/api-client";

export function useSyncCsv() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postSyncCsv,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["films"] });
    },
  });
}

export function useSyncRssConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (username: string) => putSyncRss(username),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sync", "rss", "status"] });
    },
  });
}

export function useSyncRssStatus() {
  return useQuery({
    queryKey: ["sync", "rss", "status"],
    queryFn: getSyncRssStatus,
    refetchInterval: (query) => (query.state.data?.configured ? 60_000 : false),
  });
}
