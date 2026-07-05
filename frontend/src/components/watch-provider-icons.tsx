"use client";

import Image from "next/image";
import { useMemo } from "react";
import type { WatchProviderCategoryType, WatchProviderItem } from "@/types/api";

const CATEGORY_PRIORITY: WatchProviderCategoryType[] = [
  "flatrate",
  "ads",
  "rent",
  "buy",
];

const MAX_VISIBLE = 6;

interface WatchProviderIconsProps {
  categories?: Array<{ type: WatchProviderCategoryType; providers: WatchProviderItem[] }>;
  providers?: WatchProviderItem[];
}

function dedupeProviders(
  categories: Array<{ type: WatchProviderCategoryType; providers: WatchProviderItem[] }>,
): WatchProviderItem[] {
  const seen = new Set<number>();
  const ordered: WatchProviderItem[] = [];

  for (const type of CATEGORY_PRIORITY) {
    const category = categories.find((item) => item.type === type);
    if (!category) continue;
    for (const provider of category.providers) {
      if (seen.has(provider.provider_id)) continue;
      seen.add(provider.provider_id);
      ordered.push(provider);
    }
  }

  return ordered;
}

export function WatchProviderIcons({
  categories,
  providers,
}: WatchProviderIconsProps) {
  const visibleProviders = useMemo(() => {
    if (providers) return providers;
    if (!categories || categories.length === 0) return [];
    return dedupeProviders(categories);
  }, [categories, providers]);

  if (visibleProviders.length === 0) {
    return null;
  }

  const shown = visibleProviders.slice(0, MAX_VISIBLE);
  const overflow = visibleProviders.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="watch-provider-icons">
      {shown.map((provider) => (
        <span
          key={provider.provider_id}
          className="relative inline-flex h-7 w-7 overflow-hidden rounded"
          aria-label={provider.provider_name}
        >
          {provider.logo_url ? (
            <Image
              src={provider.logo_url.replace("/w92/", "/w45/")}
              alt=""
              width={28}
              height={28}
              className="object-cover"
              onError={(event) => {
                const target = event.currentTarget;
                target.style.display = "none";
              }}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-surface-high text-[10px] text-muted-foreground">
              {provider.provider_name.slice(0, 2)}
            </span>
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span className="rounded bg-surface-high px-1.5 py-0.5 font-mono text-label-md text-muted-foreground">
          +{overflow}
        </span>
      )}
    </div>
  );
}
