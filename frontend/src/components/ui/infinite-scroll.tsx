"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { batchMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type InfiniteBatchProps<T> = {
  items: T[];
  pageSize: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  className?: string;
};

/** New rows fade in over 300ms. Full motion staggers 30ms; reduced motion fades the batch together. */
export function InfiniteBatch<T>({
  items,
  pageSize,
  getKey,
  renderItem,
  className,
}: InfiniteBatchProps<T>) {
  const spec = batchMotion(useReducedMotion());
  const size = Math.max(1, pageSize);

  return (
    <div className={className}>
      {items.map((item, index) => {
        const delay = spec.staggerMs * (index % size);
        return (
          <div
            key={getKey(item)}
            data-cb-batch=""
            data-fade-ms={spec.fadeMs}
            data-stagger-ms={delay}
            className="min-w-0"
            style={{
              animationName: "cb-fade",
              animationDuration: `${spec.fadeMs}ms`,
              animationDelay: `${delay}ms`,
              animationFillMode: "both",
              animationTimingFunction: "linear",
            }}
          >
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}

/** Flat teal spinner. Teal does not glow. */
export function LoadingMore({ className }: { className?: string }) {
  return (
    <div
      role="status"
      data-cb-loading-more=""
      className={cn(
        "flex items-center justify-center gap-2 py-4 font-ui text-cb-caption text-cb-teal",
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cb-teal border-t-transparent motion-reduce:animate-none"
      />
      Loading more
    </div>
  );
}
