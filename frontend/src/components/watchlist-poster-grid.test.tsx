import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
    "aria-label"?: string;
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

describe("WatchlistPosterGrid", () => {
  it("renders poster + title only without year/enrichment/date metadata", () => {
    const { container } = render(
      <WatchlistPosterGrid
        films={[baseFilm]}
        tab="active"
        onStatusTransition={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Film")).toBeInTheDocument();
    expect(screen.getByText("NO POSTER")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/1999/);
    expect(container.textContent).not.toMatch(/Ready/i);
    expect(container.textContent).not.toMatch(/2024-01-01/);
    expect(container.textContent).not.toMatch(/Added/i);
  });

  it("links poster and title to film detail with tab", () => {
    render(
      <WatchlistPosterGrid
        films={[baseFilm]}
        tab="watched"
        onStatusTransition={vi.fn()}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links.some((link) => link.getAttribute("href") === "/watchlist/film-1?tab=watched")).toBe(
      true,
    );
  });

  it("opens ⋯ menu with Mark watched / Archive for active films", async () => {
    const user = userEvent.setup();
    const onMarkWatched = vi.fn();

    render(
      <WatchlistPosterGrid
        films={[baseFilm]}
        tab="active"
        onStatusTransition={vi.fn()}
        onMarkWatched={onMarkWatched}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Actions for Test Film/i });
    expect(trigger.className).toMatch(/min-h-\[44px]/);
    expect(trigger.className).toMatch(/min-w-\[44px]/);

    await user.click(trigger);
    expect(await screen.findByRole("menuitem", { name: /Mark watched/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Archive$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Mark watched/i }));
    expect(onMarkWatched).toHaveBeenCalledWith(baseFilm);
  });

  it("shows Return to watchlist for watched films and Re-enable for archived", async () => {
    const user = userEvent.setup();
    const onStatusTransition = vi.fn();

    const { rerender } = render(
      <WatchlistPosterGrid
        films={[{ ...baseFilm, status: "watched" }]}
        tab="watched"
        onStatusTransition={onStatusTransition}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Actions for Test Film/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Return to watchlist/i }));
    expect(onStatusTransition).toHaveBeenCalledWith("film-1", "active");

    rerender(
      <WatchlistPosterGrid
        films={[{ ...baseFilm, status: "archived" }]}
        tab="archived"
        onStatusTransition={onStatusTransition}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Actions for Test Film/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Re-enable on watchlist/i }));
    expect(onStatusTransition).toHaveBeenCalledWith("film-1", "active");
  });

  it("does not navigate when ⋯ is clicked", () => {
    render(
      <WatchlistPosterGrid
        films={[baseFilm]}
        tab="active"
        onStatusTransition={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Actions for Test Film/i });
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    const preventSpy = vi.spyOn(clickEvent, "preventDefault");
    const stopSpy = vi.spyOn(clickEvent, "stopPropagation");
    fireEvent(trigger, clickEvent);
    expect(preventSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
  });

  it("keeps grid list role and per-film title link", () => {
    render(
      <WatchlistPosterGrid
        films={[baseFilm]}
        tab="active"
        onStatusTransition={vi.fn()}
      />,
    );

    const grid = screen.getByTestId("watchlist-poster-grid");
    expect(within(grid).getByText("Test Film")).toBeInTheDocument();
  });
});
