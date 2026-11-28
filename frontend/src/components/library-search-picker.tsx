"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlreadyOnWatchlistMessage,
  LinkedFilmConflictMessage,
  PendingReviewMessage,
} from "@/components/add-film-search";
import { FilmPoster } from "@/components/film-poster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WatchReviewDialog } from "@/components/watch-review-dialog";
import {
  useAddToWatchlist,
  useFilm,
  useFilmStatusTransition,
  useFilms,
  useGlobalTmdbSearch,
} from "@/hooks/use-films";
import { toast } from "@/components/ui/sonner";
import { ApiClientError, getFilm } from "@/lib/api-client";
import { scrollFieldIntoView } from "@/lib/scroll-field-into-view";
import {
  mergeLibraryAndTmdbResults,
  PICKER_LIBRARY_STATUSES,
  statusBadgeLabel,
  type LibrarySearchHit,
} from "@/lib/library-search-merge";
import type { FilmSummary, TmdbSearchResultItem } from "@/types/api";

interface LibrarySearchPickerProps {
  autoFocus?: boolean;
  /** Input placeholder; default keeps the shared picker tone. */
  placeholder?: string;
  /** Intro helper above the input; default explains library + TMDB search. */
  helperText?: string;
}

interface ReviewDialogState {
  filmId: string;
  filmTitle: string;
  year: number | null;
  genre: string | null;
}

const DEFAULT_PLACEHOLDER = "Find a film…";
const DEFAULT_HELPER_TEXT =
  "Searches your library (including watched films) and TMDB. Archived titles are not listed.";

