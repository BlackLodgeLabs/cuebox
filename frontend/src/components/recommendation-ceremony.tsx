"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { CeremonyStageRecord } from "@/components/ceremony/ceremony-stage-record";
import { CeremonyStageRunnersUp } from "@/components/ceremony/ceremony-stage-runners-up";
import { CeremonyStageWinner } from "@/components/ceremony/ceremony-stage-winner";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

const STICKY_CHROME_CLASS =
  "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-30 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80";

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
      className="space-y-6 pb-24"
      data-testid="recommendation-ceremony"
      data-ceremony-mode={mode}
      data-ceremony-stage={stage}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
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

      <div
        className={STICKY_CHROME_CLASS}
        data-testid="ceremony-sticky-chrome"
      >
        <p
          className="mr-auto text-label-md normal-case tracking-normal text-secondary"
          data-testid="ceremony-progress"
          aria-live="polite"
        >
          {stage} / 3
        </p>

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
              Replay
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="min-h-11 min-w-11"
                  data-testid="ceremony-more-actions"
                >
                  More
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>More actions</SheetTitle>
                  <SheetDescription>
                    Secondary exits and session tools
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-h-11 w-full justify-start"
                    asChild
                  >
                    <Link
                      href="/recommend"
                      data-testid="ceremony-new-recommendation"
                    >
                      New recommendation
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-h-11 w-full justify-start"
                    asChild
                  >
                    <Link href="/history" data-testid="ceremony-view-history">
                      View history
                    </Link>
                  </Button>
                  {mode === "history" && onRequestDelete && (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="min-h-11 w-full justify-start"
                      onClick={onRequestDelete}
                      data-testid="ceremony-delete"
                    >
                      Remove from history
                    </Button>
                  )}
                  {data.profile_summary && (
                    <div
                      className="space-y-3 border-t border-border pt-4"
                      data-testid="ceremony-answer-summary"
                    >
                      <p className="text-label-md normal-case tracking-normal">
                        Answer summary
                      </p>
                      <p className="text-body-lg">
                        {data.profile_summary.narrative_profile}
                      </p>
                      <pre className="overflow-auto rounded bg-surface-high p-3 font-mono text-xs text-muted-foreground">
                        {JSON.stringify(
                          data.profile_summary.structured_profile,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
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
