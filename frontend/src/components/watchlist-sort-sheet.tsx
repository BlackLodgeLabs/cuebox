"use client";

import { Icon } from "@/components/icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WATCHLIST_SORTS, type WatchlistSort } from "@/lib/watchlist-sort";
import { cn } from "@/lib/utils";

interface WatchlistSortSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: WatchlistSort;
  onSelect: (sort: WatchlistSort) => void;
}

export function WatchlistSortSheet({
  open,
  onOpenChange,
  value,
  onSelect,
}: WatchlistSortSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader className="text-left">
          <SheetTitle>Sort by</SheetTitle>
          <SheetDescription className="sr-only">
            Choose how films are ordered. Each choice has one direction.
          </SheetDescription>
        </SheetHeader>
        <div role="listbox" aria-label="Sort by">
          {WATCHLIST_SORTS.map((option) => {
            const selected =
              option.sort === value.sort && option.sortDir === value.sortDir;
            return (
              <button
                key={option.sort}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-3 border-b border-cb-divider py-3 text-left",
                  selected ? "text-cb-teal" : "text-cb-text",
                )}
                onClick={() => {
                  onSelect(option);
                  onOpenChange(false);
                }}
              >
                <span>
                  <span className="block font-ui text-cb-ui">{option.label}</span>
                  <span
                    className={cn(
                      "block font-ui text-cb-caption",
                      selected ? "text-cb-teal" : "text-cb-muted",
                    )}
                  >
                    {option.hint}
                  </span>
                </span>
                {selected ? (
                  <span className="inline-flex items-center text-cb-teal">
                    <Icon name="check" size={18} />
                    <span className="sr-only">Selected</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
