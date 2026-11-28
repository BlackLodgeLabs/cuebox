"use client";

import Image from "next/image";
import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilmWatchProviders } from "@/hooks/use-watch-providers";
import { ApiClientError } from "@/lib/api-client";
import { splitWatchProviders } from "@/lib/watch-services";
import type { WatchProviderCategory, WatchProviderItem } from "@/types/api";

interface WhereToWatchSectionProps {
  filmId: string;
  hasTmdbId?: boolean;
  onEditMatch?: () => void;
  /** Hide the section title when a parent heading already says Where to Watch. */
  showTitle?: boolean;
}

function ProviderRow({
  provider,
  categoryLabel,
  countryCode,
}: {
  provider: WatchProviderItem;
  categoryLabel: string;
  countryCode: string;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-cb-divider py-2 last:border-0">
      {provider.logo_url ? (
        <Image
          src={provider.logo_url}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-cb-sm object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-cb-sm border border-cb-divider bg-cb-surface font-ui text-[10px] font-semibold">
          {provider.provider_name.slice(0, 2)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-ui text-cb-ui font-medium">{provider.provider_name}</p>
        <p className="font-mono text-[11px] text-cb-muted">
          {categoryLabel} · {countryCode}
        </p>
      </div>
      <span className="font-mono text-cb-meta uppercase text-cb-teal">{categoryLabel}</span>
    </li>
  );
}

function ProviderGroups({
  categories,
  countryCode,
}: {
  categories: WatchProviderCategory[];
  countryCode: string;
}) {
  const { mine, others } = splitWatchProviders(categories);
  return (
    <div className="space-y-5">
      {mine.length > 0 ? (
        <div className="space-y-1">
          <p className="font-mono text-cb-meta uppercase text-cb-muted">My services</p>
          <h3 className="font-display text-cb-section leading-none">Ready to play</h3>
          <ul>
            {mine.map((provider) => (
              <ProviderRow
                key={`mine-${provider.provider_id}`}
                provider={provider}
                categoryLabel={provider.categoryLabel}
                countryCode={countryCode}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {mine.length > 0 && others.length > 0 ? (
        <p className="font-mono text-cb-meta uppercase text-cb-muted">Others</p>
      ) : null}
      {others.map((category) => (
        <div key={category.type} className="space-y-1">
          {mine.length === 0 ? (
            <p className="font-mono text-cb-meta uppercase text-cb-muted">{category.label}</p>
          ) : null}
          <ul>
            {category.providers.map((provider) => (
              <ProviderRow
                key={`${category.type}-${provider.provider_id}`}
                provider={provider}
                categoryLabel={category.label}
                countryCode={countryCode}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function WhereToWatchSkeleton() {
  return (
    <div data-testid="where-to-watch" className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-3/4" />
    </div>
  );
}

function MatchGuidance({ onEditMatch }: { onEditMatch?: () => void }) {
  return (
    <div data-testid="where-to-watch" className="space-y-3">
      <p className="font-ui text-cb-body text-cb-muted">
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
    </div>
  );
}

export function WhereToWatchSection({
  filmId,
  hasTmdbId = true,
  onEditMatch,
  showTitle = true,
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
      <div data-testid="where-to-watch">
        <ErrorState
          title="Could not load streaming options"
          message="Streaming availability could not be loaded right now."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div data-testid="where-to-watch" className="space-y-3">
      {showTitle && (
        <h3 className="font-display text-cb-section leading-none">Where to Watch</h3>
      )}
      {!data || data.categories.length === 0 ? (
        <p className="font-ui text-cb-body text-cb-muted">
          No streaming options currently listed for the UK.
        </p>
      ) : (
        <ProviderGroups categories={data.categories} countryCode={data.country_code} />
      )}
      <p className="font-mono text-[11px] text-cb-muted">
        Streaming data provided by JustWatch via TMDB.
      </p>
      {data?.link && (
        <a
          href={data.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center font-ui text-cb-ui text-cb-teal"
        >
          View on TMDB
        </a>
      )}
    </div>
  );
}
