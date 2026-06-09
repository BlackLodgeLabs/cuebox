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
        setInlineError("Upload failed. Please try again.");
      }
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import watchlist</h1>
        <p className="mt-1 text-muted-foreground">
          Upload your Letterboxd watchlist CSV to import films and start
          enrichment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            Export your watchlist from Letterboxd (Settings → Data → Export your
            data). The file must include Date, Title, Year, and Letterboxd URI
            columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload
            onFileSelect={(f) => {
              setFile(f);
              setInlineError(null);
            }}
            disabled={upload.isPending}
          />
          {inlineError && (
            <p className="text-sm text-destructive">{inlineError}</p>
          )}
          <Button
            onClick={() => void handleUpload()}
            disabled={!file || upload.isPending}
            className="w-full"
          >
            {upload.isPending ? "Uploading…" : "Start import"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
