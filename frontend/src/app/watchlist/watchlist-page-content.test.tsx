import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchlistPageContent } from "@/app/watchlist/watchlist-page-content";

const mockReplace = vi.fn();
const mockUseFilms = vi.fn();
const mockUseFilmStatusTransition = vi.fn();
let searchParams = new URLSearchParams("tab=watched&search=matrix");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: (...args: unknown[]) => mockReplace(...args) }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/hooks/use-films", () => ({
  useFilms: (...args: unknown[]) => mockUseFilms(...args),
  useFilmStatusTransition: () => mockUseFilmStatusTransition(),
}));

vi.mock("@/components/watchlist-poster-grid", () => ({
  WatchlistPosterGrid: () => <div data-testid="watchlist-poster-grid" />,
}));

vi.mock("@/components/watchlist-filter-sheet", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/watchlist-filter-sheet")
  >("@/components/watchlist-filter-sheet");
  return {
    ...actual,
    WatchlistFilterSheet: ({
      open,
      onApply,
      onClear,
      values,
    }: {
      open: boolean;
      onApply: (values: typeof actual.DEFAULT_WATCHLIST_FILTERS) => void;
      onClear: () => void;
      values: typeof actual.DEFAULT_WATCHLIST_FILTERS;
    }) =>
      open ? (
        <div data-testid="watchlist-filter-sheet">
          <button
            type="button"
            onClick={() =>
              onApply({
                ...values,
                search: "applied-search",
                enrichmentStatus: "ready",
                year: "1973",
                sort: "title",
                sortDir: "asc",
              })
            }
          >
            Apply
          </button>
          <button type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      ) : null,
  };
});

function mockEmptyFilms() {
  mockUseFilms.mockImplementation(
    (params?: { status?: string; on_watchlist?: boolean }) => {
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
      if (params?.status === "archived") {
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
    },
  );
}

describe("WatchlistPageContent", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    searchParams = new URLSearchParams("tab=watched&search=matrix");
    mockUseFilmStatusTransition.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it("maps watched tab URL param to status=watched query", () => {
    mockEmptyFilms();
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
    expect(screen.queryByTestId("watchlist-table")).not.toBeInTheDocument();
  });

  it("maps archived tab to status=archived and active to on_watchlist", () => {
    searchParams = new URLSearchParams("tab=archived");
    mockEmptyFilms();
    render(<WatchlistPageContent />);

    const archivedCall = mockUseFilms.mock.calls.find(
      ([params]) => params?.status === "archived",
    );
    expect(archivedCall?.[0]).toMatchObject({ status: "archived" });
    expect(screen.getByText(/No archived films/i)).toBeInTheDocument();

    searchParams = new URLSearchParams("");
    mockUseFilms.mockClear();
    mockEmptyFilms();
    render(<WatchlistPageContent />);
    const activeCall = mockUseFilms.mock.calls.find(
      ([params]) => params?.on_watchlist === true && params?.limit === 20,
    );
    expect(activeCall).toBeDefined();
  });

  it("opens filter sheet and Apply updates router params", async () => {
    const user = userEvent.setup();
    mockEmptyFilms();
    render(<WatchlistPageContent />);

    const filterButton = screen.getByRole("button", { name: /Filter and sort/i });
    expect(filterButton.className).toMatch(/min-h-\[44px]/);
    await user.click(filterButton);
    expect(screen.getByTestId("watchlist-filter-sheet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Apply$/i }));
    expect(mockReplace).toHaveBeenCalled();
    const url = String(mockReplace.mock.calls.at(-1)?.[0] ?? "");
    expect(url).toContain("search=applied-search");
    expect(url).toContain("enrichment_status=ready");
    expect(url).toContain("year=1973");
    expect(url).toContain("sort=title");
    expect(url).toContain("sort_dir=asc");
  });

  it("Clear resets filters via router", async () => {
    const user = userEvent.setup();
    mockEmptyFilms();
    render(<WatchlistPageContent />);

    await user.click(screen.getByRole("button", { name: /Filter and sort/i }));
    await user.click(screen.getByRole("button", { name: /^Clear$/i }));

    expect(mockReplace).toHaveBeenCalled();
    const url = String(mockReplace.mock.calls.at(-1)?.[0] ?? "");
    expect(url).not.toContain("search=matrix");
    expect(url).toContain("sort=created_at");
    expect(url).toContain("sort_dir=desc");
  });

  it("renders poster grid when films are present", () => {
    searchParams = new URLSearchParams("");
    mockUseFilms.mockImplementation((params?: { limit?: number }) => {
      if (params?.limit === 20) {
        return {
          data: {
            data: [
              {
                id: "film-1",
                title: "Test Film",
                status: "active",
              },
            ],
            pagination: { total: 1, limit: 20, offset: 0, has_more: false },
          },
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      }
      return {
        data: {
          data: [],
          pagination: { total: 1, limit: 1, offset: 0, has_more: false },
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    render(<WatchlistPageContent />);
    expect(screen.getByTestId("watchlist-poster-grid")).toBeInTheDocument();
    expect(screen.queryByText("Enrichment")).not.toBeInTheDocument();
  });
});
