"use client";

import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChromeOverrideProvider, useTabBarOverride } from "@/components/chrome-override";
import { FilmSearchCard } from "@/components/film-search-card";
import {
  HomeArrivalProvider,
  arrivalChromeTransition,
  useArrivalPhase,
} from "@/components/home-arrival";
import { Icon } from "@/components/icon";
import { Wordmark } from "@/components/wordmark";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { screenMotion } from "@/lib/motion";
import { isScreenFadeSuppressed } from "@/lib/recommend-handoff";
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

function isCatalogueFilmPath(pathname: string): boolean {
  return pathname.startsWith("/films/tmdb/");
}

/** Film detail replaces the shell header and tab bar with its own hero and action bar. */
export function isFilmDetailPath(pathname: string): boolean {
  return /^\/watchlist\/(?!add$)[^/]+$/.test(pathname);
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
  return (
    <HomeArrivalProvider>
      <ChromeOverrideProvider>
        <AppShellFrame>{children}</AppShellFrame>
      </ChromeOverrideProvider>
    </HomeArrivalProvider>
  );
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const filmDetail = isFilmDetailPath(pathname);
  const catalogueFilm = isCatalogueFilmPath(pathname);
  const reduced = useReducedMotion();
  const screen = screenMotion(reduced);
  const phase = useArrivalPhase();
  const playing = phase === "play";
  const chrome = arrivalChromeTransition(playing);
  const isHome = pathname === "/";
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const tabOverride = useTabBarOverride();
  const programmeTonight = pathname === "/dev/programme";
  const programmeHistory = pathname.startsWith("/dev/programme/history");
  const historyNight = /^\/history\/[^/]+/.test(pathname);
  const programmePreview = programmeTonight || programmeHistory;
  const historyRoute = pathname.startsWith("/history");
  const questionnaire = pathname === "/recommend";
  const recommendResults = pathname.startsWith("/recommend/results");
  const hideHeader =
    filmDetail || catalogueFilm || programmeTonight || questionnaire || recommendResults;
  const hideTabs = filmDetail || catalogueFilm || (questionnaire && tabOverride !== true);
  const skipRouteFade = (isHome && reduced) || isScreenFadeSuppressed(pathname);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  return (
    <div className="min-h-screen bg-cb-bg text-cb-text">
      <Suspense fallback={null}>
        <SearchFocusOpener onOpen={openSearch} />
      </Suspense>
      {hideHeader ? null : (
        <motion.header
          key={phase}
          initial={playing ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={chrome}
          className={cn(
            "sticky top-0 z-40 pt-[env(safe-area-inset-top,0px)]",
            isHome && !scrolled ? "bg-transparent" : "bg-cb-bg",
          )}
        >
          <div
            data-shell-header
            className="mx-auto flex h-[52px] w-full max-w-7xl items-center gap-2 px-4"
          >
            <Wordmark />
            {programmeHistory || historyRoute ? null : (
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
        </motion.header>
      )}

      <main
        className={
          filmDetail
            ? "mx-auto w-full max-w-7xl px-0 py-0 pb-[calc(112px+env(safe-area-inset-bottom,0px))]"
            : catalogueFilm
              ? "mx-auto w-full max-w-7xl pb-[env(safe-area-inset-bottom,0px)]"
              : isHome
                ? "mx-auto w-full max-w-7xl px-0 py-0 pb-[calc(90px+env(safe-area-inset-bottom,0px))]"
                : questionnaire || recommendResults
                  ? cn(
                      "mx-auto w-full max-w-7xl px-4 md:px-12",
                      hideTabs
                        ? "pb-4"
                        : "pb-[calc(90px+env(safe-area-inset-bottom,0px))]",
                      "pt-2",
                    )
                  : cn(
                      "mx-auto w-full max-w-7xl px-4 pb-[calc(90px+env(safe-area-inset-bottom,0px))] md:px-12",
                      historyRoute ? "pt-1" : programmePreview ? "pt-2" : "pt-8",
                    )
        }
      >
        <AnimatePresence initial={false} mode="popLayout">
          <ScreenPane
            key={pathname}
            fadeMs={screen.fadeMs}
            transition={screen.transition}
            skipFade={skipRouteFade}
          >
            {children}
          </ScreenPane>
        </AnimatePresence>
      </main>

      <FilmSearchCard open={searchOpen} onOpenChange={setSearchOpen} />

      {hideTabs ? null : (
        <motion.nav
          key={`tabs-${phase}`}
          aria-label="Primary"
          initial={playing ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={chrome}
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
        </motion.nav>
      )}
    </div>
  );
}

function ScreenPane({
  children,
  fadeMs,
  transition,
  skipFade,
}: {
  children: React.ReactNode;
  fadeMs: number;
  transition: ReturnType<typeof screenMotion>["transition"];
  skipFade: boolean;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      data-cb-screen=""
      data-fade-ms={skipFade ? 0 : fadeMs}
      aria-hidden={present ? undefined : true}
      inert={present ? undefined : true}
      initial={skipFade ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={skipFade ? { duration: 0 } : transition}
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
