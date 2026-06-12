"use client";

import { useCallback } from "react";
import { ApiClientError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-messages";
import { useToast } from "@/hooks/use-toast";

export function useToastOnError() {
  const { toast } = useToast();

  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiClientError) {
        toast({
          variant: "destructive",
          title: "Request failed",
          description: getErrorMessage({
            code: error.code as Parameters<typeof getErrorMessage>[0]["code"],
            message: error.message,
            details: error.details,
          }),
        });
        return;
      }

      toast({
        variant: "destructive",
        title: "Request failed",
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    },
    [toast],
  );
}
