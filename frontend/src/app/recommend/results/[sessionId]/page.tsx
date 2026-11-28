"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DevModePanel } from "@/components/dev-mode/dev-mode-panel";
import { DevModeProvider } from "@/components/dev-mode/dev-mode-provider";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { ProgrammeLayout } from "@/components/programme-layout";
import { useRecommendation } from "@/hooks/use-recommendations";
import { TONIGHT_PROGRAMME_TITLE } from "@/lib/programme-format";
import {
  consumeProgrammeSettled,
  peekProgrammeSettled,
} from "@/lib/recommend-handoff";

export default function ResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const { data, isLoading, isError, refetch } = useRecommendation(sessionId);
  const [settled] = useState(() => peekProgrammeSettled(sessionId));

  useEffect(() => {
    consumeProgrammeSettled(sessionId);
  }, [sessionId]);

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
    <DevModeProvider>
      <ProgrammeLayout
        session={data}
        title={TONIGHT_PROGRAMME_TITLE}
        settled={settled}
      />
      <DevModePanel sessionId={sessionId} />
    </DevModeProvider>
  );
}
