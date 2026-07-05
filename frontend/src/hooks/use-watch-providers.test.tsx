import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query-wrapper";
import {
  useFilmWatchProviders,
  useFilmsWatchProviders,
} from "@/hooks/use-watch-providers";

const { getFilmWatchProvidersMock } = vi.hoisted(() => ({
  getFilmWatchProvidersMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  getFilmWatchProviders: getFilmWatchProvidersMock,
}));

const watchProvidersResponse = {
  film_id: "film-1",
  tmdb_id: 603,
  country_code: "GB",
  link: "https://www.themoviedb.org/movie/603/watch?locale=GB",
  categories: [
    {
      type: "flatrate" as const,
      label: "Stream" as const,
      providers: [
        {
          provider_id: 8,
          provider_name: "Netflix",
          logo_url: "https://image.tmdb.org/t/p/w92/netflix.jpg",
          display_priority: 1,
        },
      ],
    },
  ],
};

describe("useFilmWatchProviders", () => {
  it("fetches when enabled and disables when filmId is empty", async () => {
    getFilmWatchProvidersMock.mockResolvedValue(watchProvidersResponse);

    const { Wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(
      ({ filmId }: { filmId: string }) => useFilmWatchProviders(filmId),
      {
        wrapper: Wrapper,
        initialProps: { filmId: "" },
      },
    );

    expect(getFilmWatchProvidersMock).not.toHaveBeenCalled();

    rerender({ filmId: "film-1" });

    await waitFor(() => {
      expect(result.current.data?.tmdb_id).toBe(603);
    });

    expect(getFilmWatchProvidersMock).toHaveBeenCalledWith("film-1");
  });
});

describe("useFilmsWatchProviders", () => {
  it("fires parallel queries for up to five film ids", async () => {
    getFilmWatchProvidersMock.mockClear();
    getFilmWatchProvidersMock.mockImplementation((filmId: string) =>
      Promise.resolve({ ...watchProvidersResponse, film_id: filmId }),
    );

    const filmIds = ["a", "b", "c", "d", "e", "f"];
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useFilmsWatchProviders(filmIds), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.get("a")?.data?.film_id).toBe("a");
      expect(result.current.get("e")?.data?.film_id).toBe("e");
    });

    expect(getFilmWatchProvidersMock).toHaveBeenCalledTimes(5);
    expect(result.current.has("f")).toBe(false);
  });
});
