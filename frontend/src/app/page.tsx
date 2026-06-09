"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardGridSkeleton, LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import {
  useHasWatchlist,
  usePendingReviewCount,
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
          <h1 className="text-3xl font-bold">Welcome to Film Picker</h1>
          <p className="mt-2 text-muted-foreground">
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
        <h1 className="text-3xl font-bold">What do you want to watch?</h1>
        <p className="mt-2 text-muted-foreground">
          Start a new recommendation or browse your past picks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
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

        <Card>
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
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Films need review
              <Badge variant="destructive">{reviewCount}</Badge>
            </CardTitle>
            <CardDescription className="text-amber-900/80">
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
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        System status
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-2 rounded-md border px-3 py-2 text-xs text-muted-foreground">
          <p>
            API: <span className="font-medium text-foreground">{health.status}</span>
          </p>
          <p>
            Database:{" "}
            <span className="font-medium text-foreground">{health.database}</span>
          </p>
          <p>Version {health.version}</p>
        </div>
      )}
    </div>
  );
}
