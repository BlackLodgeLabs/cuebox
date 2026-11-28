"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useHasWatchlist } from "@/hooks/use-films";

export default function HomePage() {
  const {
    data: hasWatchlist,
    isLoading: watchlistLoading,
    isError: watchlistError,
    refetch: refetchWatchlist,
  } = useHasWatchlist();

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
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <h1 className="text-h1">What do you want to watch?</h1>
        <p className="mt-2 text-body-md text-muted-foreground">
          Find a film in your library, create a recommendation, or open History.
        </p>
      </header>

      <div className="space-y-3">
        <Button asChild size="lg" className="w-full min-h-11">
          <Link href="/recommend">Create a recommendation</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="w-full min-h-11"
        >
          <Link href="/history">History</Link>
        </Button>
      </div>
    </div>
  );
}
