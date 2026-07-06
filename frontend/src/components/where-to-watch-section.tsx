"use client";

import Image from "next/image";
import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilmWatchProviders } from "@/hooks/use-watch-providers";
import { ApiClientError } from "@/lib/api-client";
import type { WatchProviderCategory } from "@/types/api";

interface WhereToWatchSectionProps {
  filmId: string;
  hasTmdbId?: boolean;
  onEditMatch?: () => void;
}

function ProviderRow({
  category,
}: {
  category: WatchProviderCategory;
}) {
  return (
    <div className="space-y-3">
      <p className="text-label-md text-muted-foreground">{category.label}</p>
      <ul className="space-y-2">
        {category.providers.map((provider) => (
          <li
            key={`${category.type}-${provider.provider_id}`}
            className="flex items-center gap-3"
          >
            {provider.logo_url ? (
              <Image
                src={provider.logo_url}
                alt=""
                width={36}
                height={36}
                className="rounded"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded bg-surface-high text-label-md">
                {provider.provider_name.slice(0, 1)}
              </div>
            )}
            <span className="text-body-md">{provider.provider_name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WhereToWatchSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where to Watch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full bg-surface-high" />
        <Skeleton className="h-10 w-full bg-surface-high" />
        <Skeleton className="h-10 w-3/4 bg-surface-high" />
      </CardContent>
    </Card>
  );
}

function MatchGuidance({ onEditMatch }: { onEditMatch?: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where to Watch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-body-md text-muted-foreground">
          Match TMDB metadata to see streaming options.
        </p>
        {onEditMatch ? (
          <Button size="sm" variant="outline" onClick={onEditMatch}>
            Edit film match
          </Button>
        ) : (
          <Button size="sm" variant="outline" asChild>
            <Link href="#edit-match">Edit film match</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function WhereToWatchSection({
  filmId,
  hasTmdbId = true,
  onEditMatch,
}: WhereToWatchSectionProps) {
  const { data, isLoading, isError, error, refetch } = useFilmWatchProviders(filmId, {
    enabled: hasTmdbId,
  });

  if (!hasTmdbId) {
    return <MatchGuidance onEditMatch={onEditMatch} />;
  }

  if (isLoading) {
    return <WhereToWatchSkeleton />;
  }

  if (isError) {
    if (error instanceof ApiClientError && error.code === "UNPROCESSABLE") {
      return <MatchGuidance onEditMatch={onEditMatch} />;
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Where to Watch</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Could not load streaming options"
            message="Streaming availability could not be loaded right now."
            onRetry={() => void refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Where to Watch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-body-md text-muted-foreground">
            No streaming options currently listed for the UK.
          </p>
          <p className="text-label-md text-muted-foreground">
            Streaming data provided by JustWatch via TMDB.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where to Watch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.categories.map((category) => (
          <ProviderRow key={category.type} category={category} />
        ))}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2 border-t border-border/60 pt-4">
        <p className="text-label-md text-muted-foreground">
          Streaming data provided by JustWatch via TMDB.
        </p>
        {data.link && (
          <a
            href={data.link}
            target="_blank"
            rel="noreferrer"
            className="text-body-md text-primary hover:underline"
          >
            View on TMDB
          </a>
        )}
      </CardFooter>
    </Card>
  );
}
