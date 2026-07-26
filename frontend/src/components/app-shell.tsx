"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { usePendingReviewCount } from "@/hooks/use-films";
import { cn } from "@/lib/utils";

const BOTTOM_TABS = [
  {
    href: "/",
    label: "Home",
    icon: "home",
    isActive: (pathname: string) => pathname === "/",
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    icon: "bookmark",
    isActive: (pathname: string) => pathname.startsWith("/watchlist"),
  },
  {
    href: "/recommend",
    label: "Recommend",
    icon: "movie",
    isActive: (pathname: string) => pathname.startsWith("/recommend"),
  },
  {
    href: "/settings/sync",
    label: "More",
    icon: "more_horiz",
    isActive: (pathname: string) => pathname.startsWith("/settings"),
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: reviewCount = 0 } = usePendingReviewCount();
  const reviewActive = pathname.startsWith("/review");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 md:px-12">
          <Link href="/" className="text-h2 font-heading text-foreground">
            Cuebox
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/search"
              aria-label="Search films"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:text-foreground"
            >
              <Icon name="search" size={22} />
            </Link>
            {reviewCount > 0 && (
              <Link
                href="/review"
                aria-label={`Review ${reviewCount}`}
                className={cn(
                  "flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded px-2 transition-colors duration-150 motion-reduce:transition-none",
                  reviewActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon name="fact_check" filled={reviewActive} size={22} />
                <Badge variant="secondary">{reviewCount}</Badge>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="main-scanlines mx-auto max-w-7xl px-4 py-8 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:px-12">
        {children}
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="mx-auto flex max-w-7xl items-stretch justify-around px-2">
          {BOTTOM_TABS.map((tab) => {
            const active = tab.isActive(pathname);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-label-md normal-case tracking-normal transition-colors duration-150 motion-reduce:transition-none",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon name={tab.icon} filled={active} size={22} />
                <span className="text-[11px] font-mono font-semibold leading-4 tracking-[0.04em]">
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
