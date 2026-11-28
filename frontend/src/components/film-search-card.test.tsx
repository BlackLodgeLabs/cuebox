import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilmSearchCard } from "@/components/film-search-card";
import { Toaster } from "@/components/ui/sonner";
import { createQueryWrapper } from "@/test/query-wrapper";
import type { FilmSummary, TmdbSearchResultItem } from "@/types/api";

const { getFilmsMock, searchTmdbGlobalMock, addToWatchlistMock, pushMock } = vi.hoisted(
  () => ({
    getFilmsMock: vi.fn(),
    searchTmdbGlobalMock: vi.fn(),
    addToWatchlistMock: vi.fn(),
    pushMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api-client", () => ({
  getFilms: getFilmsMock,
  searchTmdbGlobal: searchTmdbGlobalMock,
  addToWatchlist: addToWatchlistMock,
}));

const wicker: FilmSummary = {
  id: "film-wicker",
  title: "The Wicker Man",
  year: 1973,
  letterboxd_uri: "https://letterboxd.com/film/the-wicker-man/",
  status: "active",
  enrichment_status: "ready",
  tmdb_id: 11453,
  poster_url: null,
  director: "Robin Hardy",
  runtime: 88,
  genres: ["Horror"],
  backdrop_url: null,
  latest_score: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const matrix: TmdbSearchResultItem = {
  tmdb_id: 603,
  title: "The Matrix",
  original_title: "The Matrix",
  year: 1999,
  overview: "A hacker learns the truth.",
  poster_url: null,
};

function renderCard() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <Toaster />
      <FilmSearchCard open onOpenChange={vi.fn()} />
    </Wrapper>,
  );
}

describe("FilmSearchCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks for a title before it searches", () => {
    renderCard();

    expect(
      screen.getByText("Search your watchlist and other films"),
    ).toBeInTheDocument();
    expect(getFilmsMock).not.toHaveBeenCalled();
    expect(searchTmdbGlobalMock).not.toHaveBeenCalled();
  });

  it("groups watchlist hits above catalogue hits and drops duplicates", async () => {
    getFilmsMock.mockResolvedValue({
      data: [wicker],
      pagination: { total: 1, limit: 20, offset: 0, has_more: false },
    });
    searchTmdbGlobalMock.mockResolvedValue({
      data: [
        {
          tmdb_id: 11453,
          title: "The Wicker Man",
          original_title: "The Wicker Man",
          year: 1973,
          overview: "Duplicate",
          poster_url: null,
        },
        matrix,
      ],
      pagination: { total: 2, limit: 20, offset: 0, has_more: false },
    });

    renderCard();
    await userEvent.type(screen.getByRole("combobox", { name: "Search films" }), "the");

    await waitFor(() => {
      expect(screen.getByText("On your watchlist")).toBeInTheDocument();
    });
    expect(screen.getByText("Not on your watchlist")).toBeInTheDocument();
    expect(screen.getByText("1973 · 88m")).toBeInTheDocument();
    expect(screen.getByText("1999")).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("The Wicker Man");
    expect(options[1]).toHaveTextContent("The Matrix");
    expect(screen.getByRole("button", { name: "Open The Wicker Man" })).toHaveClass(
      "min-h-12",
    );
    expect(
      screen.getByRole("button", { name: "Add The Matrix to watchlist" }),
    ).toHaveClass("min-h-12");
    expect(screen.queryByRole("button", { name: /mark watched/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add & mark watched" })).not.toBeInTheDocument();
  });

  it("opens a watchlist hit on its film page, including the eye", async () => {
    getFilmsMock.mockResolvedValue({
      data: [wicker],
      pagination: { total: 1, limit: 20, offset: 0, has_more: false },
    });
    searchTmdbGlobalMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 20, offset: 0, has_more: false },
    });

    renderCard();
    await userEvent.type(screen.getByRole("combobox", { name: "Search films" }), "wicker");
    await screen.findByRole("option", { name: /The Wicker Man/ });

    await userEvent.click(screen.getByRole("button", { name: "Open The Wicker Man" }));
    expect(pushMock).toHaveBeenCalledWith("/watchlist/film-wicker");
  });

  it("opens a catalogue hit on the lighter film page", async () => {
    getFilmsMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 20, offset: 0, has_more: false },
    });
    searchTmdbGlobalMock.mockResolvedValue({
      data: [matrix],
      pagination: { total: 1, limit: 20, offset: 0, has_more: false },
    });

    renderCard();
    await userEvent.type(screen.getByRole("combobox", { name: "Search films" }), "matrix");
    const option = await screen.findByRole("option", { name: /The Matrix/ });
    await userEvent.click(option);

    expect(pushMock).toHaveBeenCalledWith("/films/tmdb/603");
  });

  it("adds a catalogue hit and shows Added to watchlist for 2800ms", async () => {
    getFilmsMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 20, offset: 0, has_more: false },
    });
    searchTmdbGlobalMock.mockResolvedValue({
      data: [matrix],
      pagination: { total: 1, limit: 20, offset: 0, has_more: false },
    });
    addToWatchlistMock.mockResolvedValue({
      film_id: "film-matrix",
      enrichment_status: "enriching",
    });

    renderCard();
    await userEvent.type(screen.getByRole("combobox", { name: "Search films" }), "matrix");
    await screen.findByRole("option", { name: /The Matrix/ });
    await userEvent.click(
      screen.getByRole("button", { name: "Add The Matrix to watchlist" }),
    );

    expect(await screen.findByText("Added to watchlist")).toBeInTheDocument();
    const toaster = document.querySelector("[data-sonner-toaster]");
    expect(toaster?.textContent).toContain("The Matrix");
    expect(toaster?.getAttribute("style") ?? "").toContain("--cb-toast-stay: 2800ms");
    expect(addToWatchlistMock.mock.calls[0]?.[0]).toEqual({ tmdb_id: 603 });
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: /The Matrix/ })).toHaveAttribute(
      "data-added",
      "true",
    );
  });

  it("says when nothing matches", async () => {
    getFilmsMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 20, offset: 0, has_more: false },
    });
    searchTmdbGlobalMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 20, offset: 0, has_more: false },
    });

    renderCard();
    await userEvent.type(screen.getByRole("combobox", { name: "Search films" }), "zzzz");

    expect(await screen.findByText('No films match "zzzz".')).toBeInTheDocument();
  });
});
