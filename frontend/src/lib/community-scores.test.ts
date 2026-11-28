import { describe, expect, it } from "vitest";
import { communityScores } from "@/lib/community-scores";

describe("communityScores", () => {
  it("shows TMDB as a rounded percentage and Rotten Tomatoes as stored", () => {
    expect(
      communityScores({
        tmdb_rating: 8.24,
        rotten_tomatoes_score: 90,
      }),
    ).toEqual([
      { source: "tmdb", label: "TMDB", percent: 82 },
      { source: "rt", label: "RT", percent: 90 },
    ]);
  });

  it("hides Rotten Tomatoes when OMDb has no score", () => {
    expect(
      communityScores({
        tmdb_rating: 7.5,
        rotten_tomatoes_score: null,
      }),
    ).toEqual([{ source: "tmdb", label: "TMDB", percent: 75 }]);
  });

  it("does not include a Letterboxd score even when one is stored", () => {
    const scores = communityScores({
      tmdb_rating: 7.5,
      rotten_tomatoes_score: 90,
      letterboxd_rating: 4.2,
    });

    expect(scores.map((score) => score.source)).toEqual(["tmdb", "rt"]);
    expect(scores.map((score) => score.percent)).toEqual([75, 90]);
    expect(JSON.stringify(scores)).not.toContain("letterboxd");
  });

  it("returns nothing when metadata is missing", () => {
    expect(communityScores(null)).toEqual([]);
  });
});
