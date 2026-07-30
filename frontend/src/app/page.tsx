"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/icon";
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
import { getHealth } from "@/lib/api-client";
import { scrollSearchFieldToTop } from "@/lib/scroll-field-into-view";

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
  const [healthOpen, setHealthOpen] = useState(false);
  const focusHandledRef = useRef(false);
  const {
    data: hasWatchlist,
    isLoading: watchlistLoading,
    isError: watchlistError,
    refetch: refetchWatchlist,
  } = useHasWatchlist();
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!focusSearch || focusHandledRef.current) return;
    if (watchlistLoading) return;

    focusHandledRef.current = true;

    if (hasWatchlist) {
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="library-search-input"]',
      );
      if (input) {
        scrollSearchFieldToTop(input);
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
        <HealthPanel health={health} open={healthOpen} onToggle={setHealthOpen} />
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
