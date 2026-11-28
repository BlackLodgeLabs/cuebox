/**
 * Home arrival, option E. Wall-clock values from the design pack §6.1.
 * The logo unfold plays at 0.85× (1730ms → 2035ms, lock 1610ms → 1894ms).
 */

export const HOME_ARRIVAL = {
  logoScale: 0.85,
  logoWallMs: 2035,
  wordmarkLockMs: 1894,
  beatMs: 80,
  irisStartMs: 1974,
  irisDurationMs: 760,
  irisEase: [0.42, 0, 0.58, 1] as const,
  softEdgeFromPx: 1.25,
  softEdgeToPx: 12,
  wordmarkFadeDelayMs: 80,
  wordmarkFadeMs: 600,
  chromeStartMs: 2674,
  restStartMs: 2734,
  restRisePx: 6,
  restStaggerMs: 70,
  restDurationMs: 300,
};

export function irisProgress(elapsedMs: number): number {
  const start = HOME_ARRIVAL.irisStartMs;
  const duration = HOME_ARRIVAL.irisDurationMs;
  if (elapsedMs <= start) return 0;
  if (elapsedMs >= start + duration) return 1;
  const progress = (elapsedMs - start) / duration;
  return progress * progress * (3 - 2 * progress);
}

/** Tester ease-out: a cubic stand-in for cubic-bezier(0.16, 1, 0.3, 1). */
export function easeOutUnit(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return 1 - (1 - clamped) ** 3;
}

function easedSpan(elapsedMs: number, start: number, duration: number): number {
  if (elapsedMs <= start) return 0;
  if (elapsedMs >= start + duration) return 1;
  return easeOutUnit((elapsedMs - start) / duration);
}

export function splashWordmarkOpacity(elapsedMs: number): number {
  const start = HOME_ARRIVAL.irisStartMs + HOME_ARRIVAL.wordmarkFadeDelayMs;
  return 1 - easedSpan(elapsedMs, start, HOME_ARRIVAL.wordmarkFadeMs);
}

/** The full stop clears in the first 80ms of the iris so the still can show through. */
export function splashStopOpacity(elapsedMs: number): number {
  return 1 - easedSpan(elapsedMs, HOME_ARRIVAL.irisStartMs, HOME_ARRIVAL.beatMs);
}

/** Hole radius grows from the full stop, not from a point. */
export function irisRadiusPx(
  elapsedMs: number,
  stopRadiusPx: number,
  farRadiusPx: number,
): number {
  return stopRadiusPx + (farRadiusPx - stopRadiusPx) * irisProgress(elapsedMs);
}

export function arrivalDelayMs(slot: "title" | "rest", index = 0): number {
  const start = slot === "title" ? HOME_ARRIVAL.chromeStartMs : HOME_ARRIVAL.restStartMs;
  return start + index * HOME_ARRIVAL.restStaggerMs;
}

export function irisSoftEdgePx(elapsedMs: number): number {
  const progress = irisProgress(elapsedMs);
  return (
    HOME_ARRIVAL.softEdgeFromPx +
    (HOME_ARRIVAL.softEdgeToPx - HOME_ARRIVAL.softEdgeFromPx) * progress
  );
}
