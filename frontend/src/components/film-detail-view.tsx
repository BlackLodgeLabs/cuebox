"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { EditFilmMatchDialog } from "@/components/edit-film-match-dialog";
import { FilmPoster } from "@/components/film-poster";
import { WhereToWatchSection } from "@/components/where-to-watch-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEnrichmentStatus } from "@/lib/enrichment-status";
import type { FilmDetail } from "@/types/api";

interface FilmDetailViewProps {
  film: FilmDetail;
  autoOpenEditMatch?: boolean;
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

export function FilmDetailView({ film, autoOpenEditMatch = false }: FilmDetailViewProps) {
  const [editOpen, setEditOpen] = useState(false);
  const metadata = film.metadata;
  const semantic = film.semantic_profile;
  const backdropUrl = metadata?.backdrop_url ?? null;
  const isEnriching = film.enrichment_status === "enriching";

  useEffect(() => {
    if (autoOpenEditMatch) {
      setEditOpen(true);
    }
  }, [autoOpenEditMatch, film.id]);

  return (
    <div className="space-y-8">
      <Link
        href="/watchlist"
        className="inline-flex text-body-md text-muted-foreground hover:text-foreground"
      >
        ← Watchlist
      </Link>

      <div className="relative -mx-4 overflow-hidden rounded-lg md:-mx-0">
        <div className="relative h-56 md:h-72">
          {backdropUrl ? (
            <>
              <Image
                src={backdropUrl}
                alt=""
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/20" />
            </>
          ) : (
            <div className="h-full bg-surface-container-high" />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 px-4 pb-4 md:px-6 md:pb-6">
            <FilmPoster
              src={metadata?.poster_url ?? null}
              alt={film.title}
              size="md"
              className="shadow-glow"
            />
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-h1">
                {film.title}
                {film.year ? ` (${film.year})` : ""}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
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
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  Edit film match
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-label-md text-muted-foreground">Letterboxd</dt>
              <dd>
                <a
                  href={film.letterboxd_uri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  View on Letterboxd
                </a>
              </dd>
            </div>
            {metadata?.director && (
              <div>
                <dt className="text-label-md text-muted-foreground">Director</dt>
                <dd>{metadata.director}</dd>
              </div>
            )}
            {metadata?.original_title && (
              <div>
                <dt className="text-label-md text-muted-foreground">Original title</dt>
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
        </CardContent>
      </Card>

      {metadata && (
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            {(metadata.imdb_id || metadata.tmdb_id) && (
              <dl className="grid gap-4 sm:grid-cols-2">
                {metadata.tmdb_id !== null && (
                  <div>
                    <dt className="text-label-md text-muted-foreground">TMDB</dt>
                    <dd>
                      <a
                        href={`https://www.themoviedb.org/movie/${metadata.tmdb_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {metadata.tmdb_id}
                      </a>
                    </dd>
                  </div>
                )}
                {metadata.imdb_id && (
                  <div>
                    <dt className="text-label-md text-muted-foreground">IMDb</dt>
                    <dd>
                      <a
                        href={`https://www.imdb.com/title/${metadata.imdb_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {metadata.imdb_id}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>
      )}

      <WhereToWatchSection
        filmId={film.id}
        hasTmdbId={metadata?.tmdb_id != null}
        onEditMatch={() => setEditOpen(true)}
      />

      {semantic && (
        <Card>
          <CardHeader>
            <CardTitle>Semantic profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
          </CardContent>
        </Card>
      )}

      {!metadata && !semantic && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Enrichment data is not available yet for this film.
          </CardContent>
        </Card>
      )}

      <EditFilmMatchDialog
        film={film}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
