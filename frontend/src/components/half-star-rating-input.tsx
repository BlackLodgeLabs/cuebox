"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { starFillMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface HalfStarRatingInputProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  id?: string;
  /** Create sheet plays the locked star fill. Edit snaps to the new score. */
  animate?: boolean;
}

const STAR_PATH =
  "M12 3.5 14.4 9l5.8.6-4.4 3.8 1.3 5.6L12 16.2 6.9 19l1.3-5.6L3.8 9.6 9.6 9 12 3.5Z";

function starLabel(step: number): string {
  return step === 1 ? "1 star" : `${step} stars`;
}

function amountsFor(value: number | null): number[] {
  return [1, 2, 3, 4, 5].map((star) => {
    if (value == null) return 0;
    if (value >= star) return 1;
    if (value >= star - 0.5) return 0.5;
    return 0;
  });
}

export function HalfStarRatingInput({
  value,
  onChange,
  disabled = false,
  id = "watch-score",
  animate = false,
}: HalfStarRatingInputProps) {
  const reduced = useReducedMotion();
  const spec = starFillMotion(reduced || !animate);
  const instant = !animate || reduced || spec.travel === "none";
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (instant) return;
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [instant, value]);

  const displayed = instant ? value : shown;
  const fills = amountsFor(displayed);
  const lastIndex = displayed == null ? -1 : Math.ceil(displayed) - 1;
  const ease = "cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <div
      role="radiogroup"
      aria-label="Your rating"
      id={id}
      data-stagger-ms={spec.staggerMs}
      data-fill-ms={spec.fillMs}
      data-bounce-ms={spec.bounceMs}
      data-bounce-percent={Math.round(spec.bounce * 100)}
      data-saved-delay-ms={spec.savedDelayMs}
      data-saved-fade-ms={spec.savedFadeMs}
      data-glow={spec.glow}
      data-crossfade-ms={spec.crossfadeMs}
      data-reduced={reduced ? "true" : "false"}
      data-animate={animate && !reduced ? "true" : "false"}
      className="flex items-center justify-center gap-2 text-cb-accent"
      style={{ ["--cb-star-bounce-peak" as string]: String(1 + spec.bounce) }}
    >
      {fills.map((amount, index) => {
        const bounce =
          animate &&
          !reduced &&
          spec.bounceMs > 0 &&
          index === lastIndex &&
          displayed === value;
        const delay = index * spec.staggerMs;
        return (
          <div
            key={index}
            className="relative h-11 w-11"
            data-glow={spec.glow > 0 && amount > 0 ? String(spec.glow) : "0"}
            style={{
              animation: bounce
                ? `cb-star-bounce ${spec.bounceMs}ms ${ease} ${lastIndex * spec.staggerMs + spec.fillMs}ms both`
                : undefined,
              filter:
                spec.glow > 0 && amount > 0
                  ? `drop-shadow(0 0 4px color-mix(in srgb, var(--cb-accent) ${Math.round(spec.glow * 100)}%, transparent))`
                  : undefined,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-1 top-1 h-9 w-9"
              aria-hidden
            >
              <path
                d={STAR_PATH}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-1 top-1 h-9 w-9"
              aria-hidden
              style={{
                clipPath: `inset(0 ${(1 - amount) * 100}% 0 0)`,
                transition: instant
                  ? "none"
                  : `clip-path ${spec.fillMs}ms ${ease} ${delay}ms`,
              }}
            >
              <path d={STAR_PATH} fill="currentColor" />
            </svg>
            {[index + 0.5, index + 1].map((step, half) => (
              <button
                key={step}
                type="button"
                role="radio"
                aria-checked={value === step}
                aria-label={starLabel(step)}
                disabled={disabled}
                onClick={() => onChange(step)}
                className={cn(
                  "absolute inset-y-0 z-10 w-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cb-accent",
                  half === 0 ? "left-0" : "right-0",
                  disabled ? "cursor-not-allowed" : "cursor-pointer",
                )}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
