import { describe, expect, it } from "vitest";
import { closeToThisFilms } from "@/lib/close-to-this";
import type { SimilarFilm } from "@/types/api";

function film(status: SimilarFilm["status"], title: string): SimilarFilm {
  return {
    id: title,
    title,
    year: 2015,
    letterboxd_uri: "https://boxd.it/x",
    status,
    enrichment_status: "ready",
    poster_url: null,
    director: null,
    runtime: 92,
    genres: [],
    backdrop_url: null,
    latest_score: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    semantic_line: "A line.",
  };
}

describe("closeToThisFilms", () => {
  it("keeps only unwatched watchlist films", () => {
    const films = [
      film("active", "The Witch"),
      film("watched", "Lamb"),
      film("archived", "Midsommar"),
      film("pending_watch_review", "Hereditary"),
    ];

    expect(closeToThisFilms(films, true).map((item) => item.title)).toEqual([
      "The Witch",
    ]);
  });

  it("is empty when the film is not on the watchlist", () => {
    expect(closeToThisFilms([film("active", "The Witch")], false)).toEqual([]);
  });
});
