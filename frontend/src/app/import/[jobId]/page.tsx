"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { OffTabPageHeader } from "@/components/off-tab-page-header";
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
  const isImportComplete = data?.status === "complete";
  const {
    data: reviewData,
    isLoading: reviewLoading,
  } = useReviewRequired({ limit: 1 }, { enabled: isImportComplete });

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
    <div className="mx-auto max-w-xl space-y-4">
      <OffTabPageHeader
        title="Import progress"
        subtitle={`Job ${data.job_id.slice(0, 8)}…`}
      />

      <Card>
        <CardHeader className="space-y-1 p-4 pb-2 sm:p-6 sm:pb-2">
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
        <CardContent className="space-y-4 p-4 pt-2 sm:p-6 sm:pt-2">
          {isRunning && (
            <div className="space-y-2">
              {progressPercent !== null ? (
                <>
                  <Progress value={progressPercent} />
                  <p className="font-ui text-cb-ui text-cb-muted">
                    {data.processed_films} of {data.total_films} films processed
                  </p>
                </>
              ) : (
                <>
                  <Progress value={undefined} className="animate-pulse" />
                  <p className="font-ui text-cb-ui text-cb-muted">
                    Parsing CSV… ({data.processed_films} processed so far)
                  </p>
                </>
              )}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-2 font-ui text-cb-ui">
            <dt className="text-cb-muted">Processed</dt>
            <dd>{data.processed_films}</dd>
            <dt className="text-cb-muted">Failed</dt>
            <dd>{data.failed_films}</dd>
            <dt className="text-cb-muted">Duplicates skipped</dt>
            <dd>{data.duplicate_films}</dd>
            {data.total_films !== null && (
              <>
                <dt className="text-cb-muted">Total</dt>
                <dd>{data.total_films}</dd>
              </>
            )}
          </dl>

          {data.failed_films > 0 && data.failure_summary && (
            <div>
              <button
                type="button"
                className="inline-flex min-h-11 items-center font-ui text-cb-ui font-medium text-cb-teal hover:underline"
                onClick={() => setFailuresOpen(!failuresOpen)}
              >
                {failuresOpen ? "Hide" : "Show"} failure details ({data.failed_films})
              </button>
              {failuresOpen && (
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
                  {data.failure_summary.map((item) => (
                    <li key={item.letterboxd_uri} className="min-w-0 rounded-cb border border-cb-divider p-2">
                      <p className="break-all font-mono text-cb-caption text-cb-teal">
                        {item.letterboxd_uri}
                      </p>
                      <p className="font-ui text-cb-ui text-cb-muted">{item.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isComplete && reviewLoading && (
            <p className="font-ui text-cb-ui text-cb-muted">
              Checking for matches to review…
            </p>
          )}
          {isComplete && !reviewLoading && (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {reviewCount > 0 ? (
                <Button asChild size="lg" className="min-h-11 w-full sm:w-auto">
                  <Link href="/review">Review matches ({reviewCount})</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="min-h-11 w-full sm:w-auto">
                  <Link href="/recommend">Get a recommendation</Link>
                </Button>
              )}
            </div>
          )}

          {isFailed && (
            <Button asChild variant="outline" size="lg" className="min-h-11 w-full sm:w-auto">
              <Link href="/import">Try again</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
