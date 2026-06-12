import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full resize-y rounded border border-border bg-surface-high px-4 py-3 text-body-md text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 hover:border-[var(--outline)] focus-visible:border-secondary focus-visible:outline-none focus-visible:shadow-focus-lime disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
