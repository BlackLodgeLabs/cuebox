import { cueboxEase, readCssNumber, REDUCED_FADE_MS } from "@/lib/motion";

export type TickFill = 0 | 0.5 | 1;

export type TasteTickMotion = {
  perTickMs: number;
  fillMs: number;
  rowDelayMs: number;
  ease: typeof cueboxEase | "linear";
  glow: false;
  triggerRatio: number;
  fadeTogether: boolean;
};

/** Locked taste-tick motion (design pack §6.3). Glow stays off. */
export function tasteTickMotion(reduced: boolean): TasteTickMotion {
  if (reduced) {
    return {
      perTickMs: 0,
      fillMs: REDUCED_FADE_MS,
      rowDelayMs: 0,
      ease: "linear",
      glow: false,
      triggerRatio: 0,
      fadeTogether: true,
    };
  }

  return {
    perTickMs: readCssNumber("--cb-tick-stagger", 70),
    fillMs: readCssNumber("--cb-tick-fill", 330),
    rowDelayMs: readCssNumber("--cb-tick-row-delay", 90),
    ease: cueboxEase,
    glow: false,
    triggerRatio: readCssNumber("--cb-tick-trigger", 0.4),
    fadeTogether: false,
  };
}

/**
 * Ten ticks. A remainder of at least 1 fills the tick; at least 0.45 fills half.
 * 6.5 is six full ticks and one half tick.
 */
export function tickFills(score: number): TickFill[] {
  const clamped = Math.min(10, Math.max(0, score));
  return Array.from({ length: 10 }, (_, index) => {
    const remain = clamped - index;
    if (remain >= 1) return 1;
    if (remain >= 0.45) return 0.5;
    return 0;
  });
}

export function formatTasteScore(score: number): string {
  return `${score.toFixed(1)} / 10`;
}
