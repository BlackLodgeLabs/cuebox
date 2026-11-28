"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DevModePanel } from "@/components/dev-mode/dev-mode-panel";
import { DevModeProvider } from "@/components/dev-mode/dev-mode-provider";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { ProgrammeLayout } from "@/components/programme-layout";
import { useRecommendation } from "@/hooks/use-recommendations";
import { formatProgrammeDate } from "@/lib/programme-format";

export default function HistoryDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const { data, isLoading, isError, refetch } = useRecommendation(params.sessionId);

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

  const title = formatProgrammeDate(data.created_at);

  return (
    <DevModeProvider>
      <ProgrammeLayout
        session={data}
        title={title || "Past night"}
        backLink={{ href: "/history", label: "History" }}
      />
      <div className="py-4">
        <Link href="/recommend" className="font-ui text-cb-caption font-medium text-cb-muted">
          New pick
        </Link>
      </div>
      <DevModePanel sessionId={params.sessionId} />
    </DevModeProvider>
  );
}
