"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DeleteHistoryDialog } from "@/components/delete-history-dialog";
import { HistoryTicket } from "@/components/history-ticket";
import {
  DEFAULT_HISTORY_FILTERS,
  HistoryFilterSheet,
  type HistoryFilterValues,
} from "@/components/history-filter-sheet";
import { Icon } from "@/components/icon";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { InfiniteBatch, LoadingMore } from "@/components/ui/infinite-scroll";
import { HISTORY_PAGE_SIZE } from "@/hooks/use-infinite-scroll";
import {
  useDeleteRecommendation,
  useInfiniteRecommendationHistory,
} from "@/hooks/use-recommendations";
import { useToastOnError } from "@/hooks/use-toast-on-error";
import { formatNightCount, historyMonthLabel } from "@/lib/history-format";
import { cn } from "@/lib/utils";
import type { HistoryCard, WatchStatusFilter } from "@/types/api";

function filtersActive(values: HistoryFilterValues): boolean {
  return values.dateFrom !== "" || values.dateTo !== "" || values.watchStatus !== "all";
}

export default function HistoryPage() {
  const router = useRouter();
  const deleteRecommendation = useDeleteRecommendation();
  const onDeleteError = useToastOnError();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [watchStatus, setWatchStatus] = useState<WatchStatusFilter | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filterValues: HistoryFilterValues = { dateFrom, dateTo, watchStatus };
  const active = filtersActive(filterValues);

  const history = useInfiniteRecommendationHistory({
    search: debouncedSearch || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    watch_status: watchStatus === "all" ? undefined : watchStatus,
  });

  const monthBreaks = useMemo(() => {
    const breaks = new Map<string, string>();
    let previous = "";
    for (const item of history.items) {
      const label = historyMonthLabel(item.created_at);
      if (label !== previous) {
        breaks.set(item.session_id, label);
        previous = label;
      }
    }
    return breaks;
  }, [history.items]);

  const applyFilters = (values: HistoryFilterValues) => {
    setDateFrom(values.dateFrom);
    setDateTo(values.dateTo);
    setWatchStatus(values.watchStatus);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    applyFilters(DEFAULT_HISTORY_FILTERS);
  };

  const handleConfirmDelete = () => {
    if (!deletingSessionId) return;
    deleteRecommendation.mutate(deletingSessionId, {
      onSuccess: () => {
        setDeletingSessionId(null);
      },
      onError: onDeleteError,
    });
  };

  return (
    <div>
      <header className="pb-2.5 pt-1">
        <h1 className="font-display text-cb-page leading-[30px] tracking-[0.01em]">History</h1>
        {!history.isLoading && !history.isError ? (
          <p className="mt-1 font-mono text-cb-meta tracking-[0.04em] text-cb-muted">
            {formatNightCount(history.total)}
          </p>
        ) : null}
      </header>

      <div className="flex items-center gap-2 pb-3">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-cb border border-cb-divider bg-cb-surface px-3 text-cb-teal">
          <Icon name="search" size={16} className="shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title…"
            aria-label="Search by title"
            autoComplete="off"
            className="w-full bg-transparent font-ui text-cb-caption text-cb-text outline-none placeholder:text-cb-muted"
          />
        </label>
        <button
          type="button"
          aria-label="Filter history"
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-cb border bg-cb-surface px-3 font-ui text-cb-caption font-medium",
            active
              ? "border-cb-teal text-cb-teal"
              : "border-cb-divider text-cb-text",
          )}
          onClick={() => setFilterOpen(true)}
        >
          <Icon name="filter_list" size={16} />
          Filter
        </button>
      </div>

      {history.isLoading && <LoadingState message="Loading history…" />}

      {history.isError && (
        <ErrorState
          message="Could not load recommendation history."
          onRetry={() => void history.refetch()}
        />
      )}

      {!history.isLoading && !history.isError && history.items.length === 0 && (
        <div className="py-12 text-center font-ui text-cb-caption text-cb-muted">
          {active || debouncedSearch ? "No nights match." : "No nights yet."}{" "}
          <Link href="/recommend" className="text-cb-teal">
            New pick
          </Link>
        </div>
      )}

      {history.items.length > 0 && (
        <InfiniteBatch
          items={history.items}
          pageSize={HISTORY_PAGE_SIZE}
          getKey={(item) => item.session_id}
          renderItem={(item: HistoryCard) => {
            const month = monthBreaks.get(item.session_id);
            const first = history.items[0]?.session_id === item.session_id;
            return (
              <>
                {month ? (
                  <div
                    className={cn(
                      "flex items-center gap-2.5 pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-cb-muted",
                      first ? "pt-1" : "pt-3.5",
                    )}
                  >
                    <i aria-hidden className="block h-px w-6 bg-cb-teal" />
                    {month}
                  </div>
                ) : null}
                <HistoryTicket
                  item={item}
                  onOpen={() => router.push(`/history/${item.session_id}`)}
                  onRemove={() => setDeletingSessionId(item.session_id)}
                />
              </>
            );
          }}
        />
      )}

      {history.isFetchingNextPage ? <LoadingMore /> : null}

      <HistoryFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        values={filterValues}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      <DeleteHistoryDialog
        open={deletingSessionId !== null}
        onOpenChange={(open) => {
          if (!open && !deleteRecommendation.isPending) {
            setDeletingSessionId(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        isPending={deleteRecommendation.isPending}
      />
    </div>
  );
}
