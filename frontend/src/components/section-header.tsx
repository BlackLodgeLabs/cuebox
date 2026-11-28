import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-cb-card leading-none">{title}</h2>
        {action}
      </div>
      <span
        aria-hidden
        data-section-hairline
        className="h-px w-8 bg-cb-teal"
      />
    </div>
  );
}
