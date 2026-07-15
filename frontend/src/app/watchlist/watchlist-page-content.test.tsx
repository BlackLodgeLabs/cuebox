import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WatchlistPageContent } from "@/app/watchlist/watchlist-page-content";

const mockUseFilms = vi.fn();
const mockUseFilmStatusTransition = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=watched&search=matrix"),
}));

vi.mock("@/hooks/use-films", () => ({
  useFilms: (...args: unknown[]) => mockUseFilms(...args),
  useFilmStatusTransition: () => mockUseFilmStatusTransition(),
}));

vi.mock("@/components/watchlist-table", () => ({
  WatchlistTable: () => <div data-testid="watchlist-table" />,
}));

describe("WatchlistPageContent", () => {
  it("maps watched tab URL param to status=watched query", () => {
    mockUseFilmStatusTransition.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseFilms.mockImplementation((params?: { status?: string; on_watchlist?: boolean }) => {
      if (params?.status === "watched") {
        return {
          data: {
            data: [],
            pagination: { total: 0, limit: 20, offset: 0, has_more: false },
          },
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      }
      return {
        data: {
          data: [],
          pagination: { total: 0, limit: 1, offset: 0, has_more: false },
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    render(<WatchlistPageContent />);

    const watchedCall = mockUseFilms.mock.calls.find(
      ([params]) => params?.status === "watched",
    );
    expect(watchedCall).toBeDefined();
    expect(watchedCall?.[0]).toMatchObject({
      status: "watched",
      search: "matrix",
      limit: 20,
    });
    expect(screen.getByText(/No watched films yet/i)).toBeInTheDocument();
  });
});
