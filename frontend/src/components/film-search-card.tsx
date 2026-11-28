"use client";

import { Command } from "cmdk";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { SearchCard } from "@/components/ui/search-card";
import { toast } from "@/components/ui/sonner";
import {
  useAddToWatchlist,
  useFilms,
  useGlobalTmdbSearch,
} from "@/hooks/use-films";
import {
  mergeLibraryAndTmdbResults,
  PICKER_LIBRARY_STATUSES,
  type LibrarySearchHit,
} from "@/lib/library-search-merge";
import { filmMetaLine, runtimeLabel } from "@/lib/programme-format";
import { cn } from "@/lib/utils";
import { WatchReviewDialog } from "@/components/watch-review-dialog";
import type { FilmSummary, TmdbSearchResultItem } from "@/types/api";

const GROUP_CLASS =
  "[&_[cmdk-group-heading]]:px-cb-3 [&_[cmdk-group-heading]]:pb-cb-1 [&_[cmdk-group-heading]]:pt-cb-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-cb-meta [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-cb-muted";

/** Keep a film just added in this card under "Not on your watchlist" (home-search-added). */
function presentSearchHits(
  libraryFilms: FilmSummary[],
  tmdbResults: TmdbSearchResultItem[],
  addedIds: number[],
): LibrarySearchHit[] {
  const pinned = new Set(addedIds);
  const libraryForMerge = libraryFilms.filter(
    (film) => film.tmdb_id == null || !pinned.has(film.tmdb_id),
  );
  return mergeLibraryAndTmdbResults(libraryForMerge, tmdbResults);
}

type FilmSearchCardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FilmSearchCard({ open, onOpenChange }: FilmSearchCardProps) {
  const [reviewFilm, setReviewFilm] = useState<FilmSummary | null>(null);

  return (
    <>
      <SearchCard open={open} onOpenChange={onOpenChange}>
        <FilmSearchPanel
          onClose={() => onOpenChange(false)}
          onLogWatch={(film) => {
            onOpenChange(false);
            setReviewFilm(film);
          }}
        />
      </SearchCard>
      {reviewFilm ? (
        <WatchReviewDialog
          open
          mode="create"
          filmId={reviewFilm.id}
          filmTitle={reviewFilm.title}
          year={reviewFilm.year}
          genre={reviewFilm.genres.find((genre) => genre.trim()) ?? null}
          onOpenChange={(next) => {
            if (!next) setReviewFilm(null);
          }}
        />
      ) : null}
    </>
  );
}

function searchResultMeta(year: number | null, runtime: number | null): string {
  return filmMetaLine([
    year != null ? String(year) : null,
    runtimeLabel(runtime),
  ]);
}

