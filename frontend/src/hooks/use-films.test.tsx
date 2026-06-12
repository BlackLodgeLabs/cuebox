import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query-wrapper";
import { useHasWatchlist, useReviewRequired } from "@/hooks/use-films";

const { getFilmsMock, getReviewRequiredMock } = vi.hoisted(() => ({
  getFilmsMock: vi.fn(),
  getReviewRequiredMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  getFilms: getFilmsMock,
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
