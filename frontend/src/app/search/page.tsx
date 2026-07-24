"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  LibrarySearchPicker,
  type SearchPickerIntent,
} from "@/components/library-search-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function parseIntent(value: string | null): SearchPickerIntent | undefined {
  if (value === "add" || value === "mark-watched") {
    return value;
  }
  return undefined;
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const intent = parseIntent(searchParams.get("intent"));

  const title =
    intent === "mark-watched"
      ? "Mark a film watched"
      : intent === "add"
        ? "Add a film"
        : "Search films";

  const description =
    intent === "mark-watched"
      ? "Find a title in your library (including watched) or on TMDB, then mark it watched."
      : intent === "add"
        ? "Search your library and TMDB. Add new titles or open ones you already have."
        : "Search your library and TMDB to add a film or mark one watched.";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1">{title}</h1>
          <p className="mt-1 text-body-md text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>
            Library hits show status-aware actions. TMDB-only hits can be added to
            your watchlist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LibrarySearchPicker intent={intent} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-muted-foreground">Loading search…</p>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
