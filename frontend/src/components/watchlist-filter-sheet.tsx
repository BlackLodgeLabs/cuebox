"use client";

import { useEffect, useMemo, useState } from "react";
import { MultiSelectChips } from "@/components/multi-select-chips";
import { Button } from "@/components/ui/button";
import { CueNumber } from "@/components/ui/cue-number";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useFilms, useWatchlistGenres } from "@/hooks/use-films";
import { RUNTIME_OPTIONS } from "@/lib/questionnaire-vocabulary";
import { cn } from "@/lib/utils";
import type { RuntimePreference, WatchlistTab } from "@/types/api";

export interface WatchlistFilterValues {
  genres: string[];
  runtime: RuntimePreference;
}

export const DEFAULT_WATCHLIST_FILTERS: WatchlistFilterValues = {
  genres: [],
  runtime: "any",
};

interface WatchlistFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current pill. The preview count uses this status. */
  status: WatchlistTab;
  values: WatchlistFilterValues;
  onApply: (values: WatchlistFilterValues) => void;
}

function mergeGenres(fromServer: string[], selected: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const label of [...fromServer, ...selected]) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(label);
  }
  return merged;
}

export function WatchlistFilterSheet({
  open,
  onOpenChange,
  status,
  values,
  onApply,
}: WatchlistFilterSheetProps) {
  const [draft, setDraft] = useState<WatchlistFilterValues>(values);

  useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  const genresQuery = useWatchlistGenres({ enabled: open });
  const genreOptions = useMemo(
    () => mergeGenres(genresQuery.data ?? [], draft.genres),
    [draft.genres, genresQuery.data],
  );

  const preview = useFilms(
    {
      status,
      limit: 1,
      ...(draft.genres.length > 0 ? { genres: draft.genres } : {}),
      ...(draft.runtime === "any" ? {} : { runtime: draft.runtime }),
    },
    { enabled: open, keepPrevious: true },
  );
  const total = preview.data?.pagination.total;
  const filmWord = total === 1 ? "film" : "films";
  const countPending = total == null && preview.isLoading && !preview.isError;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader className="text-left">
          <SheetTitle>Filter</SheetTitle>
          <SheetDescription className="sr-only">
            Narrow this view by genre and runtime. On my services arrives later.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
          {/* S8 inserts the On my services switch here. */}
          <div data-slot="on-my-services" />

          <div className="space-y-2">
            <p className="text-label-md text-cb-muted">Genre</p>
            {genreOptions.length > 0 ? (
              <MultiSelectChips
                options={genreOptions}
                value={draft.genres}
                onChange={(genres) => setDraft((prev) => ({ ...prev, genres }))}
              />
            ) : (
              <p className="font-ui text-cb-caption text-cb-muted">
                {genresQuery.isError ? "Could not load genres." : "No genres yet."}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p id="watchlist-runtime-label" className="text-label-md text-cb-muted">
              Runtime
            </p>
            <div
              role="radiogroup"
              aria-labelledby="watchlist-runtime-label"
              className="flex flex-wrap gap-2"
            >
              {RUNTIME_OPTIONS.map((option) => {
                const selected = draft.runtime === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-cb border px-3 py-2 font-ui text-cb-caption",
                      selected
                        ? "border-cb-teal bg-cb-surface text-cb-teal"
                        : "border-cb-divider bg-cb-surface text-cb-muted",
                    )}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, runtime: option.value }))
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col items-center gap-3 pt-2">
          <button
            type="button"
            className="font-ui text-cb-ui text-cb-teal"
            onClick={() => setDraft(DEFAULT_WATCHLIST_FILTERS)}
          >
            Clear all
          </button>
          <Button
            type="button"
            className="h-12 w-full"
            disabled={countPending}
            aria-label={total == null ? "Show films" : `Show ${total} ${filmWord}`}
            onClick={() => onApply(draft)}
          >
            <span className="inline-flex items-baseline gap-1">
              <span>Show</span>
              {total == null ? <span>…</span> : <CueNumber value={total} />}
              <span>{filmWord}</span>
            </span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
