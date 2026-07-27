"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EditFilmMatchDialog } from "@/components/edit-film-match-dialog";
import { FilmPoster } from "@/components/film-poster";
import { FilmStatusActions } from "@/components/film-status-actions";
import { WatchReviewDialog, watchToDialogProps } from "@/components/watch-review-dialog";
import { WhereToWatchSection } from "@/components/where-to-watch-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEnrichmentStatus } from "@/lib/enrichment-status";
import type { FilmDetail, FilmStatus, FilmWatch, WatchlistTab } from "@/types/api";

interface FilmDetailViewProps {
  film: FilmDetail;
  autoOpenEditMatch?: boolean;
  watchlistTab?: WatchlistTab;
  onStatusTransition?: (status: FilmStatus) => void;
  onMarkWatched?: () => void;
  isStatusPending?: boolean;
}

function TagGroup({ label, tags }: { label: string; tags: string[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-label-md text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-label-md text-muted-foreground">{label}</span>
      <span className="font-mono text-body-md">{value.toFixed(1)}</span>
    </div>
  );
}

function formatRating(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(1);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  );
}

export function FilmDetailView({
  film,
  autoOpenEditMatch = false,
  watchlistTab,
  onStatusTransition,
  onMarkWatched,
  isStatusPending = false,
}: FilmDetailViewProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [watchDialog, setWatchDialog] = useState<{
    mode: "complete" | "edit";
    watch?: FilmWatch;
  } | null>(null);
  const metadata = film.metadata;
  const semantic = film.semantic_profile;
  const isEnriching = film.enrichment_status === "enriching";

  useEffect(() => {
    if (autoOpenEditMatch) {
      setEditOpen(true);
    }
  }, [autoOpenEditMatch, film.id]);

  const backTab =
    watchlistTab ??
    (film.status === "watched" || film.status === "pending_watch_review"
      ? "watched"
      : film.status === "archived"
        ? "archived"
        : "active");
  const backHref =
    backTab === "active" ? "/watchlist" : `/watchlist?tab=${backTab}`;

  const hasKeyMeta = Boolean(
    metadata?.director ||
      metadata?.original_title ||
      metadata?.runtime != null ||
      metadata?.original_language ||
      metadata?.country ||
      metadata?.synopsis,
  );

  const hasScores =
    metadata != null &&
    (metadata.tmdb_rating !== null ||
      metadata.rotten_tomatoes_score !== null ||
      metadata.letterboxd_rating !== null ||
      metadata.genres.length > 0 ||
      metadata.keywords.length > 0);

  const hasSemanticContent =
    semantic != null &&
    Boolean(
      semantic.semantic_summary ||
        semantic.subgenres.length > 0 ||
        semantic.themes.length > 0 ||
        semantic.tones.length > 0 ||
        semantic.visual_descriptors.length > 0 ||
        semantic.emotional_outcomes.length > 0 ||
        semantic.viewing_contexts.length > 0 ||
        semantic.complexity !== null ||
        semantic.pacing !== null ||
        semantic.energy !== null ||
        semantic.obscurity !== null,
    );

  const enrichmentPending = !metadata && !semantic;

  return (
    <div className="space-y-8">
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center text-body-md text-muted-foreground hover:text-foreground"
      >
        ← Watchlist
      </Link>

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div className="relative mx-auto aspect-[2/3] w-full max-w-xs shrink-0 overflow-hidden rounded md:mx-0 md:w-64 lg:w-72">
          <FilmPoster
            src={metadata?.poster_url ?? null}
            alt={film.title}
            size="fill"
            className="shadow-glow"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h1 className="text-h1">
              {film.title}
              {film.year ? ` (${film.year})` : ""}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {formatEnrichmentStatus(film.enrichment_status)}
              </Badge>
              {isEnriching && (
                <span className="text-label-md text-muted-foreground">
                  Updating metadata…
                </span>
              )}
              <Badge variant="outline">{film.status}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              variant="outline"
              className="min-h-11"
              onClick={() => setEditOpen(true)}
            >
              Edit film match
            </Button>
            {onStatusTransition && (
              <FilmStatusActions
                status={film.status}
                variant="detail"
                isPending={isStatusPending}
                onTransition={onStatusTransition}
                onMarkWatched={onMarkWatched}
                onCompleteReview={() => {
                  const pending = film.watches.find((watch) => watch.is_pending);
                  setWatchDialog({
                    mode: "complete",
                    watch: pending,
                  });
                }}
              />
            )}
          </div>
        </div>
      </div>

      {hasKeyMeta && (
        <Section title="Overview">
          <dl className="grid gap-4 sm:grid-cols-2">
            {metadata?.director && (
              <div>
                <dt className="text-label-md text-muted-foreground">Director</dt>
                <dd>{metadata.director}</dd>
              </div>
            )}
            {metadata?.original_title && (
              <div>
                <dt className="text-label-md text-muted-foreground">
                  Original title
                </dt>
                <dd>{metadata.original_title}</dd>
              </div>
            )}
            {metadata?.runtime != null && (
              <div>
                <dt className="text-label-md text-muted-foreground">Runtime</dt>
                <dd>{metadata.runtime} min</dd>
              </div>
            )}
            {metadata?.original_language && (
              <div>
                <dt className="text-label-md text-muted-foreground">Language</dt>
                <dd>{metadata.original_language.toUpperCase()}</dd>
              </div>
            )}
            {metadata?.country && (
              <div>
                <dt className="text-label-md text-muted-foreground">Country</dt>
                <dd>{metadata.country}</dd>
              </div>
            )}
          </dl>
          {metadata?.synopsis && (
            <div>
              <p className="text-label-md text-muted-foreground">Synopsis</p>
              <p className="mt-1 text-body-lg text-muted-foreground">
                {metadata.synopsis}
              </p>
            </div>
          )}
        </Section>
      )}

      <WhereToWatchSection
        filmId={film.id}
        hasTmdbId={metadata?.tmdb_id != null}
        onEditMatch={() => setEditOpen(true)}
      />

      {(film.watches.length > 0 || film.status === "pending_watch_review") && (
        <Section title="Watch history">
          {film.status === "pending_watch_review" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-4">
              <p className="text-body-md text-muted-foreground">
                This film is waiting for a watch diary entry.
              </p>
              <Button
                size="lg"
                className="min-h-11"
                onClick={() => {
                  const pending = film.watches.find((watch) => watch.is_pending);
                  setWatchDialog({ mode: "complete", watch: pending });
                }}
              >
                Complete review
              </Button>
            </div>
          )}
          {film.watches
            .filter((watch) => !watch.is_pending)
            .map((watch) => (
              <div
                key={watch.id}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 py-3 last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {watch.score == null
                      ? `Unrated · ${watch.watched_at}`
                      : `${watch.score}★ · ${watch.watched_at}`}
                  </p>
                  {watch.notes && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {watch.notes}
                    </p>
                  )}
                </div>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setWatchDialog({ mode: "edit", watch })}
                >
                  Edit
                </Button>
              </div>
            ))}
        </Section>
      )}

      {hasScores && metadata && (
        <Section title="Scores & tags">
          <div className="flex flex-wrap gap-4 text-body-md">
            {metadata.tmdb_rating !== null && (
              <span>TMDB: {formatRating(metadata.tmdb_rating)}</span>
            )}
            {metadata.rotten_tomatoes_score !== null && (
              <span>RT: {metadata.rotten_tomatoes_score}%</span>
            )}
            {metadata.letterboxd_rating !== null && (
              <span>LBX: {formatRating(metadata.letterboxd_rating)}</span>
            )}
          </div>
          <TagGroup label="Genres" tags={metadata.genres} />
          <TagGroup label="Keywords" tags={metadata.keywords} />
        </Section>
      )}

      {hasSemanticContent && semantic && (
        <Section title="Semantic profile">
          {semantic.semantic_summary && (
            <div>
              <p className="text-label-md text-muted-foreground">Summary</p>
              <p className="mt-1 text-body-lg text-muted-foreground">
                {semantic.semantic_summary}
              </p>
            </div>
          )}
          <TagGroup label="Subgenres" tags={semantic.subgenres} />
          <TagGroup label="Themes" tags={semantic.themes} />
          <TagGroup label="Tones" tags={semantic.tones} />
          <TagGroup label="Visual descriptors" tags={semantic.visual_descriptors} />
          <TagGroup label="Emotional outcomes" tags={semantic.emotional_outcomes} />
          <TagGroup label="Viewing contexts" tags={semantic.viewing_contexts} />
          <div>
            <p className="mb-2 text-label-md text-muted-foreground">Scores</p>
            <ScoreRow label="Complexity" value={semantic.complexity} />
            <ScoreRow label="Pacing" value={semantic.pacing} />
            <ScoreRow label="Energy" value={semantic.energy} />
            <ScoreRow label="Obscurity" value={semantic.obscurity} />
          </div>
        </Section>
      )}

      <Section title="Links">
        <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
          <li>
            <a
              href={film.letterboxd_uri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center text-body-md text-primary hover:underline"
            >
              View on Letterboxd
            </a>
          </li>
          {metadata?.tmdb_id != null && (
            <li>
              <a
                href={`https://www.themoviedb.org/movie/${metadata.tmdb_id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center text-body-md text-primary hover:underline"
              >
                View on TMDB
              </a>
            </li>
          )}
          {metadata?.imdb_id && (
            <li>
              <a
                href={`https://www.imdb.com/title/${metadata.imdb_id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center text-body-md text-primary hover:underline"
              >
                View on IMDB
              </a>
            </li>
          )}
        </ul>
      </Section>

      {enrichmentPending && (
        <p className="text-body-md text-muted-foreground">
          Enrichment data is not available yet for this film.
        </p>
      )}

      <EditFilmMatchDialog
        film={film}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

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
