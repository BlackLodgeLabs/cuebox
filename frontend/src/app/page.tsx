"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@/components/icon";
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
  useWatchlistCount,
} from "@/hooks/use-films";
import { getHealth } from "@/lib/api-client";

export default function HomePage() {
  const [healthOpen, setHealthOpen] = useState(false);
  const {
    data: hasWatchlist,
    isLoading: watchlistLoading,
    isError: watchlistError,
    refetch: refetchWatchlist,
  } = useHasWatchlist();
  const { data: reviewCount = 0 } = usePendingReviewCount();
  const { data: watchlistCount } = useWatchlistCount();
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    staleTime: 60_000,
  });

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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-h1">What do you want to watch?</h1>
        <p className="mt-2 text-body-md text-muted-foreground">
          Start a new recommendation or browse your past picks.
        </p>
      </div>

      <Card className="hover-glow">
        <CardHeader>
          <CardTitle>Your watchlist</CardTitle>
          <CardDescription>
            {watchlistCount === undefined
              ? "Loading watchlist…"
              : watchlistCount === 1
                ? "1 film on your watchlist"
                : `${watchlistCount} films on your watchlist`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/watchlist">View watchlist</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
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
            <CardTitle>Add film to watchlist</CardTitle>
            <CardDescription>
              Search TMDB and add a single film without re-exporting your
              Letterboxd watchlist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/watchlist/add">Add a film</Link>
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
            <Button asChild className="w-full">
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
              Some films need metadata confirmation or a watch diary entry before
              they are fully ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/review">Review now</Link>
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
