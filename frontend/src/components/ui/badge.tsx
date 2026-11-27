import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-cb border px-2 py-0.5 font-mono text-cb-meta-sm uppercase",
  {
    variants: {
      variant: {
        default: "border-transparent bg-cb-accent text-cb-ink",
        secondary: "border-cb-divider bg-cb-surface text-cb-muted",
        destructive: "border-transparent bg-cb-danger text-cb-text",
        outline: "border-cb-divider bg-cb-surface text-cb-text",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
