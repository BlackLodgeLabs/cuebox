import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibrarySearchPicker } from "@/components/library-search-picker";
import { createQueryWrapper } from "@/test/query-wrapper";
import type { FilmSummary } from "@/types/api";

const {
  getFilmsMock,
  searchTmdbGlobalMock,
  addToWatchlistMock,
  setFilmStatusMock,
  pushMock,
} = vi.hoisted(() => ({
  getFilmsMock: vi.fn(),
  searchTmdbGlobalMock: vi.fn(),
  addToWatchlistMock: vi.fn(),
  setFilmStatusMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/api-client", () => ({
  getFilms: getFilmsMock,
  searchTmdbGlobal: searchTmdbGlobalMock,
  addToWatchlist: addToWatchlistMock,
  setFilmStatus: setFilmStatusMock,
  getFilm: vi.fn(),
  completeWatchReview: vi.fn(),
  cancelWatchReview: vi.fn(),
  updateFilmWatch: vi.fn(),
  ApiClientError: class ApiClientError extends Error {
    code: string;
    details?: { field?: string; message?: string }[];
    constructor(error: { code: string; message: string; details?: { field?: string; message?: string }[] }) {
      super(error.message);
      this.code = error.code;
      this.details = error.details;
    }
  },
}));

function makeFilm(overrides: Partial<FilmSummary> & Pick<FilmSummary, "id" | "title" | "status">): FilmSummary {
  return {
    year: 2000,
    letterboxd_uri: "https://letterboxd.com/film/test/",
    enrichment_status: "ready",
    tmdb_id: 100,
    poster_url: null,
    director: null,
    runtime: null,
    genres: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("LibrarySearchPicker", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  it("shows helper copy and merges local over TMDB duplicate", async () => {
    getFilmsMock.mockResolvedValue({
      data: [
        makeFilm({
          id: "film-active",
          title: "The Wicker Man",
          year: 1973,
          status: "active",
          tmdb_id: 11453,
        }),
      ],
      pagination: { total: 1, limit: 20, offset: 0, has_more: false },
    });
    searchTmdbGlobalMock.mockResolvedValue({
      data: [
        {
          tmdb_id: 11453,
          title: "The Wicker Man",
          original_title: "The Wicker Man",
          year: 1973,
          overview: "A remote island.",
          poster_url: null,
        },
        {
          tmdb_id: 999,
          title: "Other Film",
          original_title: "Other Film",
          year: 2020,
          overview: null,
          poster_url: null,
        },
      ],
      pagination: { total: 2, limit: 20, offset: 0, has_more: false },
    });

    const { Wrapper } = createQueryWrapper();
    render(<LibrarySearchPicker intent="add" />, { wrapper: Wrapper });

    expect(
      screen.getByText(/Searches your library \(including watched films\) and TMDB/i),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Library and TMDB search"),
      "Wicker",
    );

    await waitFor(() => {
      expect(screen.getByText("The Wicker Man (1973)")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Mark watched" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/watchlist/film-active",
    );
    expect(screen.getByText("Other Film (2020)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to watchlist" })).toBeInTheDocument();
    // Duplicate TMDB row must not appear as a second Add for The Wicker Man
    expect(screen.getAllByText(/The Wicker Man/)).toHaveLength(1);

    expect(getFilmsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ["active", "pending_watch_review", "watched"],
        search: "Wicker",
      }),
    );
  });

  it("shows Complete review for pending_watch_review and View only for watched", async () => {
    getFilmsMock.mockResolvedValue({
      data: [
        makeFilm({
          id: "film-pending",
          title: "Pending Film",
          status: "pending_watch_review",
          tmdb_id: 1,
        }),
        makeFilm({
          id: "film-watched",
          title: "Watched Film",
          status: "watched",
          tmdb_id: 2,
        }),
      ],
      pagination: { total: 2, limit: 20, offset: 0, has_more: false },
    });
    searchTmdbGlobalMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 20, offset: 0, has_more: false },
    });

    const { Wrapper } = createQueryWrapper();
    render(<LibrarySearchPicker intent="mark-watched" />, { wrapper: Wrapper });

    await userEvent.type(
      screen.getByLabelText("Library and TMDB search"),
      "Film",
    );

    await waitFor(() => {
      expect(screen.getByText("Pending Film (2000)")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Complete review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark watched" })).not.toBeInTheDocument();
    const viewed = screen.getAllByRole("link", { name: "View" });
    expect(viewed).toHaveLength(2);
  });

  it("shows empty idle, no-results, and TMDB partial error states", async () => {
    getFilmsMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 20, offset: 0, has_more: false },
    });
    searchTmdbGlobalMock.mockRejectedValue(new Error("TMDB down"));

    const { Wrapper } = createQueryWrapper();
    render(<LibrarySearchPicker />, { wrapper: Wrapper });

    expect(
      screen.getByText(/Type a title to search your library and TMDB/i),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Library and TMDB search"),
      "Nobody",
    );

    await waitFor(() => {
      expect(
        screen.getByText(/TMDB search failed\. Showing library results only/i),
      ).toBeInTheDocument();
    });
  });
});
