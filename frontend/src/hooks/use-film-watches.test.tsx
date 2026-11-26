import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useCreateFilmWatch,
  useDeleteFilmWatch,
  useUpdateFilmWatch,
} from "@/hooks/use-films";
import { createQueryWrapper } from "@/test/query-wrapper";

const { createFilmWatchMock, updateFilmWatchMock, deleteFilmWatchMock } = vi.hoisted(
  () => ({
    createFilmWatchMock: vi.fn(),
    updateFilmWatchMock: vi.fn(),
    deleteFilmWatchMock: vi.fn(),
  }),
);

vi.mock("@/lib/api-client", () => ({
  createFilmWatch: createFilmWatchMock,
  updateFilmWatch: updateFilmWatchMock,
  deleteFilmWatch: deleteFilmWatchMock,
}));

describe("film watch mutations", () => {
  it("creates a watch from a score-only star tap", async () => {
    createFilmWatchMock.mockResolvedValue({ id: "film-1", watches: [] });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCreateFilmWatch(), { wrapper: Wrapper });

    await result.current.mutateAsync({
      filmId: "film-1",
      body: { score: 4 },
    });

    expect(createFilmWatchMock).toHaveBeenCalledWith("film-1", { score: 4 });
  });

  it("patches only the fields the caller sends, including a cleared date", async () => {
    updateFilmWatchMock.mockResolvedValue({ id: "watch-1" });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useUpdateFilmWatch(), { wrapper: Wrapper });

    await result.current.mutateAsync({
      filmId: "film-1",
      watchId: "watch-1",
      body: { notes: "late" },
    });
    await result.current.mutateAsync({
      filmId: "film-1",
      watchId: "watch-1",
      body: { watched_at: null },
    });

    expect(updateFilmWatchMock).toHaveBeenNthCalledWith(1, "film-1", "watch-1", {
      notes: "late",
    });
    expect(updateFilmWatchMock).toHaveBeenNthCalledWith(2, "film-1", "watch-1", {
      watched_at: null,
    });
  });

  it("deletes a watch by film and watch id", async () => {
    deleteFilmWatchMock.mockResolvedValue(undefined);
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDeleteFilmWatch(), { wrapper: Wrapper });

    await result.current.mutateAsync({ filmId: "film-1", watchId: "watch-1" });

    await waitFor(() => {
      expect(deleteFilmWatchMock).toHaveBeenCalledWith("film-1", "watch-1");
    });
  });
});
