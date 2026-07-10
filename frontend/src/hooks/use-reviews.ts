"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { acceptReview, rejectReview, resolveLetterboxdReview } from "@/lib/api-client";
import { useToastOnError } from "@/hooks/use-toast-on-error";

export function useAcceptReview() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: acceptReview,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["films", "review-required"] });
    },
    onError,
  });
}

export function useRejectReview() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: rejectReview,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["films", "review-required"] });
    },
    onError,
  });
}

export function useResolveLetterboxdReview() {
  const queryClient = useQueryClient();
  const onError = useToastOnError();

  return useMutation({
    mutationFn: ({
      reviewId,
      letterboxdUri,
    }: {
      reviewId: string;
      letterboxdUri: string;
    }) => resolveLetterboxdReview(reviewId, { letterboxd_uri: letterboxdUri }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["films", "review-required"] });
      void queryClient.invalidateQueries({ queryKey: ["films"] });
    },
    onError,
  });
}
