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

export function FilmDetailSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading film">
      <Skeleton className="h-5 w-28 bg-surface-high" />
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <Skeleton className="mx-auto aspect-[2/3] w-full max-w-xs rounded bg-surface-high md:mx-0 md:w-64 lg:w-72" />
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className="h-9 w-3/4 bg-surface-high" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 bg-surface-high" />
            <Skeleton className="h-6 w-16 bg-surface-high" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-36 bg-surface-high" />
            <Skeleton className="h-11 w-32 bg-surface-high" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-24 bg-surface-high" />
        <Skeleton className="h-20 w-full bg-surface-high" />
        <Skeleton className="h-4 w-2/3 bg-surface-high" />
      </div>
    </div>
  );
}
