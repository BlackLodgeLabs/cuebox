"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getImportStatus, postImport } from "@/lib/api-client";

export function useImportUpload() {
  return useMutation({
    mutationFn: postImport,
  });
}

export function useImportStatus(jobId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["import", jobId, "status"],
    queryFn: () => getImportStatus(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 3000 : false,
  });

  useEffect(() => {
    if (query.data?.status === "complete") {
      void queryClient.invalidateQueries({ queryKey: ["films"] });
    }
  }, [query.data?.status, queryClient]);

  return query;
}

export function useInvalidateImport() {
  const queryClient = useQueryClient();
  return (jobId: string) => {
    void queryClient.invalidateQueries({ queryKey: ["import", jobId] });
  };
}
