"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import {
  HomeArrivalProvider,
  arrivalChromeTransition,
  useArrivalPhase,
} from "@/components/home-arrival";
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
      pathname.startsWith("/settings"),
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <HomeArrivalProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </HomeArrivalProvider>
  );
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const screen = screenMotion(reduced);
  const phase = useArrivalPhase();
  const playing = phase === "play";
  const isHome = pathname === "/";
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const chrome = arrivalChromeTransition(playing);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  return (
    <div className="min-h-screen bg-cb-bg text-cb-text">
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
      </motion.header>

      <Suspense fallback={null}>
        <SearchFocus pathname={pathname} onOpen={() => setSearchOpen(true)} />
      </Suspense>

      <main
        className={cn(
          "mx-auto w-full max-w-7xl pb-[calc(90px+env(safe-area-inset-bottom,0px))]",
          isHome ? "px-0 py-0" : "px-4 py-8 md:px-12",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={pathname}
            data-cb-screen=""
            data-fade-ms={isHome && reduced ? 0 : screen.fadeMs}
            initial={isHome && reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={isHome && reduced ? { duration: 0 } : screen.transition}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <SearchCard open={searchOpen} onOpenChange={setSearchOpen} />

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
      </motion.nav>
    </div>
  );
}

function SearchFocus({
  pathname,
  onOpen,
}: {
  pathname: string;
  onOpen: () => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (searchParams.get("focus") !== "search") return;
    handled.current = true;
    onOpen();
    router.replace(pathname || "/", { scroll: false });
  }, [onOpen, pathname, router, searchParams]);

  return null;
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
