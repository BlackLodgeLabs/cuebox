"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { ProgrammeLayout } from "@/components/programme-layout";
import { useRecommendation } from "@/hooks/use-recommendations";
import {
  formatProgrammeDate,
  TONIGHT_PROGRAMME_TITLE,
} from "@/lib/programme-format";

/**
 * Visual fixture for the shared programme. S7 and S9 own the real routes.
 * The mocked Playwright test opens this page at 390 × 844.
 */
function ProgrammeFixture() {
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const history = params.get("variant") === "history";
  const { data, isLoading, isError, refetch } = useRecommendation(sessionId || undefined);

  if (!sessionId) {
    return <ErrorState message="This preview needs a recommendation session." />;
  }

  if (isLoading) {
    return <LoadingState message="Loading programme…" />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        message="Could not load this programme."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="-mt-8">
      <ProgrammeLayout
        session={data}
        title={history ? formatProgrammeDate(data.created_at) : TONIGHT_PROGRAMME_TITLE}
        backLink={history ? { href: "/history", label: "History" } : undefined}
      />
    </div>
  );
}

export default function ProgrammeFixturePage() {
  return (
    <Suspense fallback={<LoadingState message="Loading programme…" />}>
      <ProgrammeFixture />
    </Suspense>
  );
}
