"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getStreamingCatalog,
  getStreamingServices,
  putStreamingServices,
} from "@/lib/api-client";

export function useStreamingServices() {
  const queryClient = useQueryClient();
  const saved = useQuery({
    queryKey: ["settings", "services"],
    queryFn: getStreamingServices,
  });
  const catalog = useQuery({
    queryKey: ["settings", "services", "catalog"],
    queryFn: getStreamingCatalog,
  });
  const save = useMutation({
    mutationFn: putStreamingServices,
    onSuccess: (data) => {
      queryClient.setQueryData(["settings", "services"], data);
    },
  });
  return { saved, catalog, save };
}
