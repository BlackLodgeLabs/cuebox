"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/error-state";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { useAddToWatchlist, useTmdbFilm } from "@/hooks/use-films";
import { communityScores } from "@/lib/community-scores";
import { filmDetailLine, filmMetaLine } from "@/lib/programme-format";
import type { TmdbFilm } from "@/types/api";

function catalogueMeta(film: TmdbFilm): string {
  return filmMetaLine([filmDetailLine(film), film.director]);
}

function onWatchlist(film: TmdbFilm): film is TmdbFilm & { film_id: string } {
  return Boolean(film.film_id) && film.status != null && film.status !== "archived";
}

export function TmdbFilmPage({ tmdbId }: { tmdbId: string }) {
  const id = Number(tmdbId);
  const valid = Number.isInteger(id) && id > 0;
  if (!valid) {
    return <ErrorState message="That film link is not valid." />;
  }
  return <TmdbFilmPageContent tmdbId={id} />;
}

function TmdbFilmPageContent({ tmdbId }: { tmdbId: number }) {
  const router = useRouter();
  const filmQuery = useTmdbFilm(tmdbId);
  const addToWatchlist = useAddToWatchlist();
  const [moreOpen, setMoreOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const claimed = useRef(false);
  const film = filmQuery.data;

  useEffect(() => {
    if (film && onWatchlist(film)) {
      router.replace(`/watchlist/${film.film_id}`);
    }
  }, [film, router]);

  if (filmQuery.isLoading) {
    return (
      <p role="status" className="px-4 py-16 text-center font-ui text-cb-muted">
        Loading film
      </p>
    );
  }

  if (filmQuery.isError || !film) {
    return (
      <ErrorState
        message="Could not load this film."
        onRetry={() => void filmQuery.refetch()}
      />
    );
  }

  if (onWatchlist(film)) {
    return (
      <p role="status" className="px-4 py-16 text-center font-ui text-cb-muted">
        Opening your film
      </p>
    );
  }

  const score = communityScores({
    tmdb_rating: film.tmdb_rating,
    rotten_tomatoes_score: null,
  })[0];
  const meta = catalogueMeta(film);

  async function add() {
    if (claimed.current || added || addToWatchlist.isPending) return;
    claimed.current = true;
    try {
      const response = await addToWatchlist.mutateAsync({ tmdb_id: tmdbId });
      setAdded(true);
      toast({
        title: response.already_on_watchlist
          ? "Already on your watchlist"
          : "Added to watchlist",
        description: film?.title,
      });
    } catch {
      claimed.current = false;
      // useAddToWatchlist reports the failure.
    }
  }

  return (
    <article className="relative min-h-screen bg-cb-bg pb-32">
      <div className="relative h-[42vh] min-h-[240px] bg-cb-surface">
        {film.backdrop_url ? (
          <img
            src={film.backdrop_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-cb-bg via-cb-bg/25 to-black/25" />
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.back()}
          className="absolute left-4 top-[max(16px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-cb-text"
        >
          <Icon name="arrow_back" size={22} />
        </button>
      </div>

      <div className="relative -mt-cb-6 px-cb-3">
        <h1 className="text-h1 text-cb-text">{film.title}</h1>
        {meta ? (
          <p className="mt-cb-2 font-mono text-cb-caption text-cb-muted">{meta}</p>
        ) : null}
        {score ? (
          <p className="mt-cb-3 inline-flex items-center gap-cb-2 rounded-cb bg-cb-surface px-cb-2 py-cb-1 font-mono text-cb-meta-sm">
            <span className="text-cb-teal">{score.label}</span>
            <span className="text-cb-text">{score.percent}%</span>
          </p>
        ) : null}

        <p className="mt-cb-5 font-mono text-cb-meta uppercase text-cb-muted">
          Story
        </p>
        <h2 className="text-h2 text-cb-text">Synopsis</h2>
        <p className="mt-cb-2 max-w-prose font-ui text-cb-body text-cb-text">
          {film.overview?.trim() ? film.overview : "No synopsis yet."}
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cb-divider bg-cb-bg px-cb-4 pb-[calc(var(--cb-space-3)+env(safe-area-inset-bottom,0px))] pt-cb-3">
        <div className="mx-auto grid max-w-md grid-cols-3 items-end">
          <div className="flex justify-center">
            {film.trailer_url ? (
              <a
                href={film.trailer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 min-w-11 flex-col items-center gap-1 text-cb-muted"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-cb-divider">
                  <Icon name="play_arrow" size={22} />
                </span>
                <span className="font-ui text-cb-caption">Trailer</span>
              </a>
            ) : null}
          </div>
          <div className="flex justify-center">
            <Button
              type="button"
              onClick={() => void add()}
              disabled={added || addToWatchlist.isPending}
              className="h-auto flex-col gap-1 bg-transparent p-0 text-cb-accent shadow-none hover:bg-transparent"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cb-accent text-cb-ink shadow-glow motion-reduce:shadow-none">
                <Icon name="add" size={28} />
              </span>
              Add to watchlist
            </Button>
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-h-11 min-w-11 flex-col items-center gap-1 text-cb-muted"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-cb-divider">
                <Icon name="more_horiz" size={22} />
              </span>
              <span className="font-ui text-cb-caption">More</span>
            </button>
          </div>
        </div>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <a
            href={`https://www.themoviedb.org/movie/${film.tmdb_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-ui text-cb-body text-cb-teal"
          >
            View on TMDB
          </a>
        </SheetContent>
      </Sheet>
    </article>
  );
}
