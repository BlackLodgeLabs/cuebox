"use client";

import { useEffect, useState } from "react";
import { FilmPoster } from "@/components/film-poster";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRematchFilm, useTmdbSearch } from "@/hooks/use-films";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FilmDetail, TmdbSearchResultItem } from "@/types/api";

interface EditFilmMatchDialogProps {
  film: FilmDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditFilmMatchDialog({
  film,
  open,
  onOpenChange,
}: EditFilmMatchDialogProps) {
  const { toast } = useToast();
  const rematch = useRematchFilm();
  const [searchQuery, setSearchQuery] = useState(film.title);
  const [yearFilter, setYearFilter] = useState(
    film.year !== null ? String(film.year) : "",
  );
  const [debouncedQuery, setDebouncedQuery] = useState(film.title);
  const [selected, setSelected] = useState<TmdbSearchResultItem | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearchQuery(film.title);
    setYearFilter(film.year !== null ? String(film.year) : "");
    setDebouncedQuery(film.title);
    setSelected(null);
  }, [open, film.title, film.year]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const parsedYear = yearFilter.trim() ? Number(yearFilter) : undefined;
  const yearParam =
    parsedYear !== undefined && !Number.isNaN(parsedYear) ? parsedYear : undefined;

  const search = useTmdbSearch(
    film.id,
    { q: debouncedQuery, year: yearParam },
    { enabled: open },
  );

  const results = search.data?.data ?? [];

  async function handleConfirm() {
    if (!selected) return;

    try {
      await rematch.mutateAsync({ filmId: film.id, tmdbId: selected.tmdb_id });
      onOpenChange(false);
      toast({
        title: "Regenerating enrichment…",
        description: "Film metadata was updated. Semantic profile will refresh shortly.",
      });
    } catch {
      // Error toast handled by useRematchFilm
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit film match</DialogTitle>
          <DialogDescription>
            Search TMDB for the correct movie. Letterboxd title and year stay unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search TMDB…"
            aria-label="TMDB search query"
          />
          <Input
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            placeholder="Year"
            inputMode="numeric"
            aria-label="Release year filter"
          />
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {search.isLoading && (
            <p className="text-sm text-muted-foreground">Searching TMDB…</p>
          )}
          {search.isError && (
            <p className="text-sm text-destructive">
              Could not load search results. Check your TMDB API key and try again.
            </p>
          )}
          {!search.isLoading && !search.isError && results.length === 0 && debouncedQuery && (
            <p className="text-sm text-muted-foreground">No results found.</p>
          )}
          {results.map((result) => {
            const isSelected = selected?.tmdb_id === result.tmdb_id;
            return (
              <button
                key={result.tmdb_id}
                type="button"
                onClick={() => setSelected(result)}
                className={cn(
                  "flex w-full gap-3 rounded border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50",
                )}
              >
                <FilmPoster
                  src={result.poster_url}
                  alt={result.title}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {result.title}
                    {result.year ? ` (${result.year})` : ""}
                  </p>
                  {result.overview && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {result.overview}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected || rematch.isPending}
            onClick={() => void handleConfirm()}
          >
            Confirm match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
