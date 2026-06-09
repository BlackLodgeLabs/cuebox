"use client";

import { useParams } from "next/navigation";
import { ResultsView } from "@/components/results-view";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useRecommendation } from "@/hooks/use-recommendations";

export default function ResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const { data, isLoading, isError, refetch } = useRecommendation(
    params.sessionId,
  );

  if (isLoading) {
    return <LoadingState message="Loading recommendation…" />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        message="Could not load this recommendation session."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your pick</h1>
        <p className="mt-1 text-muted-foreground">
          Based on your preferences from{" "}
          {new Date(data.created_at).toLocaleString()}
        </p>
      </div>
      <ResultsView data={data} />
    </div>
  );
}
