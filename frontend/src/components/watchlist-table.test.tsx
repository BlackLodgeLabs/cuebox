import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WatchlistTable } from "@/components/watchlist-table";
import type { FilmSummary } from "@/types/api";

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

const film: FilmSummary = {
  id: "film-1",
  title: "Test Film",
  year: 1999,
  letterboxd_uri: "https://letterboxd.com/film/test/",
  status: "active",
  enrichment_status: "ready",
  poster_url: null,
  director: null,
  runtime: null,
  genres: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("WatchlistTable", () => {
  it("renders films and calls onSort when a header is clicked", () => {
    const onSort = vi.fn();

    render(
      <WatchlistTable
        films={[film]}
        tab="active"
        sort="created_at"
        sortDir="desc"
        onSort={onSort}
        onStatusTransition={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("link", { name: "Test Film" })[0]).toHaveAttribute(
      "href",
      "/watchlist/film-1?tab=active",
    );

    fireEvent.click(screen.getByRole("button", { name: /title/i }));
    expect(onSort).toHaveBeenCalledWith("title");
  });

  it("shows Watched column on watched tab and wires status actions", () => {
    const onStatusTransition = vi.fn();
    const watchedFilm: FilmSummary = {
      ...film,
      status: "watched",
      removed_at: "2024-06-01T00:00:00Z",
      latest_watched_at: "2024-06-01",
    };

    render(
      <WatchlistTable
        films={[watchedFilm]}
        tab="watched"
        sort="created_at"
        sortDir="desc"
        onSort={vi.fn()}
        onStatusTransition={onStatusTransition}
      />,
    );

    expect(screen.getByRole("button", { name: /watched/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /return to watchlist/i }));
    expect(onStatusTransition).toHaveBeenCalledWith("film-1", "active");
  });
});
