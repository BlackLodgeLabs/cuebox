"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatEnrichmentStatus } from "@/lib/enrichment-status";
import type { FilmSortField, SortDirection } from "@/types/api";

const ENRICHMENT_OPTIONS = [
  "pending",
  "matching",
  "review_required",
  "enriching",
  "ready",
  "failed",
] as const;

export interface WatchlistFilterValues {
  search: string;
  enrichmentStatus: string;
  year: string;
  sort: FilmSortField;
  sortDir: SortDirection;
  createdFrom: string;
  createdTo: string;
}

export const DEFAULT_WATCHLIST_FILTERS: WatchlistFilterValues = {
  search: "",
  enrichmentStatus: "all",
  year: "",
  sort: "created_at",
  sortDir: "desc",
  createdFrom: "",
  createdTo: "",
};

interface WatchlistFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: WatchlistFilterValues;
  onApply: (values: WatchlistFilterValues) => void;
  onClear: () => void;
}

export function WatchlistFilterSheet({
  open,
  onOpenChange,
  values,
  onApply,
  onClear,
}: WatchlistFilterSheetProps) {
  const [draft, setDraft] = useState<WatchlistFilterValues>(values);

  useEffect(() => {
    if (open) {
      setDraft(values);
    }
  }, [open, values]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto sm:max-w-lg sm:mx-auto">
        <SheetHeader>
          <SheetTitle>Filter and sort</SheetTitle>
          <SheetDescription>
            Adjust search, enrichment, year, and sort. Apply to update the grid.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="watchlist-filter-search">Search</Label>
            <Input
              id="watchlist-filter-search"
              placeholder="Filter by title…"
              value={draft.search}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, search: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Enrichment</Label>
            <Select
              value={draft.enrichmentStatus}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, enrichmentStatus: value }))
              }
            >
              <SelectTrigger aria-label="Enrichment status">
                <SelectValue placeholder="Enrichment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ENRICHMENT_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {formatEnrichmentStatus(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="watchlist-filter-year">Year</Label>
            <Input
              id="watchlist-filter-year"
              type="number"
              placeholder="Year"
              value={draft.year}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, year: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Sort by</Label>
              <Select
                value={draft.sort}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    sort: value as FilmSortField,
                  }))
                }
              >
                <SelectTrigger aria-label="Sort by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                  <SelectItem value="created_at">Date added</SelectItem>
                  <SelectItem value="enrichment_status">Enrichment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={draft.sortDir}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    sortDir: value as SortDirection,
                  }))
                }
              >
                <SelectTrigger aria-label="Sort direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="watchlist-filter-created-from">Added from</Label>
              <Input
                id="watchlist-filter-created-from"
                type="date"
                value={draft.createdFrom}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    createdFrom: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="watchlist-filter-created-to">Added to</Label>
              <Input
                id="watchlist-filter-created-to"
                type="date"
                value={draft.createdTo}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, createdTo: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <SheetFooter className="mt-8 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(DEFAULT_WATCHLIST_FILTERS);
              onClear();
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(draft);
            }}
          >
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
