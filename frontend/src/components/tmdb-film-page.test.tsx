import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TmdbFilmPage } from "@/components/tmdb-film-page";
import { Toaster } from "@/components/ui/sonner";
import { createQueryWrapper } from "@/test/query-wrapper";
import type { TmdbFilm } from "@/types/api";

const { getTmdbFilmMock, addToWatchlistMock, backMock, replaceMock } = vi.hoisted(() => ({
  getTmdbFilmMock: vi.fn(),
  addToWatchlistMock: vi.fn(),
  backMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: backMock }),
  usePathname: () => "/films/tmdb/603",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client",
  );
  return {
    ...actual,
    getTmdbFilm: getTmdbFilmMock,
    addToWatchlist: addToWatchlistMock,
  };
});

const thirdMan: TmdbFilm = {
  tmdb_id: 603,
  title: "The Third Man",
  year: 1949,
  overview:
    "A pulp writer arrives in postwar Vienna to find his old friend dead.",
  backdrop_url: "https://image.tmdb.org/t/p/w1280/third.jpg",
  poster_url: null,
  genres: ["Thriller", "Mystery"],
  runtime: 104,
  director: "Carol Reed",
  tmdb_rating: 8.1,
  trailer_url: "https://www.youtube.com/watch?v=trailer",
  film_id: null,
  status: null,
};

function renderPage() {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <Toaster />
      <TmdbFilmPage tmdbId="603" />
    </Wrapper>,
  );
}

describe("TmdbFilmPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the lighter page with a TMDB percent, synopsis, and trailer", async () => {
    getTmdbFilmMock.mockResolvedValue(thirdMan);
    renderPage();

    expect(await screen.findByRole("heading", { name: "The Third Man" })).toBeInTheDocument();
    expect(
      screen.getByText("1949 · Thriller · 104m · Carol Reed"),
    ).toBeInTheDocument();
    expect(screen.getByText("81%")).toBeInTheDocument();
    expect(screen.getByText("TMDB")).toBeInTheDocument();
    expect(screen.queryByText("RT")).not.toBeInTheDocument();
    expect(screen.queryByText("LB")).not.toBeInTheDocument();
    expect(screen.getByText(/pulp writer arrives/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Synopsis" })).toBeInTheDocument();

    const trailer = screen.getByRole("link", { name: "Trailer" });
    expect(trailer).toHaveAttribute("href", "https://www.youtube.com/watch?v=trailer");
    expect(trailer).toHaveAttribute("target", "_blank");

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
    expect(screen.queryByText(/close to this/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/taste/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(backMock).toHaveBeenCalled();
  });

  it("hides the trailer when TMDB has none", async () => {
    getTmdbFilmMock.mockResolvedValue({ ...thirdMan, trailer_url: null });
    renderPage();

    await screen.findByRole("heading", { name: "The Third Man" });
    expect(screen.queryByRole("link", { name: "Trailer" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to watchlist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("adds the film and shows Added to watchlist", async () => {
    getTmdbFilmMock.mockResolvedValue(thirdMan);
    addToWatchlistMock.mockResolvedValue({
      film_id: "film-third",
      enrichment_status: "enriching",
    });
    renderPage();

    await screen.findByRole("button", { name: "Add to watchlist" });
    await userEvent.click(screen.getByRole("button", { name: "Add to watchlist" }));

    expect(await screen.findByText("Added to watchlist")).toBeInTheDocument();
    expect(addToWatchlistMock.mock.calls[0]?.[0]).toEqual({ tmdb_id: 603 });
    const toaster = document.querySelector("[data-sonner-toaster]");
    expect(toaster?.textContent).toContain("The Third Man");
    expect(toaster?.getAttribute("style") ?? "").toContain("--cb-toast-stay: 2800ms");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("opens More with a link to TMDB", async () => {
    getTmdbFilmMock.mockResolvedValue({ ...thirdMan, trailer_url: null });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "More" }));
    const link = await screen.findByRole("link", { name: "View on TMDB" });
    expect(link).toHaveAttribute("href", "https://www.themoviedb.org/movie/603");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("sends a film already on the watchlist to its detail page", async () => {
    getTmdbFilmMock.mockResolvedValue({
      ...thirdMan,
      film_id: "film-third",
      status: "active",
    });
    renderPage();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/watchlist/film-third");
    });
    expect(screen.queryByRole("button", { name: "Add to watchlist" })).not.toBeInTheDocument();
  });

  it("shows an error when the film cannot be loaded", async () => {
    getTmdbFilmMock.mockRejectedValue(new Error("down"));
    renderPage();

    expect(await screen.findByText("Could not load this film.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to watchlist" })).not.toBeInTheDocument();
  });
});
