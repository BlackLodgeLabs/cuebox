"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { EditFilmMatchDialog } from "@/components/edit-film-match-dialog";
import { FilmPoster } from "@/components/film-poster";
import { Icon } from "@/components/icon";
import { TasteTickChart } from "@/components/taste-tick-chart";
import { WatchReviewDialog, watchToDialogProps } from "@/components/watch-review-dialog";
import { WhereToWatchSection } from "@/components/where-to-watch-section";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFilmTrailer, useSimilarFilms } from "@/hooks/use-films";
import { closeToThisFilms } from "@/lib/close-to-this";
import { communityScores } from "@/lib/community-scores";
import { cn } from "@/lib/utils";
import type { FilmDetail, FilmStatus, FilmWatch, WatchlistTab } from "@/types/api";

interface FilmDetailViewProps {
  film: FilmDetail;
  autoOpenEditMatch?: boolean;
  watchlistTab?: WatchlistTab;
  onStatusTransition?: (status: FilmStatus) => void;
  onMarkWatched?: () => void;
  onRemove?: () => void;
  isStatusPending?: boolean;
  /** False on the lighter not-on-watchlist page, which has no Close to this. */
  onWatchlist?: boolean;
}

const LETTERBOXD_UNKNOWN_DATE = "1984-09-28";
const SYNOPSIS_PREVIEW = 180;

function statusKicker(status: FilmStatus): string {
  if (status === "watched" || status === "pending_watch_review") return "Watched";
  if (status === "archived") return "Archived";
  return "On your watchlist";
}

function heroMeta(film: FilmDetail): string {
  const metadata = film.metadata;
  const parts: string[] = [];
  if (film.year) parts.push(String(film.year));
  const genre = metadata?.genres[0];
  if (genre) parts.push(genre);
  if (metadata?.runtime != null) parts.push(`${metadata.runtime}m`);
  if (metadata?.director) parts.push(metadata.director);
  return parts.join(" · ");
}

