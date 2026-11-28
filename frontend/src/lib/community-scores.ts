export type CommunityScoreSource = "tmdb" | "rt";

export interface CommunityScore {
  source: CommunityScoreSource;
  label: "TMDB" | "RT";
  percent: number;
}

/**
 * Catalogue scores for the film hero.
 * TMDB is stored as a 0–10 vote average and shown as a whole percent.
 * Rotten Tomatoes is already a percent and is omitted when OMDb has none.
 * Letterboxd is never a community score on this screen.
 */
export function communityScores(
  metadata: {
    tmdb_rating: number | null;
    rotten_tomatoes_score: number | null;
    letterboxd_rating?: number | null;
  } | null,
): CommunityScore[] {
  if (!metadata) return [];

  const scores: CommunityScore[] = [];
  if (metadata.tmdb_rating != null && Number.isFinite(metadata.tmdb_rating)) {
    scores.push({
      source: "tmdb",
      label: "TMDB",
      percent: Math.round(metadata.tmdb_rating * 10),
    });
  }
  if (
    metadata.rotten_tomatoes_score != null &&
    Number.isFinite(metadata.rotten_tomatoes_score)
  ) {
    scores.push({
      source: "rt",
      label: "RT",
      percent: Math.round(metadata.rotten_tomatoes_score),
    });
  }
  return scores;
}
