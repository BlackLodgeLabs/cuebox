"use client";

import { Badge } from "@/components/ui/badge";
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
              className="focus:outline-none"
            >
              <Badge
                variant={selected ? "default" : "outline"}
                className={cn(
                  "cursor-pointer px-3 py-1 text-sm",
                  selected && "bg-primary text-primary-foreground",
                )}
              >
                {option}
              </Badge>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
