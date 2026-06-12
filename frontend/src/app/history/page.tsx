"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FilmPoster } from "@/components/film-poster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useRecommendationHistory } from "@/hooks/use-recommendations";
import type { WatchStatusFilter } from "@/types/api";

export default function HistoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [watchStatus, setWatchStatus] = useState<WatchStatusFilter | "all">(
    "all",
  );
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, dateFrom, dateTo, watchStatus]);

  const { data, isLoading, isError, refetch } = useRecommendationHistory({
    search: debouncedSearch || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    watch_status: watchStatus === "all" ? undefined : watchStatus,
    limit,
    offset,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1">Recommendation history</h1>
        <p className="mt-1 text-body-md text-muted-foreground">
          Browse past picks and revisit your preferences.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="max-w-[160px]"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="max-w-[160px]"
        />
        <Select
          value={watchStatus}
          onValueChange={(v) =>
            setWatchStatus(v as WatchStatusFilter | "all")
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Watch status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="watched">Watched</SelectItem>
            <SelectItem value="unwatched">Unwatched</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <CardGridSkeleton count={4} />}

      {isError && (
        <ErrorState
          message="Could not load recommendation history."
          onRetry={() => void refetch()}
        />
      )}

      {data && data.data.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No recommendations found.{" "}
          <Link href="/recommend" className="text-primary hover:underline">
            Start your first one
          </Link>
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((item) => (
              <Link key={item.session_id} href={`/history/${item.session_id}`}>
                <Card className="h-full hover-glow">
                  <CardHeader className="flex flex-row gap-3">
                    <FilmPoster
                      src={item.winner_poster_url}
                      alt={item.winner_title}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">
                        {item.winner_title}
                        {item.winner_year ? ` (${item.winner_year})` : ""}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {item.preference_summary}
                      </CardDescription>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                        {item.winner_watch_status && (
                          <Badge variant="secondary" className="text-xs">
                            {item.winner_watch_status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>

          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!data.pagination.has_more}
              onClick={() => setOffset((o) => o + limit)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
