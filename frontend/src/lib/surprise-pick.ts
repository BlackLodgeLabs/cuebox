/** Random watchlist slot that is not the film already showing, when another exists. */

export function surpriseOffset(
  total: number,
  avoid: number,
  random: () => number = Math.random,
): number {
  if (total <= 1) return 0;
  const span = total - 1;
  const pick = Math.min(span - 1, Math.max(0, Math.floor(random() * span)));
  return pick >= avoid ? pick + 1 : pick;
}
