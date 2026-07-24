import { describe, expect, it } from "vitest";
import {
  mergeLibraryAndTmdbResults,
  PICKER_LIBRARY_STATUSES,
  statusBadgeLabel,
} from "@/lib/library-search-merge";
import type { FilmSummary, TmdbSearchResultItem } from "@/types/api";

function makeFilm(overrides: Partial<FilmSummary> & Pick<FilmSummary, "id" | "title" | "status">): FilmSummary {
  return {
    year: 2000,
    letterboxd_uri: "https://letterboxd.com/film/test/",
    enrichment_status: "ready",
    tmdb_id: null,
    poster_url: null,
    director: null,
    runtime: null,
    genres: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTmdb(
  overrides: Partial<TmdbSearchResultItem> & Pick<TmdbSearchResultItem, "tmdb_id" | "title">,
): TmdbSearchResultItem {
  return {
    original_title: overrides.title,
    year: 1999,
    overview: null,
    poster_url: null,
    ...overrides,
  };
}

describe("mergeLibraryAndTmdbResults", () => {
  it("puts library hits first and drops TMDB duplicates by tmdb_id", () => {
    const local = makeFilm({
      id: "local-1",
      title: "The Matrix",
      status: "active",
      tmdb_id: 603,
    });
    const tmdbDup = makeTmdb({ tmdb_id: 603, title: "The Matrix" });
    const tmdbOnly = makeTmdb({ tmdb_id: 604, title: "The Matrix Reloaded" });

    const hits = mergeLibraryAndTmdbResults([local], [tmdbDup, tmdbOnly]);

    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ kind: "library", film: { id: "local-1" } });
    expect(hits[1]).toMatchObject({ kind: "tmdb", result: { tmdb_id: 604 } });
  });

  it("keeps TMDB hits when local film has no tmdb_id", () => {
    const local = makeFilm({
      id: "local-2",
      title: "Mystery",
      status: "watched",
      tmdb_id: null,
    });
    const tmdb = makeTmdb({ tmdb_id: 99, title: "Mystery" });

    const hits = mergeLibraryAndTmdbResults([local], [tmdb]);
    expect(hits).toHaveLength(2);
    expect(hits.every((hit) => hit.kind === "library" || hit.kind === "tmdb")).toBe(
      true,
    );
  });
});

describe("PICKER_LIBRARY_STATUSES", () => {
  it("never requests archived", () => {
    expect(PICKER_LIBRARY_STATUSES).toEqual([
      "active",
      "pending_watch_review",
      "watched",
    ]);
    expect(PICKER_LIBRARY_STATUSES).not.toContain("archived");
  });
});

describe("statusBadgeLabel", () => {
  it("labels known statuses", () => {
    expect(statusBadgeLabel("active")).toBe("On watchlist");
    expect(statusBadgeLabel("pending_watch_review")).toBe("Pending review");
    expect(statusBadgeLabel("watched")).toBe("Watched");
  });
});
