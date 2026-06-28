"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { RecommendationLoading } from "@/components/recommendation-loading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardGridSkeleton } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import {
  useHasWatchlist,
  usePendingReviewCount,
} from "@/hooks/use-films";
import { useCreateRecommendation } from "@/hooks/use-recommendations";
import { ApiClientError } from "@/lib/api-client";
import { getHealth } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-messages";
import {
  buildQuestionnaireFromPreset,
  MOOD_PRESETS,
} from "@/lib/mood-presets";

export default function HomePage() {
  const router = useRouter();
  const [healthOpen, setHealthOpen] = useState(false);
  const [quickPickError, setQuickPickError] = useState<string | null>(null);
  const create = useCreateRecommendation();
  const {
    data: hasWatchlist,
    isLoading: watchlistLoading,
    isError: watchlistError,
    refetch: refetchWatchlist,
  } = useHasWatchlist();
  const { data: reviewCount = 0 } = usePendingReviewCount();
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    staleTime: 60_000,
  });

  const handleQuickPick = async (presetId: string) => {
    if (create.isPending) return;
    setQuickPickError(null);
    try {
      const questionnaire = buildQuestionnaireFromPreset(presetId);
      const result = await create.mutateAsync({
        questionnaire,
        quick_pick_preset_id: presetId,
      });
      router.push(`/recommend/results/${result.session_id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setQuickPickError(
          getErrorMessage({
            code: error.code as Parameters<typeof getErrorMessage>[0]["code"],
            message: error.message,
            details: error.details,
          }),
        );
      } else {
        setQuickPickError("Recommendation failed. Please try again.");
      }
    }
  };

  if (watchlistLoading) {
    return <CardGridSkeleton count={1} />;
  }

  if (watchlistError) {
    return (
      <ErrorState
        message="Could not reach the API. Make sure the backend is running."
        onRetry={() => void refetchWatchlist()}
      />
    );
  }

  if (!hasWatchlist) {
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <div>
          <h1 className="text-h1">Welcome to Cuebox</h1>
          <p className="mt-2 text-body-md text-muted-foreground">
            Import your Letterboxd watchlist to get personalized film
            recommendations based on your mood and preferences.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Export your watchlist from Letterboxd as a CSV and upload it here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full">
              <Link href="/import">Import watchlist</Link>
            </Button>
          </CardContent>
        </Card>
        <HealthPanel health={health} open={healthOpen} onToggle={setHealthOpen} />
      </div>
    );
  }

  if (create.isPending) {
    return <RecommendationLoading />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-h1">What do you want to watch?</h1>
        <p className="mt-2 text-body-md text-muted-foreground">
          Start a new recommendation or browse your past picks.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-h2">Mood quick pick</h2>
          <p className="mt-1 text-body-md text-muted-foreground">
            Skip the questionnaire — tap a mood and we&apos;ll pick a film.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {MOOD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={create.isPending}
              onClick={() => void handleQuickPick(preset.id)}
              className="text-left"
            >
              <Card className="hover-glow h-full transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon name={preset.icon} size={20} className="text-secondary" />
                    {preset.label}
                  </CardTitle>
                  <CardDescription>{preset.description}</CardDescription>
                </CardHeader>
              </Card>
            </button>
          ))}
        </div>
        {quickPickError && (
          <p className="text-sm text-destructive">{quickPickError}</p>
        )}
        <p className="text-body-sm text-muted-foreground">
          <Link href="/recommend" className="text-secondary hover:underline">
            Customize instead
          </Link>{" "}
          — answer the full questionnaire for finer control.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="hover-glow">
          <CardHeader>
            <CardTitle>New recommendation</CardTitle>
            <CardDescription>
              Answer a few questions and we&apos;ll pick a film from your
              watchlist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/recommend">Start questionnaire</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-glow">
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>
              Browse past recommendations and revisit your picks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/history">View history</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {reviewCount > 0 && (
        <Card className="warning-banner">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Films need review
              <Badge variant="secondary">{reviewCount}</Badge>
            </CardTitle>
            <CardDescription>
              Some imported films need you to confirm their metadata match before
              they can be recommended.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/review">Review matches</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <HealthPanel health={health} open={healthOpen} onToggle={setHealthOpen} />
    </div>
  );
}

function HealthPanel({
  health,
  open,
  onToggle,
}: {
  health: Awaited<ReturnType<typeof getHealth>> | undefined;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  if (!health) return null;

  return (
    <div className="text-left">
      <button
        type="button"
        onClick={() => onToggle(!open)}
        className="flex items-center gap-1 text-label-md normal-case tracking-normal text-muted-foreground hover:text-foreground"
      >
        System status
        <Icon name={open ? "expand_less" : "expand_more"} size={16} />
      </button>
      {open && (
        <div className="mt-2 rounded border border-border bg-surface-high px-3 py-2 font-mono text-xs text-muted-foreground">
          <p>
            API: <span className="text-foreground">{health.status}</span>
          </p>
          <p>
            DB: <span className="text-foreground">{health.database}</span>
          </p>
          <p>VER {health.version}</p>
        </div>
      )}
    </div>
  );
}
