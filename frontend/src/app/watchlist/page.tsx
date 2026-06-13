import { Suspense } from "react";
import { CardGridSkeleton } from "@/components/loading-state";
import { WatchlistPageContent } from "@/app/watchlist/watchlist-page-content";

export default function WatchlistPage() {
  return (
    <Suspense fallback={<CardGridSkeleton count={4} />}>
      <WatchlistPageContent />
    </Suspense>
  );
}
