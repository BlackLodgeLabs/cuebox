"use client";

import { cn } from "@/lib/utils";

interface HalfStarRatingInputProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  id?: string;
}

const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export function HalfStarRatingInput({
  value,
  onChange,
  disabled = false,
  id = "watch-score",
}: HalfStarRatingInputProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Rating"
      className="flex items-center gap-0.5"
      id={id}
    >
      {STEPS.map((step) => {
        const filled = value !== null && step <= value;
        const halfOnly = value !== null && step - 0.5 === value;
        const label = `${step} stars`;

        return (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={value === step}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onChange(step)}
            className={cn(
              "relative h-8 w-4 text-xl leading-none transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-primary",
              filled || halfOnly ? "text-primary" : "text-muted-foreground/40",
            )}
          >
            <span className="absolute inset-y-0 left-0 w-2 overflow-hidden">
              {filled || halfOnly ? "★" : "☆"}
            </span>
            <span className="absolute inset-y-0 right-0 w-2 overflow-hidden text-right">
              {filled ? "★" : "☆"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
