import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded border border-border bg-surface-high px-4 py-2 text-body-md text-foreground shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/70 hover:border-[var(--outline)] focus-visible:border-secondary focus-visible:outline-none focus-visible:shadow-focus-lime disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale aria-[invalid=true]:border-destructive aria-[invalid=true]:shadow-[0_0_0_2px_rgba(255,180,171,0.2)]",
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
