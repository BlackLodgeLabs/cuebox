"use client";

import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { FilmSearchCard } from "@/components/film-search-card";
import { Icon } from "@/components/icon";
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
      pathname.startsWith("/settings"),
  },
] as const;

function isCatalogueFilmPath(pathname: string): boolean {
  return pathname.startsWith("/films/tmdb/");
}

function SearchFocusOpener({ onOpen }: { onOpen: () => void }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (params.get("focus") !== "search") {
      handled.current = false;
      return;
    }
    if (handled.current) return;
    handled.current = true;
    onOpen();
    const url = new URL(window.location.href);
    url.searchParams.delete("focus");
    const next = `${pathname}${url.search}`;
    router.replace(next, { scroll: false });
  }, [params, pathname, onOpen, router]);

  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const screen = screenMotion(reduced);
  const [searchOpen, setSearchOpen] = useState(false);
  const catalogueFilm = isCatalogueFilmPath(pathname);
  const openSearch = useCallback(() => setSearchOpen(true), []);

  return (
    <div className="min-h-screen bg-cb-bg text-cb-text">
      <Suspense fallback={null}>
        <SearchFocusOpener onOpen={openSearch} />
      </Suspense>
      {catalogueFilm ? null : (
      <header className="sticky top-0 z-40 bg-cb-bg pt-[env(safe-area-inset-top,0px)]">
        <div
          data-shell-header
          className="mx-auto flex h-[52px] w-full max-w-7xl items-center gap-2 px-4"
        >
          <Wordmark />
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
        </div>
      </header>
      )}

      <main
        className={cn(
          "mx-auto w-full max-w-7xl",
          catalogueFilm
            ? "pb-[env(safe-area-inset-bottom,0px)]"
            : "px-4 py-8 pb-[calc(90px+env(safe-area-inset-bottom,0px))] md:px-12",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <ScreenPane key={pathname} fadeMs={screen.fadeMs} transition={screen.transition}>
            {children}
          </ScreenPane>
        </AnimatePresence>
      </main>

      <FilmSearchCard open={searchOpen} onOpenChange={setSearchOpen} />

      {catalogueFilm ? null : (
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-cb-divider bg-cb-bg pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div
          data-shell-tabbar
          className="mx-auto flex h-[90px] max-w-7xl items-stretch justify-around px-2"
        >
          {BOTTOM_TABS.map((tab) => {
            const active = tab.isActive(pathname);

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
      )}
    </div>
  );
}

function ScreenPane({
  children,
  fadeMs,
  transition,
}: {
  children: React.ReactNode;
  fadeMs: number;
  transition: ReturnType<typeof screenMotion>["transition"];
}) {
  const present = useIsPresent();
  return (
    <motion.div
      data-cb-screen=""
      data-fade-ms={fadeMs}
      aria-hidden={present ? undefined : true}
      inert={present ? undefined : true}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition}
    >
      {children}
    </motion.div>
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
