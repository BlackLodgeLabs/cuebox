import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-cb bg-cb-divider motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
