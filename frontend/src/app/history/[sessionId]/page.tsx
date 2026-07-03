"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteHistoryDialog } from "@/components/delete-history-dialog";
import { DevModePanel } from "@/components/dev-mode/dev-mode-panel";
import { DevModeProvider } from "@/components/dev-mode/dev-mode-provider";
import { ResultsView } from "@/components/results-view";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import {
  useDeleteRecommendation,
  useRecommendation,
} from "@/hooks/use-recommendations";

export default function HistoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const deleteRecommendation = useDeleteRecommendation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useRecommendation(
    params.sessionId,
  );

  const handleConfirmDelete = () => {
    deleteRecommendation.mutate(params.sessionId, {
      onSuccess: () => {
        setDialogOpen(false);
        router.push("/history");
      },
    });
  };

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h1">{data.winner.title}</h1>
            <p className="mt-1 text-body-md text-muted-foreground">
              Recommended on {new Date(data.created_at).toLocaleString()}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialogOpen(true)}
          >
            Remove from history
          </Button>
        </div>
        <ResultsView data={data} showActions />
        <DevModePanel sessionId={params.sessionId} />
      </div>

      <DeleteHistoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirmDelete}
        isPending={deleteRecommendation.isPending}
      />
    </DevModeProvider>
  );
}
