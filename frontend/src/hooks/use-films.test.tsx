import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query-wrapper";
import {
  useHasWatchlist,
  useReviewRequired,
  useWatchlistCount,
  useWatchlistGenres,
} from "@/hooks/use-films";

const { getFilmsMock, getFilmGenresMock, getReviewRequiredMock } = vi.hoisted(() => ({
  getFilmsMock: vi.fn(),
  getFilmGenresMock: vi.fn(),
  getReviewRequiredMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  getFilms: getFilmsMock,
  getFilmGenres: getFilmGenresMock,
  getReviewRequired: getReviewRequiredMock,
}));

describe("useHasWatchlist", () => {
  it("counts any film status for returning-user home state", async () => {
    getFilmsMock.mockResolvedValue({
      data: [],
      pagination: { total: 3, limit: 1, offset: 0, has_more: true },
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useHasWatchlist(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toBe(true);
    });

    expect(getFilmsMock).toHaveBeenCalledWith({ limit: 1 });
    expect(getFilmsMock.mock.calls[0][0]).not.toHaveProperty("status");
  });
});

describe("useReviewRequired", () => {
  it("respects enabled=false to defer review fetch until import completes", () => {
    getReviewRequiredMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 1, offset: 0, has_more: false },
    });

    const { Wrapper } = createQueryWrapper();
    renderHook(() => useReviewRequired({ limit: 1 }, { enabled: false }), {
      wrapper: Wrapper,
    });

    expect(getReviewRequiredMock).not.toHaveBeenCalled();
  });
});

describe("useWatchlistGenres", () => {
  it("loads distinct watchlist genres for the filter chips", async () => {
    getFilmGenresMock.mockResolvedValue({ data: ["Drama", "Horror"] });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useWatchlistGenres(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data?.data).toEqual(["Drama", "Horror"]);
    });

    expect(getFilmGenresMock).toHaveBeenCalledOnce();
  });
});

describe("useWatchlistCount", () => {
  it("returns on_watchlist total from pagination", async () => {
    getFilmsMock.mockResolvedValue({
      data: [],
      pagination: { total: 12, limit: 1, offset: 0, has_more: true },
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useWatchlistCount(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toBe(12);
    });

    expect(getFilmsMock).toHaveBeenCalledWith({ on_watchlist: true, limit: 1 });
  });
});
