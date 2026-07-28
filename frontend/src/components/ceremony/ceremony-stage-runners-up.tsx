"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  formatDirectorRuntime,
  formatFilmTitle,
  ShortReasons,
  WatchlistDeepLink,
} from "@/components/ceremony/ceremony-shared";
import { cn } from "@/lib/utils";
import type { FilmResult } from "@/types/api";

export function CeremonyStageRunnersUp({ films }: { films: FilmResult[] }) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || films.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number(
          (visible.target as HTMLElement).dataset.runnerIndex ?? "0",
        );
        if (!Number.isNaN(index)) {
          setFocusedIndex(index);
        }
      },
      {
        root: scroller,
        threshold: [0.55, 0.75, 0.9],
      },
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [films.length]);

  if (films.length === 0) {
    return (
      <section
        className="space-y-4"
        data-testid="ceremony-stage-runners-up"
        aria-label="Ceremony stage 2 — runners-up"
      >
        <p className="text-body-md text-muted-foreground">
          No runners-up for this session.
        </p>
      </section>
    );
  }

  const focused = films[focusedIndex] ?? films[0];

  const focusPoster = (index: number) => {
    setFocusedIndex(index);
    itemRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  return (
    <section
      className="space-y-6"
      data-testid="ceremony-stage-runners-up"
      aria-label="Ceremony stage 2 — runners-up"
    >
      <div>
        <h2 className="text-h2">Runners-up</h2>
        <p className="mt-1 text-body-md text-muted-foreground">
          Swipe to compare the near-misses.
        </p>
      </div>

      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Runner-up posters"
      >
        {films.map((film, index) => {
          const isFocused = index === focusedIndex;
          return (
            <button
              key={film.film_id}
              type="button"
              role="listitem"
              data-runner-index={index}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onClick={() => focusPoster(index)}
              onFocus={() => focusPoster(index)}
              aria-pressed={isFocused}
              aria-label={`${formatFilmTitle(film)}${isFocused ? " (focused)" : ""}`}
              className={cn(
                "relative aspect-[2/3] w-40 shrink-0 snap-center overflow-hidden rounded bg-surface-high transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48 md:w-56",
                isFocused ? "border border-primary shadow-glow" : "opacity-80",
              )}
            >
              {film.poster_url ? (
                <Image
                  src={film.poster_url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 160px, 224px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-label-md text-muted-foreground">
                  NO POSTER
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-3" data-testid="runner-focus-panel">
        <h3 className="font-heading text-h2 leading-none">
          {formatFilmTitle(focused)}
        </h3>
        {formatDirectorRuntime(focused) && (
          <p className="text-body-md text-muted-foreground">
            {formatDirectorRuntime(focused)}
          </p>
        )}
        <ShortReasons film={focused} />
        <WatchlistDeepLink film={focused} />
      </div>
    </section>
  );
}