function formatWatchDate(watch: FilmWatch): string {
  if (
    !watch.watched_at ||
    (watch.source === "letterboxd_import" && watch.watched_at === LETTERBOXD_UNKNOWN_DATE)
  ) {
    return "Date unknown";
  }
  const [year, month, day] = watch.watched_at.split("-").map(Number);
  if (!year || !month || !day) return "Date unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function DetailSection({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 pt-5">
      <p className="font-mono text-cb-meta uppercase text-cb-muted">{kicker}</p>
      <h2 className="mt-1 font-display text-cb-section leading-none">{title}</h2>
      <span aria-hidden className="mt-1.5 block h-0.5 w-7 bg-cb-teal" />
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AmberStars({ score }: { score: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${score} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = score >= index + 1;
        const half = !filled && score >= index + 0.5;
        return (
          <span key={index} className="relative inline-flex text-cb-divider">
            <Icon name="star" size={16} />
            {(filled || half) && (
              <span className={cn("absolute inset-0 overflow-hidden text-cb-accent", half && "w-1/2")}>
                <Icon name="star" filled size={16} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function Synopsis({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const clipped = text.length > SYNOPSIS_PREVIEW;
  const head = clipped ? text.slice(0, SYNOPSIS_PREVIEW).replace(/\s+\S*$/, "") : text;
  const tail = clipped ? text.slice(head.length).trimStart() : "";

  return (
    <div>
      <p className="font-ui text-cb-body leading-[22px] text-cb-text">
        {head}
        {clipped && !open ? "…" : ""}
      </p>
      {clipped && (
        <Reveal open={open}>
          <p className="font-ui text-cb-body leading-[22px] text-cb-text">{tail}</p>
        </Reveal>
      )}
      {clipped && !open && (
        <button
          type="button"
          className="mt-2 font-ui text-cb-ui font-medium text-cb-teal"
          onClick={() => setOpen(true)}
        >
          More
        </button>
      )}
    </div>
  );
}

export function FilmDetailView({
  film,
  autoOpenEditMatch = false,
  watchlistTab,
  onStatusTransition,
  onMarkWatched,
  onRemove,
  isStatusPending = false,
  onWatchlist = true,
}: FilmDetailViewProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [watchSheetOpen, setWatchSheetOpen] = useState(false);
  const [tab, setTab] = useState("overview");
  const [compact, setCompact] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const [watchDialog, setWatchDialog] = useState<{
    mode: "complete" | "edit";
    watch?: FilmWatch;
  } | null>(null);

  const watches = film.watches ?? [];
  const loggedWatches = watches.filter((watch) => !watch.is_pending);
  const pendingWatch = watches.find((watch) => watch.is_pending);
  const metadata = film.metadata;
  const semantic = film.semantic_profile;
  const isEnriching = film.enrichment_status === "enriching";
  const trailer = useFilmTrailer(film.id);
  const trailerUrl = trailer.data?.url ?? null;
  const similar = useSimilarFilms(film.id, { enabled: onWatchlist });
  const neighbours = closeToThisFilms(similar.data, onWatchlist);
  const scores = communityScores(metadata);
  const hasWatch =
    loggedWatches.length > 0 ||
    pendingWatch != null ||
    film.status === "watched" ||
    film.status === "pending_watch_review";
  const watchedLabel = hasWatch ? "Watched" : "Watched?";

  useEffect(() => {
    if (autoOpenEditMatch) setEditOpen(true);
  }, [autoOpenEditMatch, film.id]);

  useEffect(() => {
    const node = heroRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setCompact(entry ? !entry.isIntersecting : false);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const backTab =
    watchlistTab ??
    (film.status === "watched" || film.status === "pending_watch_review"
      ? "watched"
      : film.status === "archived"
        ? "archived"
        : "active");
  const backHref = backTab === "active" ? "/watchlist" : `/watchlist?tab=${backTab}`;

  const enrichmentPending = !metadata && !semantic;

  function openLoggedWatch() {
    if (film.status === "pending_watch_review") {
      setWatchDialog({ mode: "complete", watch: pendingWatch });
      return;
    }
    if (loggedWatches.length === 0 && film.status !== "watched") {
      onMarkWatched?.();
      return;
    }
    setTab("you");
  }

  function logAnotherWatch() {
    if (film.status === "pending_watch_review") {
      setWatchDialog({ mode: "complete", watch: pendingWatch });
      return;
    }
    if (loggedWatches.length === 0) {
      onMarkWatched?.();
      return;
    }
    setTab("you");
  }

  const metaLine = heroMeta(film);
  const tasteScores = semantic
    ? {
        pacing: semantic.pacing,
        complexity: semantic.complexity,
        energy: semantic.energy,
        obscurity: semantic.obscurity,
      }
    : null;
  const showTaste =
    tasteScores != null &&
    (tasteScores.pacing != null ||
      tasteScores.complexity != null ||
      tasteScores.energy != null ||
      tasteScores.obscurity != null);

  return (
    <div className="pb-4">
      {compact && (
        <div className="sticky top-0 z-30 flex h-12 items-center gap-1 border-b border-cb-divider bg-cb-bg px-1">
          <Link
            href={backHref}
            aria-label="Back to watchlist"
            className="flex h-11 w-11 items-center justify-center text-cb-text"
          >
            <Icon name="arrow_back" size={22} />
          </Link>
          <p className="truncate font-display text-cb-card leading-none">{film.title}</p>
        </div>
      )}

      <div ref={heroRef} className="relative h-[448px] overflow-hidden bg-cb-surface">
        {metadata?.backdrop_url && (
          <Image
            src={metadata.backdrop_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_38%]"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,11,11,0.35) 0%, rgba(11,11,11,0.12) 32%, rgba(11,11,11,0.88) 78%, #0B0B0B 100%)",
          }}
        />
        {!compact && (
          <Link
            href={backHref}
            aria-label="Back to watchlist"
            className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-cb bg-black/45 text-cb-text"
          >
            <Icon name="arrow_back" size={22} />
          </Link>
        )}
        <div className="absolute inset-x-4 bottom-4">
          <p className="font-mono text-cb-meta uppercase tracking-[0.06em] text-cb-teal">
            {statusKicker(film.status)}
          </p>
          <h1 className="mt-1.5 font-display text-cb-display leading-none tracking-[-0.02em]">
            {film.title}
          </h1>
          {metaLine && (
            <p className="mt-2 font-mono text-[12px] leading-4 text-cb-muted">{metaLine}</p>
          )}
          {isEnriching && (
            <p className="mt-2 font-ui text-cb-caption text-cb-muted">Updating metadata…</p>
          )}
        </div>
      </div>

      {scores.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5" data-testid="community-scores">
          {scores.map((score) => (
            <span
              key={score.source}
              className="inline-flex items-center gap-1.5"
              aria-label={`${score.label} ${score.percent} percent`}
            >
              <span
                className={cn(
                  "inline-flex h-[15px] items-center rounded-[3px] px-1 font-mono text-[7px] uppercase leading-none tracking-[0.04em]",
                  score.source === "tmdb" ? "bg-cb-teal text-cb-ink" : "bg-[#5C2E28] text-cb-text",
                )}
              >
                {score.label}
              </span>
              <span className="font-display text-cb-tile leading-none">{score.percent}%</span>
            </span>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          className={cn(
            "sticky z-20 flex h-11 w-full items-stretch justify-start gap-0 rounded-none border-b border-cb-divider bg-cb-bg p-0",
            compact ? "top-12" : "top-0",
          )}
        >
          {["Overview", "Watch", "You"].map((name) => (
            <TabsTrigger
              key={name}
              value={name.toLowerCase()}
              className="relative h-11 flex-1 rounded-none border-0 bg-transparent px-3 font-ui text-cb-ui text-cb-muted shadow-none data-[state=active]:border-0 data-[state=active]:bg-transparent data-[state=active]:text-cb-teal data-[state=active]:shadow-none after:absolute after:inset-x-3 after:bottom-[-1px] after:h-0.5 after:rounded-sm after:bg-transparent data-[state=active]:after:bg-cb-teal"
            >
              {name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0 focus-visible:ring-0">
          {metadata?.synopsis && (
            <DetailSection kicker="Story" title="Synopsis">
              <Synopsis text={metadata.synopsis} />
            </DetailSection>
          )}
          <DetailSection kicker="Services" title="Where to Watch">
            <WhereToWatchSection
              filmId={film.id}
              hasTmdbId={metadata?.tmdb_id != null}
              onEditMatch={() => setEditOpen(true)}
              showTitle={false}
            />
          </DetailSection>
          {metadata && (metadata.original_title || metadata.original_language || metadata.country) && (
            <DetailSection kicker="Details" title="Metadata">
              <dl className="space-y-3">
                {metadata.original_title && (
                  <div>
                    <dt className="font-mono text-cb-meta uppercase text-cb-muted">Original title</dt>
                    <dd className="font-ui text-cb-body">{metadata.original_title}</dd>
                  </div>
                )}
                {metadata.original_language && (
                  <div>
                    <dt className="font-mono text-cb-meta uppercase text-cb-muted">Language</dt>
                    <dd className="font-ui text-cb-body">{metadata.original_language.toUpperCase()}</dd>
                  </div>
                )}
                {metadata.country && (
                  <div>
                    <dt className="font-mono text-cb-meta uppercase text-cb-muted">Country</dt>
                    <dd className="font-ui text-cb-body">{metadata.country}</dd>
                  </div>
                )}
              </dl>
            </DetailSection>
          )}
          {showTaste && tasteScores && (
            <DetailSection kicker="Taste profile" title="How it feels">
              {semantic?.semantic_summary && (
                <p className="mb-4 font-ui text-cb-body text-cb-muted">{semantic.semantic_summary}</p>
              )}
              <TasteTickChart scores={tasteScores} />
            </DetailSection>
          )}
          {enrichmentPending && (
            <p className="px-4 pt-5 font-ui text-cb-body text-cb-muted">
              Enrichment data is not available yet for this film.
            </p>
          )}
        </TabsContent>

        <TabsContent value="watch" className="mt-0 focus-visible:ring-0">
          <DetailSection kicker="Services" title="Where to Watch">
            <WhereToWatchSection
              filmId={film.id}
              hasTmdbId={metadata?.tmdb_id != null}
              onEditMatch={() => setEditOpen(true)}
              showTitle={false}
            />
          </DetailSection>
        </TabsContent>

        <TabsContent value="you" className="mt-0 focus-visible:ring-0">
          <DetailSection kicker="Your review" title="Watch history">
            <div className="space-y-3">
              {film.status === "pending_watch_review" && (
                <div className="rounded-cb-lg border border-cb-divider p-4">
                  <p className="font-ui text-cb-body text-cb-muted">
                    This film is waiting for a watch diary entry.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3 min-h-11"
                    onClick={() => setWatchDialog({ mode: "complete", watch: pendingWatch })}
                  >
                    Complete review
                  </Button>
                </div>
              )}
              {loggedWatches.map((watch) => {
                const when = formatWatchDate(watch);
                return (
                  <article
                    key={watch.id}
                    className="rounded-cb-lg border border-cb-divider bg-cb-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-ui text-cb-ui">{when}</p>
                      <button
                        type="button"
                        aria-label={`Edit watch, ${when}`}
                        className="flex h-11 w-11 items-center justify-center text-cb-muted"
                        onClick={() => setWatchDialog({ mode: "edit", watch })}
                      >
                        <Icon name="edit" size={18} />
                      </button>
                    </div>
                    {watch.score == null ? (
                      <p className="mt-2 font-ui text-cb-caption text-cb-muted">Unrated</p>
                    ) : (
                      <div className="mt-2">
                        <AmberStars score={watch.score} />
                      </div>
                    )}
                    {watch.notes && (
                      <p className="mt-2 font-ui text-cb-body text-cb-text">{watch.notes}</p>
                    )}
                  </article>
                );
              })}
              <button
                type="button"
                className="font-ui text-cb-ui font-medium text-cb-teal"
                onClick={logAnotherWatch}
              >
                Log another watch
              </button>
            </div>
          </DetailSection>

          {neighbours.length > 0 && (
            <DetailSection kicker="If you liked this" title="Close to this on your watchlist">
              <ul className="space-y-4">
                {neighbours.map((neighbour) => (
                  <li key={neighbour.id}>
                    <Link href={`/watchlist/${neighbour.id}`} className="flex gap-3">
                      <FilmPoster
                        src={neighbour.poster_url}
                        alt=""
                        size="sm"
                        className="shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block font-display text-cb-card leading-none">
                          {neighbour.title}
                        </span>
                        <span className="mt-1 block font-mono text-[12px] text-cb-muted">
                          {[
                            neighbour.year ? String(neighbour.year) : null,
                            neighbour.runtime != null ? `${neighbour.runtime}m` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {neighbour.semantic_line && (
                          <span className="mt-1 block line-clamp-1 font-ui text-cb-caption text-cb-muted">
                            {neighbour.semantic_line}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </DetailSection>
          )}
        </TabsContent>
      </Tabs>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cb-divider bg-cb-bg pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex max-w-7xl items-start justify-between px-3 pt-3">
          {trailerUrl && (
            <BarButton label="Trailer" onClick={() => window.open(trailerUrl, "_blank", "noopener,noreferrer")}>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cb-text/10 text-cb-text">
                <Icon name="play_arrow" filled size={22} />
              </span>
            </BarButton>
          )}
          <BarButton label="Watch" pressable onClick={() => setWatchSheetOpen(true)}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cb-accent text-cb-ink shadow-glow motion-reduce:shadow-none">
              <Icon name="tv" size={22} />
            </span>
          </BarButton>
          <BarButton label={watchedLabel} onClick={openLoggedWatch} watched={watchedLabel === "Watched"}>
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full",
                watchedLabel === "Watched"
                  ? "bg-cb-teal/15 text-cb-teal"
                  : "bg-cb-text/10 text-cb-text",
              )}
            >
              <Icon name="visibility" size={22} />
            </span>
          </BarButton>
          <BarButton label="More" onClick={() => setMoreOpen(true)}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cb-text/10 text-cb-text">
              <Icon name="more_vert" size={22} />
            </span>
          </BarButton>
        </div>
      </div>

      <Sheet open={watchSheetOpen} onOpenChange={setWatchSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Where to watch</SheetTitle>
          </SheetHeader>
          <WhereToWatchSection
            filmId={film.id}
            hasTmdbId={metadata?.tmdb_id != null}
            onEditMatch={() => {
              setWatchSheetOpen(false);
              setEditOpen(true);
            }}
            showTitle={false}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom">
          <SheetHeader className="sr-only">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col">
            <SheetAction
              icon="archive"
              label="Archive"
              disabled={isStatusPending}
              onClick={() => {
                setMoreOpen(false);
                onStatusTransition?.("archived");
              }}
            />
            <SheetAction
              icon="tune"
              label="Edit TMDB match"
              onClick={() => {
                setMoreOpen(false);
                setEditOpen(true);
              }}
            />
            <SheetAction
              icon="delete"
              label="Remove from watchlist"
              danger
              disabled={isStatusPending}
              onClick={() => {
                setMoreOpen(false);
                onRemove?.();
              }}
            />
            <a
              href={film.letterboxd_uri}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-3 font-ui text-cb-ui text-cb-text"
            >
              <Icon name="open_in_new" size={18} />
              Open in Letterboxd
            </a>
            {metadata?.tmdb_id != null && (
              <a
                href={`https://www.themoviedb.org/movie/${metadata.tmdb_id}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-3 font-ui text-cb-ui text-cb-text"
              >
                <Icon name="open_in_new" size={18} />
                Open in TMDB
              </a>
            )}
            {metadata?.imdb_id && (
              <a
                href={`https://www.imdb.com/title/${metadata.imdb_id}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-3 font-ui text-cb-ui text-cb-text"
              >
                <Icon name="open_in_new" size={18} />
                Open in IMDb
              </a>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <EditFilmMatchDialog film={film} open={editOpen} onOpenChange={setEditOpen} />

      {watchDialog && (
        <WatchReviewDialog
          filmId={film.id}
          filmTitle={film.title}
          open
          mode={watchDialog.mode}
          onOpenChange={(open) => {
            if (!open) setWatchDialog(null);
          }}
          {...(watchDialog.watch ? watchToDialogProps(watchDialog.watch) : {})}
        />
      )}
    </div>
  );
}

function BarButton({
  label,
  onClick,
  watched = false,
  pressable = false,
  children,
}: {
  label: string;
  onClick: () => void;
  watched?: boolean;
  /** Amber primary: shared 4% press (120ms down, 200ms back). */
  pressable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 min-w-11 flex-1 flex-col items-center gap-2 px-0.5",
        pressable && "cb-press",
      )}
    >
      {children}
      <span
        className={cn(
          "font-ui text-[11px] font-medium leading-[14px]",
          label === "Watch" && "font-semibold text-cb-accent",
          watched && "text-cb-teal",
          label !== "Watch" && !watched && "text-cb-muted",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function SheetAction({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-11 items-center gap-3 text-left font-ui text-cb-ui disabled:opacity-50",
        danger ? "text-cb-danger" : "text-cb-text",
      )}
    >
      <Icon name={icon} size={18} />
      {label}
    </button>
  );
}
