"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { usePendingReviewCount } from "@/hooks/use-films";

const MORE_DESTINATIONS = [
  {
    href: "/history",
    label: "History",
    description: "Browse past recommendations.",
    icon: "history",
  },
  {
    href: "/settings/services",
    label: "My services",
    description: "Services you use to watch.",
    icon: "live_tv",
  },
  {
    href: "/settings/sync",
    label: "Sync",
    description: "CSV sync, watched diary, and RSS polling.",
    icon: "sync",
  },
  {
    href: "/import",
    label: "Import",
    description: "Upload a Letterboxd watchlist CSV.",
    icon: "upload_file",
  },
  {
    href: "/review",
    label: "Reviews",
    description: "Metadata matches and watch reviews.",
    icon: "rate_review",
    showPendingCount: true,
  },
] as const;

export default function MorePage() {
  const { data: pendingCount } = usePendingReviewCount();
  const reviewCount = typeof pendingCount === "number" && pendingCount > 0 ? pendingCount : null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-h1">More</h1>
        <p className="mt-1 font-ui text-cb-body text-cb-muted">
          History, services, sync, import, and reviews.
        </p>
      </div>

      <nav
        aria-label="More destinations"
        className="divide-y divide-cb-divider border-y border-cb-divider"
      >
        {MORE_DESTINATIONS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 items-center gap-3 py-3 text-left hover:bg-cb-surface"
          >
            <Icon name={item.icon} size={22} className="shrink-0 text-cb-muted" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-cb-tile text-cb-text">
                {item.label}
                {"showPendingCount" in item && item.showPendingCount && reviewCount !== null ? (
                  <span className="ml-2 font-ui text-cb-caption text-cb-muted">{reviewCount}</span>
                ) : null}
              </span>
              <span className="mt-0.5 block font-ui text-cb-caption text-cb-muted">
                {item.description}
              </span>
            </span>
            <Icon name="chevron_right" size={20} className="shrink-0 text-cb-muted" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
