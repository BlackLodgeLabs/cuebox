import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-cb border border-cb-divider bg-cb-surface px-4 py-2 font-ui text-cb-body text-cb-text transition-colors file:border-0 file:bg-transparent file:font-ui file:text-cb-ui file:font-medium placeholder:text-cb-muted hover:border-cb-muted focus-visible:border-cb-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-cb-danger",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
