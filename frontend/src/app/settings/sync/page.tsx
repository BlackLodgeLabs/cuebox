"use client";

import { useState } from "react";
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
} from "@/hooks/use-sync";
import { ApiClientError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-messages";
import type { SyncCsvResponse } from "@/types/api";

export default function SyncSettingsPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncCsvResponse | null>(null);
  const [username, setUsername] = useState("");
  const [rssError, setRssError] = useState<string | null>(null);

  const syncCsv = useSyncCsv();
  const syncRss = useSyncRssConfig();
  const {
    data: rssStatus,
    isLoading: rssLoading,
    isError: rssStatusError,
    refetch: refetchRss,
  } = useSyncRssStatus();

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
            Upload a fresh Letterboxd watchlist export to add, remove, or mark
            films as watched.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload
            label="Re-sync watchlist"
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
                <li>Removed: {syncResult.removed}</li>
                <li>Watched: {syncResult.watched}</li>
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
              onChange={(e) => setUsername(e.target.value)}
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
