import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultsView } from "@/components/results-view";
import type { RecommendationResponse } from "@/types/api";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    "aria-label": ariaLabel,
  }: {
    children?: React.ReactNode;
    href: string;
    "aria-label"?: string;
  }) => (
    <a href={href} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/film-poster", () => ({
  FilmPoster: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

const recommendation: RecommendationResponse = {
  session_id: "session-1",
  profile_id: "profile-1",
  profile_cache_hit: false,
  constraint_relaxation: null,
  created_at: "2024-01-01T00:00:00Z",
  winner: {
    film_id: "winner-1",
    title: "Winner Film",
    year: 1999,
    runtime: 110,
    director: "Director One",
    synopsis: "A haunting tale of isolation.",
    letterboxd_rating: 4.1,
    tmdb_rating: 7.8,
    rotten_tomatoes_score: 92,
    poster_url: null,
    explanation: {
      why_it_matches: "Matches your slow-burn horror preferences.",
      most_influential_factors: ["theme fit", "pacing"],
      why_it_beat_alternatives: "Stronger emotional alignment than runners-up.",
      caveats: "Runtime is at the upper end of your preference.",
    },
  },
  runners_up: [
    {
      film_id: "runner-1",
      title: "Runner Film",
      year: 2001,
      runtime: 95,
      director: "Director Two",
      synopsis: "Should not appear on runner-up card.",
      letterboxd_rating: 3.9,
      tmdb_rating: 6.5,
      rotten_tomatoes_score: 80,
      poster_url: null,
      explanation: {
        why_it_matches: "Solid alternative with overlapping themes.",
        most_influential_factors: ["semantic fit"],
        why_it_beat_alternatives: null,
        caveats: null,
      },
    },
  ],
};

describe("ResultsView", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders TMDB and RT scores without Letterboxd and links cards to watchlist detail", () => {
    render(<ResultsView data={recommendation} showActions={false} />);

    expect(screen.getByText("TMDB: 7.8")).toBeInTheDocument();
    expect(screen.getByText("RT: 92%")).toBeInTheDocument();
    expect(screen.getByText("TMDB: 6.5")).toBeInTheDocument();
    expect(screen.getByText("RT: 80%")).toBeInTheDocument();
    expect(screen.queryByText(/LBX:/i)).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: /view winner film \(1999\) in watchlist/i })).toHaveAttribute(
      "href",
      "/watchlist/winner-1",
    );
    expect(screen.getByRole("link", { name: /view runner film \(2001\) in watchlist/i })).toHaveAttribute(
      "href",
      "/watchlist/runner-1",
    );
  });

  it("shows synopsis and winner-only explanation sections on the top pick card", () => {
    render(<ResultsView data={recommendation} showActions={false} />);

    expect(screen.getByText("Synopsis")).toBeInTheDocument();
    expect(screen.getByText("A haunting tale of isolation.")).toBeInTheDocument();
    expect(screen.getByText("Why it beat alternatives")).toBeInTheDocument();
    expect(screen.getByText("Caveats")).toBeInTheDocument();

    const winnerLink = screen.getByRole("link", {
      name: /view winner film \(1999\) in watchlist/i,
    });
    expect(winnerLink).not.toHaveTextContent("Synopsis");
    expect(winnerLink).not.toHaveTextContent("A haunting tale of isolation.");

    expect(
      screen.queryByText("Should not appear on runner-up card."),
    ).not.toBeInTheDocument();
  });
});
