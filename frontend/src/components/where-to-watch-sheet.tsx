"use client";

import { ErrorState } from "@/components/error-state";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilmWatchProviders } from "@/hooks/use-watch-providers";
import type { WatchProviderCategory } from "@/types/api";

export function WhereToWatchSheet({
  filmId,
  filmTitle,
  open,
  onOpenChange,
}: {
  filmId: string | null;
  filmTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError, refetch } = useFilmWatchProviders(filmId ?? "", {
    enabled: open && Boolean(filmId),
  });
  const categories = (data?.categories ?? []).filter((category) => category.providers.length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-y-auto">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>Where to watch</SheetTitle>
          <SheetDescription>
            {filmTitle ? `Services for ${filmTitle}` : "Services for this film"}
          </SheetDescription>
        </SheetHeader>
        {isLoading ? <ProviderSkeleton /> : null}
        {isError ? (
          <ErrorState
            message="Could not load where to watch."
            onRetry={() => void refetch()}
          />
        ) : null}
        {!isLoading && !isError && categories.length === 0 ? (
          <p className="font-ui text-cb-body text-cb-muted">
            Nothing listed for this film right now.
          </p>
        ) : null}
        {!isLoading && !isError ? (
          <div className="space-y-6">
            {categories.map((category) => (
              <ProviderGroup key={category.type} category={category} />
            ))}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ProviderGroup({ category }: { category: WatchProviderCategory }) {
  return (
    <section className="space-y-3">
      <h3 className="font-mono text-cb-meta uppercase text-cb-muted">{category.label}</h3>
      <ul className="space-y-3">
        {category.providers.map((provider) => (
          <li key={`${category.type}-${provider.provider_id}`} className="flex items-center gap-3">
            {provider.logo_url ? (
              <img
                src={provider.logo_url}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-cb-sm object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-cb-sm bg-cb-bg font-ui text-cb-caption text-cb-muted">
                <Icon name="play_arrow" size={18} />
              </span>
            )}
            <span className="font-ui text-cb-body text-cb-text">{provider.provider_name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProviderSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-4 w-16 bg-cb-bg" />
      <Skeleton className="h-10 w-full bg-cb-bg" />
      <Skeleton className="h-10 w-full bg-cb-bg" />
    </div>
  );
}
