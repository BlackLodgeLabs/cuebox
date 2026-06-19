import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultsView } from "@/components/results-view";
import type { RecommendationResponse } from "@/types/api";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
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

    expect(screen.getByRole("link", { name: /winner film/i })).toHaveAttribute(
      "href",
      "/watchlist/winner-1",
    );
    expect(screen.getByRole("link", { name: /runner film/i })).toHaveAttribute(
      "href",
      "/watchlist/runner-1",
    );
  });

  it("shows synopsis and winner-only explanation sections on the top pick card", () => {
    render(<ResultsView data={recommendation} showActions={false} />);

    const winnerLink = screen.getByRole("link", { name: /winner film/i });
    expect(winnerLink).toHaveTextContent("Synopsis");
    expect(winnerLink).toHaveTextContent("A haunting tale of isolation.");
    expect(winnerLink).toHaveTextContent("Why it beat alternatives");
    expect(winnerLink).toHaveTextContent("Caveats");

    const runnerLink = screen.getByRole("link", { name: /runner film/i });
    expect(runnerLink).not.toHaveTextContent("Should not appear on runner-up card.");
    expect(runnerLink).not.toHaveTextContent("Synopsis");
  });
});
