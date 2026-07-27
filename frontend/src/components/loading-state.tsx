import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <Skeleton className="h-8 w-48 bg-surface-high" />
      <p className="text-body-md text-muted-foreground">{message}</p>
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded bg-surface-high" />
      ))}
    </div>
  );
}

export function PosterGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      data-testid="poster-grid-skeleton"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded bg-surface-high" />
          <Skeleton className="h-4 w-3/4 rounded bg-surface-high" />
        </div>
      ))}
    </div>
  );
}
