"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getImportStatus, postImport } from "@/lib/api-client";
import { useToastOnError } from "@/hooks/use-toast-on-error";

export function useImportUpload() {
  const onError = useToastOnError();

  return useMutation({
    mutationFn: postImport,
    onError,
  });
}

export function useImportStatus(jobId: string | undefined) {
  return useQuery({
    queryKey: ["import", jobId, "status"],
    queryFn: () => getImportStatus(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 3000 : false,
  });
}

export function useInvalidateImport() {
  const queryClient = useQueryClient();
  return (jobId: string) => {
    void queryClient.invalidateQueries({ queryKey: ["import", jobId] });
  };
}
