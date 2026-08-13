"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { LibrarySearchPicker } from "@/components/library-search-picker";
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
import { scrollFieldIntoView } from "@/lib/scroll-field-into-view";

export default function HomePage() {
  return (
    <Suspense fallback={<CardGridSkeleton count={1} />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusSearch = searchParams.get("focus") === "search";
  const focusHandledRef = useRef(false);
  const {
    data: hasWatchlist,
    isLoading: watchlistLoading,
    isError: watchlistError,
    refetch: refetchWatchlist,
  } = useHasWatchlist();

  useEffect(() => {
    if (!focusSearch || focusHandledRef.current) return;
    if (watchlistLoading) return;

    focusHandledRef.current = true;

    if (hasWatchlist) {
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="library-search-input"]',
      );
      if (input) {
        scrollFieldIntoView(input, "start");
        input.focus();
      }
    }

    router.replace("/", { scroll: false });
  }, [focusSearch, hasWatchlist, watchlistLoading, router]);

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

      <LibrarySearchPicker
        autoFocus={focusSearch}
        placeholder="Find a film in your library or add one…"
        helperText="Search your library (including watched films) or add from TMDB. Archived titles are not listed."
      />

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
