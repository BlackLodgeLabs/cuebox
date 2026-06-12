"use client";

import { useParams } from "next/navigation";
import { DevModePanel } from "@/components/dev-mode/dev-mode-panel";
import { DevModeProvider } from "@/components/dev-mode/dev-mode-provider";
import { ResultsView } from "@/components/results-view";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useRecommendation } from "@/hooks/use-recommendations";

export default function HistoryDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const { data, isLoading, isError, refetch } = useRecommendation(
    params.sessionId,
  );

  if (isLoading) {
    return <LoadingState message="Loading session…" />;
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
    <DevModeProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-h1">{data.winner.title}</h1>
          <p className="mt-1 text-body-md text-muted-foreground">
            Recommended on {new Date(data.created_at).toLocaleString()}
          </p>
        </div>
        <ResultsView data={data} showActions />
        <DevModePanel sessionId={params.sessionId} />
      </div>
    </DevModeProvider>
  );
}
