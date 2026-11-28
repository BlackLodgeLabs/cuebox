"use client";

import { toggleMultiSelect } from "@/lib/questionnaire-vocabulary";
import { cn } from "@/lib/utils";

interface MultiSelectChipsProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

export function MultiSelectChips({
  options,
  value,
  onChange,
  error,
}: MultiSelectChipsProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(toggleMultiSelect(value, option))}
              className={cn(
                "inline-flex min-h-11 items-center rounded-cb border px-3 py-2 font-ui text-cb-caption transition-colors motion-reduce:transition-none",
                selected
                  ? "border-cb-teal bg-cb-surface text-cb-teal"
                  : "border-cb-divider bg-cb-surface text-cb-muted hover:border-cb-muted",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {error && <p className="text-body-md text-destructive">{error}</p>}
    </div>
  );
}
