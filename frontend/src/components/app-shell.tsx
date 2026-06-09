"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { usePendingReviewCount } from "@/hooks/use-films";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/recommend", label: "Recommend" },
  { href: "/history", label: "History" },
  { href: "/settings/sync", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: reviewCount = 0 } = usePendingReviewCount();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold">
            Film Picker
          </Link>
          <nav className="flex items-center gap-1 sm:gap-4">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const showBadge =
                item.href === "/review" ||
                (item.href === "/" && reviewCount > 0);

              return (
                <Link
                  key={item.href}
                  href={
                    item.href === "/" && reviewCount > 0 ? "/review" : item.href
                  }
                  className={cn(
                    "relative rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                    active && "bg-accent text-accent-foreground",
                  )}
                >
                  {item.label}
                  {showBadge && reviewCount > 0 && item.href === "/" && (
                    <Badge
                      variant="destructive"
                      className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-xs"
                    >
                      {reviewCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
            {reviewCount > 0 && (
              <Link
                href="/review"
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  pathname.startsWith("/review") &&
                    "bg-accent text-accent-foreground",
                )}
              >
                Review
                <Badge variant="destructive" className="ml-2">
                  {reviewCount}
                </Badge>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
