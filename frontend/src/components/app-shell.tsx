"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { SearchCard } from "@/components/ui/search-card";
import { Wordmark } from "@/components/wordmark";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { screenMotion } from "@/lib/motion";
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
    href: "/more",
    label: "More",
    icon: "more_horiz",
    isActive: (pathname: string) =>
      pathname === "/more" ||
      pathname.startsWith("/more/") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/history"),
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const screen = screenMotion(reduced);
  const [searchOpen, setSearchOpen] = useState(false);
  const programmeTonight = pathname === "/dev/programme";
  const programmeHistory = pathname.startsWith("/dev/programme/history");
  const historyNight = /^\/history\/[^/]+/.test(pathname);
  const programmePreview = programmeTonight || programmeHistory;
  const tightTop = programmePreview || pathname.startsWith("/history");

  return (
    <div className="min-h-screen bg-cb-bg text-cb-text">
      {programmeTonight ? null : (
        <header className="sticky top-0 z-40 bg-cb-bg pt-[env(safe-area-inset-top,0px)]">
          <div
            data-shell-header
            className="mx-auto flex h-[52px] w-full max-w-7xl items-center gap-2 px-4"
          >
            <Wordmark />
            {programmeHistory || historyNight ? null : (
              <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-cb bg-cb-surface px-3">
                <Icon name="search" size={18} className="shrink-0 text-cb-muted" />
                <input
                  readOnly
                  placeholder="Search films"
                  aria-label="Search films"
                  className="w-full cursor-pointer bg-transparent font-ui text-cb-caption text-cb-text outline-none placeholder:text-cb-muted"
                  onClick={() => setSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSearchOpen(true);
                    }
                  }}
                />
              </label>
            )}
          </div>
        </header>
      )}

      <main
        className={cn(
          "mx-auto w-full max-w-7xl px-4 pb-[calc(90px+env(safe-area-inset-bottom,0px))] md:px-12",
          tightTop ? "pt-1" : "py-8",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={pathname}
            data-cb-screen=""
            data-fade-ms={screen.fadeMs}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={screen.transition}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <SearchCard open={searchOpen} onOpenChange={setSearchOpen} />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-cb-divider bg-cb-bg pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div
          data-shell-tabbar
          className="mx-auto flex h-[90px] max-w-7xl items-stretch justify-around px-2"
        >
          {BOTTOM_TABS.map((tab) => {
            const active = programmeTonight
              ? tab.label === "Recommend"
              : programmeHistory
                ? tab.label === "More"
                : tab.isActive(pathname);

            return (
              <LinkTab
                key={tab.href}
                href={tab.href}
                label={tab.label}
                icon={tab.icon}
                active={active}
              />
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function LinkTab({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 px-1 font-ui text-cb-tab",
        active ? "text-cb-teal" : "text-cb-muted",
      )}
    >
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </Link>
  );
}