export function LibrarySearchPicker({
  autoFocus = false,
  placeholder = DEFAULT_PLACEHOLDER,
  helperText = DEFAULT_HELPER_TEXT,
}: LibrarySearchPickerProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState | null>(
    null,
  );
  const [pendingFilmId, setPendingFilmId] = useState<string | null>(null);
  const [pendingMarkWatchedFilmId, setPendingMarkWatchedFilmId] = useState<
    string | null
  >(null);
  const [alreadyOnWatchlistId, setAlreadyOnWatchlistId] = useState<string | null>(
    null,
  );
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [conflictFilmId, setConflictFilmId] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const addToWatchlist = useAddToWatchlist();
  const statusTransition = useFilmStatusTransition();
  const pollId = pendingMarkWatchedFilmId ?? pendingFilmId;
  const polling = useFilm(pollId ?? "", { pollWhileEnriching: true });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const trimmedQuery = debouncedQuery.trim();
  const hasQuery = Boolean(trimmedQuery);

  const libraryQuery = useFilms(
    {
      statuses: PICKER_LIBRARY_STATUSES,
      search: trimmedQuery || undefined,
      limit: 20,
      sort: "title",
      sort_dir: "asc",
    },
    { enabled: hasQuery },
  );

  const tmdbQuery = useGlobalTmdbSearch(
    { q: trimmedQuery, page: 1 },
    { enabled: hasQuery },
  );

  useEffect(() => {
    if (!pollId || !polling.data) return;
    const status = polling.data.enrichment_status;
    if (status !== "ready" && status !== "failed") return;

    if (pendingMarkWatchedFilmId) {
      const filmId = pendingMarkWatchedFilmId;
      const filmTitle = polling.data.title;
      const filmStatus = polling.data.status;
      setPendingMarkWatchedFilmId(null);

      if (status === "failed") {
        toast({
          title: "Enrichment failed",
          description:
            "The film was added but enrichment failed. Check the watchlist.",
          variant: "destructive",
        });
        return;
      }

      if (filmStatus !== "active") {
        toast({
          title: "Film added",
          description: `${filmTitle} is on your watchlist.`,
        });
        void libraryQuery.refetch();
        return;
      }

      setReviewDialog({
        filmId,
        filmTitle,
        year: polling.data.year,
        genre: polling.data.metadata?.genres.find((genre) => genre.trim()) ?? null,
      });
      toast({
        title: "Ready to review",
        description: `${filmTitle} is ready — tap a star to save.`,
      });
      return;
    }

    if (!pendingFilmId) return;

    const filmId = pendingFilmId;
    setPendingFilmId(null);

    if (status === "ready") {
      toast({
        title: "Film added",
        description: `${polling.data.title} is ready on your watchlist.`,
      });
    } else {
      toast({
        title: "Enrichment failed",
        description:
          "The film was added but enrichment failed. Check the watchlist.",
        variant: "destructive",
      });
    }
    router.push(`/watchlist/${filmId}`);
  }, [
    pollId,
    pendingFilmId,
    pendingMarkWatchedFilmId,
    polling.data,
    router,
    toast,
    statusTransition,
    libraryQuery.refetch,
  ]);

  const libraryFilms = hasQuery ? (libraryQuery.data?.data ?? []) : [];
  const tmdbResults = hasQuery ? (tmdbQuery.data?.data ?? []) : [];
  const hits = hasQuery
    ? mergeLibraryAndTmdbResults(libraryFilms, tmdbResults)
    : [];

  const libraryLoading = hasQuery && (libraryQuery.isLoading || libraryQuery.isFetching);
  const tmdbLoading = hasQuery && (tmdbQuery.isLoading || tmdbQuery.isFetching);
  const isLoading = libraryLoading || tmdbLoading;
  const libraryError = hasQuery && libraryQuery.isError;
  const tmdbError = hasQuery && tmdbQuery.isError;
  const bothFailed = libraryError && tmdbError;
  const partialError = (libraryError || tmdbError) && !bothFailed;
  const noResults =
    hasQuery && !isLoading && !bothFailed && hits.length === 0 && !partialError;

  const isAddPending =
    addToWatchlist.isPending ||
    Boolean(pendingFilmId) ||
    Boolean(pendingMarkWatchedFilmId);

  function clearInlineMessages() {
    setAlreadyOnWatchlistId(null);
    setPendingReviewId(null);
    setConflictFilmId(null);
    setConflictMessage(null);
  }

  function openReviewDialog(film: FilmSummary) {
    setReviewDialog({
      filmId: film.id,
      filmTitle: film.title,
      year: film.year,
      genre: film.genres.find((genre) => genre.trim()) ?? null,
    });
  }

  async function handleReturnToWatchlist(film: FilmSummary) {
    clearInlineMessages();
    try {
      await statusTransition.mutateAsync({
        filmId: film.id,
        status: "active",
      });
      toast({
        title: "Returned to watchlist",
        description: `${film.title} is active again for recommendations.`,
      });
      void libraryQuery.refetch();
    } catch {
      // useFilmStatusTransition toasts on error
    }
  }

  async function handleAddTmdb(selected: TmdbSearchResultItem) {
    clearInlineMessages();
    try {
      const result = await addToWatchlist.mutateAsync({
        tmdb_id: selected.tmdb_id,
      });

      if (result.already_on_watchlist) {
        setAlreadyOnWatchlistId(result.film_id);
        return;
      }

      if (result.enrichment_status === "review_required") {
        setPendingReviewId(result.review_id ?? null);
        toast({
          title: "Letterboxd link needed",
          description:
            "Cuebox could not auto-link this film. Paste the Letterboxd URL on the review page.",
        });
        return;
      }

      if (result.restored) {
        toast({
          title: "Added back to your watchlist",
          description: `${selected.title} was restored to your active watchlist.`,
        });
        router.push(`/watchlist/${result.film_id}`);
        return;
      }

      setPendingFilmId(result.film_id);
      toast({
        title: "Adding film…",
        description: "Enriching metadata and semantic profile.",
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "CONFLICT") {
        const filmId = error.details?.find((detail) => detail.field === "film_id")
          ?.message;
        if (filmId) {
          setConflictFilmId(filmId);
          setConflictMessage(error.message);
          return;
        }
      }
    }
  }

  async function handleAddAndMarkWatched(selected: TmdbSearchResultItem) {
    clearInlineMessages();
    try {
      const result = await addToWatchlist.mutateAsync({
        tmdb_id: selected.tmdb_id,
      });

      if (result.already_on_watchlist) {
        const film = await getFilm(result.film_id);
        if (film.status === "active" || film.status === "pending_watch_review") {
          setReviewDialog({
            filmId: film.id,
            filmTitle: film.title,
            year: film.year,
            genre: film.metadata?.genres.find((genre) => genre.trim()) ?? null,
          });
          return;
        }
        setAlreadyOnWatchlistId(result.film_id);
        return;
      }

      if (result.enrichment_status === "review_required") {
        setPendingReviewId(result.review_id ?? null);
        toast({
          title: "Letterboxd link needed",
          description:
            "Cuebox could not auto-link this film. Paste the Letterboxd URL on the review page.",
        });
        return;
      }

      setPendingMarkWatchedFilmId(result.film_id);
      toast({
        title: "Adding film…",
        description: "Enriching before opening the watch review.",
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "CONFLICT") {
        const filmId = error.details?.find((detail) => detail.field === "film_id")
          ?.message;
        if (filmId) {
          setConflictFilmId(filmId);
          setConflictMessage(error.message);
          return;
        }
      }
    }
  }

  function handleReviewSuccessNavigate() {
    void libraryQuery.refetch();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{helperText}</p>

      <Input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onFocus={(event) => scrollFieldIntoView(event.currentTarget, "start")}
        placeholder={placeholder}
        aria-label="Library and TMDB search"
        autoFocus={autoFocus}
        data-testid="library-search-input"
        id="library-search-input"
      />

      <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1" role="list">
        {!hasQuery && (
          <p className="text-sm text-muted-foreground">
            Type a title to search your library and TMDB.
          </p>
        )}

        {hasQuery && isLoading && (
          <p className="text-sm text-muted-foreground">Searching…</p>
        )}

        {bothFailed && (
          <p className="text-sm text-destructive">
            Could not search your library or TMDB. Check the API and try again.
          </p>
        )}

        {partialError && libraryError && (
          <p className="text-sm text-destructive">
            Library search failed. Showing TMDB results only.
          </p>
        )}

        {partialError && tmdbError && (
          <p className="text-sm text-destructive">
            TMDB search failed. Showing library results only. Check your TMDB API
            key if this persists.
          </p>
        )}

        {noResults && (
          <p className="text-sm text-muted-foreground">No results found.</p>
        )}

        {!isLoading &&
          hits.map((hit) => (
            <SearchHitRow
              key={hit.key}
              hit={hit}
              isStatusPending={statusTransition.isPending}
              isAddPending={isAddPending}
              onMarkWatched={openReviewDialog}
              onCompleteReview={openReviewDialog}
              onReturnToWatchlist={(film) => void handleReturnToWatchlist(film)}
              onAddTmdb={(result) => void handleAddTmdb(result)}
              onAddAndMarkWatched={(result) => void handleAddAndMarkWatched(result)}
            />
          ))}
      </div>

      {alreadyOnWatchlistId ? (
        <AlreadyOnWatchlistMessage filmId={alreadyOnWatchlistId} />
      ) : null}
      {pendingReviewId ? <PendingReviewMessage reviewId={pendingReviewId} /> : null}
      {conflictFilmId && conflictMessage ? (
        <LinkedFilmConflictMessage
          filmId={conflictFilmId}
          message={conflictMessage}
        />
      ) : null}
      {(pendingFilmId || pendingMarkWatchedFilmId) && (
        <p className="text-sm text-muted-foreground">
          Enriching film… this may take a moment.
        </p>
      )}

      {reviewDialog && (
        <WatchReviewDialog
          filmId={reviewDialog.filmId}
          filmTitle={reviewDialog.filmTitle}
          year={reviewDialog.year}
          genre={reviewDialog.genre}
          open
          mode="create"
          onOpenChange={(open) => {
            if (!open) {
              setReviewDialog(null);
              void libraryQuery.refetch();
            }
          }}
          onCompleted={handleReviewSuccessNavigate}
        />
      )}
    </div>
  );
}

function SearchHitRow({
  hit,
  isStatusPending,
  isAddPending,
  onMarkWatched,
  onCompleteReview,
  onReturnToWatchlist,
  onAddTmdb,
  onAddAndMarkWatched,
}: {
  hit: LibrarySearchHit;
  isStatusPending: boolean;
  isAddPending: boolean;
  onMarkWatched: (film: FilmSummary) => void;
  onCompleteReview: (film: FilmSummary) => void;
  onReturnToWatchlist: (film: FilmSummary) => void;
  onAddTmdb: (result: TmdbSearchResultItem) => void;
  onAddAndMarkWatched: (result: TmdbSearchResultItem) => void;
}) {
  if (hit.kind === "library") {
    const { film } = hit;
    const title = film.year ? `${film.title} (${film.year})` : film.title;
    return (
      <div
        role="listitem"
        className="flex flex-col gap-3 rounded border border-border p-3"
        data-testid={`library-hit-${film.status}`}
      >
        <div className="flex min-w-0 flex-1 gap-3">
          <FilmPoster src={film.poster_url} alt={film.title} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{statusBadgeLabel(film.status)}</Badge>
              <span className="text-xs text-muted-foreground">Library</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="lg" className="min-h-11">
            <Link href={`/watchlist/${film.id}`}>View</Link>
          </Button>
          {film.status === "active" && (
            <Button
              size="lg"
              className="min-h-11"
              variant="secondary"
              disabled={isStatusPending}
              onClick={() => onMarkWatched(film)}
            >
              Mark watched
            </Button>
          )}
          {film.status === "pending_watch_review" && (
            <Button
              size="lg"
              className="min-h-11"
              variant="secondary"
              onClick={() => onCompleteReview(film)}
            >
              Complete review
            </Button>
          )}
          {film.status === "watched" && (
            <Button
              size="lg"
              className="min-h-11"
              variant="secondary"
              disabled={isStatusPending}
              onClick={() => onReturnToWatchlist(film)}
            >
              Return to watchlist
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { result } = hit;
  const title = result.year ? `${result.title} (${result.year})` : result.title;
  return (
    <div
      role="listitem"
      className="flex flex-col gap-3 rounded border border-border p-3"
      data-testid="tmdb-hit"
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <FilmPoster src={result.poster_url} alt={result.title} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">TMDB</Badge>
            {result.overview && (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {result.overview}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          className="min-h-11"
          disabled={isAddPending}
          onClick={() => onAddTmdb(result)}
        >
          Add to watchlist
        </Button>
        <Button
          size="lg"
          className="min-h-11"
          variant="secondary"
          disabled={isAddPending}
          onClick={() => onAddAndMarkWatched(result)}
        >
          Add & mark watched
        </Button>
      </div>
    </div>
  );
}
