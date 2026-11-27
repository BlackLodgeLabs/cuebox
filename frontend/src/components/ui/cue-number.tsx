"use client";

import NumberFlow from "@number-flow/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cueboxEase, numberMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const easing = `cubic-bezier(${cueboxEase.join(",")})`;

type CueNumberProps = {
  value: number;
  className?: string;
};

/** NumberFlow at 400ms. Reduced motion shows the settled figure. */
export function CueNumber({ value, className }: CueNumberProps) {
  const spec = numberMotion(useReducedMotion());

  return (
    <span
      data-cb-number=""
      data-duration-ms={spec.durationMs}
      data-settled={spec.settled ? "true" : "false"}
      className={cn("inline-block tabular-nums", className)}
    >
      {spec.settled ? (
        value
      ) : (
        <NumberFlow
          value={value}
          respectMotionPreference
          transformTiming={{ duration: spec.durationMs, easing }}
          spinTiming={{ duration: spec.durationMs, easing }}
          opacityTiming={{ duration: spec.durationMs, easing: "linear" }}
        />
      )}
    </span>
  );
}
