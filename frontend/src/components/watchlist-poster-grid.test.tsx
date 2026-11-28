import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WatchlistPosterGrid } from "@/components/watchlist-poster-grid";
import type { FilmSummary } from "@/types/api";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const baseFilm: FilmSummary = {
  id: "film-1",
  title: "The Witch",
  year: 2015,
  letterboxd_uri: "https://letterboxd.com/film/the-witch/",
  status: "active",
  enrichment_status: "ready",
  poster_url: null,
  director: null,
  runtime: 92,
  genres: ["Horror"],
  backdrop_url: null,
  latest_score: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

function films(count: number): FilmSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    ...baseFilm,
    id: `film-${index}`,
    title: `Film ${index}`,
  }));
}

describe("WatchlistPosterGrid", () => {
  afterEach(() => {
    cleanup();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("shows a poster, the title, and year · runtime in a 3-column grid", () => {
    render(<WatchlistPosterGrid films={[baseFilm]} tab="active" />);

    const grid = screen.getByTestId("watchlist-poster-grid");
    expect(grid.className).toContain("grid-cols-3");
    expect(screen.getByText("The Witch")).toBeInTheDocument();
    expect(screen.getByText("2015 · 92m")).toBeInTheDocument();
    expect(screen.getByText("NO POSTER")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Actions for/i })).not.toBeInTheDocument();
  });

  it("omits a missing year or runtime instead of leaving a dangling separator", () => {
    const { rerender } = render(
      <WatchlistPosterGrid films={[{ ...baseFilm, runtime: null }]} tab="active" />,
    );
    expect(screen.getByText("2015")).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();

    rerender(
      <WatchlistPosterGrid films={[{ ...baseFilm, year: null }]} tab="active" />,
    );
    expect(screen.getByText("92m")).toBeInTheDocument();

    rerender(
      <WatchlistPosterGrid
        films={[{ ...baseFilm, year: null, runtime: null }]}
        tab="active"
      />,
    );
    expect(screen.queryByText("2015")).not.toBeInTheDocument();
    expect(screen.queryByText("92m")).not.toBeInTheDocument();
  });

  it("links the card to the film, keeping the current view", () => {
    render(<WatchlistPosterGrid films={[baseFilm]} tab="watched" />);
    expect(screen.getByRole("link", { name: /The Witch/ })).toHaveAttribute(
      "href",
      "/watchlist/film-1?tab=watched",
    );
  });

  it("shows an amber score badge only for rated films on the Watched view", () => {
    render(
      <WatchlistPosterGrid
        films={[
          { ...baseFilm, id: "rated", title: "Blade Runner", latest_score: 4.5, latest_watched_at: null },
          { ...baseFilm, id: "whole", title: "Seven Samurai", latest_score: 4 },
          { ...baseFilm, id: "bare", title: "Sid and Nancy", latest_score: null },
        ]}
        tab="watched"
      />,
    );

    const badges = screen.getAllByTestId("watchlist-rating-badge");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent("4.5");
    expect(badges[1]).toHaveTextContent("4");
    expect(badges[0].textContent).not.toMatch(/Sid and Nancy/);
    expect(badges[0].querySelector(".text-cb-accent")?.textContent).toBe("star");
    expect(screen.getByText("Sid and Nancy")).toBeInTheDocument();
  });

  it("hides a score on Unwatched and Archived", () => {
    const rated = { ...baseFilm, latest_score: 5 };
    const { rerender } = render(<WatchlistPosterGrid films={[rated]} tab="active" />);
    expect(screen.queryByTestId("watchlist-rating-badge")).not.toBeInTheDocument();

    rerender(<WatchlistPosterGrid films={[rated]} tab="archived" />);
    expect(screen.queryByTestId("watchlist-rating-badge")).not.toBeInTheDocument();
  });

  it("fades films after the first 18, staggered 30ms", () => {
    render(<WatchlistPosterGrid films={films(20)} tab="active" />);

    expect(screen.getByText("Film 0").closest("[data-cb-batch]")).toBeNull();
    const firstNew = screen.getByText("Film 18").closest("[data-cb-batch]");
    const secondNew = screen.getByText("Film 19").closest("[data-cb-batch]");
    expect(firstNew).toHaveAttribute("data-fade-ms", "300");
    expect(firstNew).toHaveAttribute("data-stagger-ms", "0");
    expect(secondNew).toHaveAttribute("data-fade-ms", "300");
    expect(secondNew).toHaveAttribute("data-stagger-ms", "30");
  });

  it("fades a new batch together when motion is reduced", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query.includes("prefers-reduced-motion");
      },
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));

    render(<WatchlistPosterGrid films={films(20)} tab="active" />);

    const secondNew = screen.getByText("Film 19").closest("[data-cb-batch]");
    expect(secondNew).toHaveAttribute("data-fade-ms", "300");
    await waitFor(() => {
      expect(secondNew).toHaveAttribute("data-stagger-ms", "0");
    });
  });
});
