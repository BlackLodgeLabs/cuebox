"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSyncRssStatus, postSyncCsv, putSyncRss } from "@/lib/api-client";
import { useToastOnError } from "@/hooks/use-toast-on-error";

export function useSyncCsv() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: postSyncCsv,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["films"] });
    },
    onError,
  });
}

export function useSyncRssConfig() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: (username: string) => putSyncRss(username),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sync", "rss", "status"] });
    },
    onError,
  });
}

export function useSyncRssStatus() {
  return useQuery({
    queryKey: ["sync", "rss", "status"],
    queryFn: getSyncRssStatus,
    refetchInterval: (query) => (query.state.data?.configured ? 60_000 : false),
  });
}
