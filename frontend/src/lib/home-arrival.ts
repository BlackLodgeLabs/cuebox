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

export function splashWordmarkOpacity(elapsedMs: number): number {
  const start = HOME_ARRIVAL.irisStartMs + HOME_ARRIVAL.wordmarkFadeDelayMs;
  const duration = HOME_ARRIVAL.wordmarkFadeMs;
  if (elapsedMs <= start) return 1;
  if (elapsedMs >= start + duration) return 0;
  return 1 - (elapsedMs - start) / duration;
}

export function irisSoftEdgePx(elapsedMs: number): number {
  const progress = irisProgress(elapsedMs);
  return (
    HOME_ARRIVAL.softEdgeFromPx +
    (HOME_ARRIVAL.softEdgeToPx - HOME_ARRIVAL.softEdgeFromPx) * progress
  );
}
