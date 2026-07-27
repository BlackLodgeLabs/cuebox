import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilmDetailView } from "@/components/film-detail-view";
import type { FilmDetail, FilmMetadataBlock } from "@/types/api";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt} />;
  },
}));

vi.mock("@/components/edit-film-match-dialog", () => ({
  EditFilmMatchDialog: () => null,
}));

vi.mock("@/components/where-to-watch-section", () => ({
  WhereToWatchSection: () => (
    <div data-testid="where-to-watch">Where to Watch</div>
  ),
}));

vi.mock("@/components/watch-review-dialog", () => ({
  WatchReviewDialog: () => null,
  watchToDialogProps: () => ({}),
}));

const metadata: FilmMetadataBlock = {
  tmdb_id: 76203,
  imdb_id: "tt2024544",
  original_title: "12 Years a Slave",
  runtime: 134,
  synopsis: "In the antebellum United States…",
  genres: ["Drama", "History"],
  keywords: ["slavery"],
  original_language: "en",
  country: "US",
  director: "Steve McQueen",
  tmdb_rating: 7.9,
  rotten_tomatoes_score: 95,
  letterboxd_rating: 4.2,
  poster_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
  backdrop_url: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
  match_confidence: 1,
  metadata_source: "tmdb",
};

const readyFilm: FilmDetail = {
  id: "film-1",
  title: "12 Years a Slave",
  year: 2013,
  letterboxd_uri: "https://boxd.it/2D2e",
  status: "active",
  enrichment_status: "ready",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  metadata,
  semantic_profile: {
    subgenres: ["historical drama"],
    themes: ["freedom"],
    tones: ["somber"],
    visual_descriptors: [],
    emotional_outcomes: [],
    viewing_contexts: [],
    complexity: 8,
    pacing: 5,
    energy: 4,
    obscurity: 2,
    semantic_summary: "A harrowing true story.",
    semantic_version: "1",
    generated_by_model: "test",
    generated_at: "2024-01-01T00:00:00Z",
  },
  watches: [],
};

const emptyFilm: FilmDetail = {
  ...readyFilm,
  enrichment_status: "pending",
  metadata: null,
  semantic_profile: null,
};

describe("FilmDetailView poster-led layout", () => {
  it("renders a dominant poster with title adjacent, not a backdrop hero", () => {
    const { container } = render(
      <FilmDetailView
        film={readyFilm}
        onStatusTransition={vi.fn()}
        onMarkWatched={vi.fn()}
      />,
    );

    expect(screen.getByAltText("12 Years a Slave")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /12 Years a Slave \(2013\)/i }),
    ).toBeInTheDocument();
    // No full-bleed backdrop Image as competing hero chrome
    expect(container.querySelector(".relative.-mx-4")).toBeNull();
    expect(container.querySelector("img[alt='']")).toBeNull();
  });

  it("shows NO POSTER when poster is missing", () => {
    render(
      <FilmDetailView
        film={{
          ...readyFilm,
          metadata: { ...metadata, poster_url: null },
        }}
      />,
    );
    expect(screen.getByText("NO POSTER")).toBeInTheDocument();
  });

  it.each([
    {
      name: "explicit watchlistTab wins",
      film: { ...readyFilm, status: "watched" as const },
      watchlistTab: "archived" as const,
      href: "/watchlist?tab=archived",
    },
    {
      name: "active status → /watchlist",
      film: { ...readyFilm, status: "active" as const },
      watchlistTab: undefined,
      href: "/watchlist",
    },
    {
      name: "watched status → watched tab",
      film: { ...readyFilm, status: "watched" as const },
      watchlistTab: undefined,
      href: "/watchlist?tab=watched",
    },
    {
      name: "pending_watch_review → watched tab",
      film: { ...readyFilm, status: "pending_watch_review" as const },
      watchlistTab: undefined,
      href: "/watchlist?tab=watched",
    },
    {
      name: "archived status → archived tab",
      film: { ...readyFilm, status: "archived" as const },
      watchlistTab: undefined,
      href: "/watchlist?tab=archived",
    },
  ])("back link: $name", ({ film, watchlistTab, href }) => {
    render(<FilmDetailView film={film} watchlistTab={watchlistTab} />);
    expect(screen.getByRole("link", { name: /watchlist/i })).toHaveAttribute(
      "href",
      href,
    );
  });

  it("renders detail status actions with ≥44px hit targets for active films", () => {
    render(
      <FilmDetailView
        film={readyFilm}
        onStatusTransition={vi.fn()}
        onMarkWatched={vi.fn()}
      />,
    );

    const markWatched = screen.getByRole("button", { name: /mark watched/i });
    const archive = screen.getByRole("button", { name: /^archive$/i });
    const editMatch = screen.getByRole("button", { name: /edit film match/i });

    expect(markWatched.className).toMatch(/min-h-11|h-11/);
    expect(archive.className).toMatch(/min-h-11|h-11/);
    expect(editMatch.className).toMatch(/min-h-11|h-11/);
  });

  it("exposes Letterboxd, TMDB, and IMDb links when IDs exist", () => {
    render(<FilmDetailView film={readyFilm} />);

    expect(
      screen.getByRole("link", { name: /view on letterboxd/i }),
    ).toHaveAttribute("href", "https://boxd.it/2D2e");
    expect(screen.getByRole("link", { name: /view on tmdb/i })).toHaveAttribute(
      "href",
      "https://www.themoviedb.org/movie/76203",
    );
    expect(screen.getByRole("link", { name: /view on imdb/i })).toHaveAttribute(
      "href",
      "https://www.imdb.com/title/tt2024544",
    );
  });

  it("mounts where-to-watch section", () => {
    render(<FilmDetailView film={readyFilm} />);
    expect(screen.getByTestId("where-to-watch")).toBeInTheDocument();
  });

  it("degrades enrichment-empty without a broken empty card shell", () => {
    const { container } = render(<FilmDetailView film={emptyFilm} />);

    expect(screen.getByText(/enrichment data is not available yet/i)).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    // Plain status line — no Card chrome wrapping the empty message
    const emptyCopy = screen.getByText(/enrichment data is not available yet/i);
    expect(emptyCopy.closest("[class*='rounded']")).toBeNull();
    expect(container.querySelector(".py-8.text-center")).toBeNull();
    expect(screen.queryByRole("heading", { name: /overview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /semantic profile/i })).not.toBeInTheDocument();
    // Letterboxd still available
    expect(
      screen.getByRole("link", { name: /view on letterboxd/i }),
    ).toBeInTheDocument();
  });
});
