"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import {
  useSyncCsv,
  useSyncRssConfig,
  useSyncRssStatus,
  useSyncWatched,
} from "@/hooks/use-sync";
import { ApiClientError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-messages";
import type { SyncCsvResponse, SyncWatchedResponse } from "@/types/api";

export default function SyncSettingsPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncCsvResponse | null>(null);
  const [watchedFile, setWatchedFile] = useState<File | null>(null);
  const [ratingsFile, setRatingsFile] = useState<File | null>(null);
  const [diaryFile, setDiaryFile] = useState<File | null>(null);
  const [watchedError, setWatchedError] = useState<string | null>(null);
  const [watchedResult, setWatchedResult] = useState<SyncWatchedResponse | null>(
    null,
  );
  const [username, setUsername] = useState("");
  const [rssError, setRssError] = useState<string | null>(null);
  const usernameEdited = useRef(false);

  const syncCsv = useSyncCsv();
  const syncWatched = useSyncWatched();
  const syncRss = useSyncRssConfig();
  const {
    data: rssStatus,
    isLoading: rssLoading,
    isError: rssStatusError,
    refetch: refetchRss,
  } = useSyncRssStatus();

  useEffect(() => {
    if (usernameEdited.current || !rssStatus?.username) return;
    setUsername(rssStatus.username);
  }, [rssStatus?.username]);

  const handleCsvSync = async () => {
    if (!csvFile) {
      setCsvError("Please select a CSV file.");
      return;
    }
    setCsvError(null);
    try {
      const result = await syncCsv.mutateAsync(csvFile);
      setSyncResult(result);
      setCsvFile(null);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setCsvError(
          getErrorMessage({
            code: error.code as Parameters<typeof getErrorMessage>[0]["code"],
            message: error.message,
            details: error.details,
          }),
        );
      } else {
        setCsvError("Sync failed. Please try again.");
      }
    }
  };

  const handleWatchedImport = async () => {
    if (!watchedFile || !ratingsFile || !diaryFile) {
      setWatchedError("Select watched.csv, ratings.csv, and diary.csv.");
      return;
    }
    setWatchedError(null);
    try {
      const result = await syncWatched.mutateAsync({
        watched: watchedFile,
        ratings: ratingsFile,
        diary: diaryFile,
      });
      setWatchedResult(result);
      setWatchedFile(null);
      setRatingsFile(null);
      setDiaryFile(null);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setWatchedError(
          getErrorMessage({
            code: error.code as Parameters<typeof getErrorMessage>[0]["code"],
            message: error.message,
            details: error.details,
          }),
        );
      } else {
        setWatchedError("Watched history import failed. Please try again.");
      }
    }
  };

  const handleRssSave = async () => {
    setRssError(null);
    try {
      await syncRss.mutateAsync(username.trim());
    } catch (error) {
      if (error instanceof ApiClientError) {
        setRssError(
          getErrorMessage({
            code: error.code as Parameters<typeof getErrorMessage>[0]["code"],
            message: error.message,
            details: error.details,
          }),
        );
      } else {
        setRssError("Failed to save RSS config. Please try again.");
      }
    }
  };

  const watchedReady = Boolean(watchedFile && ratingsFile && diaryFile);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-h1">Sync settings</h1>
        <p className="mt-1 text-body-md text-muted-foreground">
          Keep your local watchlist aligned with Letterboxd.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV re-sync</CardTitle>
          <CardDescription>
            Upload a fresh Letterboxd watchlist export to add new films. Existing
            films are never removed or reclassified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload
            label="Re-sync watchlist"
            selectedFile={csvFile}
            onFileSelect={(f) => {
              setCsvFile(f);
              setCsvError(null);
            }}
            disabled={syncCsv.isPending}
          />
          {csvError && <p className="text-sm text-destructive">{csvError}</p>}
          <Button
            onClick={() => void handleCsvSync()}
            disabled={!csvFile || syncCsv.isPending}
          >
            {syncCsv.isPending ? "Syncing…" : "Sync watchlist"}
          </Button>
          {syncResult && (
            <div className="rounded-md border p-4 text-sm">
              <p className="font-medium">Sync complete</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Added: {syncResult.added}</li>
                <li>Unchanged: {syncResult.unchanged}</li>
                {syncResult.failed > 0 && (
                  <li className="text-destructive">Failed: {syncResult.failed}</li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import watched history</CardTitle>
          <CardDescription>
            Upload Letterboxd&apos;s watched, ratings, and diary CSVs to seed your
            Cuebox watch history. Separate from watchlist sync — does not count
            toward the 500 active-film cap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload
            label="watched.csv"
            selectedFile={watchedFile}
            onFileSelect={(f) => {
              setWatchedFile(f);
              setWatchedError(null);
            }}
            disabled={syncWatched.isPending}
          />
          <FileUpload
            label="ratings.csv"
            selectedFile={ratingsFile}
            onFileSelect={(f) => {
              setRatingsFile(f);
              setWatchedError(null);
            }}
            disabled={syncWatched.isPending}
          />
          <FileUpload
            label="diary.csv"
            selectedFile={diaryFile}
            onFileSelect={(f) => {
              setDiaryFile(f);
              setWatchedError(null);
            }}
            disabled={syncWatched.isPending}
          />
          {watchedError && (
            <p className="text-sm text-destructive">{watchedError}</p>
          )}
          <Button
            onClick={() => void handleWatchedImport()}
            disabled={!watchedReady || syncWatched.isPending}
          >
            {syncWatched.isPending ? "Importing…" : "Import watched history"}
          </Button>
          {watchedResult && (
            <div className="rounded-md border p-4 text-sm">
              <p className="font-medium">Watched history imported</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Films seen: {watchedResult.films_seen}</li>
                <li>Films created: {watchedResult.films_created}</li>
                <li>Watches created: {watchedResult.watches_created}</li>
                <li>
                  Watches skipped (duplicates):{" "}
                  {watchedResult.watches_skipped_duplicate}
                </li>
                <li>Sent to review queue: {watchedResult.pending_review}</li>
                {watchedResult.failures.length > 0 && (
                  <li className="text-destructive">
                    Failures: {watchedResult.failures.length}
                  </li>
                )}
              </ul>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  href="/watchlist?tab=watched"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  View Watched list
                </Link>
                {watchedResult.pending_review > 0 && (
                  <Link
                    href="/watchlist?tab=active"
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Open watch review queue
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RSS sync</CardTitle>
          <CardDescription>
            Configure automatic polling of your Letterboxd RSS feed every 15
            minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Letterboxd username</Label>
            <Input
              id="username"
              placeholder="johndoe"
              value={username}
              onChange={(e) => {
                usernameEdited.current = true;
                setUsername(e.target.value);
              }}
            />
          </div>
          {rssError && <p className="text-sm text-destructive">{rssError}</p>}
          <Button
            onClick={() => void handleRssSave()}
            disabled={!username.trim() || syncRss.isPending}
          >
            {syncRss.isPending ? "Saving…" : "Save RSS config"}
          </Button>

          <div className="border-t pt-4">
            <h3 className="font-medium">RSS status</h3>
            {rssLoading && <LoadingState message="Loading RSS status…" />}
            {rssStatusError && (
              <ErrorState
                message="Could not load RSS status."
                onRetry={() => void refetchRss()}
              />
            )}
            {rssStatus && (
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-label-md normal-case tracking-normal text-muted-foreground">Configured</dt>
                <dd className="font-mono text-sm">{rssStatus.configured ? "Yes" : "No"}</dd>
                {rssStatus.username && (
                  <>
                    <dt className="text-muted-foreground">Username</dt>
                    <dd>{rssStatus.username}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Poll interval</dt>
                <dd>{rssStatus.polling_interval_seconds}s</dd>
                <dt className="text-muted-foreground">Last polled</dt>
                <dd>
                  {rssStatus.last_polled_at
                    ? new Date(rssStatus.last_polled_at).toLocaleString()
                    : "Never"}
                </dd>
                <dt className="text-muted-foreground">Last poll status</dt>
                <dd>
                  {rssStatus.last_poll_status ? (
                    <Badge
                      variant={
                        rssStatus.last_poll_status === "error"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {rssStatus.last_poll_status}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </dd>
                {rssStatus.events_processed_last_poll !== null && (
                  <>
                    <dt className="text-muted-foreground">Events last poll</dt>
                    <dd>{rssStatus.events_processed_last_poll}</dd>
                  </>
                )}
              </dl>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