function FilmSearchPanel({
  onClose,
  onLogWatch,
}: {
  onClose: () => void;
  onLogWatch: (film: FilmSummary) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const claimedIds = useRef(new Set<number>());
  const addToWatchlist = useAddToWatchlist();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasQuery = debounced.length > 0;
  const libraryQuery = useFilms(
    {
      statuses: PICKER_LIBRARY_STATUSES,
      search: hasQuery ? debounced : undefined,
      limit: 20,
      sort: "title",
      sort_dir: "asc",
    },
    { enabled: hasQuery },
  );
  const tmdbQuery = useGlobalTmdbSearch(
    { q: debounced, page: 1 },
    { enabled: hasQuery },
  );

  const hits: LibrarySearchHit[] = hasQuery
    ? presentSearchHits(
        libraryQuery.data?.data ?? [],
        tmdbQuery.data?.data ?? [],
        addedIds,
      )
    : [];
  const libraryHits = hits.filter((hit) => hit.kind === "library");
  const catalogueHits = hits.filter((hit) => hit.kind === "tmdb");
  const pending =
    hasQuery &&
    (libraryQuery.isLoading ||
      libraryQuery.isFetching ||
      tmdbQuery.isLoading ||
      tmdbQuery.isFetching);

  let message: string | null = null;
  if (!hasQuery) {
    message = "Search your watchlist and other films";
  } else if (hits.length === 0 && pending) {
    message = "Searching…";
  } else if (hits.length === 0 && (libraryQuery.isError || tmdbQuery.isError)) {
    message = "Could not search right now.";
  } else if (hits.length === 0) {
    message = `No films match "${debounced}".`;
  }

  function openFilm(href: string) {
    onClose();
    router.push(href);
  }

  async function addCatalogueFilm(result: TmdbSearchResultItem) {
    if (claimedIds.current.has(result.tmdb_id) || pendingId != null) return;
    claimedIds.current.add(result.tmdb_id);
    setPendingId(result.tmdb_id);
    try {
      const response = await addToWatchlist.mutateAsync({ tmdb_id: result.tmdb_id });
      setAddedIds((ids) =>
        ids.includes(result.tmdb_id) ? ids : [...ids, result.tmdb_id],
      );
      toast({
        title: response.already_on_watchlist
          ? "Already on your watchlist"
          : "Added to watchlist",
        description: result.title,
      });
    } catch {
      claimedIds.current.delete(result.tmdb_id);
      // useAddToWatchlist reports the failure.
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <div className="flex items-center gap-cb-2 border-b border-cb-divider px-cb-3">
        <Icon name="search" size={18} className="shrink-0 text-cb-muted" />
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search films"
          aria-label="Search query"
          className="h-11 w-full bg-transparent font-ui text-cb-body text-cb-text outline-none placeholder:text-cb-muted"
        />
      </div>
      <Command.List className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {message ? (
          <p className="px-cb-3 py-cb-5 text-center font-ui text-cb-caption text-cb-muted">
            {message}
          </p>
        ) : null}
        {libraryHits.length > 0 ? (
          <Command.Group heading="On your watchlist" className={GROUP_CLASS}>
            {libraryHits.map((hit) =>
              hit.kind === "library" ? (
                <ResultRow
                  key={hit.key}
                  value={hit.key}
                  title={hit.film.title}
                  meta={searchResultMeta(hit.film.year, hit.film.runtime)}
                  posterUrl={hit.film.poster_url}
                  added={
                    hit.film.tmdb_id != null && addedIds.includes(hit.film.tmdb_id)
                  }
                  onSelect={() => openFilm(`/watchlist/${hit.film.id}`)}
                  action={
                    <IconAction
                      label={`Log a watch for ${hit.film.title}`}
                      icon="visibility"
                      onClick={() => onLogWatch(hit.film)}
                    />
                  }
                />
              ) : null,
            )}
          </Command.Group>
        ) : null}
        {catalogueHits.length > 0 ? (
          <Command.Group heading="Not on your watchlist" className={GROUP_CLASS}>
            {catalogueHits.map((hit) =>
              hit.kind === "tmdb" ? (
                <ResultRow
                  key={hit.key}
                  value={hit.key}
                  title={hit.result.title}
                  meta={searchResultMeta(hit.result.year, null)}
                  posterUrl={hit.result.poster_url}
                  added={addedIds.includes(hit.result.tmdb_id)}
                  onSelect={() => openFilm(`/films/tmdb/${hit.result.tmdb_id}`)}
                  action={
                    <IconAction
                      label={`Add ${hit.result.title} to watchlist`}
                      icon="add"
                      added={addedIds.includes(hit.result.tmdb_id)}
                      onClick={() => void addCatalogueFilm(hit.result)}
                    />
                  }
                />
              ) : null,
            )}
          </Command.Group>
        ) : null}
      </Command.List>
      <button
        type="button"
        onClick={onClose}
        className="w-full border-t border-cb-divider py-cb-3 font-ui text-cb-caption text-cb-muted"
      >
        Cancel
      </button>
    </>
  );
}

function ResultRow({
  value,
  title,
  meta,
  posterUrl,
  added,
  onSelect,
  action,
}: {
  value: string;
  title: string;
  meta: string;
  posterUrl: string | null;
  added: boolean;
  onSelect: () => void;
  action: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      data-added={added ? "true" : "false"}
      className={cn(
        "flex cursor-pointer items-center gap-cb-2 rounded-cb px-cb-2 py-cb-2",
        added
          ? "bg-[color-mix(in_srgb,var(--cb-teal)_32%,transparent)]"
          : "aria-selected:bg-cb-surface data-[selected=true]:bg-cb-surface",
      )}
    >
      <Thumb src={posterUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-ui text-cb-body font-medium text-cb-text">
          {title}
        </span>
        {meta ? (
          <span className="block truncate font-mono text-cb-caption text-cb-muted">
            {meta}
          </span>
        ) : null}
      </span>
      {action}
    </Command.Item>
  );
}

function IconAction({
  label,
  icon,
  added = false,
  onClick,
}: {
  label: string;
  icon: string;
  added?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex h-12 min-h-12 w-12 min-w-12 shrink-0 items-center justify-center rounded-cb text-cb-teal",
        added && "bg-cb-teal text-cb-bg",
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onClick();
      }}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}

function Thumb({ src }: { src: string | null }) {
  if (!src) {
    return <span aria-hidden className="h-14 w-10 shrink-0 rounded-cb-sm bg-cb-bg" />;
  }
  return (
    <img
      src={src}
      alt=""
      className="h-14 w-10 shrink-0 rounded-cb-sm object-cover"
    />
  );
}
