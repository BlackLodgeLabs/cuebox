"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useImportStatus } from "@/hooks/use-import";
import { useReviewRequired } from "@/hooks/use-films";

export default function ImportStatusPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const [failuresOpen, setFailuresOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useImportStatus(jobId);
  const { data: reviewData } = useReviewRequired({ limit: 1 });

  if (isLoading) {
    return <LoadingState message="Loading import status…" />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        message="Could not load import status."
        onRetry={() => void refetch()}
      />
    );
  }

  const progressPercent =
    data.total_films && data.total_films > 0
      ? Math.round((data.processed_films / data.total_films) * 100)
      : null;

  const reviewCount = reviewData?.pagination.total ?? 0;
  const isComplete = data.status === "complete";
  const isFailed = data.status === "failed";
  const isRunning = data.status === "running";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import progress</h1>
        <p className="mt-1 text-muted-foreground">
          Job {data.job_id.slice(0, 8)}…
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isRunning && "Enriching films…"}
            {isComplete && "Import complete"}
            {isFailed && "Import failed"}
          </CardTitle>
          <CardDescription>
            {isRunning &&
              "Films are being matched and enriched. This may take a few minutes."}
            {isComplete && "All films have been processed."}
            {isFailed && "The import job encountered an error."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRunning && (
            <div className="space-y-2">
              {progressPercent !== null ? (
                <>
                  <Progress value={progressPercent} />
                  <p className="text-sm text-muted-foreground">
                    {data.processed_films} of {data.total_films} films processed
                  </p>
                </>
              ) : (
                <>
                  <Progress value={undefined} className="animate-pulse" />
                  <p className="text-sm text-muted-foreground">
                    Parsing CSV… ({data.processed_films} processed so far)
                  </p>
                </>
              )}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Processed</dt>
            <dd>{data.processed_films}</dd>
            <dt className="text-muted-foreground">Failed</dt>
            <dd>{data.failed_films}</dd>
            <dt className="text-muted-foreground">Duplicates skipped</dt>
            <dd>{data.duplicate_films}</dd>
            {data.total_films !== null && (
              <>
                <dt className="text-muted-foreground">Total</dt>
                <dd>{data.total_films}</dd>
              </>
            )}
          </dl>

          {data.failed_films > 0 && data.failure_summary && (
            <div>
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => setFailuresOpen(!failuresOpen)}
              >
                {failuresOpen ? "Hide" : "Show"} failure details ({data.failed_films})
              </button>
              {failuresOpen && (
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
                  {data.failure_summary.map((item) => (
                    <li key={item.letterboxd_uri} className="rounded border p-2">
                      <p className="font-mono text-xs">{item.letterboxd_uri}</p>
                      <p className="text-muted-foreground">{item.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isComplete && (
            <div className="flex flex-wrap gap-3">
              {reviewCount > 0 ? (
                <Button asChild>
                  <Link href="/review">Review matches ({reviewCount})</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/recommend">Get a recommendation</Link>
                </Button>
              )}
            </div>
          )}

          {isFailed && (
            <Button asChild variant="outline">
              <Link href="/import">Try again</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
