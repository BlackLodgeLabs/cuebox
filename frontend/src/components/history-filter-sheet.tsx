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
import type { WatchStatusFilter } from "@/types/api";

export interface HistoryFilterValues {
  dateFrom: string;
  dateTo: string;
  watchStatus: WatchStatusFilter | "all";
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilterValues = {
  dateFrom: "",
  dateTo: "",
  watchStatus: "all",
};

interface HistoryFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: HistoryFilterValues;
  onApply: (values: HistoryFilterValues) => void;
  onClear: () => void;
}

export function HistoryFilterSheet({
  open,
  onOpenChange,
  values,
  onApply,
  onClear,
}: HistoryFilterSheetProps) {
  const [draft, setDraft] = useState<HistoryFilterValues>(values);

  useEffect(() => {
    if (open) {
      setDraft(values);
    }
  }, [open, values]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto sm:max-w-lg sm:mx-auto">
        <SheetHeader>
          <SheetTitle>Filter history</SheetTitle>
          <SheetDescription>
            Narrow by date range and watch status. Apply to update the list.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="history-filter-date-from">From</Label>
              <Input
                id="history-filter-date-from"
                type="date"
                value={draft.dateFrom}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, dateFrom: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-filter-date-to">To</Label>
              <Input
                id="history-filter-date-to"
                type="date"
                value={draft.dateTo}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, dateTo: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Watch status</Label>
            <Select
              value={draft.watchStatus}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  watchStatus: value as WatchStatusFilter | "all",
                }))
              }
            >
              <SelectTrigger aria-label="Watch status">
                <SelectValue placeholder="Watch status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="watched">Watched</SelectItem>
                <SelectItem value="unwatched">Unwatched</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="mt-8 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(DEFAULT_HISTORY_FILTERS);
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
