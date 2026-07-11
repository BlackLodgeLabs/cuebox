"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { usePendingReviewCount } from "@/hooks/use-films";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/watchlist", label: "Watchlist", icon: "bookmark" },
  { href: "/recommend", label: "Recommend", icon: "movie" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/settings/sync", label: "Settings", icon: "settings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: reviewCount = 0 } = usePendingReviewCount();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-12">
          <Link href="/" className="text-h2 font-heading text-foreground">
            Cuebox
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-3 py-2 text-label-md normal-case tracking-normal transition-all hover-glow",
                    active
                      ? "bg-accent text-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon name={item.icon} filled={active} size={20} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
            {reviewCount > 0 && (
              <Link
                href="/review"
                className={cn(
                  "flex items-center gap-2 rounded px-3 py-2 text-label-md normal-case tracking-normal transition-all hover-glow",
                  pathname.startsWith("/review")
                    ? "bg-accent text-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  name="fact_check"
                  filled={pathname.startsWith("/review")}
                  size={20}
                />
                <span className="hidden sm:inline">Review</span>
                <Badge variant="secondary">{reviewCount}</Badge>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="main-scanlines mx-auto max-w-7xl px-4 py-8 md:px-12">
        {children}
      </main>
    </div>
  );
}
