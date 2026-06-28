export function RecommendationLoading() {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
      <h1 className="text-h1">Finding your film…</h1>
      <p className="text-body-md text-muted-foreground">
        This can take up to 30 seconds while we search and rank your watchlist.
      </p>
      <div className="mx-auto h-2 w-48 animate-pulse rounded-full bg-muted" />
    </div>
  );
}
