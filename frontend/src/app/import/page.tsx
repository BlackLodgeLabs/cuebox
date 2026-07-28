"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useImportUpload } from "@/hooks/use-import";
import { ApiClientError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-messages";

const API_REACH_MESSAGE =
  "Could not reach the API. Make sure the backend is running.";

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const upload = useImportUpload();

  const handleUpload = async () => {
    if (!file) {
      setInlineError("Please select a CSV file.");
      return;
    }

    setInlineError(null);
    try {
      const result = await upload.mutateAsync(file);
      router.push(`/import/${result.job_id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setInlineError(
          getErrorMessage({
            code: error.code as Parameters<typeof getErrorMessage>[0]["code"],
            message: error.message,
            details: error.details,
          }),
        );
      } else {
        setInlineError(API_REACH_MESSAGE);
      }
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-h1">Import watchlist</h1>
        <p className="mt-1 text-body-md text-muted-foreground">
          Upload your Letterboxd watchlist CSV to import films and start
          enrichment.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-1 p-4 pb-2 sm:p-6 sm:pb-2">
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            Export your watchlist from Letterboxd (Settings → Data → Export your
            data). The file must include Date, Title, Year, and Letterboxd URI
            columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-2 sm:p-6 sm:pt-2">
          <FileUpload
            variant="compact"
            selectedFile={file}
            onFileSelect={(f) => {
              setFile(f);
              setInlineError(null);
            }}
            disabled={upload.isPending}
          />
          {inlineError && (
            <div
              role="alert"
              className="space-y-3 rounded border border-destructive/40 bg-destructive/10 p-3"
            >
              <p className="text-body-md text-destructive">{inlineError}</p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => void handleUpload()}
                disabled={!file || upload.isPending}
              >
                Try again
              </Button>
            </div>
          )}
          <Button
            size="lg"
            onClick={() => void handleUpload()}
            disabled={!file || upload.isPending}
            className="w-full min-h-11"
          >
            {upload.isPending ? "Uploading…" : "Start import"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
