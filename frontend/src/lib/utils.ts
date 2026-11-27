import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const CB_FONT_SIZES = [
  "cb-display",
  "cb-title",
  "cb-page",
  "cb-section",
  "cb-card",
  "cb-tile",
  "cb-body",
  "cb-ui",
  "cb-caption",
  "cb-tab",
  "cb-meta",
  "cb-meta-sm",
];

const CB_COLORS = [
  "cb-bg",
  "cb-surface",
  "cb-text",
  "cb-muted",
  "cb-accent",
  "cb-teal",
  "cb-divider",
  "cb-ink",
  "cb-danger",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: CB_FONT_SIZES }],
      "text-color": [{ text: CB_COLORS }],
      "bg-color": [{ bg: CB_COLORS }],
      "border-color": [{ border: CB_COLORS }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
