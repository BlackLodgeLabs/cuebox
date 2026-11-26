import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query-wrapper";
import { useFilmTrailer, useSimilarFilms, useTmdbFilm } from "@/hooks/use-films";

const { getSimilarFilmsMock, getFilmTrailerMock, getTmdbFilmMock } = vi.hoisted(() => ({
  getSimilarFilmsMock: vi.fn(),
  getFilmTrailerMock: vi.fn(),
  getTmdbFilmMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  getSimilarFilms: getSimilarFilmsMock,
  getFilmTrailer: getFilmTrailerMock,
  getTmdbFilm: getTmdbFilmMock,
}));

describe("useSimilarFilms", () => {
  it("loads close-to-this films for a film id and skips an empty id", async () => {
    getSimilarFilmsMock.mockResolvedValue([
      { id: "near", title: "Near Film", semantic_line: "A rain-soaked noir." },
    ]);

    const { Wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(
      ({ filmId }: { filmId: string }) => useSimilarFilms(filmId),
      { wrapper: Wrapper, initialProps: { filmId: "" } },
    );

    expect(getSimilarFilmsMock).not.toHaveBeenCalled();

    rerender({ filmId: "film-1" });

    await waitFor(() => {
      expect(result.current.data?.[0]?.semantic_line).toBe("A rain-soaked noir.");
    });
    expect(getSimilarFilmsMock).toHaveBeenCalledWith("film-1", { limit: 6 });
  });
});

describe("useFilmTrailer", () => {
  it("loads a trailer when enabled and skips an empty film id", async () => {
    getFilmTrailerMock.mockResolvedValue({
      url: "https://www.youtube.com/watch?v=official-trailer",
      name: "Official Trailer",
      site: "YouTube",
    });

    const { Wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(
      ({ filmId }: { filmId: string }) => useFilmTrailer(filmId),
      { wrapper: Wrapper, initialProps: { filmId: "" } },
    );

    expect(getFilmTrailerMock).not.toHaveBeenCalled();

    rerender({ filmId: "film-1" });

    await waitFor(() => {
      expect(result.current.data?.url).toBe(
        "https://www.youtube.com/watch?v=official-trailer",
      );
    });
    expect(getFilmTrailerMock).toHaveBeenCalledWith("film-1");
  });
});

describe("useTmdbFilm", () => {
  it("loads a TMDB film page and skips a missing id", async () => {
    getTmdbFilmMock.mockResolvedValue({
      tmdb_id: 603,
      title: "The Matrix",
      film_id: null,
      status: null,
    });

    const { Wrapper } = createQueryWrapper();
    const initialProps: { tmdbId: number | null } = { tmdbId: null };
    const { result, rerender } = renderHook(
      ({ tmdbId }: { tmdbId: number | null }) => useTmdbFilm(tmdbId),
      { wrapper: Wrapper, initialProps },
    );

    expect(getTmdbFilmMock).not.toHaveBeenCalled();

    rerender({ tmdbId: 603 });

    await waitFor(() => {
      expect(result.current.data?.title).toBe("The Matrix");
    });
    expect(getTmdbFilmMock).toHaveBeenCalledWith(603);
  });
});
