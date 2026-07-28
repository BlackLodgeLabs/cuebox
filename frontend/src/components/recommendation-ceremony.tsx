"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { CeremonyStageRecord } from "@/components/ceremony/ceremony-stage-record";
import { CeremonyStageRunnersUp } from "@/components/ceremony/ceremony-stage-runners-up";
import { CeremonyStageWinner } from "@/components/ceremony/ceremony-stage-winner";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { useCeremonyNavigation } from "@/hooks/use-ceremony-navigation";
import { cn } from "@/lib/utils";
import type { ProfileSummary, RecommendationResponse } from "@/types/api";

export type CeremonyMode = "fresh" | "history";

export interface RecommendationCeremonyProps {
  mode: CeremonyMode;
  data: RecommendationResponse & { profile_summary?: ProfileSummary };
  sessionId: string;
  onRequestDelete?: () => void;
}

function CeremonyChrome({
  mode,
  data,
  sessionId,
  onRequestDelete,
}: RecommendationCeremonyProps) {
  const { stage, goNext, replay } = useCeremonyNavigation(sessionId);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const doneHref = mode === "history" ? "/history" : "/";

  return (
    <div
      className="space-y-6"
      data-testid="recommendation-ceremony"
      data-ceremony-mode={mode}
      data-ceremony-stage={stage}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className="text-label-md normal-case tracking-normal text-secondary"
          data-testid="ceremony-progress"
          aria-live="polite"
        >
          {stage} / 3
        </p>
      </div>

      <div
        className={cn(
          "ceremony-stage",
          reducedMotion
            ? "ceremony-reduced-motion"
            : "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
        )}
        key={stage}
      >
        {stage === 1 && <CeremonyStageWinner film={data.winner} />}
        {stage === 2 && (
          <CeremonyStageRunnersUp films={data.runners_up} />
        )}
        {stage === 3 && <CeremonyStageRecord data={data} />}
      </div>

      <div className="flex flex-wrap gap-3">
        {stage < 3 ? (
          <Button
            type="button"
            size="lg"
            className="min-h-11 min-w-11"
            onClick={goNext}
            data-testid="ceremony-next"
          >
            Next
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="lg"
              className="min-h-11 min-w-11"
              asChild
            >
              <Link href={doneHref} data-testid="ceremony-done">
                Done
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11 min-w-11"
              onClick={replay}
              data-testid="ceremony-replay"
            >
              Replay ceremony
            </Button>
            {mode === "history" && onRequestDelete && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11 min-w-11"
                onClick={onRequestDelete}
                data-testid="ceremony-delete"
              >
                Remove from history
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function RecommendationCeremony(props: RecommendationCeremonyProps) {
  return (
    <Suspense fallback={<LoadingState message="Loading ceremony…" />}>
      <CeremonyChrome {...props} />
    </Suspense>
  );
}
