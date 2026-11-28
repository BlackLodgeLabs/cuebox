import type { WatchProviderCategory, WatchProviderItem } from "@/types/api";

export interface SubscribedProvider extends WatchProviderItem {
  categoryLabel: string;
}

/** User's services first. Remaining providers stay in their category groups. */
export function splitWatchProviders(categories: WatchProviderCategory[]): {
  mine: SubscribedProvider[];
  others: WatchProviderCategory[];
} {
  const mine: SubscribedProvider[] = [];
  const seen = new Set<number>();
  const others: WatchProviderCategory[] = [];

  for (const category of categories) {
    const rest: WatchProviderItem[] = [];
    for (const provider of category.providers) {
      if (provider.subscribed && category.type === "flatrate") {
        if (!seen.has(provider.provider_id)) {
          seen.add(provider.provider_id);
          mine.push({ ...provider, categoryLabel: category.label });
        }
      } else {
        rest.push(provider);
      }
    }
    if (rest.length > 0) {
      others.push({ ...category, providers: rest });
    }
  }

  return { mine, others };
}

export const MY_SERVICES_INTRO =
  "Used to sort Where to watch, so your subscriptions come first, and by the On my services filter on the Watchlist. You can change this whenever you like.";

export function countryLabel(countryCode: string): string {
  if (countryCode === "GB") return "United Kingdom";
  return countryCode;
}
